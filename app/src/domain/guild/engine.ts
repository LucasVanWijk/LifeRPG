// The guild over time. Pure functions over plain data: every action returns a new guild,
// and `advance` plays out everything that happened since the last time it ran.
import type { Attr, CharterId, ClassId, Stance } from './content';
import {
  ATTR_MAX, AUTO_REST, BOARD_SIZE, CLASSES, DAYS_PER_YEAR, FATIGUE_REGEN, HEALTH_REGEN, hireFee, insurance, MAX_OUT, MAX_TIER, NOTICE_FEE,
  ODD_JOBS_ON_BOARD, PHASE_MS, PHASES_PER_DAY, PHASES_PER_YEAR, PRACTICE_PER_POINT, PURSE_SHARE, RACES, RECRUIT_STAY_DAYS, REST_MULT,
  ROSTER_LIMIT, SCARS, START_GOLD, START_STOCK, STANCES, TAVERN_REFRESH_DAYS, TAVERN_SIZE, TRAIN_XP,
} from './content';
import { addXp, canGoOut, dayOfPhase, injured, isActive, makeAdventurer, phaseAt, role } from './adventurer';
import { makeExpedition, makeOddJob, tutorialJob } from './board';
import type { Ctx } from './resolve';
import { resolve, snapshot } from './resolve';
import { rngFor } from './rng';
import type { Adventurer, Duty, Entry, GameMs, Guild, LedgerEntry, Offer, Outing } from './types';

const KEEP_REPORTS = 60;

/** A working copy: everything cloned except the append-only logs, which keep their identity until written. */
function draft(g: Guild): Guild {
  const { ledger, chronicle, ...rest } = g;
  return { ...structuredClone(rest), ledger, chronicle };
}
const log = (g: Guild, e: Omit<Entry, 'at'>, at = g.t) => { g.chronicle = [...g.chronicle, { at, ...e }]; };
const nextId = (g: Guild, prefix: string) => prefix + (++g.counter).toString(36);
export const phaseNow = (g: Guild) => phaseAt(g.t);
export const byId = (g: Guild, id: string | null | undefined) => (id ? g.adventurers.find((a) => a.id === id) : undefined);
export const active = (g: Guild) => g.adventurers.filter(isActive);
export const champion = (g: Guild) => { const a = byId(g, g.championId); return a && isActive(a) ? a : undefined; };
export const expeditionsOut = (g: Guild) => g.outings.filter((o) => !o.done && o.offer.scale === 'expedition').length;

// ── Founding ─────────────────────────────────────────────────

export interface Founding { name: string; town: string; charter: CharterId; crestSeed: number; seed: number }

/** A new guild with three free starting adventurers (a Tank, a Healer and a DPS); pick a Champion next. */
export function found(f: Founding, now: number): Guild {
  const g: Guild = {
    name: f.name, town: f.town, charter: f.charter, crestSeed: f.crestSeed, seed: f.seed, founded: now, t: 0,
    gold: START_GOLD, renown: 0, bankedXp: 0, stock: { ...START_STOCK }, adventurers: [], championId: null,
    recruits: [], notice: null, nextTavernDay: 0, board: [], outings: [], chronicle: [], ledger: [], tutorialDone: false, counter: 0,
  };
  const dps: ClassId = rngFor(f.seed, 'starter-dps').pick(['ranger', 'arcanist', 'blademaster'] as ClassId[]);
  (['guardian', 'cleric', dps] as ClassId[]).forEach((cls, i) => {
    const a = makeAdventurer(rngFor(f.seed, 'starter', i), nextId(g, 'a'), 0, { cls });
    g.adventurers.push(a);
  });
  g.board.push(tutorialJob(nextId(g, 'o')));
  phaseTick(g, 0);
  log(g, { k: 'found', t: f.name });
  return g;
}

// ── Time passing ─────────────────────────────────────────────

export interface Advanced { guild: Guild; entries: Entry[]; elapsed: number }

/** Plays out everything up to `now`: phases, deaths at their stage, returns. Uncapped. */
export function advance(g0: Guild, now: number): Advanced {
  const target = now - g0.founded;
  if (target <= g0.t) return { guild: g0, entries: [], elapsed: 0 };
  const g = draft(g0);
  const before = g.chronicle.length, from = g.t;
  for (;;) {
    const nextPhase = (phaseAt(g.t) + 1) * PHASE_MS;
    let ev: { t: GameMs; o: Outing; stage: number | null } | null = null;
    for (const o of g.outings) {
      if (o.done) continue;
      let cand: { t: GameMs; o: Outing; stage: number | null } = { t: o.returnAt, o, stage: null };
      for (let i = o.applied; i < o.result.stages.length; i++) if (o.result.stages[i].died) { cand = { t: o.stageAt[i], o, stage: i }; break; }
      if (!ev || cand.t < ev.t) ev = cand;
    }
    if (ev && ev.t <= nextPhase && ev.t <= target) {
      g.t = Math.max(g.t, ev.t);
      if (ev.stage === null) returnHome(g, ev.o);
      else { fall(g, ev.o, ev.stage); }
    } else if (nextPhase <= target) {
      g.t = nextPhase;
      phaseTick(g, phaseAt(nextPhase));
    } else break;
  }
  g.t = target;
  return { guild: g, entries: g.chronicle.slice(before), elapsed: target - from };
}

/** The start of phase `p`: recovery, duties, retirement, and the board and tavern on a new day. */
function phaseTick(g: Guild, p: number) {
  for (const a of g.adventurers) {
    if (!isActive(a) || a.awayOn) continue;
    if (a.injury && a.injury.until <= p) a.injury = null;
    const hurt = injured(a, p);
    const duty = effectiveDuty(a, p);
    const k = duty === 'rest' ? REST_MULT : 1;
    a.health = Math.min(100, a.health + HEALTH_REGEN * k);
    a.fatigue = Math.max(0, a.fatigue - FATIGUE_REGEN * k);
    if (duty === 'train' && !hurt) gainXp(g, a, TRAIN_XP * RACES[a.race].xpMult);
    if (p >= a.retirePhase) retire(g, a);
  }

  const odd = g.board.filter((o) => o.scale === 'odd' && !o.tutorial);
  g.board = g.board.filter((o) => !(o.scale === 'odd' && !o.tutorial && o.expires <= p));
  const want = rngFor(g.seed, 'odd-count', p).int(ODD_JOBS_ON_BOARD[0], ODD_JOBS_ON_BOARD[1]);
  for (let i = odd.filter((o) => o.expires > p).length; i < want; i++) g.board.push(makeOddJob(rngFor(g.seed, 'odd', p, i), nextId(g, 'o'), p));

  if (p % PHASES_PER_DAY !== 0) return;
  const day = dayOfPhase(p);
  g.board = g.board.filter((o) => o.scale !== 'expedition' || o.expires > p);
  for (let i = g.board.filter((o) => o.scale === 'expedition').length; i < BOARD_SIZE; i++) {
    g.board.push(makeExpedition(rngFor(g.seed, 'board', day, i), nextId(g, 'o'), day, MAX_TIER));
  }
  g.recruits = g.recruits.filter((r) => r.leaves > p);
  if (day >= g.nextTavernDay) refreshTavern(g, p, day);
  if (day > 0 && day % DAYS_PER_YEAR === 0) log(g, { k: 'year', v: day / DAYS_PER_YEAR + 1 });
}

/** New faces at the tavern. At least one Tank or Healer, and the class from a notice if one was posted. */
function refreshTavern(g: Guild, p: number, day: number) {
  const r = rngFor(g.seed, 'tavern', day);
  const forced: (ClassId | undefined)[] = [];
  if (g.notice) forced.push(g.notice.cls);
  const all = () => g.recruits.map((x) => x.adv);
  while (g.recruits.length < TAVERN_SIZE || forced.length) {
    if (g.recruits.length >= TAVERN_SIZE) g.recruits.shift();
    let cls = forced.shift();
    if (!cls && !all().some((a) => role(a) === 'tank' || role(a) === 'healer') && g.recruits.length === TAVERN_SIZE - 1) cls = r.pick(['guardian', 'cleric'] as ClassId[]);
    const adv = makeAdventurer(rngFor(g.seed, 'recruit', day, g.counter), nextId(g, 'a'), p, { cls });
    g.recruits.push({ adv, leaves: p + r.int(RECRUIT_STAY_DAYS[0], RECRUIT_STAY_DAYS[1]) * PHASES_PER_DAY, fee: hireFee(adv.level, adv.talent) });
  }
  g.notice = null;
  g.nextTavernDay = day + TAVERN_REFRESH_DAYS;
}

export function effectiveDuty(a: Adventurer, p: number): Exclude<Duty, 'auto'> {
  if (injured(a, p)) return 'rest';
  if (a.duty !== 'auto') return a.duty;
  return a.health < AUTO_REST.health || a.fatigue > AUTO_REST.fatigue ? 'rest' : 'train';
}

function gainXp(g: Guild, a: Adventurer, xp: number) {
  const up = addXp(a, xp);
  if (up) log(g, { k: 'level', a: a.id, v: a.level });
  return up;
}

function retire(g: Guild, a: Adventurer) {
  a.state = 'retired';
  a.endedPhase = phaseNow(g);
  const pension = a.purse;
  g.gold += pension;
  a.purse = 0;
  if (g.championId === a.id) g.championId = null;
  log(g, { k: 'retire', a: a.id, v: pension });
}

function fall(g: Guild, o: Outing, stage: number) {
  const id = o.result.stages[stage].died!;
  o.applied = stage + 1;
  const a = byId(g, id);
  if (!a || a.state !== 'active') return;
  const paid = insurance(a.level, a.talent);
  a.state = 'fallen';
  a.endedPhase = phaseNow(g);
  a.fellAt = o.offer.name;
  a.awayOn = null;
  a.outings++;
  g.gold += a.purse + paid;
  a.purse = 0;
  if (g.championId === a.id) g.championId = null;
  log(g, { k: 'fell', a: a.id, o: o.id, v: paid });
}

function returnHome(g: Guild, o: Outing) {
  o.done = true;
  o.applied = o.result.stages.length;
  const p = phaseNow(g);
  const survivors = o.party.map((id) => byId(g, id)).filter((a): a is Adventurer => !!a && a.state === 'active');
  for (const a of survivors) {
    const m = o.result.members[a.id];
    a.awayOn = null;
    a.outings++;
    a.health = m.health;
    a.fatigue = m.fatigue;
    if (m.injury) {
      a.injury = { text: m.injury.text, until: p + m.injury.days * PHASES_PER_DAY };
      log(g, { k: 'hurt', a: a.id, o: o.id, t: m.injury.text, v: m.injury.days });
      if (m.scar) {
        const scar = SCARS.find((s) => s.text === m.scar)!;
        a.scars.push(scar.text);
        a.attrs[scar.attr] = Math.max(1, a.attrs[scar.attr] - 1);
        log(g, { k: 'scar', a: a.id, t: scar.text });
      }
    }
    gainXp(g, a, m.xp);
  }
  const gold = o.result.loot.gold;
  const share = survivors.length ? Math.floor((gold * PURSE_SHARE) / survivors.length) : 0;
  for (const a of survivors) a.purse += share;
  g.gold += gold - share * survivors.length;
  for (const k of ['wood', 'stone', 'iron', 'herbs'] as const) g.stock[k] += o.result.loot[k] ?? 0;
  const full = o.result.stages.length === o.offer.stages.length && o.result.stages.every((s) => s.outcome !== 'fail');
  if (full && o.offer.scale === 'expedition') g.renown += o.offer.tier;
  if (o.offer.tutorial) g.tutorialDone = true;
  log(g, { k: 'back', o: o.id, v: gold });
  for (const a of survivors) if (p >= a.retirePhase) retire(g, a);
  const finished = g.outings.filter((x) => x.done);
  if (finished.length > KEEP_REPORTS) {
    const drop = new Set(finished.slice(0, finished.length - KEEP_REPORTS).map((x) => x.id));
    g.outings = g.outings.filter((x) => !drop.has(x.id));
  }
}

// ── Player actions ───────────────────────────────────────────

export type Result = { ok: true; guild: Guild; levels?: number } | { ok: false; reason: string };

export function hire(g0: Guild, recruitId: string): Result {
  const r = g0.recruits.find((x) => x.adv.id === recruitId);
  if (!r) return { ok: false, reason: 'They have moved on' };
  if (active(g0).length >= ROSTER_LIMIT) return { ok: false, reason: 'The roster is full (' + ROSTER_LIMIT + ')' };
  if (g0.gold < r.fee) return { ok: false, reason: 'Not enough gold' };
  const g = draft(g0);
  const p = phaseNow(g);
  const adv: Adventurer = { ...structuredClone(r.adv), joinedPhase: p, retirePhase: p + r.adv.career * PHASES_PER_YEAR };
  g.gold -= r.fee;
  g.recruits = g.recruits.filter((x) => x.adv.id !== recruitId);
  g.adventurers.push(adv);
  log(g, { k: 'hire', a: adv.id, v: r.fee });
  return { ok: true, guild: g };
}

/** Lets an adventurer go. Their purse stays with the guild. */
export function release(g0: Guild, id: string): Result {
  const a0 = byId(g0, id);
  if (!a0 || !isActive(a0) || a0.awayOn) return { ok: false, reason: 'Only adventurers at home can be let go' };
  const g = draft(g0);
  const a = byId(g, id)!;
  a.state = 'left';
  a.endedPhase = phaseNow(g);
  g.gold += a.purse;
  a.purse = 0;
  if (g.championId === id) g.championId = null;
  log(g, { k: 'leave', a: id });
  return { ok: true, guild: g };
}

/** Makes someone Champion. XP banked while there was none goes to them. */
export function setChampion(g0: Guild, id: string): Result {
  const a0 = byId(g0, id);
  if (!a0 || !isActive(a0)) return { ok: false, reason: 'Only active adventurers can be Champion' };
  if (a0.awayOn) return { ok: false, reason: 'They are away' };
  const cur = champion(g0);
  if (cur?.awayOn) return { ok: false, reason: 'Your Champion is away; switch when they are back' };
  const g = draft(g0);
  const a = byId(g, id)!;
  g.championId = id;
  let levels = 0;
  if (g.bankedXp > 0) {
    levels = gainXp(g, a, g.bankedXp);
    g.ledger = g.ledger.map((e) => (e.to === null && e.xp > 0 ? { ...e, to: id } : e));
    g.bankedXp = 0;
  }
  a.chapter.from ??= g.t;
  log(g, { k: 'champion', a: id });
  return { ok: true, guild: g, levels };
}

export function setDuty(g0: Guild, id: string, duty: Duty): Guild {
  const g = draft(g0);
  const a = byId(g, id);
  if (a) a.duty = duty;
  return g;
}

export function postNotice(g0: Guild, cls: ClassId): Result {
  if (g0.notice) return { ok: false, reason: 'A notice is already up' };
  if (g0.gold < NOTICE_FEE) return { ok: false, reason: 'Not enough gold' };
  const g = draft(g0);
  g.gold -= NOTICE_FEE;
  g.notice = { cls };
  log(g, { k: 'notice', t: cls });
  return { ok: true, guild: g };
}

/** Why this party can't take this offer, or null when it can. */
export function sendProblem(g: Guild, offer: Offer, party: string[]): string | null {
  const p = phaseNow(g);
  if (party.length < offer.minParty) return 'Needs at least ' + offer.minParty + (offer.minParty === 1 ? ' adventurer' : ' adventurers');
  if (party.length > offer.maxParty) return 'At most ' + offer.maxParty;
  const members = party.map((id) => byId(g, id));
  if (members.some((a) => !a || !canGoOut(a, p))) return 'Everyone must be at home and unhurt';
  if (offer.scale === 'expedition' && expeditionsOut(g) >= MAX_OUT) return 'Already ' + MAX_OUT + ' expeditions out';
  for (const need of offer.needs) if (!members.some((a) => a && role(a) === need)) return 'Needs a ' + (need === 'tank' ? 'Tank' : 'Healer');
  return null;
}

export const ctxFor = (g: Guild, offer: Offer, party: string[], stance: Stance): Ctx =>
  ({ offer, stance, charter: g.charter, members: party.map((id) => snapshot(byId(g, id)!)) });

/** Sends a party. The outcome is decided now and revealed stage by stage. */
export function send(g0: Guild, offerId: string, party: string[], stance: Stance): Result {
  const offer0 = g0.board.find((o) => o.id === offerId);
  if (!offer0) return { ok: false, reason: 'That offer is gone' };
  const problem = sendProblem(g0, offer0, party);
  if (problem) return { ok: false, reason: problem };
  const g = draft(g0);
  const offer = g.board.find((o) => o.id === offerId)!;
  const id = nextId(g, 'x');
  const result = resolve(ctxFor(g, offer, party, stance), rngFor(g.seed, 'outing', id));
  const dur = offer.scale === 'odd' ? (offer.minutes ?? 30) * 60_000 : (offer.phases ?? 1) * PHASE_MS * STANCES[stance].duration;
  const n = offer.stages.length, slot = dur / (n + 1);
  const stageAt = result.stages.map((_, i) => Math.round(g.t + slot * (i + 1)));
  const returnAt = Math.round(stageAt[stageAt.length - 1] + slot);
  g.outings.push({ id, offer, party, stance, departAt: g.t, stageAt, returnAt, result, applied: 0, done: false, read: false });
  g.board = g.board.filter((o) => o.id !== offerId);
  for (const a of party.map((x) => byId(g, x)!)) a.awayOn = id;
  return { ok: true, guild: g };
}

export function markRead(g0: Guild, id: string): Guild {
  const o = g0.outings.find((x) => x.id === id);
  if (!o || o.read || !o.done) return g0;
  const g = draft(g0);
  g.outings.find((x) => x.id === id)!.read = true;
  return g;
}

/** Testing aid: moves the guild's clock `ms` into the future. */
export function skipTime(g: Guild, ms: number): Guild { return { ...g, founded: g.founded - ms }; }

// ── Real life ────────────────────────────────────────────────

export interface Pay {
  key: string; xp: number; gold: number; kind: LedgerEntry['kind']; title: string; date: string;
  /** The attribute this work trains, or the class's main attribute. */
  attr: Attr | 'main';
  notable: boolean;
  /** The campaign's Standard-bearer, if it has one. */
  bearerId?: string | null;
}
export interface Paid { guild: Guild; entry: LedgerEntry; to: Adventurer | null; levels: number }

/** Pays a real-life reward: XP and practice to the Standard-bearer or Champion, 25% of the gold to their purse, the rest to the guild. */
export function payReal(g0: Guild, pay: Pay): Paid {
  const g = draft(g0);
  const bearer = byId(g, pay.bearerId);
  const to = bearer && isActive(bearer) ? bearer : champion(g) ?? null;
  const purse = to ? Math.round(pay.gold * PURSE_SHARE) : 0;
  const entry: LedgerEntry = {
    key: pay.key, to: to?.id ?? null, xp: pay.xp, purse, guild: pay.gold - purse, attr: 'might', practice: 0, points: 0,
    kind: pay.kind, title: pay.title, date: pay.date, notable: pay.notable,
  };
  let levels = 0;
  g.gold += entry.guild;
  if (to) {
    entry.xp = Math.round(pay.xp * RACES[to.race].xpMult);
    entry.attr = pay.attr === 'main' ? CLASSES[to.cls].main : pay.attr;
    to.purse += purse;
    levels = gainXp(g, to, entry.xp);
    to.practice[entry.attr] += entry.xp;
    entry.practice = entry.xp;
    while (to.practice[entry.attr] >= PRACTICE_PER_POINT && to.attrs[entry.attr] < ATTR_MAX) {
      to.practice[entry.attr] -= PRACTICE_PER_POINT;
      to.attrs[entry.attr]++;
      entry.points++;
    }
    if (to.attrs[entry.attr] >= ATTR_MAX) to.practice[entry.attr] = Math.min(to.practice[entry.attr], PRACTICE_PER_POINT - 1);
    const ch = to.chapter;
    ch.from ??= g.t;
    if (pay.kind === 'quest') ch.quests++;
    else if (pay.kind === 'habit') ch.habits++;
    else ch.campaigns.push(pay.title);
    if (pay.notable) ch.notable = [...ch.notable, { t: pay.title, d: pay.date }].slice(-20);
  } else g.bankedXp += pay.xp;
  g.ledger = [...g.ledger, entry];
  return { guild: g, entry, to, levels };
}

/** Takes a real-life reward back exactly as it was paid. Levels and attribute points are never lost. */
export function refund(g0: Guild, key: string): Guild {
  let idx = -1;
  for (let i = g0.ledger.length - 1; i >= 0; i--) if (g0.ledger[i].key === key) { idx = i; break; }
  if (idx < 0) return g0;
  const e = g0.ledger[idx];
  const g = draft(g0);
  g.ledger = g0.ledger.filter((_, i) => i !== idx);
  let fromGuild = e.guild;
  const a = byId(g, e.to);
  if (e.to === null) g.bankedXp = Math.max(0, g.bankedXp - e.xp);
  else if (a) {
    a.xp = Math.max(0, a.xp - e.xp);
    a.practice[e.attr] = Math.max(0, a.practice[e.attr] - (e.practice - e.points * PRACTICE_PER_POINT));
    const fromPurse = Math.min(a.purse, e.purse);
    a.purse -= fromPurse;
    fromGuild += e.purse - fromPurse;
    const ch = a.chapter;
    if (e.kind === 'quest') ch.quests = Math.max(0, ch.quests - 1);
    else if (e.kind === 'habit') ch.habits = Math.max(0, ch.habits - 1);
    else { const i = ch.campaigns.lastIndexOf(e.title); if (i >= 0) ch.campaigns.splice(i, 1); }
    if (e.notable) { const i = ch.notable.findIndex((n) => n.t === e.title && n.d === e.date); if (i >= 0) ch.notable.splice(i, 1); }
  } else fromGuild += e.purse;
  g.gold = Math.max(0, g.gold - fromGuild);
  return g;
}

export const ledgerEntry = (g: Guild, key: string) => { for (let i = g.ledger.length - 1; i >= 0; i--) if (g.ledger[i].key === key) return g.ledger[i]; return undefined; };
