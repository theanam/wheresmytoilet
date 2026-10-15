import { config } from '../config';
import type { InputState } from '../systems/input';
import { h } from './dom';

export interface TouchActions {
  /** Called with the pixels dragged on the look area. */
  onLook(dx: number, dy: number): void;
  onPause(): void;
}

/**
 * Converts a joystick drag (pixels from where the thumb went down) into movement
 * axes. Up is forward. Inside the dead zone it's (0, 0); past the radius it's capped at 1.
 */
export function stickAxes(dx: number, dy: number, radius: number, deadZone: number): { forward: number; strafe: number } {
  const dist = Math.hypot(dx, dy);
  if (dist < deadZone * radius || dist === 0) return { forward: 0, strafe: 0 };
  const scale = Math.min(dist, radius) / dist / radius;
  return { forward: -dy * scale, strafe: dx * scale };
}

/** Pointer-ish event fields we use; real PointerEvents and test events both fit. */
type PointerLike = Event & { pointerId: number; clientX: number; clientY: number };

/**
 * On-screen controls for phones and tablets: a floating joystick on the left,
 * drag anywhere else to look, and USE / HOLD / RUN / pause buttons.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private useBtn: HTMLElement;
  private runBtn: HTMLElement;
  private stick: { id: number; x: number; y: number } | null = null;
  private lookers = new Map<number, { x: number; y: number }>();
  private running = false;

  constructor(parent: HTMLElement, private input: InputState, private actions: TouchActions) {
    this.knob = h('div', { class: 'stick-knob' });
    this.base = h('div', { class: 'stick-base' }, this.knob);
    this.useBtn = h('button', { class: 'tbtn use', type: 'button', 'data-action': 'use', 'aria-label': 'Use toilet' }, 'USE');
    this.runBtn = h('button', { class: 'tbtn run', type: 'button', 'data-action': 'run', 'aria-label': 'Run', 'aria-pressed': 'false' }, 'RUN');
    this.root = h(
      'div',
      { class: 'touch', 'data-testid': 'touch-controls' },
      this.base,
      h('button', { class: 'tbtn pause', type: 'button', 'data-action': 'pause', 'aria-label': 'Pause' }, '❚❚'),
      h(
        'div',
        { class: 'tbtns' },
        this.runBtn,
        h('button', { class: 'tbtn hold', type: 'button', 'data-action': 'hold', 'aria-label': 'Clench' }, 'HOLD'),
        this.useBtn,
      ),
    );
    this.root.addEventListener('pointerdown', (e) => this.down(e as PointerLike));
    this.root.addEventListener('pointermove', (e) => this.move(e as PointerLike));
    for (const type of ['pointerup', 'pointercancel']) this.root.addEventListener(type, (e) => this.up(e as PointerLike));
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    parent.append(this.root);
  }

  /** Highlight USE when the player is close enough to a toilet. */
  setNearToilet(near: boolean): void {
    this.useBtn.classList.toggle('ready', near);
  }

  /** Drop all touches, e.g. when the game pauses. RUN stays as the player left it. */
  reset(): void {
    this.endStick();
    this.lookers.clear();
    this.input.keyUp('Space');
    if (this.running) this.input.keyDown('ShiftLeft');
  }

  remove(): void {
    this.reset();
    this.input.keyUp('ShiftLeft');
    this.root.remove();
  }

  private down(e: PointerLike) {
    e.preventDefault();
    const action = (e.target as HTMLElement | null)?.closest?.('[data-action]')?.getAttribute('data-action');
    if (action) return this.press(action, e.pointerId);
    const width = this.root.clientWidth || window.innerWidth;
    if (!this.stick && e.clientX < width * config.touch.stickZoneWidth) {
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('active');
      this.knob.style.transform = '';
    } else {
      this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  private move(e: PointerLike) {
    if (this.stick && e.pointerId === this.stick.id) {
      const { stickRadius: r, stickDeadZone } = config.touch;
      let dx = e.clientX - this.stick.x;
      let dy = e.clientY - this.stick.y;
      const { forward, strafe } = stickAxes(dx, dy, r, stickDeadZone);
      this.input.setStick(forward, strafe);
      const d = Math.hypot(dx, dy);
      if (d > r) {
        dx *= r / d;
        dy *= r / d;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }
    const last = this.lookers.get(e.pointerId);
    if (last) {
      this.actions.onLook(e.clientX - last.x, e.clientY - last.y);
      this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  private up(e: PointerLike) {
    if (this.stick && e.pointerId === this.stick.id) this.endStick();
    this.lookers.delete(e.pointerId);
    if (this.holdId === e.pointerId) {
      this.holdId = null;
      this.input.keyUp('Space');
    }
  }

  private holdId: number | null = null;

  private press(action: string, pointerId: number) {
    switch (action) {
      case 'use':
        this.input.keyDown('KeyE');
        this.input.keyUp('KeyE');
        break;
      case 'hold':
        this.holdId = pointerId;
        this.input.keyDown('Space');
        break;
      case 'run':
        this.running = !this.running;
        this.runBtn.classList.toggle('on', this.running);
        this.runBtn.setAttribute('aria-pressed', String(this.running));
        if (this.running) this.input.keyDown('ShiftLeft');
        else this.input.keyUp('ShiftLeft');
        break;
      case 'pause':
        this.actions.onPause();
        break;
    }
  }

  private endStick() {
    this.stick = null;
    this.input.setStick(0, 0);
    this.base.classList.remove('active');
    this.knob.style.transform = '';
  }
}

/** True on phones/tablets, where the main pointer is a finger. */
export function prefersTouch(win: Pick<Window, 'matchMedia'> = window): boolean {
  try {
    return win.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
