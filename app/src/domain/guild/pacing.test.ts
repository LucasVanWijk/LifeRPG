import { describe, expect, it } from 'vitest';
import { simulate } from './pacing';

/** The day each Guild Hall level (2 to 10) should be reached by a typical player, where level 10 is about a year in. */
const TARGET = [4, 18, 40, 72, 113, 162, 220, 288, 365];

describe('pacing', () => {
  it('has a typical player reach each Guild Hall level close to its target day, and real life pay at least half through Hall 6', () => {
    const runs = [1, 2, 3, 4].map((seed) => simulate(440, undefined, seed));
    for (const r of runs) expect(r.hallDay.length).toBe(9);
    TARGET.forEach((target, i) => {
      const mean = runs.reduce((n, r) => n + r.hallDay[i], 0) / runs.length;
      // Within 25% of the target, or within 5 days for the early levels, which depend on luck.
      expect(Math.abs(mean - target), 'Hall level ' + (i + 2) + ' came on day ' + mean).toBeLessThanOrEqual(Math.max(5, target * 0.25));
    });
    for (const r of runs) expect(r.realShare).toBeGreaterThanOrEqual(0.5);
  }, 240_000);
});
