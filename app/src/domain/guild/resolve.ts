// How an outing plays out. One set of stage rules is used twice: `resolve` rolls the real outcome
// once, when the party leaves, and `odds` walks every branch of the same rules to give exact chances.
import type { CharterId, Role, StageKind, StockKey } from './content';
import {
  BOLD_XP, BOSS_EXTRA, CLEAR_AT, DEATH_BASE, difficulty, EXPOSURE, FATIGUE_GAIN, HEALER_SAVE, HEALTH_LOSS, INJURIES, INJURY_CHANCE,
  INJURY_DAYS, INJURY_HEALER_MULT, MISSING_ROLE, RACES, ROLE_WEIGHT, SCAR_CHANCE, SCARS, SIZE_BONUS, STAGE_GOLD, STAGE_HERBS,
  STAGE_MATERIALS, STANCES, STRAIN_AT, xpFor,
} from './content';
import type { Stance } from './content';
import { rating, role } from './adventurer';
import type { Rng } from './rng';
import type { Adventurer, Loot, MemberResult, Offer, Outcome, OutingResult, StageResult } from './types';

/** A party member as they were when the party left. */
export interface Member { id: string; role: Role; rating: number; health: number; fatigue: number; injuryMult: number; xpMult: number; lucky: boolean; elf: boolean }
export interface Ctx { offer: Offer; stance: Stance; charter: CharterId; members: Member[] }

export const snapshot = (a: Adventurer): Member => ({
  id: a.id, role: role(a), rating: rating(a), health: a.health, fatigue: a.fatigue,
  injuryMult: RACES[a.race].injuryMult, xpMult: RACES[a.race].xpMult, lucky: a.race === 'halfling' && !a.luckUsed, elf: a.race === 'elf',
});

interface State { alive: boolean[]; health: number[]; fatigue: number[]; fails: number; luck: boolean[] }

const start = (ctx: Ctx): State => ({
  alive: ctx.members.map(() => true), health: ctx.members.map((m) => m.health), fatigue: ctx.members.map((m) => m.fatigue),
  fails: 0, luck: ctx.members.map((m) => m.lucky),
});
const copy = (s: State): State => ({ alive: [...s.alive], health: [...s.health], fatigue: [...s.fatigue], fails: s.fails, luck: [...s.luck] });
const living = (s: State) => s.alive.flatMap((a, i) => (a ? [i] : []));
const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);

// ── The rules of one stage ───────────────────────────────────

/** What the party brings to a check of this kind. */
export function partyScore(ctx: Ctx, s: State, kind: Exclude<StageKind, 'rest'>): number {
  const idx = living(s);
  const w = ROLE_WEIGHT[kind];
  let sum = 0, weights = 0;
  for (const i of idx) { const m = ctx.members[i]; sum += w[m.role] * m.rating; weights += w[m.role]; }
  let score = sum / Math.max(1e-9, weights) + SIZE_BONUS * Math.min(5, idx.length - 1);
  const miss = MISSING_ROLE[kind];
  if (miss && !idx.some((i) => ctx.members[i].role === miss.role)) score -= miss.penalty;
  if ((kind === 'hazard' || kind === 'trap') && idx.some((i) => ctx.members[i].elf)) score += 1;
  const fat = avg(idx.map((i) => s.fatigue[i]));
  if (fat > 70) score -= 2;
  if (kind === 'endurance') score -= fat / 20 + (100 - avg(idx.map((i) => s.health[i]))) / 25;
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

const healerAlive = (ctx: Ctx, s: State) => living(s).some((i) => ctx.members[i].role === 'healer');

function injuryChance(ctx: Ctx, s: State, i: number, outcome: Outcome): number {
  if (outcome === 'clear' || ctx.offer.tutorial) return 0;
  const base = INJURY_CHANCE[outcome] * (ctx.offer.scale === 'odd' ? 0.5 : 1);
  return Math.min(0.9, base * ctx.members[i].injuryMult * STANCES[ctx.stance].injury * (healerAlive(ctx, s) ? INJURY_HEALER_MULT : 1));
}

/** On a failed stage one member is struck: who, and how likely they die or are saved. */
function strikes(ctx: Ctx, s: State) {
  if (ctx.offer.scale === 'odd') return [];
  const idx = living(s);
  const w = idx.map((i) => EXPOSURE[ctx.members[i].role] * (1 + (100 - s.health[i]) / 100));
  const total = w.reduce((n, x) => n + x, 0);
  const healers = idx.filter((i) => ctx.members[i].role === 'healer');
  const heal = healers.length ? Math.min(HEALER_SAVE.max, HEALER_SAVE.base + HEALER_SAVE.perRating * Math.max(...healers.map((i) => ctx.members[i].rating))) : 0;
  const charter = ctx.charter === 'hospitaller' ? 0.2 : 0;
  return idx.map((i, k) => {
    const raw = Math.min(0.95, DEATH_BASE * STANCES[ctx.stance].death * (1 + (100 - s.health[i]) / 50));
    const hit = (w[k] / total) * raw;
    const byHealer = hit * heal;
    const byCharter = hit * (1 - heal) * charter;
    const fatal = hit * (1 - heal) * (1 - charter);
    return { i, byHealer, byCharter, byLuck: s.luck[i] ? fatal : 0, die: s.luck[i] ? 0 : fatal };
  });
}

/** Health and fatigue after the stage, for everyone still standing. */
function afterStage(ctx: Ctx, s: State, kind: StageKind, outcome: Outcome) {
  const f = STANCES[ctx.stance].fatigue;
  for (const i of living(s)) {
    if (kind === 'rest') { s.health[i] = Math.min(100, s.health[i] + 10); s.fatigue[i] = Math.max(0, s.fatigue[i] - 10); continue; }
    if (outcome !== 'clear') s.health[i] = Math.max(0, s.health[i] - HEALTH_LOSS[outcome]);
    s.fatigue[i] = Math.min(100, s.fatigue[i] + FATIGUE_GAIN[outcome] * f);
  }
  if (outcome === 'fail') s.fails++;
}

const over = (ctx: Ctx, s: State) => s.fails >= STANCES[ctx.stance].turnBackAt || !s.alive.some(Boolean);

// ── Loot and XP ──────────────────────────────────────────────

function stageLoot(ctx: Ctx, kind: StageKind, outcome: Outcome): Loot {
  const o = ctx.offer;
  if (o.scale === 'odd') {
    const k = outcome === 'clear' ? 1 : outcome === 'strain' ? 0.6 : 0;
    const out: Loot = { gold: (o.pay?.gold ?? 0) * k };
    for (const key of ['wood', 'stone', 'iron', 'herbs'] as StockKey[]) if (o.pay?.[key]) out[key] = o.pay[key]! * k;
    return out;
  }
  if (kind === 'rest' || outcome === 'fail') return { gold: 0 };
  const t = o.tier - 1, k = (outcome === 'strain' ? 0.75 : 1) * STANCES[ctx.stance].loot;
  const goldMult = ctx.charter === 'mercantile' ? 1.15 : 1;
  if (o.kind === 'gold') return { gold: STAGE_GOLD[t] * k * goldMult };
  if (o.kind === 'alchemy') return { gold: (STAGE_GOLD[t] / 5) * k * goldMult, herbs: STAGE_HERBS[t] * k };
  const m = STAGE_MATERIALS[t] * k;
  return { gold: (STAGE_GOLD[t] / 5) * k * goldMult, wood: m * 0.5, stone: m * 0.35, iron: m * 0.15 };
}

function addLoot(a: Loot, b: Loot, k = 1): Loot {
  const out: Loot = { ...a, gold: a.gold + b.gold * k };
  for (const key of ['wood', 'stone', 'iron', 'herbs'] as StockKey[]) if (b[key]) out[key] = (out[key] ?? 0) + b[key]! * k;
  return out;
}
export const roundLoot = (l: Loot): Loot => {
  const out: Loot = { gold: Math.round(l.gold) };
  for (const key of ['wood', 'stone', 'iron', 'herbs'] as StockKey[]) if (l[key]) out[key] = Math.round(l[key]!);
  return out;
};

/** The boss chest: on a Clear, or half the time on a Strain when Bold. */
const chestChance = (ctx: Ctx, kind: StageKind, outcome: Outcome) =>
  kind !== 'boss' ? 0 : outcome === 'clear' ? 1 : outcome === 'strain' && ctx.stance === 'bold' ? 0.5 : 0;
const chestLoot = (ctx: Ctx): Loot => { const l = stageLoot(ctx, 'boss', 'clear'); return addLoot({ gold: 0 }, l, 2); };

/** XP each survivor earns, before their race's bonus. */
function outingXp(ctx: Ctx, outcomes: Outcome[]): number {
  const o = ctx.offer;
  const martial = ctx.charter === 'martial' ? 1.15 : 1;
  if (o.scale === 'odd') return (o.xp ?? 0) * (outcomes[0] === 'clear' ? 1 : outcomes[0] === 'strain' ? 0.6 : 0.2) * martial;
  const checks = o.stages.filter((s) => s.kind !== 'rest').length;
  const cleared = outcomes.filter((x, i) => x !== 'fail' && o.stages[i].kind !== 'rest').length;
  return xpFor(o.tier) * (cleared / checks) * (ctx.stance === 'bold' ? BOLD_XP : 1) * martial;
}

// ── Rolling the real outcome ─────────────────────────────────

export function resolve(ctx: Ctx, r: Rng): OutingResult {
  const s = start(ctx);
  const stages: StageResult[] = [];
  const outcomes: Outcome[] = [];
  const injuredAt: Record<string, boolean> = {};
  let loot: Loot = { gold: 0 }, chest: Loot | null = null;
  for (const plan of ctx.offer.stages) {
    const [pc, ps] = outcomeChances(margin(ctx, s, plan.kind));
    const u = r.next();
    const outcome: Outcome = plan.kind === 'rest' ? 'clear' : u < pc ? 'clear' : u < pc + ps ? 'strain' : 'fail';
    const res: StageResult = { outcome, injured: [], loot: stageLoot(ctx, plan.kind, outcome) };
    for (const i of living(s)) if (r.chance(injuryChance(ctx, s, i, outcome))) res.injured.push(ctx.members[i].id);
    if (outcome === 'fail') {
      let u2 = r.next();
      for (const st of strikes(ctx, s)) {
        const id = ctx.members[st.i].id;
        if ((u2 -= st.die) < 0) { res.died = id; s.alive[st.i] = false; break; }
        if ((u2 -= st.byLuck) < 0) { res.saved = { id, by: 'luck' }; s.luck[st.i] = false; break; }
        if ((u2 -= st.byHealer) < 0) { res.saved = { id, by: 'healer' }; break; }
        if ((u2 -= st.byCharter) < 0) { res.saved = { id, by: 'charter' }; break; }
      }
      if (res.saved && !res.injured.includes(res.saved.id)) res.injured.push(res.saved.id);
    }
    res.injured = res.injured.filter((id) => id !== res.died);
    for (const id of res.injured) injuredAt[id] = true;
    loot = addLoot(loot, res.loot);
    if (r.chance(chestChance(ctx, plan.kind, outcome))) { chest = roundLoot(chestLoot(ctx)); loot = addLoot(loot, chest); }
    afterStage(ctx, s, plan.kind, outcome);
    stages.push({ ...res, loot: roundLoot(res.loot) });
    outcomes.push(outcome);
    if (over(ctx, s)) break;
  }
  const xp = outingXp(ctx, outcomes);
  const members: Record<string, MemberResult> = {};
  ctx.members.forEach((m, i) => {
    const res: MemberResult = { health: Math.round(s.health[i]), fatigue: Math.round(s.fatigue[i]), died: !s.alive[i], xp: s.alive[i] ? Math.round(xp * m.xpMult) : 0 };
    if (s.alive[i] && injuredAt[m.id]) {
      res.injury = { text: r.pick(INJURIES), days: r.int(INJURY_DAYS[0], INJURY_DAYS[1]) };
      if (r.chance(SCAR_CHANCE)) res.scar = r.pick(SCARS).text;
    }
    members[m.id] = res;
  });
  return { stages, turnedBack: stages.length < ctx.offer.stages.length && s.alive.some(Boolean), chest, loot: roundLoot(loot), members };
}

// ── Exact odds ───────────────────────────────────────────────

export interface Odds {
  /** Every stage played without a failure. */
  full: number;
  turnBack: number;
  anyDeath: number;
  death: Record<string, number>;
  injury: Record<string, number>;
  /** Expected loot, and the gold range between the 10th and 90th percentile. */
  loot: Loot;
  goldLow: number;
  goldHigh: number;
  xp: number;
}

/** Branches less likely than this are dropped; far below what the screen shows. */
const PRUNE = 1e-9;

export function odds(ctx: Ctx): Odds {
  const n = ctx.members.length;
  const out: Odds = { full: 0, turnBack: 0, anyDeath: 0, death: {}, injury: {}, loot: { gold: 0 }, goldLow: 0, goldHigh: 0, xp: 0 };
  for (const m of ctx.members) { out.death[m.id] = 0; out.injury[m.id] = 0; }
  const leaves: { p: number; gold: number }[] = [];

  const walk = (k: number, s: State, p: number, notHurt: number[], loot: Loot, outcomes: Outcome[], deaths: number) => {
    if (p < PRUNE) return;
    const done = k >= ctx.offer.stages.length || (k > 0 && over(ctx, s));
    if (done) {
      if (outcomes.every((o) => o !== 'fail') && k === ctx.offer.stages.length) out.full += p;
      if (k < ctx.offer.stages.length && s.alive.some(Boolean)) out.turnBack += p;
      if (deaths) out.anyDeath += p;
      out.loot = addLoot(out.loot, loot, p);
      const xp = outingXp(ctx, outcomes);
      let alive = 0;
      for (let i = 0; i < n; i++) {
        const id = ctx.members[i].id;
        if (!s.alive[i]) out.death[id] += p;
        else { out.injury[id] += p * (1 - notHurt[i]); alive++; }
      }
      out.xp += p * xp * (alive ? 1 : 0);
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
      const hurt = living(s).map((i) => [i, injuryChance(ctx, s, i, outcome)] as const);
      const next = (s2: State, pp: number, extraHurt: number | null, died: boolean) => {
        const nh = [...notHurt];
        for (const [i, c] of hurt) nh[i] *= 1 - c;
        if (extraHurt !== null) nh[extraHurt] = 0;
        afterStage(ctx, s2, plan.kind, outcome);
        walk(k + 1, s2, pp, nh, withChest, [...outcomes, outcome], deaths + (died ? 1 : 0));
      };
      if (outcome !== 'fail') { next(copy(s), p * po, null, false); return; }
      const sts = strikes(ctx, s);
      let calm = 1;
      // Saves by healer or charter change nothing but the injury; fold them into the injury chances.
      const savedHurt = new Map<number, number>();
      for (const st of sts) {
        calm -= st.die + st.byLuck + st.byHealer + st.byCharter;
        savedHurt.set(st.i, st.byHealer + st.byCharter);
        if (st.die > 0) { const s2 = copy(s); s2.alive[st.i] = false; next(s2, p * po * st.die, null, true); }
        if (st.byLuck > 0) { const s2 = copy(s); s2.luck[st.i] = false; next(s2, p * po * st.byLuck, st.i, false); }
      }
      const pCalm = calm + [...savedHurt.values()].reduce((a, b) => a + b, 0);
      if (pCalm > 0) {
        const s2 = copy(s);
        const nh = [...notHurt];
        for (const [i, c] of hurt) nh[i] *= 1 - c;
        for (const [i, c] of savedHurt) nh[i] *= 1 - c / pCalm;
        afterStage(ctx, s2, plan.kind, outcome);
        walk(k + 1, s2, p * po * pCalm, nh, withChest, [...outcomes, outcome], deaths);
      }
    });
  };

  walk(0, start(ctx), 1, ctx.members.map(() => 1), { gold: 0 }, [], 0);
  leaves.sort((a, b) => a.gold - b.gold);
  const pct = (q: number) => { let acc = 0; for (const l of leaves) { acc += l.p; if (acc >= q) return l.gold; } return leaves.length ? leaves[leaves.length - 1].gold : 0; };
  out.goldLow = Math.round(pct(0.1));
  out.goldHigh = Math.round(pct(0.9));
  out.loot = roundLoot(out.loot);
  out.xp = Math.round(out.xp);
  return out;
}
