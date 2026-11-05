// Adventurers: making recruits, levels and attributes, and how good they are at their job.
import type { Attr, ClassId, RaceId, Role } from './content';
import {
  ATTR_MAX, ATTRS, CLASS_IDS, DUAL_ROLE_PENALTY, CLASSES, DAYS_PER_SEASON, DAYS_PER_YEAR, MAX_LEVEL, NAMES, PHASE_MS, PHASE_NAMES, PHASES_PER_DAY, PHASES_PER_YEAR,
  pointsPerLevel, RACE_IDS, RACES, SEASON_NAMES, xpToNext,
} from './content';
import { itemRating } from './gear';
import { backstory, pickTraits } from './traits';
import { makeVow, pickConviction } from './vows';
import type { Rng } from './rng';
import { hash, rng } from './rng';
import type { Adventurer, GameMs } from './types';

// ── Clock ────────────────────────────────────────────────────

export const phaseAt = (t: GameMs) => Math.floor(t / PHASE_MS);
export const dayOfPhase = (p: number) => Math.floor(p / PHASES_PER_DAY);

export function clock(t: GameMs) {
  const p = phaseAt(t), day = dayOfPhase(p);
  const year = Math.floor(day / DAYS_PER_YEAR) + 1;
  const inYear = day % DAYS_PER_YEAR;
  return {
    phase: PHASE_NAMES[p % PHASES_PER_DAY],
    season: SEASON_NAMES[Math.floor(inYear / DAYS_PER_SEASON)],
    day: (inYear % DAYS_PER_SEASON) + 1,
    year,
  };
}
export const clockLabel = (t: GameMs) => { const c = clock(t); return 'Day ' + c.day + ' · ' + c.phase + ' · ' + c.season + ' · Year ' + c.year; };
export const shortClock = (t: GameMs) => { const c = clock(t); return c.season + ' ' + c.day + ', Year ' + c.year; };

/** "2 h 10 min", "25 min", "under a minute". */
export function realDuration(ms: number) {
  const m = Math.ceil(ms / 60000);
  if (m <= 0) return 'now';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  if (h < 48) return h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
  return Math.round(h / 24) + ' days';
}

// ── Who they are ─────────────────────────────────────────────

export const fullName = (a: Pick<Adventurer, 'first' | 'family'>) => a.first + ' ' + a.family;
export const role = (a: Pick<Adventurer, 'cls'>): Role => CLASSES[a.cls].role;
/** Every role they can fill: one, or two for Paladins, Druids and Bards. */
export const rolesOf = (a: Pick<Adventurer, 'cls'>): Role[] => { const c = CLASSES[a.cls]; return c.second ? [c.role, c.second] : [c.role]; };
export const hasRole = (a: Pick<Adventurer, 'cls'>, r: Role) => rolesOf(a).includes(r);
export const ageYears = (a: Adventurer, phase: number) => Math.floor((phase - a.bornPhase) / PHASES_PER_YEAR);
export const yearsLeft = (a: Adventurer, phase: number) => Math.max(0, Math.ceil((a.retirePhase - phase) / PHASES_PER_YEAR));
export const isActive = (a: Adventurer) => a.state === 'active';
export const isResident = (a: Adventurer) => a.state === 'retired' || a.state === 'child';
export const isHome = (a: Adventurer) => a.state === 'active' && !a.awayOn;
export const injured = (a: Adventurer, phase: number) => !!a.injury && a.injury.until > phase;
export const canGoOut = (a: Adventurer, phase: number) => (isHome(a) && !injured(a, phase)) || canRecall(a);

/** Class-weighted attributes, 1–20. */
export const weighted = (a: Pick<Adventurer, 'cls' | 'attrs'>) => ATTRS.reduce((n, k) => n + CLASSES[a.cls].weights[k] * a.attrs[k], 0);
export const gearRating = (a: Pick<Adventurer, 'gear'>) => Object.values(a.gear).reduce((n, i) => n + (i ? itemRating(i) : 0), 0);
/** How much they bring to a check: level, half their weighted attributes, and what they carry. */
export const rating = (a: Pick<Adventurer, 'cls' | 'attrs' | 'level' | 'gear'>) => a.level + weighted(a) / 2 + gearRating(a) - (CLASSES[a.cls].second ? DUAL_ROLE_PENALTY : 0);
/** Rating shown to the player, rounded. */
export const ratingShown = (a: Pick<Adventurer, 'cls' | 'attrs' | 'level' | 'gear'>) => Math.round(rating(a));
/** A retiree whose One Last Job is still unused. */
export const canRecall = (a: Adventurer) => a.state === 'retired' && !a.recalled && !a.awayOn;

/** Spread attribute points by class weight, never above the cap. */
function spread(attrs: Record<Attr, number>, cls: ClassId, points: number, r: Rng) {
  const w = CLASSES[cls].weights;
  for (let i = 0; i < points; i++) {
    const open = ATTRS.filter((k) => attrs[k] < ATTR_MAX);
    if (!open.length) return;
    attrs[r.weighted(open, (k) => w[k])]++;
  }
}

/**
 * Adds XP, levelling up as often as it covers. Attribute points per level come from the
 * adventurer's own dice, so the same level always gives the same points.
 */
export function addXp(a: Adventurer, xp: number): number {
  let gained = 0;
  a.xp += xp;
  while (a.level < MAX_LEVEL && a.xp >= xpToNext(a.level)) {
    a.xp -= xpToNext(a.level);
    a.level++;
    gained++;
    spread(a.attrs, a.cls, pointsPerLevel(a.talent), rng(hash(a.id, 'level', a.level)));
  }
  if (a.level >= MAX_LEVEL) a.xp = Math.min(a.xp, xpToNext(MAX_LEVEL));
  return gained;
}

const TALENT_WEIGHT = [15, 30, 30, 17, 8];
const RACE_WEIGHT: Record<RaceId, number> = { human: 35, halfling: 25, dwarf: 20, elf: 20 };

export interface RecruitOpts { cls?: ClassId; race?: RaceId; family?: string; level?: number; talent?: number }

/** A new adventurer, as they walk into the tavern at `phase`. */
export function makeAdventurer(r: Rng, id: string, phase: number, opts: RecruitOpts = {}): Adventurer {
  const race = opts.race ?? r.weighted(RACE_IDS, (x) => RACE_WEIGHT[x]);
  const cls = opts.cls ?? r.pick(CLASS_IDS);
  const R = RACES[race];
  const age = r.int(R.age[0], R.age[1]);
  const frac = (age - R.age[0]) / (R.age[1] - R.age[0]);
  const career = Math.max(3, Math.min(15, Math.round(3 + 12 * (1 - frac)) + r.int(-1, 1)));
  const talent = opts.talent ?? r.weighted([1, 2, 3, 4, 5], (t) => TALENT_WEIGHT[t - 1]);
  const attrs = Object.fromEntries(ATTRS.map((k) => [k, Math.max(1, 4 + r.int(0, 3) + (R.mods[k] ?? 0))])) as Record<Attr, number>;
  attrs[CLASSES[cls].main] += 2;
  const level = opts.level ?? Math.min(7, 1 + Math.floor(frac * 5) + r.int(0, 1));
  spread(attrs, cls, (level - 1) * pointsPerLevel(talent), r);
  const names = NAMES[race];
  const base: Adventurer = {
    id, first: r.pick(names.first), family: opts.family ?? r.pick(names.family), race, cls,
    bornPhase: phase - age * PHASES_PER_YEAR - r.int(0, PHASES_PER_YEAR - 1),
    joinedPhase: phase, career, retirePhase: phase + career * PHASES_PER_YEAR,
    level, xp: 0, talent, attrs, practice: { might: 0, finesse: 0, wits: 0, spirit: 0 },
    health: 100, fatigue: 0, injury: null, scars: [], purse: 0, duty: 'auto', state: 'active', awayOn: null,
    outings: 0, chapter: { quests: 0, habits: 0, campaigns: [], notable: [] }, traitIds: [],
    gear: {}, autoBuy: true, staffAt: null, shared: {}, clears5: 0, liberated: 0,
  };
  const traitIds = pickTraits(r);
  const story = backstory(r, race, traitIds);
  return { ...base, traitIds, backstory: story, conviction: pickConviction(r), vow: makeVow(r, level) };
}
