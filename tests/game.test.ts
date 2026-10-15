import { NullEngine, Vector3 } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { config, type CameraMode } from '../src/config';
import { GameRound } from '../src/scenes/game';
import type { RoundResult } from '../src/systems/session';
import { InputState } from '../src/systems/input';
import { DIR_YAW } from '../src/world/buildMall';
import { cellAtWorld, cellCenter, getCell, isWalkable, OPPOSITE } from '../src/world/mallLayout';

let engine: NullEngine;
let round: GameRound;
let results: RoundResult[];
let input: InputState;
let sounds: string[];

function setup(seed = 1234, mode: CameraMode = 'first') {
  engine = new NullEngine();
  input = new InputState();
  results = [];
  sounds = [];
  round = new GameRound(engine, seed, input, { onEnd: (r) => results.push(r), onSound: (e) => sounds.push(e) }, mode);
  return round;
}

function run(seconds: number, step = 1 / 30) {
  for (let t = 0; t < seconds; t += step) round.tick(step);
}

afterEach(() => {
  round?.dispose();
  engine?.dispose();
});

describe('3D mall', () => {
  it('builds a collider for every solid cell plus the outer walls', () => {
    setup();
    const solidCells = round.layout.cells.flat().filter((t) => t === 'shop' || t === 'wall').length;
    expect(round.mall.colliders.length).toBeGreaterThanOrEqual(solidCells + 4);
    expect(round.mall.colliders.every((m) => m.checkCollisions)).toBe(true);
    expect(round.scene.getMeshByName('toilet-door')).not.toBeNull();
    expect(round.scene.getMeshByName('fountain-basin')).not.toBeNull();
  });

  it('places the player at the spawn cell facing into the mall', () => {
    setup();
    const c = cellCenter(round.layout, round.layout.spawn.x, round.layout.spawn.y);
    expect(round.player.position.x).toBeCloseTo(c.x);
    expect(round.player.position.z).toBeCloseTo(c.z);
    expect(round.player.yaw).toBeCloseTo(DIR_YAW[round.layout.spawn.facing]);
  });
});

describe('first-person camera (default)', () => {
  it('is the default mode', () => {
    expect(config.camera.mode).toBe('first');
  });

  it('puts the camera at eye height on the player and hides the character', () => {
    setup();
    input.keyDown('KeyW');
    run(0.5);
    const cam = round.player.camera.position;
    expect(cam.x).toBeCloseTo(round.player.position.x);
    expect(cam.z).toBeCloseTo(round.player.position.z);
    expect(cam.y).toBeCloseTo(config.player.eyeHeight);
    expect(round.player.model.isEnabled()).toBe(false);
  });
});

describe('third-person camera', () => {
  it('shows a visible character and keeps the camera behind and above it', () => {
    setup(1234, 'third');
    run(0.1);
    const model = round.player.model.getChildMeshes();
    expect(model.length).toBeGreaterThan(5);
    expect(model.every((m) => m.isVisible)).toBe(true);
    const cam = round.player.camera.position;
    const p = round.player.position;
    expect(cam.y).toBeGreaterThan(config.player.eyeHeight);
    // The camera is behind the player relative to where it looks.
    const yaw = round.player.yaw;
    const ahead = (p.x - cam.x) * Math.sin(yaw) + (p.z - cam.z) * Math.cos(yaw);
    expect(ahead).toBeGreaterThan(1);
  });

  it('pulls in instead of going through a wall behind the player', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      setup(seed, 'third');
      // Face away from the entrance, so the mall's outer wall is right behind.
      round.player.camera.rotation.set(0, DIR_YAW[OPPOSITE[round.layout.spawn.entrance]], 0);
      run(0.1);
      expect(round.player.cameraDistance).toBeLessThan(config.camera.distance);
      const cam = round.player.camera.position;
      expect(round.mall.collision.overlaps({ x: cam.x, z: cam.z }, 0.1)).toBe(false);
      round.dispose();
      engine.dispose();
    }
  });

  it('never puts the camera inside a wall while wandering', () => {
    setup(42, 'third');
    let r = 42;
    const rand = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 300; i++) {
      input.clear();
      for (const k of ['KeyW', 'KeyA', 'KeyD']) if (rand() < 0.5) input.keyDown(k);
      round.player.camera.rotation.y = rand() * Math.PI * 2;
      round.player.camera.rotation.x = rand() * 2 - 0.5;
      run(0.1);
      const cam = round.player.camera.position;
      expect(round.mall.collision.overlaps({ x: cam.x, z: cam.z }, 0.05)).toBe(false);
      expect(round.player.camera.rotation.x).toBeLessThanOrEqual(config.camera.maxPitch);
      expect(round.player.camera.rotation.x).toBeGreaterThanOrEqual(config.camera.minPitch);
      expect(cam.y).toBeLessThan(config.mall.wallHeight);
    }
  });

  it('turns the character to face the way it walks', () => {
    setup(1234, 'third');
    const yaw = round.player.yaw;
    input.keyDown('KeyD'); // strafe right
    run(1);
    const facing = round.player.model.rotation.y;
    const diff = Math.atan2(Math.sin(facing - (yaw + Math.PI / 2)), Math.cos(facing - (yaw + Math.PI / 2)));
    expect(Math.abs(diff)).toBeLessThan(0.05);
  });
});

describe('player movement', () => {
  it('walks forward with W', () => {
    setup();
    const start = round.player.position.clone();
    input.keyDown('KeyW');
    run(0.5);
    expect(Vector3.Distance(start, round.player.position)).toBeGreaterThan(1.5);
  });

  it('cannot walk through the outer wall', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      setup(seed);
      // Turn around to face the entrance wall behind the spawn point, then walk into it.
      round.player.camera.rotation.y = DIR_YAW[OPPOSITE[round.layout.spawn.facing]];
      input.keyDown('KeyW');
      input.keyDown('ShiftLeft');
      run(5);
      const half = (round.layout.size * round.layout.cellSize) / 2;
      expect(Math.abs(round.player.position.x)).toBeLessThan(half);
      expect(Math.abs(round.player.position.z)).toBeLessThan(half);
      round.dispose();
      engine.dispose();
    }
  });

  it('cannot walk through shops', () => {
    setup(77);
    const shop = round.layout.shops[0];
    const front = cellCenter(round.layout, shop.x, shop.y);
    // Stand in the corridor in front of the shop and walk straight at it.
    const from = { x: shop.x, y: shop.y };
    const dir = shop.front;
    const corridor = cellCenter(round.layout, from.x + (dir === 'E' ? 1 : dir === 'W' ? -1 : 0), from.y + (dir === 'N' ? 1 : dir === 'S' ? -1 : 0));
    round.player.body.position.set(corridor.x, config.player.eyeHeight / 2, corridor.z);
    round.player.camera.rotation.y = DIR_YAW[OPPOSITE[dir]];
    input.keyDown('KeyW');
    run(4);
    const cell = cellAtWorld(round.layout, round.player.position.x, round.player.position.z);
    expect(cell).not.toEqual({ x: shop.x, y: shop.y });
    expect(Math.hypot(round.player.position.x - front.x, round.player.position.z - front.z)).toBeGreaterThan(round.layout.cellSize / 2);
  });

  it('never ends up inside a wall or outside the walkable floor while wandering randomly', () => {
    for (const seed of [11, 22, 33]) {
      setup(seed);
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
      let r = seed;
      const rand = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
      for (let i = 0; i < 400; i++) {
        input.clear();
        for (const k of keys) if (rand() < 0.4) input.keyDown(k);
        round.player.camera.rotation.y = rand() * Math.PI * 2;
        run(0.1);
        const p = round.player.position;
        expect(round.mall.collision.overlaps(p, config.player.radius - 0.01)).toBe(false);
        const cell = cellAtWorld(round.layout, p.x, p.z)!;
        expect(isWalkable(getCell(round.layout, cell.x, cell.y))).toBe(true);
      }
      round.dispose();
      engine.dispose();
    }
  });

  it('sprints faster than walking', () => {
    setup();
    const start = round.player.position.clone();
    input.keyDown('KeyW');
    run(0.5);
    const walked = Vector3.Distance(start, round.player.position);
    round.dispose();
    engine.dispose();
    setup();
    input.keyDown('KeyW');
    input.keyDown('ShiftLeft');
    run(0.5);
    expect(Vector3.Distance(start, round.player.position)).toBeGreaterThan(walked * 1.5);
  });

  it('stands still and pauses urgency while clenching', () => {
    setup();
    const start = round.player.position.clone();
    input.keyDown('KeyW');
    input.keyDown('Space');
    run(2);
    expect(Vector3.Distance(start, round.player.position)).toBeCloseTo(0);
    expect(round.session.meter.urgency).toBeCloseTo(config.urgency.start);
    expect(round.session.meter.stamina).toBeLessThan(config.clench.max);
  });
});

describe('sounds', () => {
  it('plays footsteps while walking but not while standing or clenching', () => {
    setup();
    run(1);
    expect(sounds).not.toContain('footstep');
    input.keyDown('KeyW');
    run(1);
    expect(sounds.filter((e) => e === 'footstep').length).toBeGreaterThanOrEqual(2);
    sounds.length = 0;
    input.keyDown('Space');
    run(1);
    expect(sounds).not.toContain('footstep');
  });

  it('plays rumbles and a heartbeat when desperate', () => {
    setup();
    round.session.meter.urgency = 92;
    run(13.5, 0.1); // rumbles come at random 5–13 s gaps
    expect(sounds).toContain('heartbeat');
    expect(sounds).toContain('rumble');
  });

  it('plays a "nope" when E is pressed away from a toilet, and stops sounds after the round', () => {
    setup();
    input.keyDown('KeyE');
    run(0.1);
    expect(sounds).toEqual(['nope']);
    round.session.interact(0);
    sounds.length = 0;
    input.keyDown('KeyW');
    run(1);
    expect(sounds).toEqual([]);
  });
});

describe('a full round', () => {
  it('is won by pressing E at the toilet door', () => {
    setup();
    const door = round.mall.toiletDoor;
    round.player.body.position.set(door.x, config.player.eyeHeight / 2, door.z);
    run(0.2);
    expect(round.nearToilet).toBe(true);
    input.keyDown('KeyE');
    run(0.1);
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe('won');
    expect(results[0].stars).toBe(3);
  });

  it('pressing E away from the toilet does nothing', () => {
    setup();
    input.keyDown('KeyE');
    run(0.1);
    expect(round.nearToilet).toBe(false);
    expect(results).toHaveLength(0);
    expect(round.session.status).toBe('playing');
  });

  it('is lost when urgency hits 100%', () => {
    setup();
    run(161, 0.1);
    expect(results).toEqual([{ outcome: 'lost', seconds: expect.any(Number), stars: 0 }]);
    run(1, 0.1);
    expect(results).toHaveLength(1); // onEnd fires only once
  });

  it('rises faster in the food court', () => {
    setup();
    const cell = round.layout.cells.flatMap((row, y) => row.map((t, x) => ({ t, x, y }))).find((c) => c.t === 'foodcourt')!;
    const c = cellCenter(round.layout, cell.x, cell.y);
    // Stand in a corner of the food court cell, clear of the tables.
    round.player.body.position.set(c.x + 2, config.player.eyeHeight / 2, c.z + 2);
    expect(round.inFoodCourt).toBe(true);
    run(10, 0.1);
    expect(round.session.meter.urgency).toBeCloseTo(config.urgency.start + 10, 0);
  });

  it('wobbles the camera above 75% urgency', () => {
    setup();
    round.session.meter.urgency = 95;
    let maxRoll = 0;
    for (let i = 0; i < 30; i++) {
      round.tick(0.05);
      maxRoll = Math.max(maxRoll, Math.abs(round.player.camera.rotation.z));
    }
    expect(maxRoll).toBeGreaterThan(0.01);
  });
});
