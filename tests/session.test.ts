import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/systems/session';

const idle = { sprinting: false, clenching: false, inFoodCourt: false };

describe('game session', () => {
  it('counts time while playing but not while paused', () => {
    const s = new GameSession();
    s.update(1, idle);
    s.pause();
    s.update(5, idle);
    expect(s.elapsed).toBe(1);
    expect(s.meter.urgency).toBeCloseTo(20.5);
    s.resume();
    s.update(1, idle);
    expect(s.elapsed).toBe(2);
  });

  it('wins when E is pressed close to the toilet, with a star rating', () => {
    const s = new GameSession();
    for (let i = 0; i < 45; i++) s.update(1, idle);
    expect(s.interact(1)).toBe(true);
    expect(s.status).toBe('won');
    expect(s.result).toEqual({ outcome: 'won', seconds: 45, stars: 3 });
  });

  it('does not win when E is pressed too far away', () => {
    const s = new GameSession();
    expect(s.interact(10)).toBe(false);
    expect(s.status).toBe('playing');
    expect(s.message).not.toBe('');
  });

  it('loses when urgency reaches 100%', () => {
    const s = new GameSession();
    for (let i = 0; i < 1700; i++) s.update(0.1, idle);
    expect(s.status).toBe('lost');
    expect(s.result?.outcome).toBe('lost');
    expect(s.result?.stars).toBe(0);
    expect(s.interact(0)).toBe(false); // can't win after losing
  });

  it('clears messages after their timeout', () => {
    const s = new GameSession();
    s.showMessage('hi', 1);
    s.update(0.5, idle);
    expect(s.message).toBe('hi');
    s.update(0.6, idle);
    expect(s.message).toBe('');
  });

  it('ignores pause/resume once the round is over', () => {
    const s = new GameSession();
    s.interact(0);
    s.pause();
    expect(s.status).toBe('won');
    expect(s.result).not.toBeNull();
  });
});
