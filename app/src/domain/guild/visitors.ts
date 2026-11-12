// Strangers who come to the village: unnamed people who use the town's buildings and pay a little gold.
// How many come each day follows the guild's renown; what they want is drawn at random, and what the town can
// give them (and how many it can take) follows the buildings and their levels.
import type { BuildingId } from './content';
import type { Rng } from './rng';
import { levelOf } from './town';
import type { Guild } from './types';

export type Desire = 'lodging' | 'entertainment' | 'gear' | 'healing' | 'supplies';
export const DESIRES: Desire[] = ['lodging', 'entertainment', 'gear', 'healing', 'supplies'];

export const DESIRE_INFO: Record<Desire, { name: string; verb: string; weight: number; gold: number; from: BuildingId[] }> = {
  lodging: { name: 'Lodging', verb: 'took a room', weight: 0.28, gold: 5, from: ['lodge', 'home'] },
  entertainment: { name: 'Entertainment', verb: 'drank and listened to songs', weight: 0.32, gold: 3, from: ['tavern'] },
  gear: { name: 'Gear', verb: 'bought gear', weight: 0.2, gold: 8, from: ['market', 'smithy', 'armoury'] },
  healing: { name: 'Healing', verb: 'was tended', weight: 0.12, gold: 6, from: ['infirmary', 'chapel'] },
  supplies: { name: 'Supplies', verb: 'bought potions and herbs', weight: 0.08, gold: 4, from: ['stillroom'] },
};

/** Visitors a day at 200 renown. */
export const VISITORS_AT_200 = 10;
/** Visitors per day: 10 at 200 renown, in proportion. */
export const visitorsPerDay = (renown: number) => Math.max(0, Math.round((VISITORS_AT_200 * renown) / 200));
/** How many people a desire can take in a day: a few for the first level, more for each level after. */
export const capacity = (level: number) => (level > 0 ? 3 + 3 * level : 0);

/** The best level among the buildings that can serve a desire. */
export const serviceLevel = (g: Guild, d: Desire) => Math.max(0, ...DESIRE_INFO[d].from.map((b) => levelOf(g, b)));

export interface VisitDay {
  day: number;
  /** Who came, by what they wanted, and how many of them were served. */
  wanted: Record<Desire, number>;
  served: Record<Desire, number>;
  gold: number;
}

const zero = (): Record<Desire, number> => ({ lodging: 0, entertainment: 0, gear: 0, healing: 0, supplies: 0 });

/** One day's visitors: draws what each wants, serves what the town can, and returns the day. */
export function visitDay(g: Guild, day: number, r: Rng): VisitDay {
  const n = visitorsPerDay(g.renown);
  const wanted = zero(), served = zero();
  for (let i = 0; i < n; i++) wanted[r.weighted(DESIRES, (d) => DESIRE_INFO[d].weight)]++;
  let gold = 0;
  for (const d of DESIRES) {
    const lvl = serviceLevel(g, d);
    served[d] = Math.min(wanted[d], capacity(lvl));
    gold += served[d] * Math.round(DESIRE_INFO[d].gold * (1 + 0.2 * Math.max(0, lvl - 1)));
  }
  return { day, wanted, served, gold };
}

export const servedCount = (v: Pick<VisitDay, 'served'>) => DESIRES.reduce((n, d) => n + v.served[d], 0);
export const wantedCount = (v: Pick<VisitDay, 'wanted'>) => DESIRES.reduce((n, d) => n + v.wanted[d], 0);
