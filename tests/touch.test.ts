// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { titleScreen } from '../src/scenes/screens';
import { InputState } from '../src/systems/input';
import { GameSession } from '../src/systems/session';
import { Hud } from '../src/ui/hud';
import { prefersTouch, stickAxes, TouchControls } from '../src/ui/touchControls';

const R = config.touch.stickRadius;

function pointer(target: Element, type: string, id: number, x: number, y: number) {
  const e = Object.assign(new Event(type, { bubbles: true, cancelable: true }), { pointerId: id, clientX: x, clientY: y });
  target.dispatchEvent(e);
  return e;
}

function setup() {
  const parent = document.createElement('div');
  document.body.append(parent);
  const input = new InputState();
  const actions = { onLook: vi.fn(), onPause: vi.fn() };
  const tc = new TouchControls(parent, input, actions);
  Object.defineProperty(tc.root, 'clientWidth', { value: 800 });
  const btn = (a: string) => tc.root.querySelector(`[data-action=${a}]`)!;
  return { parent, input, actions, tc, btn };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('stickAxes', () => {
  it('maps up to forward and right to strafe', () => {
    expect(stickAxes(0, -R, R, 0.2)).toEqual({ forward: 1, strafe: 0 });
    const right = stickAxes(R / 2, 0, R, 0.2);
    expect(right.strafe).toBeCloseTo(0.5);
    expect(right.forward).toBeCloseTo(0);
  });

  it('ignores small movements in the dead zone', () => {
    expect(stickAxes(3, 3, R, 0.2)).toEqual({ forward: 0, strafe: 0 });
    expect(stickAxes(0, 0, R, 0.2)).toEqual({ forward: 0, strafe: 0 });
  });

  it('caps at full speed beyond the radius', () => {
    const a = stickAxes(R * 3, R * 4, R, 0.2);
    expect(Math.hypot(a.forward, a.strafe)).toBeCloseTo(1);
    expect(a.forward).toBeCloseTo(-0.8);
  });
});

describe('input with a joystick', () => {
  it('uses the stick when no movement keys are held, keys win otherwise', () => {
    const i = new InputState();
    i.setStick(0.5, -0.25);
    expect(i.axes).toEqual({ forward: 0.5, strafe: -0.25 });
    i.keyDown('KeyS');
    expect(i.axes).toEqual({ forward: -1, strafe: 0 });
    i.clear();
    expect(i.axes).toEqual({ forward: 0, strafe: 0 });
  });
});

describe('touch controls', () => {
  it('walks with a joystick started on the left side, and stops on release', () => {
    const { tc, input } = setup();
    pointer(tc.root, 'pointerdown', 1, 100, 300);
    expect(tc.root.querySelector('.stick-base.active')).not.toBeNull();
    pointer(tc.root, 'pointermove', 1, 100, 300 - R);
    expect(input.axes.forward).toBeCloseTo(1);
    pointer(tc.root, 'pointerup', 1, 100, 300 - R);
    expect(input.axes).toEqual({ forward: 0, strafe: 0 });
    expect(tc.root.querySelector('.stick-base.active')).toBeNull();
  });

  it('looks around when dragging on the right side, while walking with the other thumb', () => {
    const { tc, input, actions } = setup();
    pointer(tc.root, 'pointerdown', 1, 100, 300);
    pointer(tc.root, 'pointermove', 1, 100 + R, 300);
    pointer(tc.root, 'pointerdown', 2, 600, 200);
    pointer(tc.root, 'pointermove', 2, 620, 190);
    pointer(tc.root, 'pointermove', 2, 625, 190);
    expect(actions.onLook).toHaveBeenNthCalledWith(1, 20, -10);
    expect(actions.onLook).toHaveBeenNthCalledWith(2, 5, 0);
    expect(input.axes.strafe).toBeCloseTo(1);
    pointer(tc.root, 'pointerup', 2, 625, 190);
    pointer(tc.root, 'pointermove', 2, 700, 190);
    expect(actions.onLook).toHaveBeenCalledTimes(2);
  });

  it('a second left-side touch looks instead of stealing the joystick', () => {
    const { tc, input, actions } = setup();
    pointer(tc.root, 'pointerdown', 1, 100, 300);
    pointer(tc.root, 'pointerdown', 2, 150, 200);
    pointer(tc.root, 'pointermove', 2, 160, 200);
    expect(actions.onLook).toHaveBeenCalledWith(10, 0);
    expect(input.axes).toEqual({ forward: 0, strafe: 0 });
  });

  it('USE presses E once', () => {
    const { input, btn } = setup();
    pointer(btn('use'), 'pointerdown', 3, 700, 400);
    expect(input.consumePress('KeyE')).toBe(true);
    expect(input.consumePress('KeyE')).toBe(false);
  });

  it('HOLD clenches only while held', () => {
    const { tc, input, btn } = setup();
    pointer(btn('hold'), 'pointerdown', 4, 700, 300);
    expect(input.clenching).toBe(true);
    pointer(tc.root, 'pointerup', 4, 700, 300);
    expect(input.clenching).toBe(false);
  });

  it('RUN toggles sprinting and survives a pause reset', () => {
    const { tc, input, btn } = setup();
    pointer(btn('run'), 'pointerdown', 5, 650, 300);
    expect(input.sprinting).toBe(true);
    expect(btn('run').getAttribute('aria-pressed')).toBe('true');
    input.clear(); // pausing clears the keyboard state...
    tc.reset(); // ...and the touch controls restore RUN
    expect(input.sprinting).toBe(true);
    pointer(btn('run'), 'pointerdown', 6, 650, 300);
    expect(input.sprinting).toBe(false);
  });

  it('pause button pauses', () => {
    const { actions, btn } = setup();
    pointer(btn('pause'), 'pointerdown', 7, 20, 20);
    expect(actions.onPause).toHaveBeenCalledOnce();
  });

  it('highlights USE near a toilet and cleans up on remove', () => {
    const { tc, parent, input, btn } = setup();
    tc.setNearToilet(true);
    expect(btn('use').classList.contains('ready')).toBe(true);
    tc.setNearToilet(false);
    expect(btn('use').classList.contains('ready')).toBe(false);
    pointer(btn('run'), 'pointerdown', 8, 650, 300);
    tc.remove();
    expect(parent.children).toHaveLength(0);
    expect(input.sprinting).toBe(false);
  });

  it('prevents the browser from scrolling or zooming on touches', () => {
    const { tc } = setup();
    expect(pointer(tc.root, 'pointerdown', 9, 400, 300).defaultPrevented).toBe(true);
  });
});

describe('touch-friendly screens', () => {
  it('detects touch devices by their coarse pointer', () => {
    expect(prefersTouch({ matchMedia: () => ({ matches: true }) as MediaQueryList })).toBe(true);
    expect(prefersTouch({ matchMedia: () => ({ matches: false }) as MediaQueryList })).toBe(false);
    expect(prefersTouch({ matchMedia: () => { throw new Error(); } })).toBe(false);
  });

  it('shows touch controls on the title screen for phones', () => {
    const el = titleScreen(() => {}, true);
    expect(el.textContent).toContain('Drag to walk');
    expect(el.textContent).toContain('USE');
    expect(el.textContent).not.toContain('W A S D');
  });

  it('HUD tells phone players to tap USE, and the sound button toggles', () => {
    const parent = document.createElement('div');
    const onToggle = vi.fn();
    const hud = new Hud(parent, true, true, onToggle);
    hud.setMuted(false);
    hud.update(new GameSession(), true);
    expect(parent.querySelector('.prompt')?.textContent).toBe('Tap USE to use the toilet');
    const sound = parent.querySelector<HTMLButtonElement>('[data-testid=sound]')!;
    expect(sound.textContent).toBe('🔊 sound on');
    sound.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
