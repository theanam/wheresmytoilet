/** Keeps track of which keys are held, using layout-independent KeyboardEvent.code values. */
export class InputState {
  private held = new Set<string>();
  private pressed = new Set<string>();

  keyDown(code: string): void {
    if (!this.held.has(code)) this.pressed.add(code);
    this.held.add(code);
  }

  keyUp(code: string): void {
    this.held.delete(code);
  }

  /** Forget everything, e.g. when the window loses focus. */
  clear(): void {
    this.held.clear();
    this.pressed.clear();
  }

  isHeld(code: string): boolean {
    return this.held.has(code);
  }

  /** True once per key press; consumes the press. */
  consumePress(code: string): boolean {
    return this.pressed.delete(code);
  }

  get sprinting(): boolean {
    return this.isHeld('ShiftLeft') || this.isHeld('ShiftRight');
  }

  get clenching(): boolean {
    return this.isHeld('Space');
  }

  /** Movement intent: forward (+1 = W) and strafe (+1 = D), each in [-1, 1]. */
  get axes(): { forward: number; strafe: number } {
    const f = (this.isHeld('KeyW') || this.isHeld('ArrowUp') ? 1 : 0) - (this.isHeld('KeyS') || this.isHeld('ArrowDown') ? 1 : 0);
    const s = (this.isHeld('KeyD') || this.isHeld('ArrowRight') ? 1 : 0) - (this.isHeld('KeyA') || this.isHeld('ArrowLeft') ? 1 : 0);
    return { forward: f, strafe: s };
  }

  attach(target: Window): () => void {
    const down = (e: KeyboardEvent) => {
      this.keyDown(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => this.keyUp(e.code);
    const blur = () => this.clear();
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', blur);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    };
  }
}

/**
 * Converts movement axes and camera yaw (radians, 0 = looking toward +z) into a
 * world-space x/z velocity of the given speed. Diagonal movement is not faster.
 */
export function moveVector(forward: number, strafe: number, yaw: number, speed: number): { x: number; z: number } {
  const len = Math.hypot(forward, strafe);
  if (len === 0) return { x: 0, z: 0 };
  const f = forward / len;
  const s = strafe / len;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: (f * sin + s * cos) * speed,
    z: (f * cos - s * sin) * speed,
  };
}
