// The town: what's built, what it supplies and demands, what it costs, and what it produces.
import type { BuildingId, ClassId, RegionId, StockKey } from './content';
import {
  BUILDINGS, BUILDING_IDS, buildingCap, CLASSES, crewsFor, DAYS_PER_SEASON, DAYS_PER_YEAR, HALL_STEPS, LEGEND_CAP_PER_LEVEL, LEGEND_LEVEL, LEGEND_STAT,
  MAX_BUILDING_LEVEL, MAX_HALL, maxOutFor, maxTierFor, OUTPOST_SLOTS, PHASES_PER_DAY, SEASON_COST, SINGLE, STONE_BONUS, STONE_MAX, workersFor,
} from './content';
import type { Multi } from './plots';
import { isMulti, slotList, slotsFor } from './plots';
import type { Building, Guild } from './types';

// ── Looking things up ────────────────────────────────────────

export const blds = (g: Guild, type: BuildingId) => g.buildings.filter((b) => b.type === type);
export const bld = (g: Guild, type: BuildingId) => g.buildings.find((b) => b.type === type);
export const hallLevel = (g: Guild) => bld(g, 'hall')?.level ?? 1;
/** The effect of a single building at its level, or 0 if it isn't built. */
export const value = (g: Guild, type: BuildingId) => { const b = bld(g, type); return b ? BUILDINGS[type].values[b.level - 1] ?? 0 : 0; };
export const levelOf = (g: Guild, type: BuildingId) => bld(g, type)?.level ?? 0;
/** The summed effect of every building of a type (Homes and Farms). */
export const total = (g: Guild, type: BuildingId) => blds(g, type).reduce((n, b) => n + (BUILDINGS[type].values[b.level - 1] ?? 0), 0);

export const dayOf = (t: number) => Math.floor(t / 3_600_000 / PHASES_PER_DAY);
export const seasonIndex = (t: number) => Math.floor((dayOf(t) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
/** A running count of seasons since founding, for things that refresh each season. */
export const seasonCount = (t: number) => Math.floor(dayOf(t) / DAYS_PER_SEASON);

/** Without a Lodge, a few cots in the Hall hold three. */
export const rosterLimit = (g: Guild) => value(g, 'lodge') || 3;
export const storageCap = (g: Guild) => Math.max(150, value(g, 'warehouse'));
export const outposts = (g: Guild) => Object.values(g.regions).filter((r) => r.liberated).length * OUTPOST_SLOTS;
export const outLimit = (g: Guild) => maxOutFor(hallLevel(g), outposts(g));
export const tierLimit = (g: Guild) => maxTierFor(hallLevel(g));
export const crews = (g: Guild) => crewsFor(hallLevel(g));

// ── Staff ────────────────────────────────────────────────────

export const staffSlots = (b: Building) => (BUILDINGS[b.type].staffable ? (b.level >= 4 ? 2 : b.level >= 2 ? 1 : 0) : 0);
export const staffOf = (g: Guild, b: Building) => g.adventurers.filter((a) => a.state === 'retired' && a.staffAt === b.id);
const staffPct = (cls: ClassId, level: number, type: BuildingId) => level * 0.01 * (BUILDINGS[type].staffClass?.includes(cls) ? 2 : 1);
/** What a building's staff add to what it does: ×1.0 with none, at most ×1.5. */
export function staffMult(g: Guild, type: BuildingId): number {
  const b = bld(g, type);
  if (!b) return 1;
  return 1 + Math.min(0.5, staffOf(g, b).reduce((n, a) => n + staffPct(a.cls, a.level, type), 0));
}

// ── Legends and stones ───────────────────────────────────────

export const isLegend = (a: { state: string; level: number; clears5: number; liberated: number }) =>
  ['retired', 'passed'].includes(a.state) && (a.level >= LEGEND_LEVEL || a.clears5 >= 3 || a.liberated > 0);
export const legendCap = (g: Guild) => (value(g, 'heroes') || LEGEND_CAP_PER_LEVEL) / 100;
/** +1% per legend of the class, up to what the Hall of Heroes allows. */
export const legendBonus = (g: Guild, cls: ClassId) => Math.min(legendCap(g), 0.01 * g.adventurers.filter((a) => a.cls === cls && isLegend(a)).length);
export const stoneCut = (g: Guild, region: RegionId) => Math.min(STONE_MAX, STONE_BONUS * (g.regions[region]?.stones ?? 0));

// ── Capacity ─────────────────────────────────────────────────

export interface Cap { supply: number; demand: number }
export interface Capacity { food: Cap; housing: Cap; happiness: Cap; order: Cap; workers: number; residents: number }

export function capacity(g: Guild, buildings: Building[] = g.buildings): Capacity {
  let workers = 0, food = 0, housing = 0, hap = 2, hapDemand = 0, order = 2;
  for (const b of buildings) {
    const d = BUILDINGS[b.type];
    workers += workersFor(d, b.level);
    const v = d.values[b.level - 1] ?? 0;
    if (b.type === 'farm' || b.type === 'fishery') food += v;
    if (b.type === 'home') housing += v;
    if (b.type === 'watch') order += v;
    const h = d.happy?.[b.level - 1] ?? 0;
    if (h > 0) hap += h; else hapDemand -= h;
    if (b.type === 'garden') hap += Math.min(g.monuments.length, v);
  }
  const retired = g.adventurers.filter((a) => a.state === 'retired').length;
  const children = g.adventurers.filter((a) => a.state === 'child').length;
  const residents = workers + retired + children;
  const active = g.adventurers.filter((a) => a.state === 'active').length;
  return {
    food: { supply: food, demand: residents + active },
    housing: { supply: housing, demand: residents },
    happiness: { supply: hap, demand: hapDemand },
    order: { supply: order, demand: Math.floor(residents / 10) },
    workers, residents,
  };
}
const KEYS = ['food', 'housing', 'happiness', 'order'] as const;
export const surplus = (c: Cap) => c.supply - c.demand;
/** Recruits at the Tavern: its level, plus one for every 5 surplus Happiness. */
/** Without a Tavern, one hopeful at a time knocks on the Hall's door. */
export const tavernSize = (g: Guild) => (value(g, 'tavern') || 1) + Math.max(0, Math.floor(surplus(capacity(g).happiness) / 5));
export const happyTalent = (g: Guild) => Math.max(0, Math.floor(surplus(capacity(g).happiness) / 5));
export const boardSize = (g: Guild, patrolling: number) => Math.min(8, 4 + Math.max(0, Math.floor(surplus(capacity(g).order) / 5)) + (patrolling > 0 ? 1 : 0));

// ── Costs ────────────────────────────────────────────────────

export interface Cost { gold: number; wood: number; stone: number; iron: number; phases: number; renown: number }

export function costOf(g: Guild, type: BuildingId, level: number): Cost {
  const builders = g.charter === 'builders';
  const cut = builders ? 0.85 : 1;
  if (type === 'hall') {
    const h = HALL_STEPS[level]!;
    return { gold: Math.ceil(h.gold * cut), wood: Math.ceil(h.wood * cut), stone: Math.ceil(h.stone * cut), iron: Math.ceil(h.iron * cut), phases: Math.ceil(h.phases * cut), renown: h.renown };
  }
  const d = BUILDINGS[type], k = 2 ** (level - 1);
  const m = (SEASON_COST[seasonIndex(g.t)][type] ?? 1) * cut;
  return {
    gold: Math.ceil(d.base.gold * k * m), wood: Math.ceil((d.base.wood ?? 0) * k * m), stone: Math.ceil((d.base.stone ?? 0) * k * m), iron: Math.ceil((d.base.iron ?? 0) * k * m),
    phases: Math.ceil(d.base.phases * 1.6 ** (level - 1) * cut), renown: 0,
  };
}
/** The cost next season, to show "cheaper next season" hints. */
export const costNextSeason = (g: Guild, type: BuildingId, level: number) => costOf({ ...g, t: g.t + DAYS_PER_SEASON * PHASES_PER_DAY * 3_600_000 }, type, level);

export const underway = (g: Guild, b: Building) => g.construction.some((c) => c.target === b.id);

const afford = (g: Guild, c: Cost) => g.gold >= c.gold && g.stock.wood >= c.wood && g.stock.stone >= c.stone && g.stock.iron >= c.iron;
export const costText = (c: Cost) => [c.gold && c.gold + 'g', c.wood && c.wood + ' wood', c.stone && c.stone + ' stone', c.iron && c.iron + ' iron'].filter(Boolean).join(' · ');

/** Why this can't be started now, or null. `target` is the building being upgraded. */
export function buildProblem(g: Guild, type: BuildingId, target?: Building): string | null {
  const hall = hallLevel(g);
  const level = target ? target.level + 1 : 1;
  if (type === 'hall') {
    if (hall >= MAX_HALL) return 'The Hall is at its highest level';
    if (g.construction.some((c) => c.type === 'hall')) return 'The Hall is already being improved';
  } else {
    const d = BUILDINGS[type];
    if (!target && hall < d.hall) return 'Needs Guild Hall level ' + d.hall;
    if (!target && SINGLE.has(type) && (bld(g, type) || g.construction.some((c) => c.type === type && !c.target))) return 'Already built';
    if (target && level > Math.min(MAX_BUILDING_LEVEL, buildingCap(hall))) return level > MAX_BUILDING_LEVEL ? 'Already at its highest level' : 'Needs Guild Hall level ' + (level * 2 - 1);
    if (target && underway(g, target)) return 'Already being improved';
    if (!target && isMulti(type) && !freePlots(g, type).length) return 'No free plot for another ' + d.name + ' (' + slotsFor(hall) + ' at this Hall level)';
  }
  if (g.construction.length >= crews(g)) return 'Every crew is busy';
  const c = costOf(g, type, type === 'hall' ? hall + 1 : level);
  if (type === 'hall' && g.renown < c.renown) return 'Needs ' + c.renown + ' renown (you have ' + g.renown + ')';
  if (!afford(g, c)) return 'Not enough materials or gold';
  if (type !== 'hall' && !BUILDINGS[type].free) {
    const next = target ? g.buildings.map((b) => (b === target ? { ...b, level } : b)) : [...g.buildings, { id: '?', type, level: 1 }];
    const before = capacity(g), after = capacity(g, next);
    for (const k of KEYS) if (surplus(after[k]) < 0 && surplus(after[k]) < surplus(before[k])) return 'Not enough ' + ({ food: 'food', housing: 'housing', happiness: 'happiness', order: 'order' })[k];
  }
  return null;
}
export const capLabel = (k: typeof KEYS[number]) => ({ food: 'Food', housing: 'Housing', happiness: 'Happiness', order: 'Order' })[k];
export { KEYS as CAP_KEYS, BUILDING_IDS };

/** What each retiree-class pairing means for a building, for display. */
export const staffNote = (type: BuildingId) => { const c = BUILDINGS[type].staffClass; return c ? c.map((x) => CLASSES[x].name).join(' or ') : ''; };
export const legendText = (cls: ClassId) => LEGEND_STAT[cls];
export const STOCKS: StockKey[] = ['wood', 'stone', 'iron', 'herbs'];

/** What production buildings make each phase. */
export function production(g: Guild): Record<StockKey, number> {
  const out: Record<StockKey, number> = { wood: 0, stone: 0, iron: 0, herbs: 0 };
  const map: Partial<Record<BuildingId, StockKey>> = { forestry: 'wood', quarry: 'stone', mine: 'iron', herbs: 'herbs' };
  for (const [type, key] of Object.entries(map) as [BuildingId, StockKey][]) {
    const b = bld(g, type);
    if (b) out[key] += Math.round(BUILDINGS[type].values[b.level - 1] * staffMult(g, type));
  }
  return out;
}

// ── Plots ────────────────────────────────────────────────────

/** Homes and Farms on the map, and how many slots for each the Hall has opened. */
export const slotCount = (g: Guild) => slotsFor(hallLevel(g));
export const countOf = (g: Guild, t: Multi) => g.buildings.filter((b) => b.type === t).length + g.construction.filter((c) => c.type === t && !c.target).length;
/** Open slots for a Home or Farm with nothing built or being built on them. */
export function freePlots(g: Guild, t: Multi): number[] {
  const used = new Set<number>([...g.buildings.filter((b) => b.type === t).map((b) => b.plot), ...g.construction.filter((c) => c.type === t && !c.target).map((c) => c.plot)].filter((n): n is number => n !== undefined));
  return slotList(t).slice(0, slotCount(g)).flatMap((_, i) => (used.has(i) ? [] : [i]));
}
/** The slot a new Home or Farm takes when the player doesn't choose: the nearest free one. Other buildings have a fixed spot. */
export const pickPlot = (g: Guild, type: BuildingId): number | undefined => (isMulti(type) ? freePlots(g, type)[0] : undefined);
