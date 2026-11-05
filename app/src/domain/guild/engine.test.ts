import { describe, expect, it } from 'vitest';
import { PHASE_MS, PHASES_PER_YEAR, TUTORIAL_MINUTES } from './content';
import { rosterLimit } from './town';
import { makeAdventurer, role } from './adventurer';
import { makeExpedition } from './board';
import { CAREFUL, deathShare, RISKY } from './balance';
import { advance, ctxFor, found, hire, payReal, refund, send, setChampion } from './engine';
import { odds, resolve, snapshot } from './resolve';
import { rngFor } from './rng';
import type { Guild } from './types';

const NOW = Date.UTC(2026, 10, 5, 12);
const founding = { name: 'The Test Company', town: 'Testwick', charter: 'martial' as const, crestSeed: 1, seed: 42 };
const fresh = () => {
  const g = found(founding, NOW);
  const r = setChampion(g, g.adventurers[0].id);
  if (!r.ok) throw new Error(r.reason);
  return r.guild;
};
const at = (g: Guild, hours: number) => advance(g, NOW + hours * PHASE_MS).guild;

describe('founding', () => {
  it('starts with a Tank, a Healer and a DPS, the tutorial job, and a full board and tavern', () => {
    const g = found(founding, NOW);
    expect(g.adventurers.map(role)).toEqual(['tank', 'healer', 'dps']);
    expect(g.board.filter((o) => o.tutorial)).toHaveLength(1);
    expect(g.board.filter((o) => o.scale === 'expedition')).toHaveLength(4);
    expect(g.board.filter((o) => o.scale === 'odd' && !o.tutorial).length).toBeGreaterThanOrEqual(2);
    expect(g.recruits).toHaveLength(2);
    expect(g.recruits.some((r) => ['tank', 'healer'].includes(role(r.adv)))).toBe(true);
  });
});

describe('advance', () => {
  it('gives the same guild however often it is called', () => {
    const g = fresh();
    const once = advance(g, NOW + 50 * PHASE_MS).guild;
    let many = g;
    for (let h = 1; h <= 200; h++) many = advance(many, NOW + h * 0.25 * PHASE_MS).guild;
    expect(JSON.stringify(many)).toEqual(JSON.stringify(once));
  });

  it('retires adventurers at the end of their career and pays the pension to the guild', () => {
    let g = fresh();
    const a = g.adventurers[1];
    g = { ...g, adventurers: g.adventurers.map((x) => (x.id === a.id ? { ...x, purse: 40 } : x)) };
    const gold = g.gold;
    const later = advance(g, NOW + (a.retirePhase + 1) * PHASE_MS).guild;
    const b = later.adventurers.find((x) => x.id === a.id)!;
    expect(b.state).toBe('retired');
    expect(b.purse).toBe(0);
    expect(later.gold).toBeGreaterThanOrEqual(gold + 40);
    expect(later.chronicle.some((e) => e.k === 'retire' && e.a === a.id)).toBe(true);
  });

  it('keeps careers between 3 and 15 years', () => {
    for (let i = 0; i < 300; i++) {
      const a = makeAdventurer(rngFor(1, i), 'a' + i, 0);
      expect(a.career).toBeGreaterThanOrEqual(3);
      expect(a.career).toBeLessThanOrEqual(15);
      expect(a.retirePhase).toBe(a.career * PHASES_PER_YEAR);
    }
  });
});

describe('outings', () => {
  it('runs the tutorial job safely and brings the party back in ten minutes', () => {
    const g = fresh();
    const tut = g.board.find((o) => o.tutorial)!;
    const r = send(g, tut.id, [g.adventurers[0].id], 'steady');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = r.guild.outings[0];
    expect(o.returnAt - o.departAt).toBe(TUTORIAL_MINUTES * 60_000);
    expect(o.result.stages[0].outcome).toBe('clear');
    const back = advance(r.guild, NOW + TUTORIAL_MINUTES * 60_000).guild;
    expect(back.outings[0].done).toBe(true);
    expect(back.tutorialDone).toBe(true);
    expect(back.adventurers[0].awayOn).toBeNull();
  });

  it('applies a death at its stage, pays insurance and clears the Champion', () => {
    let g = fresh();
    // Find an expedition seed where the Champion dies, by trying parties on fresh guilds.
    for (let s = 0; s < 400; s++) {
      const base = found({ ...founding, seed: s }, NOW);
      const c = setChampion(base, base.adventurers[0].id);
      if (!c.ok) continue;
      const exp = c.guild.board.find((o) => o.scale === 'expedition' && o.needs.length === 0)!;
      const sent = send(c.guild, exp.id, [base.adventurers[0].id, base.adventurers[2].id], 'bold');
      if (!sent.ok) continue;
      const o = sent.guild.outings[0];
      const k = o.result.stages.findIndex((st) => st.died === base.adventurers[0].id);
      if (k < 0) continue;
      g = sent.guild;
      const gold = g.gold;
      const after = advance(g, NOW + o.stageAt[k] + 1).guild;
      const dead = after.adventurers.find((a) => a.id === base.adventurers[0].id)!;
      expect(dead.state).toBe('fallen');
      expect(after.championId).toBeNull();
      expect(after.gold).toBeGreaterThan(gold);
      expect(after.chronicle.some((e) => e.k === 'fell')).toBe(true);
      return;
    }
    throw new Error('no death found in 400 seeds');
  });

  it('gives odds that match the rolled outcomes', () => {
    const g = fresh();
    const offer = makeExpedition(rngFor(3, 'x'), 'o', 0, { maxTier: 2, regions: ['hearth'] });
    offer.tier = 2;
    const party = g.adventurers.map((a) => a.id);
    const { ctx } = ctxFor(g, offer, party, 'bold');
    // Push them below their tier so deaths are common enough to measure.
    ctx.members = ctx.members.map((m) => ({ ...m, rating: m.rating - 6, health: 70 }));
    const o = odds(ctx);
    const N = 20000;
    let full = 0, anyDeath = 0;
    const deaths: Record<string, number> = {}, hurt: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const r = resolve(ctx, rngFor(99, i));
      if (r.stages.length === offer.stages.length && r.stages.every((s) => s.outcome !== 'fail')) full++;
      if (Object.values(r.members).some((m) => m.died)) anyDeath++;
      for (const [id, m] of Object.entries(r.members)) { if (m.died) deaths[id] = (deaths[id] ?? 0) + 1; if (m.injury) hurt[id] = (hurt[id] ?? 0) + 1; }
    }
    const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.012);
    close(full / N, o.full);
    close(anyDeath / N, o.anyDeath);
    for (const id of party) { close((deaths[id] ?? 0) / N, o.death[id]); close((hurt[id] ?? 0) / N, o.injury[id]); }
    expect(o.anyDeath).toBeGreaterThan(0.02);
  });

  it('snapshots the party at departure', () => {
    const g = fresh();
    expect(snapshot(g.adventurers[0]).id).toBe(g.adventurers[0].id);
  });
});

describe('hiring', () => {
  it('costs the fee and respects the roster limit', () => {
    let g = fresh();
    g = { ...g, gold: 10_000 };
    const first = g.recruits[0];
    const r = hire(g, first.adv.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.guild.gold).toBe(10_000 - first.fee);
    expect(r.guild.adventurers.at(-1)!.retirePhase).toBe(r.guild.adventurers.at(-1)!.joinedPhase + first.adv.career * PHASES_PER_YEAR);
    let full = r.guild;
    while (full.adventurers.filter((a) => a.state === 'active').length < rosterLimit(full)) {
      full = { ...full, adventurers: [...full.adventurers, makeAdventurer(rngFor(5, full.adventurers.length), 'z' + full.adventurers.length, 0)] };
    }
    const again = hire(full, full.recruits[0].adv.id);
    expect(again.ok).toBe(false);
  });
});

describe('real-life rewards', () => {
  const pay = { key: 'q:1', xp: 105, gold: 35, kind: 'quest' as const, title: 'Plan the trip', date: '2026-11-05', attr: 'wits' as const, notable: true };

  it('pays the Champion XP, practice and a quarter of the gold, and the guild the rest', () => {
    const g = fresh();
    const champ = g.adventurers[0];
    const r = payReal(g, pay);
    const after = r.guild.adventurers[0];
    expect(r.to?.id).toBe(champ.id);
    expect(r.entry).toMatchObject({ purse: 9, guild: 26 });
    expect(after.purse).toBe(champ.purse + 9);
    expect(r.guild.gold).toBe(g.gold + 26);
    expect(after.practice.wits).toBe(r.entry.xp);
    expect(after.chapter.quests).toBe(1);
    expect(after.chapter.notable).toEqual([{ t: 'Plan the trip', d: '2026-11-05' }]);
  });

  it('reverses a payment exactly', () => {
    const g = fresh();
    const r = payReal(g, { ...pay, xp: 40 });
    const back = refund(r.guild, 'q:1');
    expect(back.gold).toBe(g.gold);
    expect(back.ledger).toEqual(g.ledger);
    expect(back.adventurers[0]).toEqual(g.adventurers[0]);
  });

  it('banks XP when there is no Champion and hands it to the next one', () => {
    const g = found(founding, NOW);
    const r = payReal(g, pay);
    expect(r.to).toBeNull();
    expect(r.guild.bankedXp).toBe(105);
    expect(r.guild.gold).toBe(g.gold + 35);
    const c = setChampion(r.guild, g.adventurers[1].id);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.guild.bankedXp).toBe(0);
    expect(c.guild.ledger[0].to).toBe(g.adventurers[1].id);
  });

  it('routes a campaign quest to its Standard-bearer', () => {
    const g = fresh();
    const r = payReal(g, { ...pay, bearerId: g.adventurers[2].id });
    expect(r.to?.id).toBe(g.adventurers[2].id);
  });
});

describe('balance', () => {
  it('lets about 2/3 of careful players’ adventurers retire, and about 1/3 of risky ones', () => {
    const careful = deathShare(CAREFUL, 120);
    const risky = deathShare(RISKY, 120);
    expect(careful).toBeGreaterThan(0.2);
    expect(careful).toBeLessThan(0.45);
    expect(risky).toBeGreaterThan(0.5);
    expect(risky).toBeLessThan(0.82);
  }, 120_000);
});

it('advances at most one hour of phases per hour of real time', () => {
  const g = at(fresh(), 3);
  expect(Math.floor(g.t / PHASE_MS)).toBe(3);
});
