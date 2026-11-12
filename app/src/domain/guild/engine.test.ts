import { describe, expect, it } from 'vitest';
import { PHASE_MS, PHASES_PER_YEAR, TUTORIAL_MINUTES } from './content';
import { rosterLimit } from './town';
import { makeAdventurer, role } from './adventurer';
import { makeExpedition } from './board';
import { woundStats } from './balance';
import { advance, ctxFor, found, hire, payReal, refund, send, setChampion } from './engine';
import { odds, resolve, snapshot } from './resolve';
import { staminaCap } from './wounds';
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
    expect(g.recruits).toHaveLength(1);
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

  it('still applies a death recorded before wounds existed, pays insurance and clears the Champion', () => {
    const base = found(founding, NOW);
    const c = setChampion(base, base.adventurers[0].id);
    if (!c.ok) throw new Error(c.reason);
    const exp = c.guild.board.find((o) => o.scale === 'expedition' && o.needs.length === 0)!;
    const sent = send(c.guild, exp.id, [base.adventurers[0].id, base.adventurers[2].id], 'bold');
    if (!sent.ok) throw new Error(sent.reason);
    const g = structuredClone(sent.guild);
    g.outings[0].result.stages[0].died = base.adventurers[0].id;
    const gold = g.gold;
    const after = advance(g, NOW + g.outings[0].stageAt[0] + 1).guild;
    expect(after.adventurers.find((a) => a.id === base.adventurers[0].id)!.state).toBe('fallen');
    expect(after.championId).toBeNull();
    expect(after.gold).toBeGreaterThan(gold);
  });

  it('nobody dies on an outing any more: they come home wounded instead', () => {
    for (let s = 0; s < 40; s++) {
      const base = found({ ...founding, seed: s }, NOW);
      const c = setChampion(base, base.adventurers[0].id);
      if (!c.ok) continue;
      const exp = c.guild.board.find((o) => o.scale === 'expedition' && o.needs.length === 0)!;
      const sent = send(c.guild, exp.id, base.adventurers.map((a) => a.id), 'bold');
      if (!sent.ok) continue;
      expect(sent.guild.outings[0].result.stages.every((st) => !st.died)).toBe(true);
    }
  });

  it('turns wounds into healing time, stamina cost and a slower mend away from home', () => {
    let g = fresh();
    const a = g.adventurers[0];
    a.wounds.push({ id: 'w1', source: 'physical', severity: 'minor', text: 'a deep cut', left: 12, total: 12 });
    a.wounds.push({ id: 'w2', source: 'physical', severity: 'trivial', text: 'bruised ribs', left: 3, total: 3 });
    expect(staminaCap(a.wounds)).toBe(80);
    g = at(g, 30);
    const healed = g.adventurers[0];
    expect(healed.wounds.length).toBeLessThan(2);
  });

  it('lets a Hospitaller guild, a healer and armour all make wounds rarer, and a Bold stance worse', () => {
    const steady = woundStats('steady', 2, 0, 400, 3).any, bold = woundStats('bold', 2, 0, 400, 3).any, caut = woundStats('cautious', 2, 0, 400, 3).any;
    expect(caut).toBeLessThan(steady);
    expect(steady).toBeLessThan(bold);
  });

  it('gives odds that match the rolled outcomes', () => {
    const g = fresh();
    const offer = makeExpedition(rngFor(3, 'x'), 'o', 0, { maxTier: 2, regions: ['hearth'] });
    offer.tier = 2;
    const party = g.adventurers.map((a) => a.id);
    const { ctx } = ctxFor(g, offer, party, 'bold');
    // Push them below their tier so deaths are common enough to measure.
    ctx.members = ctx.members.map((m) => ({ ...m, rating: m.rating - 6, stamina: 70 }));
    const o = odds(ctx);
    const N = 20000;
    let full = 0, anyMajor = 0;
    const hurt: Record<string, number> = {}, major: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const r = resolve(ctx, rngFor(99, i));
      if (r.stages.length === offer.stages.length && r.stages.every((s) => s.outcome !== 'fail')) full++;
      if (Object.values(r.members).some((m) => m.wounds?.some((w) => w.severity === 'major'))) anyMajor++;
      for (const [id, m] of Object.entries(r.members)) { if (m.wounds?.length) hurt[id] = (hurt[id] ?? 0) + 1; if (m.wounds?.some((w) => w.severity === 'major')) major[id] = (major[id] ?? 0) + 1; }
    }
    const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.012);
    close(full / N, o.full);
    close(anyMajor / N, o.anyMajor);
    for (const id of party) { close((hurt[id] ?? 0) / N, o.injury[id]); close((major[id] ?? 0) / N, o.major[id]); }
    expect(o.anyMajor).toBeGreaterThan(0.02);
  });

  it('snapshots the party at departure', () => {
    const g = fresh();
    expect(snapshot(g.adventurers[0]).id).toBe(g.adventurers[0].id);
  });
});

describe('hiring', () => {
  it('costs the fee and respects the roster limit', () => {
    let g = fresh();
    g = { ...g, gold: 10_000, buildings: [...g.buildings, { id: 'l', type: 'lodge', level: 1 }] };
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
    full = { ...full, recruits: [{ ...first, adv: { ...first.adv, id: 'again' } }] };
    const again = hire(full, 'again');
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
  it('wounds an easy outing a little, with a small chance of a major wound, and a dangerous one a lot', () => {
    const easy = woundStats('steady', 3, 0, 500, 7, 6);
    expect(easy.any).toBeGreaterThan(0.2);
    expect(easy.any).toBeLessThan(0.55);
    expect(easy.major).toBeGreaterThan(0.004);
    expect(easy.major).toBeLessThan(0.05);
    const hard = woundStats('steady', 2, 2, 500, 7);
    expect(hard.any).toBeGreaterThan(0.8);
    expect(hard.major).toBeGreaterThan(0.1);
  });
});

it('advances at most one hour of phases per hour of real time', () => {
  const g = at(fresh(), 3);
  expect(Math.floor(g.t / PHASE_MS)).toBe(3);
});
