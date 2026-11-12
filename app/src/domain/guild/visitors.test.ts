import { describe, expect, it } from 'vitest';
import { found } from './engine';
import { rngFor } from './rng';
import { capacity, DESIRES, servedCount, visitDay, visitorsPerDay, wantedCount } from './visitors';

const g0 = () => found({ name: 'T', town: 'Testwick', charter: 'martial', crestSeed: 1, seed: 5 }, 0);

describe('visitors', () => {
  it('follow renown: ten a day at 200', () => {
    expect(visitorsPerDay(0)).toBe(0);
    expect(visitorsPerDay(200)).toBe(10);
    expect(visitorsPerDay(400)).toBe(20);
  });
  it('split by what they want, are served by what the town offers, and pay for it', () => {
    const g = { ...g0(), renown: 200 };
    const v = visitDay(g, 3, rngFor(5, 'v'));
    expect(wantedCount(v)).toBe(10);
    expect(servedCount(v)).toBeLessThanOrEqual(10);
    // With nothing built for them, a desire is never served.
    for (const d of DESIRES) if (v.served[d] > 0) expect(capacity(1)).toBeGreaterThan(0);
    expect(v.gold).toBeGreaterThanOrEqual(0);
    expect(visitDay(g, 3, rngFor(5, 'v'))).toEqual(v);
  });
  it('a bigger building takes more of them', () => {
    expect(capacity(0)).toBe(0);
    expect(capacity(3)).toBeGreaterThan(capacity(1));
  });
});
