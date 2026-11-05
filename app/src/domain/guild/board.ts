// What the board offers: odd jobs every phase, expeditions every day, odysseys and recoveries when earned.
import type { ConditionId, LootKind, RegionId, Role, StageKind } from './content';
import {
  COND_IDS, ODD_JOB_MINUTES, ODD_JOBS, ODYSSEY, OFFER_WORDS, PHASES_PER_DAY, RECOVERY_EXPIRES, REGIONS, stageCount, STAGE_TITLES, tierPhases, TUTORIAL_JOB,
  TUTORIAL_MINUTES,
} from './content';
import type { Rng } from './rng';
import type { Adventurer, Loot, Offer, Outing, StagePlan } from './types';

const KIND_WEIGHT: Record<LootKind, number> = { gold: 35, materials: 30, alchemy: 20, items: 15 };
const STAGE_WEIGHT: Record<Exclude<StageKind, 'boss' | 'rest'>, number> = { combat: 45, hazard: 20, trap: 15, endurance: 12 };

const stage = (r: Rng, kind: StageKind): StagePlan => ({ kind, title: r.pick(STAGE_TITLES[kind]) });
const randomStage = (r: Rng, allowed = Object.keys(STAGE_WEIGHT) as (keyof typeof STAGE_WEIGHT)[]) => stage(r, r.weighted(allowed, (k) => STAGE_WEIGHT[k]));

function stagesFor(r: Rng, tier: number): StagePlan[] {
  const n = stageCount(tier);
  const out: StagePlan[] = [];
  for (let i = 0; i < n - 1; i++) {
    out.push(i > 0 && out[i - 1].kind !== 'rest' && r.chance(0.08) ? stage(r, 'rest') : randomStage(r));
  }
  out.push(stage(r, 'boss'));
  return out;
}

/** Conditions for a place: mostly the region's own, some from anywhere. */
function conditionsFor(r: Rng, tier: number, region: RegionId, hide: boolean): Offer['conditions'] {
  const count = tier === 1 ? (r.chance(0.4) ? 1 : 0) : tier === 2 ? r.int(1, 2) : r.int(2, 3);
  const picked: ConditionId[] = [];
  const pool = REGIONS[region].conds;
  while (picked.length < count) {
    const c = r.chance(0.8) ? r.pick(pool) : r.pick(COND_IDS);
    if (!picked.includes(c)) picked.push(c);
    if (picked.length >= COND_IDS.length) break;
  }
  return picked.map((id) => ({ id, hidden: hide && r.chance(0.5) }));
}

export interface BoardOpts {
  maxTier: number;
  /** Regions the Cartographer has opened. */
  regions: RegionId[];
}

/** An expedition posted at the start of `day`. */
export function makeExpedition(r: Rng, id: string, day: number, o: BoardOpts = { maxTier: 5, regions: ['hearth'] }): Offer {
  const open = o.regions.filter((x) => REGIONS[x].tiers[0] <= o.maxTier);
  const region = r.pick(open.length ? open : (['hearth'] as RegionId[]));
  const [lo, hi] = REGIONS[region].tiers;
  const tiers = [1, 2, 3, 4, 5].filter((t) => t >= lo && t <= Math.min(hi, o.maxTier));
  const tier = r.weighted(tiers.length ? tiers : [1], (t) => [55, 45, 35, 25, 15][t - 1]);
  const kind = r.weighted(Object.keys(KIND_WEIGHT) as LootKind[], (k) => KIND_WEIGHT[k]);
  const [plo, phi] = tierPhases(tier);
  const needs: Role[] = tier >= 2 && r.chance(0.4) ? [r.pick(['tank', 'healer'] as Role[])] : [];
  return {
    id, scale: 'expedition', kind, tier, region,
    name: 'The ' + r.pick(OFFER_WORDS.adj) + ' ' + r.pick(OFFER_WORDS[kind === 'items' ? 'gold' : kind]),
    phases: r.int(plo, phi), minParty: tier, maxParty: 3 + tier, needs,
    conditions: conditionsFor(r, tier, region, tier >= 2),
    stages: stagesFor(r, tier),
    expires: (day + r.int(2, 4)) * PHASES_PER_DAY,
  };
}

/** The lair of a region: legs of fighting and travelling, with its boss at the end. */
export function makeOdyssey(r: Rng, id: string, region: RegionId, day: number): Offer {
  const reg = REGIONS[region], lair = reg.lair!;
  const legs = r.int(ODYSSEY.legs[0], ODYSSEY.legs[1]);
  const stages: StagePlan[] = [];
  for (let i = 0; i < legs; i++) {
    stages.push(randomStage(r, ['combat', 'hazard']));
    stages.push(randomStage(r, ['combat', 'trap', 'endurance']));
    if (i < legs - 1) stages.push(stage(r, 'rest'));
  }
  stages.push({ kind: 'boss', title: lair.boss });
  return {
    id, scale: 'odyssey', kind: 'items', tier: lair.tier, region, name: lair.name,
    phases: r.int(ODYSSEY.phases[0], ODYSSEY.phases[1]), minParty: ODYSSEY.party[0], maxParty: ODYSSEY.party[1], needs: ['tank', 'healer'],
    conditions: conditionsFor(r, 3, region, true), stages, expires: (day + ODYSSEY.expires / PHASES_PER_DAY) * PHASES_PER_DAY,
  };
}

/** An expedition to bring someone home, where they fell. */
export function makeRecovery(a: Adventurer, from: Outing, phase: number): Offer {
  const o = from.offer;
  return {
    id: 'rec-' + a.id, scale: 'expedition', kind: 'gold', tier: Math.max(1, o.tier), region: o.region, name: 'Bring ' + a.first + ' home', phases: Math.max(2, o.phases ?? 4),
    minParty: Math.max(1, o.tier), maxParty: 3 + Math.max(1, o.tier), needs: [], conditions: o.conditions.map((c) => ({ ...c, hidden: false })),
    stages: o.stages.filter((s) => s.kind !== 'rest').slice(0, Math.max(3, o.stages.length - 1)),
    expires: phase + RECOVERY_EXPIRES, recover: a.id,
  };
}

/** A small job for one or two, posted at the start of `phase`. */
export function makeOddJob(r: Rng, id: string, phase: number): Offer {
  const title = r.pick(ODD_JOBS);
  const pay: Loot = { gold: r.int(2, 6) };
  if (r.chance(0.3)) pay[r.pick(['wood', 'stone'] as const)] = r.int(3, 8);
  return {
    id, scale: 'odd', kind: 'gold', tier: 0, region: 'hearth', name: title, minutes: r.int(ODD_JOB_MINUTES[0], ODD_JOB_MINUTES[1]),
    minParty: 1, maxParty: 2, needs: [], conditions: [], stages: [{ kind: 'combat', title }], expires: phase + 2, xp: r.int(5, 15), pay,
  };
}

/** The first job of every guild: short, safe and certain. */
export const tutorialJob = (id: string): Offer => ({
  id, scale: 'odd', kind: 'gold', tier: 0, region: 'hearth', name: TUTORIAL_JOB, minutes: TUTORIAL_MINUTES, minParty: 1, maxParty: 2, needs: [], conditions: [],
  stages: [{ kind: 'combat', title: TUTORIAL_JOB }], expires: Number.MAX_SAFE_INTEGER, xp: 10, pay: { gold: 10 }, tutorial: true,
});

export const offerMinutes = (o: Offer) => (o.scale === 'odd' ? o.minutes ?? 30 : (o.phases ?? 1) * 60);
