import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { SoundDirector, type SoundEvent, type SoundState } from '../src/systems/soundDirector';

function collect(d: SoundDirector, seconds: number, s: SoundState, step = 0.01) {
  const events: { t: number; e: SoundEvent }[] = [];
  const steps = Math.round(seconds / step);
  for (let i = 1; i <= steps; i++) for (const e of d.update(step, s)) events.push({ t: i * step, e });
  return events;
}
const only = (evs: { e: SoundEvent }[], e: SoundEvent) => evs.filter((x) => x.e === e).length;

describe('sound director', () => {
  it('plays footsteps every 0.5 s while walking, starting right away', () => {
    const evs = collect(new SoundDirector(), 1.9, { moving: true, sprinting: false, urgency: 20 }); // 0, 0.5, 1.0, 1.5
    expect(evs[0]).toEqual({ t: 0.01, e: 'footstep' });
    expect(only(evs, 'footstep')).toBe(4);
  });

  it('plays no footsteps when standing still', () => {
    expect(only(collect(new SoundDirector(), 3, { moving: false, sprinting: false, urgency: 20 }), 'footstep')).toBe(0);
  });

  it('speeds footsteps up when sprinting and again when desperate', () => {
    const d = new SoundDirector();
    const walk = d.stepInterval({ moving: true, sprinting: false, urgency: 20 });
    const sprint = d.stepInterval({ moving: true, sprinting: true, urgency: 20 });
    const urgent = d.stepInterval({ moving: true, sprinting: false, urgency: config.urgency.wobbleAt });
    expect(sprint).toBeLessThan(walk);
    expect(urgent).toBeCloseTo(walk * config.audio.urgentStepFactor);
    expect(only(collect(new SoundDirector(), 3.1, { moving: true, sprinting: true, urgency: 20 }), 'footstep')).toBe(10);
  });

  it('rumbles only above 50%, at random gaps within the configured range', () => {
    expect(only(collect(new SoundDirector(() => 0), 30, { moving: false, sprinting: false, urgency: 49 }), 'rumble')).toBe(0);
    const evs = collect(new SoundDirector(() => 0.5), 60, { moving: false, sprinting: false, urgency: 60 }).filter((x) => x.e === 'rumble');
    const gap = (config.audio.rumbleMinGap + config.audio.rumbleMaxGap) / 2;
    expect(evs.length).toBe(Math.floor(60 / gap));
    expect(evs[1].t - evs[0].t).toBeCloseTo(gap, 1);
  });

  it('plays a heartbeat only at 90%+, faster as urgency climbs', () => {
    expect(only(collect(new SoundDirector(), 5, { moving: false, sprinting: false, urgency: 89 }), 'heartbeat')).toBe(0);
    const d = new SoundDirector();
    expect(d.heartbeatInterval(90)).toBeCloseTo(config.audio.heartbeatSlowest);
    expect(d.heartbeatInterval(100)).toBeCloseTo(config.audio.heartbeatFastest);
    const slow = only(collect(new SoundDirector(), 5, { moving: false, sprinting: false, urgency: 90 }), 'heartbeat');
    const fast = only(collect(new SoundDirector(), 5, { moving: false, sprinting: false, urgency: 99.9 }), 'heartbeat');
    expect(slow).toBeGreaterThan(3);
    expect(fast).toBeGreaterThan(slow);
  });
});
