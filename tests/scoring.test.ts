import { describe, expect, it } from 'vitest';
import { formatTime, starRating } from '../src/systems/scoring';

describe('scoring', () => {
  it('gives 3 stars under 60 s, 2 under 120 s, otherwise 1', () => {
    expect(starRating(0)).toBe(3);
    expect(starRating(59.9)).toBe(3);
    expect(starRating(60)).toBe(2);
    expect(starRating(119.9)).toBe(2);
    expect(starRating(120)).toBe(1);
    expect(starRating(500)).toBe(1);
  });

  it('formats time as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9.7)).toBe('0:09');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(-3)).toBe('0:00');
  });
});
