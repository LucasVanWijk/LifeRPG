// How an outing plays out. One set of stage rules is used twice: `resolve` rolls the real outcome
// once, when the party leaves, and `odds` works out the chances from the same rules: exactly for
// short outings, and from a fixed set of 20,000 seeded runs for the long ones (odysseys).
import type { CharterId, CondOrUnknown, ConditionId, Role, StageKind, StockKey } from './content';
import {
  BOLD_XP, BOSS_EXTRA, RENOWN, CLEAR_AT, COND_PENALTY, difficulty, MISSING_ROLE, ODYSSEY_XP, RACES, ROLE_WEIGHT, SIZE_BONUS, STAGE_GOLD, STAGE_HERBS,
  STAGE_MATERIALS, STANCES, STOCK_KEYS, STRAIN_AT, xpFor, CLASS_COUNTERS, RACE_COUNTERS,
} from './content';
import type { Stance } from './content';
import { rating, role, rolesOf } from './adventurer';
import type { TraitFx } from './traits';
import { KIND_KEY } from './traits';
import { fxFor } from './vows';
import { dropGrade, itemInjuryCut, makeDraft } from './gear';
import type { Rng } from './rng';
import { rng } from './rng';
import type { Adventurer, Loot, MemberResult, NewWound, Offer, Outcome, OutingResult, StageResult } from './types';
import {
  FATIGUE_GAIN, fatigueFactor, healerDowngrade, keepWorst, makeWound, rollSeverity, rollSource, STAMINA_COST, staminaCap, staminaFactor, woundDist, woundFactor,
} from './wounds';
import type { WoundDist } from './wounds';

/** A party member as they were when the party left. */
export interface Member {
  id: string; role: Role; roles: Role[]; fx: TraitFx;
  /** Rating before stamina, fatigue and wounds (those change during the outing). */
  rating: number;
  stamina: number; fatigue: number;
  /** What their wounds leave of their rating (1 = none), and the most stamina they can have. */
  woundFactor: number; cap: number;
  injuryMult: number; xpMult: number;
  /** A ward or a halfling's luck: major wounds are rarer. */
  soften: boolean; elf: boolean; counters: ConditionId[]; partner: string | null;
}
export interface Ctx {
  offer: Offer; stance: Stance; charter: CharterId; members: Member[];
  /** What is really there, or `unknown` for something the party can't see when working out odds. */
  conditions: CondOrUnknown[];
  /** Multipliers on loot and XP from the phase, region, charter, legends and library. */
  lootMult: number; goldMult: number; matMult: number; xpMult: number;
  /** Multiplier on the chance of wounds: witness stones, and legends of the Guardian class. */
  injuryMult: number;
  /** Which phase of the day they set out in: 0 morning, 1 noon, 2 evening. */
  phase: number;
}

export const NEUTRAL = { lootMult: 1, goldMult: 1, matMult: 1, xpMult: 1, injuryMult: 1, phase: 1 };

export interface SnapshotOpts { ward?: boolean; heal?: boolean; penalty?: number }
export const snapshot = (a: Adventurer, o: SnapshotOpts = {}): Member => {
  const trinket = a.gear.trinket?.counters;
  const cut = a.gear.armour ? itemInjuryCut(a.gear.armour) : 0;
  const fx = fxFor(a);
  const cap = staminaCap(a.wounds);
  return {
    id: a.id, role: role(a), roles: rolesOf(a), fx, rating: rating(a) - (o.penalty ?? 0),
    stamina: Math.min(cap, o.heal ? a.stamina + 40 : a.stamina), fatigue: a.fatigue, woundFactor: woundFactor(a.wounds), cap,
    injuryMult: RACES[a.race].injuryMult * (1 - cut), xpMult: RACES[a.race].xpMult * (1 + fx.x), soften: !!o.ward || a.race === 'halfling', elf: a.race === 'elf',
    counters: [...CLASS_COUNTERS[a.cls], ...(RACE_COUNTERS[a.race] ?? []), ...fx.cnt, ...(trinket ? [trinket] : [])], partner: a.partnerId ?? null,
  };
};

interface State { stamina: number[]; fatigue: number[]; fails: number }

const start = (ctx: Ctx): State => ({ stamina: ctx.members.map((m) => m.stamina), fatigue: ctx.members.map((m) => m.fatigue), fails: 0 });
const copy = (s: State): State => ({ stamina: [...s.stamina], fatigue: [...s.fatigue], fails: s.fails });
const everyone = (s: State) => s.stamina.map((_, i) => i);
const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);

// ── The rules of one stage ───────────────────────────────────

/** Conditions that nobody in the party counters. */
export function uncountered(ctx: Ctx, _s?: State): number {
  return ctx.conditions.filter((c) => c === 'unknown' || !ctx.members.some((m) => m.counters.includes(c))).length;
}

/** One member's rating for this kind of check: what their traits do in this party and setting, times how fit they are right now. */
function memberRating(ctx: Ctx, m: Member, kind: Exclude<StageKind, 'rest'>, n: number, stamina: number, fatigue: number): number {
  const f = m.fx, k = KIND_KEY[kind];
  const base = m.rating + f.r + (k ? f[k] : 0) + (ctx.stance === 'bold' ? f.bold : ctx.stance === 'cautious' ? f.caut : 0)
    + (n <= 2 ? f.solo : 0) + f.team * (Math.min(n, 5) - 1) + (ctx.phase === 2 ? f.eve : ctx.phase === 0 ? f.morn : 0);
  return base * staminaFactor(stamina) * fatigueFactor(fatigue) * m.woundFactor;
}

/** What the party brings to a check of this kind. */
export function partyScore(ctx: Ctx, s: State, kind: Exclude<StageKind, 'rest'>): number {
  const idx = everyone(s);
  const w = ROLE_WEIGHT[kind];
  let sum = 0, weights = 0;
  for (const i of idx) { const m = ctx.members[i]; const wt = Math.max(...m.roles.map((r) => w[r])); sum += wt * memberRating(ctx, m, kind, idx.length, s.stamina[i], s.fatigue[i]); weights += wt; }
  let score = sum / Math.max(1e-9, weights) + SIZE_BONUS * Math.min(5, idx.length - 1);
  const miss = MISSING_ROLE[kind];
  if (miss && !idx.some((i) => ctx.members[i].roles.includes(miss.role))) score -= miss.penalty;
  if ((kind === 'hazard' || kind === 'trap') && idx.some((i) => ctx.members[i].elf)) score += 1;
  if (idx.some((i) => ctx.members[i].partner && idx.some((j) => ctx.members[j].id === ctx.members[i].partner))) score += 1;
  score -= COND_PENALTY * uncountered(ctx, s);
  if (kind === 'endurance') score -= avg(s.fatigue) / 30 + (100 - avg(s.stamina)) / 40;
  return score;
}

/** Chances of Clear, Strain and Fail for a d20 roll plus `margin`. */
export function outcomeChances(margin: number): [number, number, number] {
  let c = 0, st = 0;
  for (let r = 1; r <= 20; r++) { const v = r + margin; if (v >= CLEAR_AT) c++; else if (v >= STRAIN_AT) st++; }
  return [c / 20, st / 20, (20 - c - st) / 20];
}

function margin(ctx: Ctx, s: State, kind: StageKind): number {
  const o = ctx.offer;
  if (o.tutorial) return 100;
  if (o.scale === 'odd') return 3;
  if (kind === 'rest') return 100;
  return partyScore(ctx, s, kind) - difficulty(o.tier) - (kind === 'boss' ? BOSS_EXTRA : 0);
}

/** One member's chances of no wound, or a trivial, minor or major one, at a stage. Healers in the party soften them. */
function wounds(ctx: Ctx, s: State, i: number, outcome: Outcome, kind: StageKind): WoundDist {
  const m = ctx.members[i];
  if (kind === 'rest' || ctx.offer.tutorial) return { none: 1, trivial: 0, minor: 0, major: 0 };
  const healers = ctx.members.filter((x) => x.roles.includes('healer')).map((x) => x.rating);
  const charter = ctx.charter === 'hospitaller' ? 0.8 : 1;
  // Higher tiers hurt more, and a trait that used to make death likelier now makes wounds worse.
  const tier = ctx.offer.scale === 'odd' ? 0.7 : 0.7 + 0.1 * ctx.offer.tier;
  const mult = m.injuryMult * Math.max(0.2, 1 + m.fx.i + m.fx.d) * ctx.injuryMult * STANCES[ctx.stance].injury * charter * tier;
  return woundDist({ outcome, kind, mult, fatigue: s.fatigue[i], stamina: s.stamina[i], downgrade: healerDowngrade(healers), soften: m.soften, odd: ctx.offer.scale === 'odd' });
}

/** Stamina and fatigue after the stage. */
function afterStage(ctx: Ctx, s: State, kind: StageKind, outcome: Outcome) {
  const f = STANCES[ctx.stance].fatigue;
  for (const i of everyone(s)) {
    if (kind === 'rest') { s.stamina[i] = Math.min(ctx.members[i].cap, s.stamina[i] + 10); s.fatigue[i] = Math.max(0, s.fatigue[i] - 2); continue; }
    const fx = Math.max(0.2, 1 + ctx.members[i].fx.f);
    s.stamina[i] = Math.max(0, s.stamina[i] - STAMINA_COST[outcome] * f * fx);
    s.fatigue[i] = Math.min(100, s.fatigue[i] + FATIGUE_GAIN[outcome] * f * fx);
  }
  if (outcome === 'fail') s.fails++;
}

const over = (ctx: Ctx, s: State) => s.fails >= STANCES[ctx.stance].turnBackAt;

// ── Loot and XP ──────────────────────────────────────────────

const emptyLoot = (): Loot => ({ gold: 0 });
function stageLoot(ctx: Ctx, kind: StageKind, outcome: Outcome, r?: Rng): Loot {
  const o = ctx.offer;
  if (o.scale === 'odd') {
    const k = outcome === 'clear' ? 1 : outcome === 'strain' ? 0.6 : 0;
    const out: Loot = { gold: (o.pay?.gold ?? 0) * k };
    for (const key of STOCK_KEYS) if (o.pay?.[key]) out[key] = o.pay[key]! * k;
    return out;
  }
  if (kind === 'rest' || outcome === 'fail') return emptyLoot();
  const t = o.tier - 1, k = (outcome === 'strain' ? 0.75 : 1) * STANCES[ctx.stance].loot * ctx.lootMult;
  const gold = (base: number) => base * k * ctx.goldMult;
  const mat = (base: number) => base * k * ctx.matMult;
  if (o.kind === 'gold') return { gold: gold(STAGE_GOLD[t]) };
  if (o.kind === 'alchemy') return { gold: gold(STAGE_GOLD[t] / 5), herbs: mat(STAGE_HERBS[t]) };
  if (o.kind === 'items') {
    const out: Loot = { gold: gold(STAGE_GOLD[t] / 5) };
    if (r && r.chance((outcome === 'clear' ? 0.4 : 0.22) * (ctx.stance === 'bold' ? 1.2 : 1))) out.items = [makeDraft(r, dropGrade(r, o.tier))];
    return out;
  }
  const m = mat(STAGE_MATERIALS[t]);
  return { gold: gold(STAGE_GOLD[t] / 5), wood: m * 0.5, stone: m * 0.35, iron: m * 0.15 };
}

function addLoot(a: Loot, b: Loot, k = 1): Loot {
  const out: Loot = { ...a, gold: a.gold + b.gold * k };
  for (const key of STOCK_KEYS) if (b[key]) out[key] = (out[key] ?? 0) + b[key]! * k;
  if (b.items?.length) out.items = [...(a.items ?? []), ...b.items];
  return out;
}
export const roundLoot = (l: Loot): Loot => {
  const out: Loot = { gold: Math.round(l.gold) };
  for (const key of STOCK_KEYS as StockKey[]) if (l[key]) out[key] = Math.round(l[key]!);
  if (l.items?.length) out.items = l.items;
  return out;
};

/** The boss chest: on a Clear, or half the time on a Strain when Bold. */
const chestChance = (ctx: Ctx, kind: StageKind, outcome: Outcome) =>
  kind !== 'boss' ? 0 : outcome === 'clear' ? 1 : outcome === 'strain' && ctx.stance === 'bold' ? 0.5 : 0;
function chestLoot(ctx: Ctx, r?: Rng): Loot {
  const l = addLoot(emptyLoot(), stageLoot(ctx, 'boss', 'clear'), 2);
  if (r && ctx.offer.kind === 'items') l.items = [...(l.items ?? []), makeDraft(r, dropGrade(r, ctx.offer.tier, 1))];
  if (r && ctx.offer.scale === 'odyssey') l.items = [...(l.items ?? []), makeDraft(r, Math.min(4, ctx.offer.tier - 1), 'trinket')];
  return l;
}

/** XP each survivor earns, before their race's bonus. */
function outingXp(ctx: Ctx, outcomes: Outcome[]): number {
  const o = ctx.offer;
  if (o.scale === 'odd') return (o.xp ?? 0) * (outcomes[0] === 'clear' ? 1 : outcomes[0] === 'strain' ? 0.6 : 0.2) * ctx.xpMult;
  const checks = o.stages.filter((s) => s.kind !== 'rest').length;
  const cleared = outcomes.filter((x, i) => x !== 'fail' && o.stages[i].kind !== 'rest').length;
  return xpFor(o.tier) * (cleared / checks) * (ctx.stance === 'bold' ? BOLD_XP : 1) * (o.scale === 'odyssey' ? ODYSSEY_XP : 1) * ctx.xpMult;
}

/** Renown an outing earns from how its stages went (see RENOWN): a share for every check passed, as much again when flawless. */
export function outingRenown(offer: Pick<Offer, 'scale' | 'tier' | 'stages'>, outcomes: Outcome[]): number {
  if (offer.scale === 'odd') return 0;
  const worth = offer.scale === 'odyssey' ? RENOWN.odyssey * offer.tier : offer.tier * offer.tier;
  const checks = offer.stages.filter((s) => s.kind !== 'rest').length;
  const passed = outcomes.filter((x, i) => x !== 'fail' && offer.stages[i].kind !== 'rest').length;
  if (!passed || !checks) return 0;
  const flawless = outcomes.length === offer.stages.length && outcomes.every((x) => x !== 'fail');
  return Math.max(1, Math.round((worth * RENOWN.share * passed) / checks)) + (flawless ? Math.round(worth * RENOWN.flawless) : 0);
}

// ── Rolling the real outcome ─────────────────────────────────

export function resolve(ctx: Ctx, r: Rng): OutingResult {
  const s = start(ctx);
  const stages: StageResult[] = [];
  const outcomes: Outcome[] = [];
  const got: Record<string, NewWound[]> = {};
  let loot: Loot = emptyLoot(), chest: Loot | null = null;
  for (const plan of ctx.offer.stages) {
    const [pc, ps] = outcomeChances(margin(ctx, s, plan.kind));
    const u = r.next();
    const outcome: Outcome = plan.kind === 'rest' ? 'clear' : u < pc ? 'clear' : u < pc + ps ? 'strain' : 'fail';
    const res: StageResult = { outcome, injured: [], hurt: [], loot: stageLoot(ctx, plan.kind, outcome, r) };
    for (const i of everyone(s)) {
      const sev = rollSeverity(wounds(ctx, s, i, outcome, plan.kind), r.next());
      if (!sev) continue;
      const source = rollSource(r, plan.kind);
      const id = ctx.members[i].id;
      (got[id] ??= []).push(makeWound(r, source, sev));
      res.injured.push(id);
      res.hurt!.push({ id, severity: sev, source });
    }
    loot = addLoot(loot, res.loot);
    if (r.chance(chestChance(ctx, plan.kind, outcome))) { chest = roundLoot(chestLoot(ctx, r)); loot = addLoot(loot, chest); }
    afterStage(ctx, s, plan.kind, outcome);
    stages.push({ ...res, loot: roundLoot(res.loot) });
    outcomes.push(outcome);
    if (over(ctx, s)) break;
  }
  const xp = outingXp(ctx, outcomes);
  const members: Record<string, MemberResult> = {};
  ctx.members.forEach((m, i) => {
    members[m.id] = { stamina: Math.round(s.stamina[i]), fatigue: Math.round(s.fatigue[i] * 10) / 10, died: false, xp: Math.round(xp * m.xpMult), wounds: keepWorst(got[m.id] ?? []) };
  });
  return { stages, turnedBack: stages.length < ctx.offer.stages.length, chest, loot: roundLoot(loot), members };
}

// ── Odds ─────────────────────────────────────────────────────

export interface Odds {
  /** Every stage played without a failure. */
  full: number;
  turnBack: number;
  /** The chance somebody comes home with a major wound. */
  anyMajor: number;
  /** For each member: the chance of any wound, and of a major one. */
  injury: Record<string, number>;
  major: Record<string, number>;
  /** Expected loot, and the gold range between the 10th and 90th percentile. */
  loot: Loot;
  goldLow: number;
  goldHigh: number;
  xp: number;
  /** Expected renown. */
  renown: number;
}

/** Branches less likely than this are dropped; far below what the screen shows. */
const PRUNE = 1e-9;
/** Outings with more stages than this are sampled instead of walked branch by branch. */
export const EXACT_STAGES = 8;
export const SAMPLES = 20000;

export function odds(ctx: Ctx): Odds {
  return ctx.offer.stages.length > EXACT_STAGES ? sampled(ctx) : exact(ctx);
}

/** The odds as a range when some conditions are hidden: none of them matter, to all of them being uncountered. */
export function oddsRange(ctx: Ctx, hidden: number): { lo: Odds; hi: Odds } {
  const known = ctx.conditions.filter((c) => c !== 'unknown');
  const lo = odds({ ...ctx, conditions: known });
  if (!hidden) return { lo, hi: lo };
  return { lo, hi: odds({ ...ctx, conditions: [...known, ...Array<CondOrUnknown>(hidden).fill('unknown')] }) };
}

function sampled(ctx: Ctx): Odds {
  const n = ctx.members.length;
  const out: Odds = { full: 0, turnBack: 0, anyMajor: 0, injury: {}, major: {}, loot: emptyLoot(), goldLow: 0, goldHigh: 0, xp: 0, renown: 0 };
  for (const m of ctx.members) { out.injury[m.id] = 0; out.major[m.id] = 0; }
  const golds: number[] = [];
  let loot: Loot = emptyLoot(), xp = 0;
  for (let k = 0; k < SAMPLES; k++) {
    const r = resolve(ctx, rng(0x9e3779b9 ^ (k * 2654435761)));
    if (r.stages.length === ctx.offer.stages.length && r.stages.every((s) => s.outcome !== 'fail')) out.full++;
    if (r.turnedBack) out.turnBack++;
    let major = false;
    for (const m of ctx.members) {
      const mr = r.members[m.id];
      if (mr.wounds?.length) out.injury[m.id]++;
      if (mr.wounds?.some((w) => w.severity === 'major')) { out.major[m.id]++; major = true; }
      xp += mr.xp;
    }
    if (major) out.anyMajor++;
    out.renown += outingRenown(ctx.offer, r.stages.map((s) => s.outcome));
    loot = addLoot(loot, { ...r.loot, items: undefined });
    golds.push(r.loot.gold);
  }
  const N = SAMPLES;
  out.full /= N; out.turnBack /= N; out.anyMajor /= N; out.renown /= N;
  for (const m of ctx.members) { out.injury[m.id] /= N; out.major[m.id] /= N; }
  golds.sort((a, b) => a - b);
  out.goldLow = golds[Math.floor(N * 0.1)]; out.goldHigh = golds[Math.floor(N * 0.9)];
  out.loot = roundLoot({ gold: loot.gold / N, wood: (loot.wood ?? 0) / N, stone: (loot.stone ?? 0) / N, iron: (loot.iron ?? 0) / N, herbs: (loot.herbs ?? 0) / N });
  out.xp = Math.round(xp / N / Math.max(1, n));
  return out;
}

function exact(ctx: Ctx): Odds {
  const n = ctx.members.length;
  const out: Odds = { full: 0, turnBack: 0, anyMajor: 0, injury: {}, major: {}, loot: emptyLoot(), goldLow: 0, goldHigh: 0, xp: 0, renown: 0 };
  for (const m of ctx.members) { out.injury[m.id] = 0; out.major[m.id] = 0; }
  const leaves: { p: number; gold: number }[] = [];

  // Wounds don't change how the rest of the outing goes, so each member's chance of none, or of no major one, just multiplies along the way.
  const walk = (k: number, s: State, p: number, notHurt: number[], notMajor: number[], loot: Loot, outcomes: Outcome[]) => {
    if (p < PRUNE) return;
    const done = k >= ctx.offer.stages.length || (k > 0 && over(ctx, s));
    if (done) {
      if (outcomes.every((o) => o !== 'fail') && k === ctx.offer.stages.length) out.full += p;
      if (k < ctx.offer.stages.length) out.turnBack += p;
      out.loot = addLoot(out.loot, loot, p);
      const xp = outingXp(ctx, outcomes);
      let none = 1;
      for (let i = 0; i < n; i++) {
        const id = ctx.members[i].id;
        out.injury[id] += p * (1 - notHurt[i]);
        out.major[id] += p * (1 - notMajor[i]);
        none *= notMajor[i];
      }
      out.anyMajor += p * (1 - none);
      out.xp += p * xp;
      out.renown += p * outingRenown(ctx.offer, outcomes);
      leaves.push({ p, gold: loot.gold });
      return;
    }
    const plan = ctx.offer.stages[k];
    const chances = plan.kind === 'rest' ? [1, 0, 0] : outcomeChances(margin(ctx, s, plan.kind));
    (['clear', 'strain', 'fail'] as Outcome[]).forEach((outcome, oi) => {
      const po = chances[oi];
      if (po <= 0) return;
      const base = addLoot(loot, stageLoot(ctx, plan.kind, outcome));
      const cc = chestChance(ctx, plan.kind, outcome);
      const withChest = cc ? addLoot(base, chestLoot(ctx), cc) : base;
      const nh = [...notHurt], nm = [...notMajor];
      for (const i of everyone(s)) { const d = wounds(ctx, s, i, outcome, plan.kind); nh[i] *= d.none; nm[i] *= 1 - d.major; }
      const s2 = copy(s);
      afterStage(ctx, s2, plan.kind, outcome);
      walk(k + 1, s2, p * po, nh, nm, withChest, [...outcomes, outcome]);
    });
  };

  walk(0, start(ctx), 1, ctx.members.map(() => 1), ctx.members.map(() => 1), emptyLoot(), []);
  leaves.sort((a, b) => a.gold - b.gold);
  const pct = (q: number) => { let acc = 0; for (const l of leaves) { acc += l.p; if (acc >= q) return l.gold; } return leaves.length ? leaves[leaves.length - 1].gold : 0; };
  out.goldLow = Math.round(pct(0.1));
  out.goldHigh = Math.round(pct(0.9));
  out.loot = roundLoot(out.loot);
  out.xp = Math.round(out.xp);
  return out;
}

