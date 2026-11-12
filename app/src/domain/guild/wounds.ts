// Wounds, stamina and fatigue.
// Stamina is energy right now: outings drain it, rest restores it, and it matters a lot to how well someone performs.
// Fatigue is the slow weariness of the work: it builds with outings and with the years served, and mends slowly.
// Wounds come in three severities and from three sources, and lower the most stamina someone can have.
import type { StageKind } from './content';
import type { Rng } from './rng';
import type { Adventurer, NewWound, Outcome, Severity, Wound, WoundSource } from './types';

export const SEVERITIES: Severity[] = ['trivial', 'minor', 'major'];
export const SOURCES: WoundSource[] = ['physical', 'disease', 'magical'];
export const SEVERITY_NAME: Record<Severity, string> = { trivial: 'Trivial', minor: 'Minor', major: 'Major' };
export const SOURCE_NAME: Record<WoundSource, string> = { physical: 'Physical', disease: 'Disease', magical: 'Magical' };

// ── Stamina and fatigue ──────────────────────────────────────

export const STAMINA_REGEN = 5;
/** What each stage costs in stamina. An outing of a day or two takes about half; a few in a row leaves nothing. */
export const STAMINA_COST: Record<Outcome, number> = { clear: 6, strain: 11, fail: 19 };
export const FATIGUE_GAIN: Record<Outcome, number> = { clear: 0.8, strain: 1.6, fail: 3 };
/** Fatigue that mends per phase of rest, down to the floor. */
export const FATIGUE_REGEN = 0.3;
/** How high the floor reaches as someone nears retirement. */
export const FATIGUE_FLOOR_MAX = 80;

/** How tired the years have made someone: nothing when they join, FATIGUE_FLOOR_MAX at retirement. */
export function fatigueFloor(a: Pick<Adventurer, 'joinedPhase' | 'retirePhase'>, phase: number): number {
  const span = Math.max(1, a.retirePhase - a.joinedPhase);
  const progress = Math.min(1, Math.max(0, (phase - a.joinedPhase) / span));
  return Math.round(FATIGUE_FLOOR_MAX * progress * progress * 10) / 10;
}

/** Their performance at this much stamina: 100% when full, still 98% at 80, 89% at half, and 55% when empty (stamina matters most). */
export const staminaFactor = (stamina: number) => 1 - 0.45 * Math.pow(1 - Math.min(100, Math.max(0, stamina)) / 100, 2);
/** …and at this much fatigue: down to 80% at 100 (87% at 80, about 95% at 50). */
export const fatigueFactor = (fatigue: number) => 1 - 0.2 * Math.pow(Math.min(100, Math.max(0, fatigue)) / 100, 2);

// ── Wounds ───────────────────────────────────────────────────

/** Stamina a wound takes off the most someone can have, and the share of their rating it costs. */
export const WOUND_STAMINA: Record<Severity, number> = { trivial: 5, minor: 15, major: 35 };
export const WOUND_RATING: Record<Severity, number> = { trivial: 0, minor: 0.03, major: 0.2 };
/** Phases of rest to heal at the normal pace (3 phases a day): about a day, a few days, one to three weeks. */
export const WOUND_PHASES: Record<Severity, [number, number]> = { trivial: [2, 4], minor: [6, 15], major: [18, 54] };
/** Healing runs at this pace while the wounded are out on an expedition. */
export const AWAY_HEAL = 1 / 3;

export const staminaCap = (wounds: Pick<Wound, 'severity'>[]) => Math.max(20, 100 - Math.min(80, wounds.reduce((n, w) => n + WOUND_STAMINA[w.severity], 0)));
export const woundFactor = (wounds: Pick<Wound, 'severity'>[]) => Math.max(0.4, 1 - wounds.reduce((n, w) => n + WOUND_RATING[w.severity], 0));
export const worst = (wounds: Pick<Wound, 'severity'>[]): Severity | null => SEVERITIES.slice().reverse().find((s) => wounds.some((w) => w.severity === s)) ?? null;

/** Everything that shapes how well someone does right now, as one multiplier on their rating. */
export const conditionFactor = (a: Pick<Adventurer, 'stamina' | 'fatigue' | 'wounds'>) => staminaFactor(a.stamina) * fatigueFactor(a.fatigue) * woundFactor(a.wounds ?? []);

/** Chance of a wound per member per stage, by how the stage went, before everything that changes it. */
export const WOUND_CHANCE: Record<Outcome, number> = { clear: 0.08, strain: 0.28, fail: 0.68 };
/** Of the wounds that happen, the share that is trivial, minor and major. */
export const SEVERITY_MIX: Record<Outcome, [number, number, number]> = { clear: [0.7, 0.28, 0.02], strain: [0.55, 0.35, 0.1], fail: [0.28, 0.45, 0.27] };
/** A boss makes the worst wounds more likely. */
export const BOSS_MAJOR = 1.5;
/** A ward, or a halfling's luck, makes major wounds this much rarer. */
export const SOFTEN_MAJOR = 0.25;
/** More fatigue and less stamina both make wounds more likely. */
export const FATIGUE_INJURY = 1.0;
export const STAMINA_INJURY = 0.5;
/** A healer in the party downgrades a wound by one grade this often (a trivial one becomes nothing). */
export const HEALER_DOWNGRADE = { base: 0.3, perRating: 0.01, max: 0.6 };

/** Where wounds come from, by the kind of stage. */
export const SOURCE_MIX: Record<Exclude<StageKind, 'rest'>, [number, number, number]> = {
  combat: [0.8, 0.05, 0.15], hazard: [0.5, 0.4, 0.1], trap: [0.5, 0.3, 0.2], endurance: [0.3, 0.6, 0.1], boss: [0.5, 0.1, 0.4],
};

export interface WoundDist { none: number; trivial: number; minor: number; major: number }

/** The chances of no wound, or a trivial, minor or major one, for one member at one stage. */
export function woundDist(o: { outcome: Outcome; kind: StageKind; mult: number; fatigue: number; stamina: number; downgrade: number; soften: boolean; odd?: boolean }): WoundDist {
  if (o.outcome === 'clear' && o.odd) return { none: 1, trivial: 0, minor: 0, major: 0 };
  const chance = Math.min(0.95, WOUND_CHANCE[o.outcome] * (o.odd ? 0.5 : 1) * o.mult * (1 + FATIGUE_INJURY * o.fatigue / 100) * (1 + STAMINA_INJURY * (100 - o.stamina) / 100));
  let [t, m, M] = SEVERITY_MIX[o.outcome];
  if (o.kind === 'boss') M *= BOSS_MAJOR;
  if (o.soften) M *= SOFTEN_MAJOR;
  const sum = t + m + M;
  t /= sum; m /= sum; M /= sum;
  let qt = chance * t, qm = chance * m, qM = chance * M;
  const h = o.downgrade;
  if (h > 0) { const nt = qt * (1 - h) + qm * h, nm = qm * (1 - h) + qM * h, nM = qM * (1 - h); qt = nt; qm = nm; qM = nM; }
  return { none: 1 - qt - qm - qM, trivial: qt, minor: qm, major: qM };
}

export function healerDowngrade(ratings: number[]): number {
  return ratings.length ? Math.min(HEALER_DOWNGRADE.max, HEALER_DOWNGRADE.base + HEALER_DOWNGRADE.perRating * Math.max(...ratings)) : 0;
}

export function rollSeverity(d: WoundDist, u: number): Severity | null {
  if ((u -= d.trivial) < 0) return 'trivial';
  if ((u -= d.minor) < 0) return 'minor';
  if ((u -= d.major) < 0) return 'major';
  return null;
}

export function rollSource(r: Rng, kind: StageKind): WoundSource {
  const w = SOURCE_MIX[kind === 'rest' ? 'endurance' : kind];
  let u = r.next();
  for (let i = 0; i < 3; i++) if ((u -= w[i]) < 0) return SOURCES[i];
  return 'physical';
}

export const WOUND_TEXT: Record<WoundSource, Record<Severity, string[]>> = {
  physical: {
    trivial: ['bruised ribs', 'a sprained wrist', 'scraped knees', 'a black eye', 'a stiff back'],
    minor: ['a deep cut', 'a twisted ankle', 'a cracked rib', 'a gashed arm', 'a sprained knee'],
    major: ['a broken leg', 'a shattered arm', 'a punctured lung', 'a crushed hand', 'a broken back'],
  },
  disease: {
    trivial: ['a cough', 'the shivers', 'a stomach upset', 'a head cold'],
    minor: ['a fever', 'a festering scratch', 'swamp lung', 'a poisoned cut'],
    major: ['a wasting sickness', 'a grave poisoning', 'the red plague', 'blood-rot'],
  },
  magical: {
    trivial: ['a numb hand', 'ringing ears', 'a flicker in the vision', 'a faint curse of clumsiness'],
    minor: ['a hex of weakness', 'singed nerves', 'a whispering dread', 'frost-touched fingers'],
    major: ['a withering curse', 'a soul-burn', 'a mind-fracture', 'a binding hex'],
  },
};

export function makeWound(r: Rng, source: WoundSource, severity: Severity): NewWound {
  const [lo, hi] = WOUND_PHASES[severity];
  return { source, severity, text: r.pick(WOUND_TEXT[source][severity]), phases: r.int(lo, hi) };
}

/** At most three wounds go home with one person: the worst ones. */
export function keepWorst(list: NewWound[], n = 3): NewWound[] {
  return [...list].sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity)).slice(0, n);
}

/** Chance a healed major wound leaves a scar, and how treatment changes it. */
export const SCAR_CHANCE = 0.6;
export const SCAR_CHANCE_TREATED = 0.2;
