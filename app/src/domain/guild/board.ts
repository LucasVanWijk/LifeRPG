// What the board offers: odd jobs every phase, expeditions every day.
import type { LootKind, Role, StageKind } from './content';
import {
  MAX_TIER, ODD_JOB_MINUTES, ODD_JOBS, OFFER_WORDS, PHASES_PER_DAY, stageCount, STAGE_TITLES, tierPhases, TUTORIAL_JOB, TUTORIAL_MINUTES,
} from './content';
import type { Rng } from './rng';
import type { Loot, Offer, StagePlan } from './types';

const KIND_WEIGHT: Record<LootKind, number> = { gold: 40, materials: 35, alchemy: 25 };
const STAGE_WEIGHT: Record<Exclude<StageKind, 'boss'>, number> = { combat: 45, hazard: 20, trap: 15, endurance: 12, rest: 8 };

function stagesFor(r: Rng, tier: number): StagePlan[] {
  const n = stageCount(tier);
  const out: StagePlan[] = [];
  for (let i = 0; i < n - 1; i++) {
    const kinds = (Object.keys(STAGE_WEIGHT) as (keyof typeof STAGE_WEIGHT)[])
      .filter((k) => k !== 'rest' || (i > 0 && out[i - 1].kind !== 'rest'));
    const kind = r.weighted(kinds, (k) => STAGE_WEIGHT[k]);
    out.push({ kind, title: r.pick(STAGE_TITLES[kind]) });
  }
  out.push({ kind: 'boss', title: r.pick(STAGE_TITLES.boss) });
  return out;
}

/** An expedition posted at the start of `day`. */
export function makeExpedition(r: Rng, id: string, day: number, maxTier = MAX_TIER): Offer {
  const tier = r.weighted([1, 2, 3, 4, 5].filter((t) => t <= maxTier), (t) => [55, 45, 35, 25, 15][t - 1]);
  const kind = r.weighted(Object.keys(KIND_WEIGHT) as LootKind[], (k) => KIND_WEIGHT[k]);
  const [lo, hi] = tierPhases(tier);
  const needs: Role[] = tier >= 2 && r.chance(0.4) ? [r.pick(['tank', 'healer'] as Role[])] : [];
  return {
    id, scale: 'expedition', kind, tier,
    name: 'The ' + r.pick(OFFER_WORDS.adj) + ' ' + r.pick(OFFER_WORDS[kind]),
    phases: r.int(lo, hi), minParty: tier, maxParty: 3 + tier, needs,
    stages: stagesFor(r, tier),
    expires: (day + r.int(2, 4)) * PHASES_PER_DAY,
  };
}

/** A small job for one or two, posted at the start of `phase`. */
export function makeOddJob(r: Rng, id: string, phase: number): Offer {
  const title = r.pick(ODD_JOBS);
  const pay: Loot = { gold: r.int(2, 6) };
  if (r.chance(0.3)) pay[r.pick(['wood', 'stone'] as const)] = r.int(3, 8);
  return {
    id, scale: 'odd', kind: 'gold', tier: 0, name: title, minutes: r.int(ODD_JOB_MINUTES[0], ODD_JOB_MINUTES[1]),
    minParty: 1, maxParty: 2, needs: [], stages: [{ kind: 'combat', title }], expires: phase + 2, xp: r.int(5, 15), pay,
  };
}

/** The first job of every guild: short, safe and certain. */
export const tutorialJob = (id: string): Offer => ({
  id, scale: 'odd', kind: 'gold', tier: 0, name: TUTORIAL_JOB, minutes: TUTORIAL_MINUTES, minParty: 1, maxParty: 2, needs: [],
  stages: [{ kind: 'combat', title: TUTORIAL_JOB }], expires: Number.MAX_SAFE_INTEGER, xp: 10, pay: { gold: 10 }, tutorial: true,
});

export const offerMinutes = (o: Offer) => (o.scale === 'odd' ? o.minutes ?? 30 : (o.phases ?? 1) * 60);
