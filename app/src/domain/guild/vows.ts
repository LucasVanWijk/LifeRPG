// Convictions and vows. A conviction is what an adventurer believes (a small, steady effect).
// A vow is the one thing they mean to do before they are done: progress is counted as they play,
// and keeping it earns a lasting reward. Retiring or falling first leaves it unfulfilled.
import type { RegionId } from './content';
import { MAX_LEVEL, REGIONS } from './content';
import type { Fx } from './traits';
import { TRAIT, traitFx } from './traits';
import type { Rng } from './rng';

export interface Conviction { id: string; name: string; text: string; fx: Fx }
const c = (id: string, name: string, text: string, fx: Fx): Conviction => ({ id, name, text, fx });

export const CONVICTIONS: Conviction[] = [
  c('shield', 'The Shield', 'Holds that the strong exist to stand between the weak and the dark.', { d: -0.05, team: 0.15 }),
  c('ledger', 'The Ledger', 'Pays every debt, and expects the same.', { g: 0.05, d: -0.03 }),
  c('open-hand', 'The Open Hand', 'Believes a shared loaf is worth two kept ones.', { team: 0.2, i: -0.05 }),
  c('long-road', 'The Long Road', 'Trusts only what can be reached on foot.', { e: 0.8, f: -0.08 }),
  c('first-light', 'The First Light', 'Believes the day should be met, not waited for.', { morn: 1, x: 0.04 }),
  c('last-stand', 'The Last Stand', 'Holds that some places must not be given up.', { b: 1, d: 0.04 }),
  c('clean-kill', 'The Clean Kill', 'Thinks a fight should end quickly or not begin.', { c: 0.8, i: -0.05 }),
  c('cautious-hand', 'The Cautious Hand', 'Holds that every danger is worth respect.', { caut: 1 }),
  c('gamble', 'The Gamble', 'Believes fortune favours the one who asks.', { bold: 1, g: 0.04 }),
  c('scholar', 'The Scholar', 'Thinks any day without a lesson is a day wasted.', { x: 0.08 }),
  c('hearth', 'The Hearth', 'Keeps the thought of home like a coal in a pocket.', { rec: 0.15, team: 0.1 }),
  c('no-oaths', 'The Doubter', 'Trusts no one’s word, and checks the locks.', { team: -0.3, t: 0.6 }),
  c('wanderer', 'The Wanderer', 'Believes a road is a promise to oneself.', { solo: 0.8, e: 0.4 }),
  c('pyre', 'The Pyre', 'Holds that the dead should be put to rest, one way or another.', { cnt: ['undead'], c: 0.4 }),
  c('watcher', 'The Watcher', 'Believes most trouble can be seen coming.', { t: 0.8, h: 0.5 }),
  c('healers-creed', 'The Healer’s Creed', 'Holds that no one should be left to bleed.', { rec: 0.2, i: -0.06 }),
  c('forge', 'The Forge', 'Thinks hard work is a kind of prayer.', { c: 0.6, f: -0.06 }),
  c('grave-keeper', 'The Grave-keeper', 'Remembers the fallen, and walks softly for them.', { eve: 1, d: -0.03 }),
  c('bright-flame', 'The Bright Flame', 'Believes hope is a thing you carry in front of you.', { morn: 0.8, x: 0.05 }),
  c('guild-first', 'The Guild First', 'Holds that the guild outlasts everyone in it.', { team: 0.3, r: 0.2 }),
  c('quiet', 'The Quiet Way', 'Believes the best victory makes no noise.', { h: 0.7, t: 0.5 }),
  c('storm', 'The Storm', 'Holds that fury is its own armour.', { c: 1, f: 0.06 }),
  c('harvest', 'The Harvest', 'Thinks nothing worth having comes without sweat.', { g: 0.06, rec: 0.1 }),
  c('scales', 'The Scales', 'Believes everything balances in the end.', { r: 0.4, x: 0.04 }),
];
export const CONVICTION = Object.fromEntries(CONVICTIONS.map((x) => [x.id, x])) as Record<string, Conviction>;

export type VowKind = 'clears' | 'high' | 'bosses' | 'home' | 'region' | 'gold' | 'level' | 'rescue' | 'odyssey' | 'free' | 'love';
export interface Vow { kind: VowKind; target: number; progress: number; region?: RegionId; done?: boolean }

/** What keeping a vow gives for good. */
export const VOW_REWARD: Record<VowKind, Fx> = {
  clears: { r: 0.5 }, high: { c: 0.6, b: 0.6 }, bosses: { b: 1 }, home: { d: -0.08 }, region: { h: 0.6, e: 0.6 }, gold: { g: 0.06 },
  level: { x: 0.1 }, rescue: { i: -0.1, d: -0.05 }, odyssey: { r: 0.8 }, free: { d: -0.1, r: 0.4 }, love: { rec: 0.2, team: 0.3 },
};
export const VOW_REWARD_TEXT: Record<VowKind, string> = {
  clears: '+0.5 rating', high: '+0.6 in fights and against bosses', bosses: '+1 against bosses', home: '8% less likely to be wounded', region: '+0.6 on hazards and endurance',
  gold: '6% more gold', level: '10% more XP', rescue: '10% less likely to be hurt, 5% less to be wounded', odyssey: '+0.8 rating', free: '10% less likely to be wounded, +0.4 rating', love: 'recovers 20% faster, helps the party',
};

export function vowText(v: Pick<Vow, 'kind' | 'target' | 'region'>): string {
  const n = v.target;
  switch (v.kind) {
    case 'clears': return 'Fully clear ' + n + ' expeditions';
    case 'high': return 'Fully clear ' + n + ' expeditions of tier 3 or higher';
    case 'bosses': return 'Defeat ' + n + ' bosses';
    case 'home': return 'Bring the whole party home without a major wound from ' + n + ' expeditions of tier 2 or higher';
    case 'region': return 'Go on ' + n + ' expeditions in ' + REGIONS[v.region ?? 'hearth'].name;
    case 'gold': return 'Bring home ' + n + ' gold';
    case 'level': return 'Reach level ' + n;
    case 'rescue': return 'Bring a fallen friend home';
    case 'odyssey': return 'Finish an odyssey';
    case 'free': return 'Help free a region';
    case 'love': return 'Find someone to share the road with';
  }
}

const WEIGHT: Record<VowKind, number> = { clears: 20, high: 10, bosses: 14, home: 14, region: 14, gold: 12, level: 16, rescue: 0, odyssey: 6, free: 3, love: 5 };

export function makeVow(r: Rng, level: number): Vow {
  const kind = r.weighted(Object.keys(WEIGHT) as VowKind[], (k) => WEIGHT[k]);
  const target = { clears: r.int(3, 6), high: r.int(2, 3), bosses: r.int(3, 6), home: r.int(4, 8), region: r.int(3, 5), gold: r.int(3, 8) * 100, level: Math.min(MAX_LEVEL, level + r.int(4, 7)), rescue: 1, odyssey: 1, free: 1, love: 1 }[kind];
  const v: Vow = { kind, target, progress: kind === 'level' ? level : 0 };
  if (kind === 'region') v.region = r.pick(['hearth', 'mire', 'frost'] as RegionId[]);
  return v;
}
export const pickConviction = (r: Rng) => r.pick(CONVICTIONS).id;

/** Everything about an adventurer that changes the numbers: traits, their conviction, and a vow that was kept. */
export function fxFor(a: { traitIds?: string[]; conviction?: string; vow?: Vow }) {
  const list: Fx[] = [];
  for (const id of a.traitIds ?? []) if (TRAIT[id]) list.push(TRAIT[id].fx);
  if (a.conviction && CONVICTION[a.conviction]) list.push(CONVICTION[a.conviction].fx);
  if (a.vow?.done) list.push(VOW_REWARD[a.vow.kind]);
  return traitFx([], list);
}
