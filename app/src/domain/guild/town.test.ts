import { describe, expect, it } from 'vitest';
import type { CharterId } from './content';
import { BUILDINGS, PHASE_MS, PHASES_PER_DAY, REGION_ORDER } from './content';
import { makeAdventurer } from './adventurer';
import { makeOdyssey } from './board';
import {
  advance, assignStaff, brew, build, buyMarket, condView, ctxFor, equip, found, forge, hire, payReal, refund, reforge, salvage, sell, send, sendProblem, setChampion, setHoliday,
  upgrade, upgradeGuild, awardStreak, unequip,
} from './engine';
import { births, comeOfAge, pairUp, records } from './legacy';
import { odds, oddsRange } from './resolve';
import { rngFor } from './rng';
import { bld, buildProblem, capacity, costOf, hallLevel, production, rosterLimit, staffMult, storageCap } from './town';
import type { Guild, Item } from './types';

const NOW = Date.UTC(2026, 10, 5, 12);
const F = { name: 'T', town: 'Testwick', charter: 'builders' as CharterId, crestSeed: 1, seed: 42 };
const fresh = (charter: CharterId = 'martial', seed = 42): Guild => {
  const g = found({ ...F, charter, seed }, NOW);
  const r = setChampion(g, g.adventurers[0].id);
  if (!r.ok) throw new Error(r.reason);
  return r.guild;
};
const rich = (g: Guild): Guild => ({ ...g, gold: 99999, renown: 9999, stock: { wood: 99999, stone: 99999, iron: 99999, herbs: 99999 } });
const at = (g: Guild, hours: number) => advance(g, NOW + hours * PHASE_MS).guild;
const must = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { if (!r.ok) throw new Error((r as unknown as { reason: string }).reason); return r as Extract<T, { ok: true }>; };
const item = (id: string, patch: Partial<Item> = {}): Item => ({ id, name: 'Test Blade', slot: 'weapon', grade: 0, wear: 8, owner: 'guild', ...patch });

describe('the starting town', () => {
  it('supplies enough for everyone it starts with', () => {
    const c = capacity(fresh());
    expect(c.food).toEqual({ supply: 12, demand: 3 });
    expect(c.housing).toEqual({ supply: 10, demand: 0 });
    expect(c.happiness.supply).toBe(2);
  });
});

describe('building', () => {
  it('takes gold, materials and time, then produces', () => {
    let g = fresh();
    const c = costOf(g, 'forestry', 1);
    g = must(build(g, 'forestry')).guild;
    expect(g.gold).toBe(150 - c.gold);
    expect(g.construction).toHaveLength(1);
    const done = at(g, c.phases + 1);
    expect(bld(done, 'forestry')?.level).toBe(1);
    expect(done.construction).toHaveLength(0);
    const later = at(g, c.phases + 6);
    expect(later.stock.wood).toBeGreaterThanOrEqual(done.stock.wood + 4 * 4);
    expect(production(done).wood).toBe(4);
  });

  it('needs one crew per project and a high enough Guild Hall', () => {
    const g = rich(fresh());
    expect(buildProblem(g, 'smithy')).toMatch(/Guild Hall level 3/);
    const one = must(build(g, 'forestry')).guild;
    expect(buildProblem(one, 'quarry')).toMatch(/crew/);
  });

  it('can always raise Housing and Farms, one level per Guild Hall level, so the town never locks', () => {
    let g = rich(fresh());
    g = { ...g, buildings: g.buildings.map((b) => (b.type === 'hall' ? { ...b, level: 2 } : b)) };
    // Pile on workers until housing is far over.
    for (let i = 0; i < 4; i++) g.buildings.push({ id: 'q' + i, type: 'quarry', level: 1 });
    expect(capacity(g).housing.supply).toBeLessThan(capacity(g).housing.demand);
    expect(buildProblem(g, 'forestry')).toMatch(/Not enough (food|housing|happiness)/);
    const home = bld(g, 'home')!, farm = bld(g, 'farm')!;
    expect(buildProblem(g, 'home')).toBe('Already built');
    expect(buildProblem(g, 'home', home)).toBeNull();
    expect(buildProblem(g, 'farm', farm)).toBeNull();
    g = must(upgrade(g, home.id)).guild;
    expect(g.construction).toHaveLength(1);
    const two = { ...g, construction: [], buildings: g.buildings.map((b) => (b.type === 'home' ? { ...b, level: 2 } : b)) };
    expect(buildProblem(two, 'home', bld(two, 'home'))).toMatch(/Guild Hall level 3/);
  });

  it('stops production when the warehouse is full', () => {
    let g = rich(fresh());
    g.buildings.push({ id: 'f1', type: 'forestry', level: 1 });
    g.stock.wood = storageCap(g);
    const later = at(g, 12);
    expect(later.stock.wood).toBe(storageCap(g));
  });

  it('upgrades the Hall only with the renown and materials it asks for', () => {
    const g = fresh();
    expect(buildProblem(g, 'hall')).toMatch(/renown/);
    const r = rich(g);
    const h = must(upgrade(r, bld(r, 'hall')!.id)).guild;
    expect(h.construction[0]).toMatchObject({ type: 'hall', level: 2 });
    const done = at(h, 20);
    expect(hallLevel(done)).toBe(2);
  });

  it('says when a cost is more than the stores can ever hold, and names the Warehouse', () => {
    // Hall 3 needs 200 wood; without a Warehouse the stores hold 150, so waiting would never be enough.
    const g = fresh();
    g.buildings.find((b) => b.type === 'hall')!.level = 2;
    const r = { ...g, gold: 99999, renown: 9999, stock: { wood: storageCap(g), stone: storageCap(g), iron: 999, herbs: 0 } };
    expect(buildProblem(r, 'hall')).toMatch(/200 wood.*stores hold \(150\).*build the Warehouse/);
    // With room enough it is only a matter of saving up.
    const w = { ...r, buildings: [...r.buildings, { id: 'bw', type: 'warehouse' as const, level: 1 }], stock: { ...r.stock, wood: 10 } };
    expect(buildProblem(w, 'hall')).toBe('Not enough materials or gold');
  });

  it('charges less in the cheap season and more in the dear one', () => {
    const g = fresh();
    const autumn = { ...g, t: 33 * PHASES_PER_DAY * PHASE_MS };
    expect(costOf(g, 'farm', 1).gold).toBeLessThan(costOf(autumn, 'farm', 1).gold);
    expect(costOf({ ...g, t: 0 }, 'farm', 1).gold).toBe(48);
  });

  it('limits each building to half the Guild Hall level', () => {
    const g0 = rich(fresh());
    const g = { ...g0, buildings: [...g0.buildings, { id: 'tv', type: 'tavern' as const, level: 1 }] };
    const tavern = bld(g, 'tavern')!;
    const lvl2 = { ...g, buildings: g.buildings.map((b) => (b.id === tavern.id ? { ...b, level: 1 } : b)) };
    expect(buildProblem(lvl2, 'tavern', tavern)).toMatch(/Guild Hall level 3/);
  });

  it('gives each building five levels (Housing and Farms ten) with growing effects', () => {
    for (const d of Object.values(BUILDINGS)) if (d.id !== 'hall') expect(d.values).toHaveLength(d.id === 'home' || d.id === 'farm' ? 10 : 5);
  });
});

describe('the Merchant House', () => {
  it('buys only up to a weekly limit', () => {
    let g = rich(fresh());
    g.buildings.push({ id: 'm1', type: 'market', level: 1 });
    g.stock.wood = 500;
    g = must(sell(g, { kind: 'stock', key: 'wood', n: 500 })).guild;
    expect(g.stock.wood).toBe(400);
    expect(sell(g, { kind: 'stock', key: 'wood', n: 10 }).ok).toBe(false);
    const nextWeek = { ...g, t: g.t + 8 * PHASES_PER_DAY * PHASE_MS };
    expect(sell(nextWeek, { kind: 'stock', key: 'wood', n: 10 }).ok).toBe(true);
  });

  it('sells gear for the racks', () => {
    let g = rich(fresh());
    g.buildings.push({ id: 'm1', type: 'market', level: 5 }, { id: 'a1', type: 'armoury', level: 1 });
    g = advance({ ...g, t: g.t }, NOW + 4 * PHASES_PER_DAY * PHASE_MS).guild;
    expect(g.market.stock.length).toBeGreaterThan(0);
    const before = g.armoury.length;
    g = must(buyMarket(g, g.market.stock[0].id)).guild;
    expect(g.armoury.length).toBe(before + 1);
  });
});

describe('gear', () => {
  it('forges, reforges and salvages at the Blacksmith', () => {
    let g = rich(fresh());
    g.buildings.push({ id: 's1', type: 'smithy', level: 2 }, { id: 'a1', type: 'armoury', level: 1 });
    g = must(forge(g, 'weapon', 1)).guild;
    const w = g.armoury[0];
    expect(w).toMatchObject({ slot: 'weapon', grade: 1, wear: 12 });
    expect(forge(g, 'weapon', 4).ok).toBe(false);
    g.armoury[0] = { ...w, wear: 2 };
    g = must(reforge(g, w.id)).guild;
    expect(g.armoury[0].wear).toBe(12);
    g.stock.iron = 100;
    const iron = g.stock.iron;
    g = must(salvage(g, w.id)).guild;
    expect(g.armoury).toHaveLength(0);
    expect(g.stock.iron).toBeGreaterThan(iron);
  });

  it('keeps only as many items as there are racks, breaking down the weakest', () => {
    let g = rich(fresh());
    g.buildings.push({ id: 'a1', type: 'armoury', level: 1 }, { id: 's1', type: 'smithy', level: 5 });
    for (let i = 0; i < 10; i++) g = must(forge(g, 'weapon', 0)).guild;
    expect(g.armoury).toHaveLength(10);
    expect(forge(g, 'weapon', 0).ok).toBe(false);
  });

  it('wears out through use and melts a broken piece into iron', () => {
    for (let seed = 1; seed < 60; seed++) {
      let g = rich(fresh('martial', seed));
      g.stock.iron = 50;
      const a = g.adventurers[0];
      g.armoury.push(item('w1', { wear: 1 }));
      const offer = g.board.find((o) => o.scale === 'expedition' && o.needs.length === 0 && o.tier === 1);
      if (!offer) continue;
      const party = g.adventurers.map((x) => x.id);
      const sent = send(g, offer.id, party, 'cautious');
      if (!sent.ok) continue;
      g = sent.guild;
      if (g.outings[0].result.stages.some((s) => s.died)) continue;
      expect(g.adventurers.find((x) => x.id === a.id)!.gear.weapon?.id).toBeDefined();
      const back = advance(g, NOW + 100 * PHASE_MS).guild;
      const after = back.adventurers.find((x) => x.id === a.id)!;
      const carrier = back.adventurers.find((x) => back.chronicle.some((e) => e.k === 'broke' && e.a === x.id));
      expect(carrier).toBeDefined();
      expect(after.gear.weapon?.id === 'w1').toBe(false);
      expect(back.stock.iron).toBeGreaterThan(g.stock.iron);
      return;
    }
    throw new Error('no safe seed found');
  });

  it('lets anyone wear an heirloom, and it never wears out', () => {
    let g = fresh();
    const a = g.adventurers[1];
    g.heirlooms.push(item('h1', { heirloom: true, grade: 3, slot: 'trinket', name: 'Morning Run Band' }));
    g = must(equip(g, a.id, 'h1')).guild;
    expect(g.adventurers[1].gear.trinket?.id).toBe('h1');
    expect(g.heirlooms).toHaveLength(0);
    g = must(unequip(g, a.id, 'trinket')).guild;
    expect(g.heirlooms).toHaveLength(1);
  });

  it('brews potions from herbs, up to the Stillroom’s level', () => {
    let g = rich(fresh());
    g.buildings.push({ id: 'st1', type: 'stillroom', level: 2 });
    g = must(brew(g, 'heal')).guild;
    g = must(brew(g, 'cure')).guild;
    expect(brew(g, 'ward').ok).toBe(false);
    expect(g.potions.map((p) => p.kind)).toEqual(['heal', 'cure']);
    expect(at(g, 24 * 9).potions).toHaveLength(0); // they spoil after a game year
  });
});

describe('staff', () => {
  it('lets retirees work in a building, doubling the bonus for the right class', () => {
    let g = fresh();
    g.buildings.push({ id: 'f1', type: 'forestry', level: 2 });
    const a = makeAdventurer(rngFor(1, 1), 'r1', 0, { cls: 'ranger', level: 10 });
    g.adventurers.push({ ...a, state: 'retired' });
    expect(staffMult(g, 'forestry')).toBe(1);
    g = must(assignStaff(g, 'r1', 'f1')).guild;
    expect(staffMult(g, 'forestry')).toBeCloseTo(1.2);
    expect(production(g).wood).toBe(Math.round(6 * 1.2));
    expect(assignStaff(g, 'r1', 'nope').ok).toBe(false);
  });
});

describe('retirement and old age', () => {
  it('keeps the best piece as an heirloom and returns the rest', () => {
    let g = fresh();
    const a = g.adventurers[1];
    g.adventurers[1] = { ...a, gear: { weapon: item('w', { grade: 2, name: 'Keen Sword' }), armour: item('ar', { slot: 'armour', grade: 0, name: 'Plain Jerkin' }) } };
    const later = at(g, a.retirePhase + 2);
    const b = later.adventurers.find((x) => x.id === a.id)!;
    expect(b.state).toBe('retired');
    expect(b.gear).toEqual({});
    expect(later.heirlooms.map((h) => h.name)).toContain('Keen Sword');
    expect(later.heirlooms.find((h) => h.name === 'Keen Sword')).toMatchObject({ heirloom: true, from: a.id });
  });

  it('lets retirees pass away after their race’s span', () => {
    const g = fresh();
    const a = g.adventurers[1];
    const retired = at(g, a.retirePhase + 2);
    const r = retired.adventurers.find((x) => x.id === a.id)!;
    expect(r.passPhase).toBeGreaterThan(r.endedPhase!);
    const gone = advance(retired, NOW + (r.passPhase! + 1) * PHASE_MS).guild;
    expect(gone.adventurers.find((x) => x.id === a.id)!.state).toBe('passed');
  });

  it('recalls a retiree once, for an expedition but never an odd job', () => {
    let g = rich(fresh());
    const a = makeAdventurer(rngFor(1, 1), 'r1', 0, { cls: 'guardian', level: 6 });
    g.adventurers.push({ ...a, state: 'retired' });
    const odd = g.board.find((o) => o.scale === 'odd')!;
    const exp = g.board.find((o) => o.scale === 'expedition' && o.tier === 1 && o.needs.length === 0)!;
    expect(sendProblem(g, odd, ['r1'])).toMatch(/Retirees/);
    const sent = must(send(g, exp.id, ['r1', g.adventurers[0].id], 'cautious'));
    g = sent.guild;
    const back = advance(g, NOW + 200 * PHASE_MS).guild;
    const r = back.adventurers.find((x) => x.id === 'r1')!;
    if (r.state === 'retired') { expect(r.recalled).toBe(true); expect(r.awayOn).toBeNull(); }
    else expect(r.state).toBe('fallen');
  });
});

describe('couples, children and kin', () => {
  it('pairs up adventurers who have been out together often', () => {
    const g = fresh();
    const [a, b] = g.adventurers;
    a.shared[b.id] = 8; b.shared[a.id] = 8;
    for (let s = 0; s < 40 && !a.partnerId; s++) pairUp(g, s);
    expect(a.partnerId).toBe(b.id);
    expect(b.partnerId).toBe(a.id);
    expect(g.chronicle.some((e) => e.k === 'pair')).toBe(true);
  });

  it('gives a retired couple children who grow up into free recruits with the family name', () => {
    const g = fresh();
    const [a, b] = g.adventurers;
    Object.assign(a, { state: 'retired', partnerId: b.id });
    Object.assign(b, { state: 'retired', partnerId: a.id });
    for (let y = 2; y < 60 && !a.childIds?.length; y++) births(g, 100, y);
    expect(a.childIds?.length).toBeGreaterThan(0);
    const child = g.adventurers.find((x) => x.id === a.childIds![0])!;
    expect(child).toMatchObject({ state: 'child', family: a.family });
    expect(child.parentIds).toEqual([a.id, b.id]);
    expect(capacity(g).residents).toBeGreaterThan(2);
    comeOfAge(g, child, 5000);
    expect(g.adventurers.find((x) => x.id === child.id)).toBeUndefined();
    const rec = g.recruits.find((r) => r.adv.id === child.id)!;
    expect(rec.fee).toBe(0);
    expect(rec.adv.family).toBe(a.family);
    expect(hire({ ...g, gold: 0 }, child.id).ok).toBe(true);
  });
});

describe('conditions', () => {
  it('make an expedition more dangerous unless someone counters them', () => {
    const g = fresh();
    const base = makeOdyssey(rngFor(5, 1), 'o', 'mire', 0);
    const offer = { ...base, scale: 'expedition' as const, stages: base.stages.slice(0, 6), minParty: 1, needs: [], tier: 2 };
    const party = g.adventurers.map((a) => a.id);
    const clean = ctxFor(g, { ...offer, conditions: [] }, party, 'steady').ctx;
    const hard = ctxFor(g, { ...offer, conditions: [{ id: 'darkness', hidden: false }, { id: 'swarm', hidden: false }, { id: 'locked', hidden: false }] }, party, 'steady').ctx;
    expect(odds(hard).full).toBeLessThan(odds(clean).full);
    // A Guardian counters Ambush, and a Cleric counters Plague.
    const guard = ctxFor(g, { ...offer, conditions: [{ id: 'ambush', hidden: false }] }, party, 'steady').ctx;
    expect(guard.conditions).toEqual(['ambush']);
    expect(guard.members.some((m) => m.counters.includes('ambush'))).toBe(true);
    expect(odds(guard).full).toBeCloseTo(odds(clean).full, 5);
  });

  it('shows hidden conditions as a range until the Library reveals them', () => {
    const g = fresh();
    const base = makeOdyssey(rngFor(5, 1), 'o', 'mire', 0);
    const offer = { ...base, scale: 'expedition' as const, stages: base.stages.slice(0, 6), minParty: 1, needs: [], tier: 3, conditions: [{ id: 'darkness' as const, hidden: true }, { id: 'swarm' as const, hidden: true }] };
    const party = g.adventurers.map((a) => a.id);
    const { ctx, hidden } = ctxFor(g, offer, party, 'steady');
    expect(hidden).toBe(2);
    const { lo, hi } = oddsRange(ctx, hidden);
    expect(hi.full).toBeLessThan(lo.full);
    const withLibrary = { ...g, buildings: [...g.buildings, { id: 'l', type: 'library' as const, level: 3 }] };
    expect(condView(withLibrary, offer).every((c) => !c.hidden)).toBe(true);
    expect(condView(g, offer).every((c) => c.hidden)).toBe(true);
  });
});

describe('odysseys and regions', () => {
  it('are long, need a Tank and a Healer, and have exact-enough, repeatable odds', () => {
    const g = rich(fresh());
    const o = makeOdyssey(rngFor(9, 1), 'od', 'mire', 0);
    expect(o.stages.length).toBeGreaterThan(8);
    expect(o.stages[o.stages.length - 1].kind).toBe('boss');
    expect(o.needs).toEqual(['tank', 'healer']);
    expect(o.phases).toBeGreaterThanOrEqual(48);
    const party = g.adventurers.map((a) => a.id);
    const { ctx } = ctxFor(g, { ...o, minParty: 1, conditions: [] }, party, 'steady');
    const one = odds(ctx), two = odds(ctx);
    expect(one).toEqual(two);
    expect(one.full).toBeGreaterThanOrEqual(0);
    expect(one.full).toBeLessThanOrEqual(1);
    expect(Object.keys(one.injury)).toHaveLength(3);
  });

  it('opens regions with the Cartographer and offers lairs from Guild Hall 3', () => {
    let g = rich(fresh());
    g.buildings = g.buildings.map((b) => (b.type === 'hall' ? { ...b, level: 3 } : b));
    g.buildings.push({ id: 'c1', type: 'cartographer', level: 2 });
    const later = at(g, 30);
    const lairs = later.board.filter((o) => o.scale === 'odyssey').map((o) => o.region);
    expect(lairs.sort()).toEqual(['frost', 'mire']);
    expect(REGION_ORDER).toHaveLength(6);
  });
});

describe('falling', () => {
  it('posts a recovery expedition where someone fell', () => {
    for (let seed = 1; seed < 400; seed++) {
      const g0 = rich(fresh('martial', seed));
      const offer = g0.board.find((o) => o.scale === 'expedition' && o.tier === 1 && o.needs.length === 0);
      if (!offer) continue;
      const lead = g0.adventurers.find((a) => a.cls === 'guardian')!;
      const sent = send(g0, offer.id, [lead.id], 'bold');
      if (!sent.ok) continue;
      // Deaths no longer happen on their own; a death recorded before wounds existed still plays out.
      const guild = structuredClone(sent.guild);
      const k = 0;
      guild.outings[0].result.stages[k].died = lead.id;
      const after = advance(guild, NOW + guild.outings[0].stageAt[k] - guild.founded + guild.founded + 1).guild;
      const rec = after.board.find((o) => o.recover === lead.id);
      expect(rec).toBeDefined();
      expect(rec!.region).toBe(offer.region);
      return;
    }
    throw new Error('no death found');
  });
});

describe('holiday mode', () => {
  it('stops the clock and picks it up again where it left off', () => {
    let g = at(fresh(), 5);
    const t = g.t;
    g = setHoliday(g, true, NOW + 5 * PHASE_MS);
    expect(advance(g, NOW + 50 * PHASE_MS).guild.t).toBe(t);
    g = setHoliday(g, false, NOW + 50 * PHASE_MS);
    expect(g.holiday).toBeNull();
    expect(advance(g, NOW + 51 * PHASE_MS).guild.t).toBe(t + PHASE_MS);
  });
});

describe('what lasts', () => {
  const pay = { key: 'c:trip', xp: 250, gold: 100, kind: 'campaign' as const, title: 'Trip', date: '2026-11-05', attr: 'main' as const, notable: false, monument: { camp: 'trip', size: 'M' as const, seal: 'Seal', icon: 'compass' } };

  it('raises a monument for a finished campaign and takes it back with the reward', () => {
    const g = fresh();
    const r = payReal(g, pay);
    expect(r.guild.monuments).toHaveLength(1);
    expect(r.guild.renown).toBe(10);
    const back = refund(r.guild, 'c:trip');
    expect(back.monuments).toHaveLength(0);
    expect(back.renown).toBe(0);
  });

  it('forges an heirloom at a habit streak milestone, once', () => {
    const g = fresh();
    expect(awardStreak(g, 1, 'Morning run', 6, 'daily')).toBeNull();
    const a = awardStreak(g, 1, 'Morning run', 7, 'daily')!;
    expect(a.heirlooms[0]).toMatchObject({ name: 'Morning run Band', heirloom: true, slot: 'trinket' });
    expect(awardStreak(a, 1, 'Morning run', 8, 'daily')).toBeNull();
    expect(awardStreak(a, 1, 'Morning run', 30, 'daily')!.heirlooms).toHaveLength(2);
  });

  it('multiplies real-life gold by the Guild Hall level', () => {
    let g = fresh();
    g.buildings = g.buildings.map((b) => (b.type === 'hall' ? { ...b, level: 10 } : b));
    expect(payReal(g, { ...pay, monument: undefined, gold: 100 }).entry.guild + payReal(g, { ...pay, monument: undefined, gold: 100 }).entry.purse).toBe(190);
  });

  it('computes records', () => {
    const g = at(fresh(), 3);
    const r = records(g);
    expect(r.highestLevel).not.toBeNull();
    expect(r.deadliest).toBeNull();
  });
});

describe('saves from before the town', () => {
  it('gain the starting town and empty gear', () => {
    const g = fresh() as unknown as Record<string, unknown>;
    for (const k of ['buildings', 'construction', 'armoury', 'heirlooms', 'potions', 'market', 'sold', 'regions', 'monuments', 'eras', 'streaks', 'bestHaul', 'holiday']) delete g[k];
    const up = upgradeGuild(g as unknown as Guild);
    expect(up.buildings.map((b) => b.type)).toContain('hall');
    expect(up.regions.mire).toEqual({ liberated: false, stones: 0 });
    expect(up.adventurers[0].gear).toEqual({});
    expect(rosterLimit(up)).toBe(3);
  });
});
