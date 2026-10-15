import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/systems/collision';

describe('collision world', () => {
  it('moves freely with no obstacles', () => {
    const w = new CollisionWorld();
    const p = w.move({ x: 0, z: 0 }, { x: 3, z: 4 }, 0.4);
    expect(p.x).toBeCloseTo(3);
    expect(p.z).toBeCloseTo(4);
  });

  it('stops at a box wall', () => {
    const w = new CollisionWorld();
    w.addBox(-10, 10, 5, 6);
    const p = w.move({ x: 0, z: 0 }, { x: 0, z: 10 }, 0.4);
    expect(p.z).toBeCloseTo(4.6);
  });

  it('cannot tunnel through a thin wall in one big step', () => {
    const w = new CollisionWorld();
    w.addBox(-10, 10, 5, 5.1);
    expect(w.move({ x: 0, z: 0 }, { x: 0, z: 50 }, 0.4).z).toBeLessThan(5);
  });

  it('slides along a wall when moving diagonally', () => {
    const w = new CollisionWorld();
    w.addBox(-10, 10, 5, 6);
    const p = w.move({ x: 0, z: 4 }, { x: 3, z: 3 }, 0.4);
    expect(p.x).toBeCloseTo(3);
    expect(p.z).toBeCloseTo(4.6);
  });

  it('stops at a circle', () => {
    const w = new CollisionWorld();
    w.addCircle(0, 5, 1);
    const p = w.move({ x: 0, z: 0 }, { x: 0, z: 10 }, 0.5);
    expect(Math.hypot(p.x, p.z - 5)).toBeCloseTo(1.5);
    expect(p.z).toBeLessThan(5);
  });

  it('pushes a point that starts inside a box out the nearest side', () => {
    const w = new CollisionWorld();
    w.addBox(0, 10, 0, 10);
    const p = w.move({ x: 1, z: 5 }, { x: 0, z: 0 }, 0.5);
    expect(p).toEqual({ x: -0.5, z: 5 });
    expect(w.overlaps(p, 0.49)).toBe(false);
    expect(w.overlaps({ x: 5, z: 5 }, 0.5)).toBe(true);
  });
});

describe('collision raycast', () => {
  it('returns 1 when the path is clear', () => {
    const w = new CollisionWorld();
    w.addBox(10, 11, -1, 1);
    expect(w.raycast({ x: 0, z: 0 }, { x: 0, z: 5 })).toBe(1);
  });

  it('finds the first box along the segment, with padding', () => {
    const w = new CollisionWorld();
    w.addBox(-5, 5, 4, 5);
    w.addBox(-5, 5, 2, 3);
    expect(w.raycast({ x: 0, z: 0 }, { x: 0, z: 10 })).toBeCloseTo(0.2);
    expect(w.raycast({ x: 0, z: 0 }, { x: 0, z: 10 }, 0.5)).toBeCloseTo(0.15);
  });

  it('hits circles', () => {
    const w = new CollisionWorld();
    w.addCircle(0, 5, 1);
    expect(w.raycast({ x: 0, z: 0 }, { x: 0, z: 10 })).toBeCloseTo(0.4);
    expect(w.raycast({ x: 3, z: 0 }, { x: 3, z: 10 })).toBe(1);
    expect(w.raycast({ x: 0, z: 5 }, { x: 0, z: 10 })).toBe(0);
  });
});
