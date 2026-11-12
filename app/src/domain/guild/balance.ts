// Wound simulation used by the balance test: how often adventurers come home hurt, by stance and danger.
import type { ClassId, Stance } from './content';
import { CLASSES, REGION_ORDER, stageCount, tierLevels } from './content';
import { makeAdventurer } from './adventurer';
import { makeExpedition } from './board';
import type { Ctx } from './resolve';
import { NEUTRAL, resolve, snapshot } from './resolve';
import { rngFor } from './rng';

export interface WoundStats {
  outings: number;
  /** Share of outings after which a member came home with at least a wound of that severity (or worse). */
  any: number; minor: number; major: number;
  /** Share of outings after which a member has at least one wound at all. */
}

/**
 * Plays `outings` outings of one tier with a party of four of fitting level and says how often a member comes home wounded.
 * `over` raises the tier above what the party suits, to see how a dangerous expedition feels.
 */
export function woundStats(stance: Stance, tier: number, over = 0, outings = 1500, seed = 7, levelBonus = 0): WoundStats {
  const classes: ClassId[] = ['guardian', 'cleric', 'ranger', 'arcanist'];
  let any = 0, minor = 0, major = 0, n = 0;
  for (let i = 0; i < outings; i++) {
    const [lo, hi] = tierLevels(tier);
    const level = Math.min(20, rngFor(seed, 'lvl', i).int(lo, hi) + levelBonus);
    const party = classes.map((cls, k) => makeAdventurer(rngFor(seed, i, k), 'p' + k, 0, { cls, level }));
    const offer = makeExpedition(rngFor(seed, 'offer', i), 'o', 0, { maxTier: 5, regions: REGION_ORDER });
    offer.tier = Math.min(5, tier + over);
    offer.stages = offer.stages.slice(0, stageCount(offer.tier));
    while (offer.stages.length < stageCount(offer.tier)) offer.stages.unshift({ kind: 'combat', title: '' });
    const ctx: Ctx = { ...NEUTRAL, offer, stance, charter: 'martial', members: party.map((a) => snapshot(a)), conditions: offer.conditions.map((x) => x.id) };
    const res = resolve(ctx, rngFor(seed, 'run', i));
    for (const p of party) {
      const w = res.members[p.id].wounds ?? [];
      n++;
      if (w.length) any++;
      if (w.some((x) => x.severity !== 'trivial')) minor++;
      if (w.some((x) => x.severity === 'major')) major++;
    }
  }
  return { outings: n, any: any / n, minor: minor / n, major: major / n };
}

export const roleOf = (cls: ClassId) => CLASSES[cls].role;
