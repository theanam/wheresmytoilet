import { describe, expect, it } from 'vitest';
import { InputState, moveVector } from '../src/systems/input';

describe('input state', () => {
  it('tracks held keys and movement axes', () => {
    const i = new InputState();
    i.keyDown('KeyW');
    i.keyDown('KeyD');
    expect(i.axes).toEqual({ forward: 1, strafe: 1 });
    i.keyDown('KeyS');
    expect(i.axes.forward).toBe(0);
    i.keyUp('KeyW');
    expect(i.axes.forward).toBe(-1);
  });

  it('reports sprint and clench', () => {
    const i = new InputState();
    i.keyDown('ShiftRight');
    i.keyDown('Space');
    expect(i.sprinting).toBe(true);
    expect(i.clenching).toBe(true);
    i.clear();
    expect(i.sprinting || i.clenching).toBe(false);
  });

  it('consumes a key press once, and key repeat does not create new presses', () => {
    const i = new InputState();
    i.keyDown('KeyE');
    i.keyDown('KeyE'); // auto-repeat
    expect(i.consumePress('KeyE')).toBe(true);
    expect(i.consumePress('KeyE')).toBe(false);
    i.keyUp('KeyE');
    i.keyDown('KeyE');
    expect(i.consumePress('KeyE')).toBe(true);
  });
});

describe('moveVector', () => {
  it('moves toward +z when facing yaw 0', () => {
    const v = moveVector(1, 0, 0, 2);
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(2);
  });

  it('strafes right toward +x when facing +z', () => {
    const v = moveVector(0, 1, 0, 1);
    expect(v.x).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });

  it('rotates with yaw', () => {
    const v = moveVector(1, 0, Math.PI / 2, 1);
    expect(v.x).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });

  it('does not move faster diagonally', () => {
    const v = moveVector(1, 1, 0.3, 3);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(3);
    expect(moveVector(0, 0, 1, 3)).toEqual({ x: 0, z: 0 });
  });
});
