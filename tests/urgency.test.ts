import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { UrgencyMeter, urgencyColor } from '../src/systems/urgency';

const idle = { sprinting: false, clenching: false, inFoodCourt: false };

function run(meter: UrgencyMeter, seconds: number, input = idle, step = 0.1) {
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps; i++) meter.update(step, input);
}

describe('urgency meter', () => {
  it('starts at 20% with full clench stamina', () => {
    const m = new UrgencyMeter();
    expect(m.urgency).toBe(20);
    expect(m.stamina).toBe(100);
  });

  it('rises 0.5% per second, failing in about 160 s', () => {
    const m = new UrgencyMeter();
    run(m, 10);
    expect(m.urgency).toBeCloseTo(25);
    run(m, 149);
    expect(m.isFull).toBe(false);
    run(m, 1.1);
    expect(m.urgency).toBe(100);
    expect(m.isFull).toBe(true);
  });

  it('rises 1% per second while sprinting (2×)', () => {
    const m = new UrgencyMeter();
    run(m, 10, { ...idle, sprinting: true });
    expect(m.urgency).toBeCloseTo(30);
  });

  it('rises an extra 0.5% per second in the food court', () => {
    const m = new UrgencyMeter();
    run(m, 10, { ...idle, inFoodCourt: true });
    expect(m.urgency).toBeCloseTo(30);
  });

  it('pauses while clenching and drains 20 stamina per second', () => {
    const m = new UrgencyMeter();
    run(m, 2, { ...idle, clenching: true });
    expect(m.urgency).toBeCloseTo(20);
    expect(m.stamina).toBeCloseTo(60);
  });

  it('stops working once stamina runs out', () => {
    const m = new UrgencyMeter();
    run(m, 5, { ...idle, clenching: true });
    expect(m.stamina).toBeCloseTo(0);
    expect(m.isClenching({ clenching: true })).toBe(false);
    run(m, 2, { ...idle, clenching: true });
    expect(m.urgency).toBeCloseTo(21);
    expect(m.stamina).toBe(0); // no refill while Space is still held
  });

  it('refills 5 stamina per second when not clenching, capped at max', () => {
    const m = new UrgencyMeter();
    run(m, 2, { ...idle, clenching: true });
    run(m, 4);
    expect(m.stamina).toBeCloseTo(80);
    run(m, 100);
    expect(m.stamina).toBe(config.clench.max);
  });

  it('adds instant penalties and never exceeds 100%', () => {
    const m = new UrgencyMeter();
    m.add(config.urgency.bumpPenalty);
    expect(m.urgency).toBe(22);
    m.add(500);
    expect(m.urgency).toBe(100);
  });

  it('colours the bar green → yellow → red', () => {
    expect(urgencyColor(20)).toBe('#3ec46d');
    expect(urgencyColor(60)).toBe('#f2c218');
    expect(urgencyColor(90)).toBe('#e8413c');
  });
});
