import { describe, expect, it } from 'vitest';
import { PHASE_MS, PHASES_PER_DAY } from './content';
import { advance, found } from './engine';
import { rngFor } from './rng';
import { capacity, DESIRES, servedCount, visitWeek, visitorsPerWeek, wantedCount } from './visitors';

const g0 = () => found({ name: 'T', town: 'Testwick', charter: 'martial', crestSeed: 1, seed: 5 }, 0);

describe('visitors', () => {
  it('follow renown: ten a week at 800', () => {
    expect(visitorsPerWeek(0)).toBe(0);
    expect(visitorsPerWeek(800)).toBe(10);
    expect(visitorsPerWeek(400)).toBe(5);
    // Beyond 800 they grow more slowly: 20 at 3,200, 30 at 7,200.
    expect(visitorsPerWeek(3200)).toBe(20);
    expect(visitorsPerWeek(7200)).toBe(30);
  });
  it('split by what they want, are served by what the town offers, and pay for it', () => {
    const g = { ...g0(), renown: 800 };
    const v = visitWeek(g, 3, rngFor(5, 'v'));
    expect(wantedCount(v)).toBe(10);
    expect(servedCount(v)).toBeLessThanOrEqual(10);
    // With nothing built for them, a desire is never served.
    for (const d of DESIRES) if (v.served[d] > 0) expect(capacity(1)).toBeGreaterThan(0);
    expect(v.gold).toBeGreaterThanOrEqual(0);
    expect(visitWeek(g, 3, rngFor(5, 'v'))).toEqual(v);
  });
  it('a bigger building takes more of them', () => {
    expect(capacity(0)).toBe(0);
    expect(capacity(3)).toBeGreaterThan(capacity(1));
  });
  it('come once a week, at the start of it, and pay into the treasury then', () => {
    const g = { ...found({ name: 'T', town: 'Testwick', charter: 'martial', crestSeed: 1, seed: 5 }, 0), renown: 1600 };
    g.buildings.push({ id: 'bt', type: 'tavern', level: 2 });
    const day = (d: number) => advance(g, d * PHASES_PER_DAY * PHASE_MS).guild;
    expect(day(7).visitors?.day).toBe(0);
    const week2 = day(8);
    expect(week2.visitors?.day).toBe(8);
    expect(week2.visitorTotals?.gold).toBeGreaterThan(0);
    // Nobody else comes until the next week begins.
    expect(day(15).visitorTotals).toEqual(week2.visitorTotals);
  });
});
