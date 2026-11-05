// Career simulation used by the balance test: how many adventurers die before they retire under a play style.
import type { ClassId, Stance } from './content';
import { CLASSES, DAYS_PER_YEAR, REGION_ORDER, stageCount, tierLevels } from './content';
import { makeAdventurer } from './adventurer';
import { makeExpedition } from './board';
import type { Ctx } from './resolve';
import { NEUTRAL, resolve, snapshot } from './resolve';
import { rngFor } from './rng';

export interface Style {
  stance: Stance;
  /** Tiers above what the party's level suits. */
  overTier: number;
  healer: boolean;
  /** Outings per real day. */
  perDay: number;
}
export const CAREFUL: Style = { stance: 'steady', overTier: 0, healer: true, perDay: 1.5 };
/** One risk taken every time (here Bold) is enough to lose about two in three; stacking risks loses nearly everyone. */
export const RISKY: Style = { stance: 'bold', overTier: 0, healer: true, perDay: 1.5 };

/**
 * Follows `careers` adventurers through whole careers (3–15 years at 8 real days a year), each outing
 * with a party of four at a tier that suits their level (plus `overTier`). Returns the share who died.
 */
export function deathShare(style: Style, careers = 400, seed = 7): number {
  const r = rngFor(seed, 'balance');
  let died = 0;
  for (let c = 0; c < careers; c++) {
    const years = r.int(3, 15);
    const outings = Math.round(years * (DAYS_PER_YEAR / 8) * style.perDay);
    const classes: ClassId[] = ['guardian', style.healer ? 'cleric' : 'blademaster', 'ranger', 'arcanist'];
    const hero = r.int(0, 3);
    for (let i = 0; i < outings; i++) {
      // The level band they are in at this point of their career, rising from tier 1 to tier 5.
      const tier = Math.min(5, 1 + Math.floor((5 * i) / Math.max(1, outings)));
      const [lo, hi] = tierLevels(tier);
      const level = r.int(lo, hi);
      const party = classes.map((cls, k) => makeAdventurer(rngFor(seed, c, i, k), 'p' + k, 0, { cls, level }));
      const offer = makeExpedition(rngFor(seed, 'offer', c, i), 'o', 0, { maxTier: 5, regions: REGION_ORDER });
      offer.tier = Math.min(5, tier + style.overTier);
      offer.stages = offer.stages.slice(0, stageCount(offer.tier));
      while (offer.stages.length < stageCount(offer.tier)) offer.stages.unshift({ kind: 'combat', title: '' });
      const ctx: Ctx = { ...NEUTRAL, offer, stance: style.stance, charter: 'martial', members: party.map((a) => snapshot(a)), conditions: offer.conditions.map((x) => x.id) };
      const res = resolve(ctx, rngFor(seed, 'run', c, i));
      if (res.members[party[hero].id].died) { died++; break; }
    }
  }
  return died / careers;
}

export const roleOf = (cls: ClassId) => CLASSES[cls].role;
