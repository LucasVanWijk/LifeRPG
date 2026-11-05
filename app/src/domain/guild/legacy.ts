// What lasts: couples and children, kin, eras and the guild's records.
import { CHILD_CHANCE, COUPLE_CHANCE, COUPLE_SHARED, ERA_YEARS, KIN_CHANCE, MAX_CHILDREN, PHASE_MS, PHASES_PER_YEAR, RACES } from './content';
import { makeAdventurer } from './adventurer';
import { isLegend } from './town';
import { rngFor } from './rng';
import { log, nextId } from './util';
import type { Adventurer, Guild } from './types';

const HOUR = PHASE_MS;

/** At each season's start, adventurers who have been out together often may become a couple. */
export function pairUp(g: Guild, season: number) {
  const free = g.adventurers.filter((a) => a.state === 'active' && !a.partnerId);
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
    const a = free[i], b = free[j];
    if (a.partnerId || b.partnerId || (a.shared[b.id] ?? 0) < COUPLE_SHARED) continue;
    if (!rngFor(g.seed, 'pair', season, a.id, b.id).chance(COUPLE_CHANCE)) continue;
    a.partnerId = b.id; b.partnerId = a.id;
    log(g, { k: 'pair', a: a.id, b: b.id });
  }
}

/** Each year a retired couple may have a child, up to three. */
export function births(g: Guild, p: number, year: number) {
  for (const a of g.adventurers) {
    const b = g.adventurers.find((x) => x.id === a.partnerId);
    if (!b || a.id > b.id || a.state !== 'retired' || b.state !== 'retired') continue;
    if ((a.childIds?.length ?? 0) >= MAX_CHILDREN) continue;
    const r = rngFor(g.seed, 'birth', year, a.id);
    if (!r.chance(CHILD_CHANCE)) continue;
    const parent = r.pick([a, b]);
    const best = Math.max(a.talent, b.talent);
    const talent = Math.max(1, Math.min(5, best - 1 + (r.chance(0.25) ? 1 : 0)));
    const child = makeAdventurer(r, nextId(g, 'a'), p, { race: parent.race, family: a.family, level: 1, talent });
    child.state = 'child';
    child.bornPhase = p;
    child.joinedPhase = p;
    child.parentIds = [a.id, b.id];
    child.adultPhase = p + RACES[child.race].comesOfAge * PHASES_PER_YEAR;
    g.adventurers.push(child);
    a.childIds = [...(a.childIds ?? []), child.id];
    b.childIds = [...(b.childIds ?? []), child.id];
    log(g, { k: 'birth', a: child.id, b: a.id });
  }
}

/** A child grown up walks into the Tavern, free to hire, with the family name. */
export function comeOfAge(g: Guild, child: Adventurer, p: number) {
  g.adventurers = g.adventurers.filter((a) => a.id !== child.id);
  const r = rngFor(g.seed, 'adult', child.id);
  const career = Math.max(3, Math.min(15, 15 + r.int(-1, 0)));
  const adult: Adventurer = { ...child, state: 'active', joinedPhase: p, career, retirePhase: p + career * PHASES_PER_YEAR };
  g.recruits.push({ adv: adult, leaves: p + 8 * 3, fee: 0 });
  log(g, { k: 'adult', a: child.id });
}

/** A legend with no children may have a relative turn up one day. */
export function kin(g: Guild, p: number, year: number) {
  for (const a of g.adventurers) {
    if (!isLegend(a) || a.kinSent || a.childIds?.length) continue;
    const r = rngFor(g.seed, 'kin', year, a.id);
    if (!r.chance(KIN_CHANCE)) continue;
    a.kinSent = true;
    const relative = makeAdventurer(r, nextId(g, 'a'), p, { race: a.race, family: a.family, level: 3, talent: Math.max(3, a.talent) });
    g.recruits.push({ adv: relative, leaves: p + 8 * 3, fee: 0 });
    log(g, { k: 'kin', a: a.id, b: relative.id });
  }
}

/** Every ten years the chronicle closes an era, named for the guild's most renowned adventurer. */
export function closeEra(g: Guild, yearsDone: number) {
  const from = g.eras.length ? g.eras[g.eras.length - 1].to : 0, to = g.t;
  const inWin = (at: number) => at >= from && at < to;
  const count = (...kinds: string[]) => g.chronicle.filter((e) => inWin(e.at) && kinds.includes(e.k)).length;
  const score = (a: Adventurer) => a.level + a.outings * 0.3 + (isLegend(a) ? 8 : 0) + (a.state === 'fallen' ? 2 : 0);
  const star = [...g.adventurers].filter((a) => a.state !== 'child' && a.joinedPhase * HOUR < to && (a.endedPhase === undefined || a.endedPhase * HOUR >= from)).sort((x, y) => score(y) - score(x))[0];
  const led = g.ledger.filter((e) => inWin(e.at));
  g.eras.push({
    n: g.eras.length + 1, name: star ? star.first : 'No one', hero: star?.id ?? null, from, to,
    joined: count('hire', 'adult', 'kin'), fell: count('fell'), retired: count('retire'), built: count('built', 'upgraded', 'hall'),
    quests: led.filter((e) => e.kind === 'quest').length, habits: led.filter((e) => e.kind === 'habit').length,
  });
  log(g, { k: 'era', v: g.eras.length, a: star?.id });
  void yearsDone;
}
export const ERA_LENGTH = ERA_YEARS;

export interface Records {
  longestCareer: { who: Adventurer; years: number } | null;
  highestLevel: Adventurer | null;
  mostOutings: Adventurer | null;
  deadliest: { place: string; deaths: number } | null;
  bestHaul: { gold: number; name: string } | null;
  longestLived: { who: Adventurer; years: number } | null;
  largestFamily: { who: Adventurer; children: number } | null;
}

const maxBy = <T,>(xs: T[], f: (x: T) => number): T | null => xs.reduce<T | null>((best, x) => (best === null || f(x) > f(best) ? x : best), null);

export function records(g: Guild): Records {
  const all = g.adventurers.filter((a) => a.state !== 'child' && a.state !== 'left');
  const ended = all.filter((a) => a.endedPhase !== undefined);
  const lc = maxBy(ended, (a) => a.endedPhase! - a.joinedPhase);
  const ll = maxBy(all.filter((a) => a.state === 'passed' && a.passPhase !== undefined), (a) => a.passPhase! - a.bornPhase);
  const fam = maxBy(all, (a) => a.childIds?.length ?? 0);
  const places: Record<string, number> = {};
  for (const a of all) if (a.fellAt) places[a.fellAt] = (places[a.fellAt] ?? 0) + 1;
  const top = Object.entries(places).sort((a, b) => b[1] - a[1])[0];
  const yrs = (ph: number) => Math.round((ph / PHASES_PER_YEAR) * 10) / 10;
  return {
    longestCareer: lc ? { who: lc, years: yrs(lc.endedPhase! - lc.joinedPhase) } : null,
    highestLevel: maxBy(all, (a) => a.level),
    mostOutings: maxBy(all, (a) => a.outings),
    deadliest: top ? { place: top[0], deaths: top[1] } : null,
    bestHaul: g.bestHaul.gold ? g.bestHaul : null,
    longestLived: ll ? { who: ll, years: yrs(ll.passPhase! - ll.bornPhase) } : null,
    largestFamily: fam && (fam.childIds?.length ?? 0) > 0 ? { who: fam, children: fam.childIds!.length } : null,
  };
}
