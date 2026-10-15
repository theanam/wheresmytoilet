import { config } from '../config';
import { starRating } from './scoring';
import { UrgencyMeter, type UrgencyInput } from './urgency';

export type SessionStatus = 'playing' | 'paused' | 'won' | 'lost';

export interface RoundResult {
  outcome: 'won' | 'lost';
  seconds: number;
  stars: 0 | 1 | 2 | 3;
}

/** One round of the game: timer, urgency and the win/lose rules. No rendering. */
export class GameSession {
  status: SessionStatus = 'playing';
  elapsed = 0;
  readonly meter = new UrgencyMeter();
  message = '';
  private messageTimer = 0;

  get isOver(): boolean {
    return this.status === 'won' || this.status === 'lost';
  }

  update(dt: number, input: UrgencyInput): void {
    if (this.status !== 'playing') return;
    this.elapsed += dt;
    this.meter.update(dt, input);
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
    if (this.meter.isFull) this.status = 'lost';
  }

  pause(): void {
    if (this.status === 'playing') this.status = 'paused';
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'playing';
  }

  showMessage(text: string, seconds = 2.5): void {
    this.message = text;
    this.messageTimer = seconds;
  }

  /** Called when the player presses E. `distanceToToilet` is metres to the working toilet door. */
  interact(distanceToToilet: number): boolean {
    if (this.status !== 'playing') return false;
    if (distanceToToilet <= config.player.interactDistance) {
      this.status = 'won';
      return true;
    }
    this.showMessage('Nothing to do here... keep looking!', 1.5);
    return false;
  }

  get result(): RoundResult | null {
    if (this.status === 'won') return { outcome: 'won', seconds: this.elapsed, stars: starRating(this.elapsed) };
    if (this.status === 'lost') return { outcome: 'lost', seconds: this.elapsed, stars: 0 };
    return null;
  }
}
