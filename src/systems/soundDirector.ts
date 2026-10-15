import { config } from '../config';

export type SoundEvent = 'footstep' | 'rumble' | 'heartbeat';

export interface SoundState {
  moving: boolean;
  sprinting: boolean;
  urgency: number;
}

/**
 * Decides when the recurring body sounds play: footsteps (faster when sprinting
 * or desperate), stomach rumbles at random above 50%, and a heartbeat above 90%.
 * Pure timing logic, no audio, so it can be tested.
 */
export class SoundDirector {
  private stepTimer = 0;
  private rumbleTimer: number;
  private heartTimer = 0;

  constructor(private random: () => number = Math.random) {
    this.rumbleTimer = this.nextRumbleGap();
  }

  stepInterval(s: SoundState): number {
    const a = config.audio;
    const base = s.sprinting ? a.sprintStepInterval : a.stepInterval;
    return s.urgency >= config.urgency.wobbleAt ? base * a.urgentStepFactor : base;
  }

  heartbeatInterval(urgency: number): number {
    const a = config.audio;
    const t = Math.min(1, Math.max(0, (urgency - config.urgency.heartbeatAt) / (config.urgency.max - config.urgency.heartbeatAt)));
    return a.heartbeatSlowest + (a.heartbeatFastest - a.heartbeatSlowest) * t;
  }

  update(dt: number, s: SoundState): SoundEvent[] {
    const events: SoundEvent[] = [];

    if (s.moving) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        events.push('footstep');
        this.stepTimer += this.stepInterval(s);
        if (this.stepTimer <= 0) this.stepTimer = this.stepInterval(s);
      }
    } else {
      this.stepTimer = 0; // first step sounds as soon as you start walking
    }

    if (s.urgency >= config.audio.rumbleAbove) {
      this.rumbleTimer -= dt;
      if (this.rumbleTimer <= 0) {
        events.push('rumble');
        this.rumbleTimer = this.nextRumbleGap();
      }
    }

    if (s.urgency >= config.urgency.heartbeatAt) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        events.push('heartbeat');
        this.heartTimer = this.heartbeatInterval(s.urgency);
      }
    } else {
      this.heartTimer = 0;
    }

    return events;
  }

  private nextRumbleGap(): number {
    const { rumbleMinGap, rumbleMaxGap } = config.audio;
    return rumbleMinGap + this.random() * (rumbleMaxGap - rumbleMinGap);
  }
}
