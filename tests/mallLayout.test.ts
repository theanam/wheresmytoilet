import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import {
  ALL_DIRS,
  cellAtWorld,
  cellCenter,
  cellDistance,
  generateMall,
  getCell,
  isWalkable,
  neighbor,
  reachableCount,
  walkableNeighbors,
  type MallLayout,
} from '../src/world/mallLayout';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

function cellsOf(layout: MallLayout, type: string) {
  const out: { x: number; y: number }[] = [];
  layout.cells.forEach((row, y) => row.forEach((t, x) => t === type && out.push({ x, y })));
  return out;
}

function walkableCount(layout: MallLayout) {
  return layout.cells.flat().filter(isWalkable).length;
}

describe('mall layout generator', () => {
  it('is a 10×10 grid of 8 m cells', () => {
    const m = generateMall(1);
    expect(m.size).toBe(10);
    expect(m.cellSize).toBe(8);
    expect(m.cells).toHaveLength(10);
    m.cells.forEach((row) => expect(row).toHaveLength(10));
  });

  it('gives the same layout for the same seed and different layouts for different seeds', () => {
    expect(generateMall(123)).toEqual(generateMall(123));
    expect(generateMall(123).cells).not.toEqual(generateMall(124).cells);
  });

  it.each(SEEDS)('seed %i: every walkable cell is reachable from spawn', (seed) => {
    const m = generateMall(seed);
    expect(reachableCount(m, m.spawn)).toBe(walkableCount(m));
  });

  it('has loops, not just a pure maze', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const m = generateMall(seed);
      let edges = 0;
      m.cells.forEach((row, y) =>
        row.forEach((t, x) => {
          if (!isWalkable(t)) return;
          if (isWalkable(getCell(m, x + 1, y))) edges++;
          if (isWalkable(getCell(m, x, y + 1))) edges++;
        }),
      );
      // A tree has exactly (nodes - 1) edges; loops add more.
      expect(edges).toBeGreaterThan(walkableCount(m) - 1);
    }
  });

  it('has a fountain in the centre, a food court, kiosks, an escalator and shops', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const m = generateMall(seed);
      expect(cellsOf(m, 'fountain')).toEqual([
        { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 },
      ]);
      expect(cellsOf(m, 'foodcourt')).toHaveLength(4);
      expect(cellsOf(m, 'escalator')).toHaveLength(1);
      expect(cellsOf(m, 'kiosk').length).toBeLessThanOrEqual(config.mall.kioskCount);
      expect(m.shops.length).toBeGreaterThan(10);
    }
  });

  it('gives every shop a front that faces a walkable cell and a made-up name', () => {
    const m = generateMall(99);
    for (const shop of m.shops) {
      expect(getCell(m, shop.x, shop.y)).toBe('shop');
      const front = neighbor(shop, shop.front);
      expect(isWalkable(getCell(m, front.x, front.y))).toBe(true);
      expect(shop.name.length).toBeGreaterThan(0);
    }
  });

  it.each(SEEDS)('seed %i: spawns at an entrance on the outer wall, facing an open corridor', (seed) => {
    const m = generateMall(seed);
    expect(getCell(m, m.spawn.x, m.spawn.y)).toBe('corridor');
    // The entrance side is the outer wall of the mall.
    const outside = neighbor(m.spawn, m.spawn.entrance);
    expect(getCell(m, outside.x, outside.y)).toBeUndefined();
    const ahead = neighbor(m.spawn, m.spawn.facing);
    expect(isWalkable(getCell(m, ahead.x, ahead.y))).toBe(true);
  });

  it.each(SEEDS)('seed %i: toilet is at a dead end or corridor edge, ≥30 m from spawn, on a solid wall', (seed) => {
    const m = generateMall(seed);
    const { toilet } = m;
    expect(getCell(m, toilet.x, toilet.y)).toBe('corridor');
    expect(cellDistance(m, toilet, m.spawn)).toBeGreaterThanOrEqual(config.toilets.minDistanceFromSpawn);
    expect(walkableNeighbors(m, toilet).length).toBeLessThan(4);
    const wall = neighbor(toilet, toilet.side);
    expect(isWalkable(getCell(m, wall.x, wall.y))).toBe(false);
  });

  it('never puts a shop front on the wall holding the toilet door', () => {
    for (const seed of SEEDS) {
      const m = generateMall(seed);
      const wall = neighbor(m.toilet, m.toilet.side);
      const shop = m.shops.find((s) => s.x === wall.x && s.y === wall.y);
      if (shop) expect(neighbor(shop, shop.front)).not.toEqual({ x: m.toilet.x, y: m.toilet.y });
    }
  });

  it('uses a dead end for the toilet whenever one is far enough from spawn', () => {
    for (const seed of SEEDS) {
      const m = generateMall(seed);
      const farDeadEnd = m.cells.some((row, y) =>
        row.some((t, x) =>
          t === 'corridor' &&
          walkableNeighbors(m, { x, y }).length === 1 &&
          cellDistance(m, { x, y }, m.spawn) >= config.toilets.minDistanceFromSpawn,
        ),
      );
      if (farDeadEnd) expect(walkableNeighbors(m, m.toilet)).toHaveLength(1);
    }
  });

  it('converts between grid cells and world positions', () => {
    const m = generateMall(5);
    expect(cellCenter(m, 0, 0)).toEqual({ x: -36, z: -36 });
    expect(cellCenter(m, 9, 9)).toEqual({ x: 36, z: 36 });
    expect(cellAtWorld(m, -36, -36)).toEqual({ x: 0, y: 0 });
    expect(cellAtWorld(m, 0.1, 0.1)).toEqual({ x: 5, y: 5 });
    expect(cellAtWorld(m, 41, 0)).toBeNull();
    expect(ALL_DIRS).toHaveLength(4);
  });
});
