import { describe, expect, it } from 'vitest';
import { createRng, pick, randomInt, shuffle } from '../src/systems/rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it('differs between seeds', () => {
    expect(createRng(1)()).not.toEqual(createRng(2)());
  });

  it('stays within [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randomInt, pick and shuffle stay in range and keep items', () => {
    const r = createRng(3);
    for (let i = 0; i < 100; i++) expect(randomInt(r, 5)).toBeLessThan(5);
    expect(['a', 'b']).toContain(pick(r, ['a', 'b']));
    expect(shuffle(r, [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});
