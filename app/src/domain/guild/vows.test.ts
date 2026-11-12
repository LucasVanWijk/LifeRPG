import { describe, expect, it } from 'vitest';
import { PHASE_MS } from './content';
import { makeAdventurer } from './adventurer';
import { advance, found, payReal, send, setChampion, upgradeGuild } from './engine';
import { pairUp } from './legacy';
import { rngFor } from './rng';
import { CONVICTIONS, fxFor, makeVow, VOW_REWARD, vowText } from './vows';
import type { Guild } from './types';
import type { Vow } from './vows';

const NOW = Date.UTC(2026, 10, 5, 12);
const fresh = (seed = 42): Guild => {
  const g = found({ name: 'T', town: 'T', charter: 'martial', crestSeed: 1, seed }, NOW);
  const r = setChampion(g, g.adventurers[0].id);
  if (!r.ok) throw new Error(r.reason);
  return r.guild;
};
const withVow = (g: Guild, id: string, vow: Vow): Guild => ({ ...g, adventurers: g.adventurers.map((a) => (a.id === id ? { ...a, vow, conviction: 'shield' } : a)) });
const vowOf = (g: Guild, id: string) => g.adventurers.find((a) => a.id === id)!.vow!;

describe('convictions and vows', () => {
  it('has 24 distinct convictions, and gives every adventurer one conviction and one vow', () => {
    expect(CONVICTIONS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(CONVICTIONS.map((c) => c.id)).size).toBe(CONVICTIONS.length);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const a = makeAdventurer(rngFor(1, i), 'a' + i, 0);
      expect(a.conviction).toBeTruthy();
      expect(a.vow).toMatchObject({ progress: expect.any(Number), target: expect.any(Number) });
      expect(vowText(a.vow!).length).toBeGreaterThan(8);
      kinds.add(a.vow!.kind);
    }
    expect(kinds.size).toBe(10);
  });

  it('level vows aim above where they start', () => {
    for (let i = 0; i < 100; i++) { const v = makeVow(rngFor(2, i), 3); if (v.kind === 'level') { expect(v.target).toBeGreaterThan(3); expect(v.progress).toBe(3); } }
  });

  it('counts clears and keeps the vow at the target', () => {
    for (let seed = 1; seed < 80; seed++) {
      let g = fresh(seed);
      const lead = g.adventurers[0];
      g = withVow(g, lead.id, { kind: 'clears', target: 1, progress: 0 });
      const offer = g.board.find((o) => o.scale === 'expedition' && o.tier === 1 && o.needs.length === 0);
      if (!offer) continue;
      const sent = send(g, offer.id, g.adventurers.map((a) => a.id), 'cautious');
      if (!sent.ok) continue;
      const o = sent.guild.outings[0];
      const clean = o.result.stages.length === offer.stages.length && o.result.stages.every((s) => s.outcome !== 'fail') && !o.result.stages.some((s) => s.died);
      if (!clean) continue;
      const back = advance(sent.guild, NOW + 40 * PHASE_MS).guild;
      expect(vowOf(back, lead.id)).toMatchObject({ done: true, progress: 1 });
      expect(back.chronicle.some((e) => e.k === 'vowkept' && e.a === lead.id)).toBe(true);
      return;
    }
    throw new Error('no clean run found');
  });

  it('keeps a level vow when they reach the level', () => {
    let g = fresh();
    const lead = g.adventurers[0];
    g = withVow(g, lead.id, { kind: 'level', target: lead.level + 1, progress: lead.level });
    g = payReal(g, { key: 'q:1', xp: 5000, gold: 10, kind: 'quest', title: 'Big one', date: '2026-11-05', attr: 'wits', notable: false }).guild;
    expect(vowOf(g, lead.id).done).toBe(true);
    expect(g.chronicle.some((e) => e.k === 'vowkept')).toBe(true);
  });

  it('keeps a love vow when a couple forms', () => {
    const g = fresh();
    const [a, b] = g.adventurers;
    a.vow = { kind: 'love', target: 1, progress: 0 };
    a.shared[b.id] = 9; b.shared[a.id] = 9;
    for (let s = 0; s < 60 && !a.partnerId; s++) pairUp(g, s);
    expect(a.vow.done).toBe(true);
  });

  it('leaves a vow unfulfilled when their service ends first, and says so', () => {
    let g = fresh();
    const a = g.adventurers[1];
    g = withVow(g, a.id, { kind: 'gold', target: 99999, progress: 0 });
    const later = advance(g, NOW + (a.retirePhase + 2) * PHASE_MS).guild;
    expect(later.adventurers.find((x) => x.id === a.id)!.state).toBe('retired');
    expect(later.chronicle.some((e) => e.k === 'vowbroken' && e.a === a.id)).toBe(true);
    expect(vowOf(later, a.id).done).toBeFalsy();
  });

  it('gives a lasting reward only once the vow is kept', () => {
    const a = makeAdventurer(rngFor(3, 3), 'a', 0);
    const open = { ...a, conviction: undefined, traitIds: [], vow: { kind: 'home' as const, target: 4, progress: 0 } };
    expect(fxFor(open).d).toBe(0);
    expect(fxFor({ ...open, vow: { ...open.vow, done: true } }).d).toBeCloseTo(VOW_REWARD.home.d!);
    expect(fxFor({ ...open, conviction: 'shield' }).team).toBeCloseTo(0.15);
  });

  it('gives guilds saved before this a conviction and a vow when they load', () => {
    const g = fresh() as unknown as Guild;
    for (const x of g.adventurers) { delete x.conviction; delete x.vow; }
    for (const r of g.recruits) { delete r.adv.conviction; delete r.adv.vow; }
    const up = upgradeGuild(g);
    expect(up.adventurers.every((x) => x.conviction && x.vow)).toBe(true);
    expect(up.recruits.every((x) => x.adv.conviction && x.adv.vow)).toBe(true);
  });
});
