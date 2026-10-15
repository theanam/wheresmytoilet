import { config } from '../config';

export interface UrgencyInput {
  sprinting: boolean;
  /** True while Space is held. Only pauses urgency if there is clench stamina left. */
  clenching: boolean;
  inFoodCourt: boolean;
}

/** Tracks the Urgency meter (0–100 %) and Clench stamina. Pure logic, no rendering. */
export class UrgencyMeter {
  urgency: number = config.urgency.start;
  stamina: number = config.clench.max;

  get isFull(): boolean {
    return this.urgency >= config.urgency.max;
  }

  /** True when the player is clenching and has stamina to do so (player can't move). */
  isClenching(input: Pick<UrgencyInput, 'clenching'>): boolean {
    return input.clenching && this.stamina > 0;
  }

  update(dt: number, input: UrgencyInput): void {
    if (this.isFull) return;
    if (this.isClenching(input)) {
      this.stamina = Math.max(0, this.stamina - config.clench.drainRate * dt);
      return;
    }
    if (!input.clenching) {
      this.stamina = Math.min(config.clench.max, this.stamina + config.clench.refillRate * dt);
    }
    let rate = input.sprinting ? config.urgency.sprintRate : config.urgency.baseRate;
    if (input.inFoodCourt) rate += config.urgency.foodCourtExtra;
    this.add(rate * dt);
  }

  add(amount: number): void {
    this.urgency = Math.min(config.urgency.max, this.urgency + amount);
  }
}

/** HUD colour for the urgency bar: green → yellow → red. */
export function urgencyColor(urgency: number): string {
  if (urgency < 50) return '#3ec46d';
  if (urgency < 75) return '#f2c218';
  return '#e8413c';
}
