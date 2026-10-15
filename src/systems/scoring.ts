import { config } from '../config';

export function starRating(seconds: number): 1 | 2 | 3 {
  if (seconds < config.stars.threeUnder) return 3;
  if (seconds < config.stars.twoUnder) return 2;
  return 1;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
