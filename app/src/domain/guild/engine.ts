// The guild over time. Pure functions over plain data: every action returns a new guild,
// and `advance` plays out everything that happened since the last time it ran.
import type { Attr, BuildingId, CharterId, ClassId, ConditionId, PotionKind, Slot, Stance } from './content';
import {
  ATTR_MAX, AUTO_REST, BUILDINGS, CLASSES, DAYS_PER_SEASON, DAYS_PER_YEAR, ERA_YEARS, FORGE_IRON, GRADE_VALUE,
  hireFee, insurance, LAST_JOB_PENALTY, LIBERATED, MARKET_SIZE, MONUMENT, NOTICE_FEE, ODD_JOBS_ON_BOARD, ODYSSEY, PATROL_YIELD, PHASE_EFFECT, PHASE_MS, PHASES_PER_DAY,
  PHASES_PER_YEAR, POTIONS, POTIONS_PER_ADVENTURER, PRACTICE_PER_POINT, PURSE_SHARE, RACES, RECRUIT_STAY_DAYS, REGION_ORDER, REGIONS, REST_MULT, SCARS,
  SELL_PRICE, SLOTS, SPOIL_PHASES, START_GOLD, START_STOCK, STANCES, STARTING_BUILDINGS, STOCK_KEYS, STREAK_MILESTONES, TAVERN_REFRESH_DAYS, TRAIN_XP, WEEK_DAYS,
  WORK_CREW_BONUS, WORK_CREW_MAX, realGoldMult, STONE_LEVEL, GRADE_DURABILITY,
} from './content';
import { addXp, canGoOut, dayOfPhase, hasRole, isActive, makeAdventurer, phaseAt } from './adventurer';
import { backstory, pickTraits } from './traits';
import type { VowKind } from './vows';
import { fxFor, makeVow, pickConviction } from './vows';
import { makeExpedition, makeOddJob, makeOdyssey, makeRecovery, tutorialJob } from './board';
import { better, itemIron, itemValue, makeDraft } from './gear';
import { births, closeEra, comeOfAge, kin, pairUp } from './legacy';
import type { Ctx } from './resolve';
import { resolve, snapshot } from './resolve';
import { rngFor } from './rng';
import {
  boardSize, buildProblem, costOf, hallLevel, happyTalent, isLegend, legendBonus, levelOf, outLimit, production, rosterLimit, seasonCount,
  seasonIndex, staffMult, staffOf, staffSlots, stoneCut, storageCap, tavernSize, tierLimit, value, dayOf,
} from './town';
import { active, byId, champion, log, nextId, trimChronicle } from './util';
import { AWAY_HEAL, FATIGUE_REGEN, fatigueFloor, SCAR_CHANCE, SCAR_CHANCE_TREATED, STAMINA_REGEN, staminaCap } from './wounds';
import type { Wound, WoundSource } from './types';
import { servedCount, visitWeek } from './visitors';
import type { Adventurer, Duty, Entry, GameMs, Guild, Item, ItemDraft, LedgerEntry, Offer, Outing, Potion } from './types';

export { active, byId, champion };

const KEEP_REPORTS = 60;

/** A working copy: everything cloned except the append-only logs, which keep their identity until written. */
export function draft(g: Guild): Guild {
  const { ledger, chronicle, ...rest } = g;
  return { ...structuredClone(rest), ledger, chronicle };
}
export const phaseNow = (g: Guild) => phaseAt(g.t);
/** Expeditions and odysseys out (odd jobs don't count). */
export const expeditionsOut = (g: Guild) => g.outings.filter((o) => !o.done && o.offer.scale !== 'odd').length;

// ── Founding ─────────────────────────────────────────────────

export interface Founding { name: string; town: string; charter: CharterId; crestSeed: number; seed: number }

const emptyRegions = () => Object.fromEntries(REGION_ORDER.map((r) => [r, { liberated: false, stones: 0 }])) as Guild['regions'];

/** A new guild with three free starting adventurers (a Tank, a Healer and a DPS); pick a Champion next. */
export function found(f: Founding, now: number): Guild {
  const g: Guild = {
    name: f.name, town: f.town, charter: f.charter, crestSeed: f.crestSeed, seed: f.seed, founded: now, t: 0, holiday: null,
    gold: START_GOLD, renown: 0, bankedXp: 0, stock: { ...START_STOCK }, buildings: [], construction: [], adventurers: [], championId: null,
    recruits: [], notice: null, nextTavernDay: 0, board: [], outings: [], chronicle: [], ledger: [], tutorialDone: false, counter: 0,
    armoury: [], heirlooms: [], potions: [], market: { season: -1, stock: [] }, sold: { week: -1, gold: 0 }, regions: emptyRegions(), monuments: [], eras: [], streaks: {},
    bestHaul: { gold: 0, name: '' },
  };
  for (const type of ['hall', ...STARTING_BUILDINGS] as BuildingId[]) g.buildings.push({ id: nextId(g, 'b'), type, level: 1 });
  g.layout = 3;
  const dps: ClassId = rngFor(f.seed, 'starter-dps').pick(['ranger', 'arcanist', 'blademaster'] as ClassId[]);
  (['guardian', 'cleric', dps] as ClassId[]).forEach((cls, i) => {
    g.adventurers.push(makeAdventurer(rngFor(f.seed, 'starter', i), nextId(g, 'a'), 0, { cls }));
  });
  g.board.push(tutorialJob(nextId(g, 'o')));
  phaseTick(g, 0);
  log(g, { k: 'found', t: f.name });
  return g;
}

/** Saves from before wounds: health becomes stamina, and an injury becomes a minor wound of the same length. */
function upgradeWounds(a: Adventurer & { health?: number }) {
  if (a.stamina === undefined) a.stamina = a.health ?? 100;
  delete a.health;
  a.wounds ??= [];
  if (a.injury) {
    a.wounds.push({ id: 'w' + a.id + 'legacy', source: 'physical', severity: 'minor', text: a.injury.text, left: 9, total: 9 });
  }
  delete a.injury;
}

/** Brings a guild saved before the town, gear and legacy existed up to the current shape. */
export function upgradeGuild(raw: Guild): Guild {
  const g = structuredClone(raw) as Guild;
  g.holiday ??= null;
  g.construction ??= [];
  if (!g.buildings?.length) { g.buildings = []; for (const type of ['hall', ...STARTING_BUILDINGS] as BuildingId[]) g.buildings.push({ id: nextId(g, 'b'), type, level: 1 }); }
  // Layout 3: one of every building. Several Homes become one Housing, several Farms one Farms, at the level that
  // keeps at least what they gave; work on them is dropped.
  if ((g.layout ?? 0) < 3) {
    const OLD = { home: [4, 6, 8, 10, 12], farm: [6, 9, 12, 15, 18] };
    for (const t of ['home', 'farm'] as const) {
      const mine = g.buildings.filter((x) => x.type === t);
      const had = mine.reduce((n, b) => n + (OLD[t][b.level - 1] ?? 0), 0);
      const vals = BUILDINGS[t].values;
      const level = Math.max(1, vals.findIndex((v) => v >= had) + 1 || vals.length);
      g.buildings = g.buildings.filter((x) => x.type !== t);
      g.buildings.push({ id: mine[0]?.id ?? nextId(g, 'b'), type: t, level });
      g.construction = g.construction.filter((c) => c.type !== t);
    }
    for (const x of [...g.buildings, ...g.construction]) delete (x as { plot?: number }).plot;
    g.layout = 3;
  }
  g.armoury ??= []; g.heirlooms ??= []; g.potions ??= [];
  g.market ??= { season: -1, stock: [] };
  g.sold ??= { week: -1, gold: 0 };
  g.regions = { ...emptyRegions(), ...(g.regions ?? {}) };
  g.monuments ??= []; g.eras ??= []; g.streaks ??= {};
  g.bestHaul ??= { gold: 0, name: '' };
  for (const a of [...g.adventurers, ...g.recruits.map((r) => r.adv)]) upgradeWounds(a);
  for (const a of g.adventurers) {
    a.gear ??= {}; a.autoBuy ??= true; a.staffAt ??= null; a.shared ??= {}; a.clears5 ??= 0; a.liberated ??= 0;
    if (!a.traitIds?.length) { const r = rngFor(g.seed, 'traits', a.id); a.traitIds = pickTraits(r); a.backstory = backstory(r, a.race, a.traitIds); }
    if (!a.conviction && a.state === 'active') { const r = rngFor(g.seed, 'vow', a.id); a.conviction = pickConviction(r); a.vow = makeVow(r, a.level); }
  }
  for (const o of [...g.board, ...g.outings.map((x) => x.offer)]) { o.region ??= 'hearth'; o.conditions ??= []; }
  for (const o of g.outings) { if (Array.isArray(o.potions)) o.potions = {}; o.potions ??= {}; o.phase ??= 0; }
  for (const e of g.ledger) { e.at ??= 0; e.renown ??= 0; }
  for (const r of g.recruits) { if (!r.adv.traitIds?.length) { const rr = rngFor(g.seed, 'traits', r.adv.id); r.adv.traitIds = pickTraits(rr); r.adv.backstory = backstory(rr, r.adv.race, r.adv.traitIds); }
    if (!r.adv.conviction) { const rr = rngFor(g.seed, 'vow', r.adv.id); r.adv.conviction = pickConviction(rr); r.adv.vow = makeVow(rr, r.adv.level); }
    r.adv.gear ??= {}; r.adv.autoBuy ??= true; r.adv.staffAt ??= null; r.adv.shared ??= {}; r.adv.clears5 ??= 0; r.adv.liberated ??= 0; }
  return g;
}

// ── Time passing ─────────────────────────────────────────────

export interface Advanced { guild: Guild; entries: Entry[]; elapsed: number }

/** Plays out everything up to `now`: phases, deaths at their stage, returns. Uncapped. */
export function advance(g0: Guild, now: number): Advanced {
  if (g0.holiday !== null) return { guild: g0, entries: [], elapsed: 0 };
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
      else fall(g, ev.o, ev.stage);
    } else if (nextPhase <= target) {
      g.t = nextPhase;
      phaseTick(g, phaseAt(nextPhase));
    } else break;
  }
  g.t = target;
  const entries = g.chronicle.slice(before);
  trimChronicle(g);
  return { guild: g, entries, elapsed: target - from };
}

export function effectiveDuty(a: Adventurer, p: number): Exclude<Duty, 'auto'> {
  if (a.wounds.some((w) => w.severity !== 'trivial')) return 'rest';
  if (a.duty !== 'auto') return a.duty;
  return a.stamina < AUTO_REST.stamina || a.fatigue - fatigueFloor(a, p) > AUTO_REST.fatigue ? 'rest' : 'train';
}

/** How much faster the wounded mend, as a multiplier: the Infirmary, its staff and Cleric legends. */
export const recoveryMult = (g: Guild, source: WoundSource = 'physical') => {
  const care = source === 'magical' ? (value(g, 'chapel') / 50) * staffMult(g, 'chapel') : (value(g, 'infirmary') / 100) * staffMult(g, 'infirmary');
  // Good housing and somewhere to unwind (the tavern) help everyone recover.
  const comfort = value(g, 'home') / 400 + levelOf(g, 'tavern') * 0.04;
  return 1 + care + comfort + legendBonus(g, 'cleric');
};

/** Heals each wound by `pace` phases of rest (times what the town adds for its kind); healed major wounds may leave a scar. */
function healWounds(g: Guild, a: Adventurer, pace: number) {
  const keep = [];
  for (const w of a.wounds) {
    w.left -= pace * recoveryMult(g, w.source);
    if (w.left > 0) { keep.push(w); continue; }
    if (w.severity === 'major' && rngFor(g.seed, 'scar', w.id).chance(w.treated ? SCAR_CHANCE_TREATED : SCAR_CHANCE)) {
      const scar = rngFor(g.seed, 'scar-which', w.id).pick(SCARS);
      a.scars.push(scar.text);
      a.attrs[scar.attr] = Math.max(1, a.attrs[scar.attr] - 1);
      log(g, { k: 'scar', a: a.id, t: scar.text });
    }
  }
  a.wounds = keep;
}

function phaseTick(g: Guild, p: number) {
  const day = dayOfPhase(p);
  const duties = new Map<string, Exclude<Duty, 'auto'>>();
  for (const a of g.adventurers) if (a.state === 'active' && !a.awayOn) duties.set(a.id, effectiveDuty(a, p));
  const labourers = [...duties.values()].filter((d) => d === 'labour').length;
  const patrolling = [...duties.values()].filter((d) => d === 'patrol').length;
  const infirm = recoveryMult(g);
  const healersHome = g.adventurers.filter((x) => x.state === 'active' && !x.awayOn && hasRole(x, 'healer')).length;
  const fieldLevel = levelOf(g, 'field');
  let benches = value(g, 'field');
  const fieldXp = TRAIN_XP * (1 + 0.25 * (fieldLevel - 1)) * staffMult(g, 'field');

  for (const a of [...g.adventurers]) {
    if (a.state === 'child') { if (a.adultPhase !== undefined && p >= a.adultPhase) comeOfAge(g, a, p); continue; }
    if (a.state === 'retired') { if (a.passPhase !== undefined && p >= a.passPhase) pass(g, a, p); continue; }
    if (a.state !== 'active') continue;
    // Away, wounds heal slowly and stamina doesn't come back.
    if (a.awayOn) { healWounds(g, a, AWAY_HEAL); continue; }
    const duty = duties.get(a.id) ?? 'rest';
    const k = duty === 'rest' ? REST_MULT : 1;
    const tf = fxFor(a);
    healWounds(g, a, k * Math.max(0.2, 1 + tf.rec) * (1 + Math.min(0.3, 0.05 * healersHome)));
    a.stamina = Math.min(staminaCap(a.wounds), a.stamina + STAMINA_REGEN * k * infirm * Math.max(0.2, 1 + tf.rec));
    const floor = fatigueFloor(a, p);
    a.fatigue = Math.max(floor, a.fatigue - FATIGUE_REGEN * k * (1 + (infirm - 1) / 3));
    if (duty === 'train') {
      const onBench = fieldLevel > 0 && benches > 0;
      if (onBench) benches--;
      gainXp(g, a, (onBench ? fieldXp : TRAIN_XP / 2) * RACES[a.race].xpMult * Math.max(0.2, 1 + tf.tr));
    } else if (duty === 'patrol') {
      const room = storageCap(g);
      g.stock.wood = Math.min(room, g.stock.wood + PATROL_YIELD.wood);
      g.stock.stone = Math.min(room, g.stock.stone + PATROL_YIELD.stone);
    }
    if (p >= a.retirePhase) retire(g, a, p);
  }

  // The town works.
  const crewSpeed = 1 + Math.min(WORK_CREW_MAX, labourers * WORK_CREW_BONUS);
  for (const c of [...g.construction]) {
    c.left -= crewSpeed;
    if (c.left > 0) continue;
    g.construction = g.construction.filter((x) => x.id !== c.id);
    if (c.target) { const b = g.buildings.find((x) => x.id === c.target); if (b) b.level = c.level; } else g.buildings.push({ id: nextId(g, 'b'), type: c.type, level: 1 });
    log(g, c.type === 'hall' ? { k: 'hall', v: c.level } : { k: c.target ? 'upgraded' : 'built', t: c.type, v: c.level });
  }
  const made = production(g), cap = storageCap(g);
  for (const key of STOCK_KEYS) g.stock[key] = Math.max(g.stock[key], Math.min(cap, g.stock[key] + made[key]));
  g.potions = g.potions.filter((x) => p - x.made < SPOIL_PHASES);

  // The board: small jobs every phase.
  const odd = g.board.filter((o) => o.scale === 'odd' && !o.tutorial);
  g.board = g.board.filter((o) => !(o.scale === 'odd' && !o.tutorial && o.expires <= p));
  const want = rngFor(g.seed, 'odd-count', p).int(ODD_JOBS_ON_BOARD[0], ODD_JOBS_ON_BOARD[1]);
  for (let i = odd.filter((o) => o.expires > p).length; i < want; i++) g.board.push(makeOddJob(rngFor(g.seed, 'odd', p, i), nextId(g, 'o'), p));

  if (p % PHASES_PER_DAY !== 0) return;

  // A new day.
  g.board = g.board.filter((o) => o.scale === 'odd' || o.expires > p);
  const regions = REGION_ORDER.filter((_, i) => i <= levelOf(g, 'cartographer'));
  const open = g.board.filter((o) => o.scale === 'expedition' && !o.recover).length;
  for (let i = open; i < boardSize(g, patrolling); i++) {
    g.board.push(makeExpedition(rngFor(g.seed, 'board', day, i), nextId(g, 'o'), day, { maxTier: tierLimit(g), regions }));
  }
  if (hallLevel(g) >= ODYSSEY.hall) {
    for (const r of regions) {
      const lair = REGIONS[r].lair;
      if (!lair || g.regions[r].liberated || g.board.some((o) => o.scale === 'odyssey' && o.region === r) || g.outings.some((o) => !o.done && o.offer.scale === 'odyssey' && o.offer.region === r)) continue;
      g.board.push(makeOdyssey(rngFor(g.seed, 'odyssey', day, r), nextId(g, 'o'), r, day));
    }
  }
  g.recruits = g.recruits.filter((r) => r.leaves > p);
  // Once a week, strangers come to town and pay a little for what it offers.
  if (day % WEEK_DAYS === 0) {
    const visit = visitWeek(g, day, rngFor(g.seed, 'visitors', day));
    g.visitors = visit;
    g.visitorTotals = { people: (g.visitorTotals?.people ?? 0) + servedCount(visit), gold: (g.visitorTotals?.gold ?? 0) + visit.gold };
    g.gold += visit.gold;
  }
  if (day >= g.nextTavernDay) refreshTavern(g, p, day);
  if (value(g, 'market') && g.market.season !== seasonCount(g.t)) refreshMarket(g);

  const dayInYear = day % DAYS_PER_YEAR;
  if (day > 0 && dayInYear % DAYS_PER_SEASON === 0) {
    pairUp(g, seasonCount(g.t));
    log(g, { k: 'season', v: seasonIndex(g.t) });
  }
  if (day > 0 && dayInYear === 0) {
    const year = day / DAYS_PER_YEAR + 1;
    log(g, { k: 'year', v: year });
    births(g, p, year);
    kin(g, p, year);
    if ((year - 1) % ERA_YEARS === 0 && year > 1) closeEra(g, year - 1);
  }
}

/** New faces at the tavern. At least one Tank or Healer, and the class from a notice if one was posted. */
function refreshTavern(g: Guild, p: number, day: number) {
  const r = rngFor(g.seed, 'tavern', day);
  const size = tavernSize(g), boost = happyTalent(g);
  const forced: (ClassId | undefined)[] = [];
  if (g.notice) forced.push(g.notice.cls);
  g.recruits = g.recruits.filter((x) => x.fee > 0 || x.leaves > p);
  const paying = () => g.recruits.filter((x) => x.fee > 0);
  while (paying().length < size || forced.length) {
    if (paying().length >= size) { const i = g.recruits.findIndex((x) => x.fee > 0); g.recruits.splice(i, 1); }
    let cls = forced.shift();
    if (!cls && !paying().some((x) => hasRole(x.adv, 'tank') || hasRole(x.adv, 'healer')) && paying().length === size - 1) cls = r.pick(['guardian', 'cleric'] as ClassId[]);
    const adv = makeAdventurer(rngFor(g.seed, 'recruit', day, g.counter), nextId(g, 'a'), p, { cls });
    if (boost && rngFor(g.seed, 'talent', adv.id).chance(0.3 * boost)) adv.talent = Math.min(5, adv.talent + 1);
    g.recruits.push({ adv, leaves: p + r.int(RECRUIT_STAY_DAYS[0], RECRUIT_STAY_DAYS[1]) * PHASES_PER_DAY, fee: hireFee(adv.level, adv.talent) });
  }
  g.notice = null;
  g.nextTavernDay = day + TAVERN_REFRESH_DAYS;
}

function refreshMarket(g: Guild) {
  const season = seasonCount(g.t), r = rngFor(g.seed, 'market', season);
  const top = Math.max(0, levelOf(g, 'market') - 1);
  g.market = {
    season,
    stock: Array.from({ length: MARKET_SIZE }, (_, i) => {
      const grade = r.weighted([0, 1, 2, 3, 4].filter((x) => x <= top), (x) => 5 - x);
      const d = makeDraft(r, grade, i < 3 ? SLOTS[i] : undefined);
      const price = Math.round(GRADE_VALUE[grade] * (1 + r.next() * 0.3));
      return { ...d, id: nextId(g, 'i'), owner: 'guild', price };
    }),
  };
}

/** Counts progress towards an adventurer's vow, and keeps it when the target is reached. */
export function vowStep(g: Guild, a: Adventurer, kind: VowKind, n = 1, region?: string) {
  const v = a.vow;
  if (!v || v.done || v.kind !== kind || (kind === 'region' && v.region !== region)) return;
  v.progress = kind === 'level' ? n : v.progress + n;
  if (v.progress >= v.target) { v.done = true; log(g, { k: 'vowkept', a: a.id, t: v.kind, v: v.target, b: v.region }); }
}
const breakVow = (g: Guild, a: Adventurer) => {
  if (a.vow && !a.vow.done) log(g, { k: 'vowbroken', a: a.id, t: a.vow.kind, v: a.vow.target, b: a.vow.region });
};

function gainXp(g: Guild, a: Adventurer, xp: number) {
  const up = addXp(a, xp);
  if (up) { log(g, { k: 'level', a: a.id, v: a.level }); vowStep(g, a, 'level', a.level); }
  return up;
}

// ── Gear ─────────────────────────────────────────────────────

const itemFrom = (g: Guild, d: ItemDraft): Item => ({ ...d, id: nextId(g, 'i'), owner: 'guild' });
export const salvagePct = (g: Guild) => [0.5, 0.6, 0.7, 0.85, 1][Math.max(0, levelOf(g, 'smithy') - 1)] ?? 0.5;

/** Breaks an item down into iron, as much as the warehouse will hold. */
function breakDown(g: Guild, i: Item): number {
  const iron = Math.round(itemIron(i) * salvagePct(g));
  g.stock.iron = Math.min(Math.max(g.stock.iron, storageCap(g)), g.stock.iron + iron);
  return iron;
}

/** Puts an item on the racks. When they are full the weakest unlocked item makes room, or the new one is broken down. */
function stash(g: Guild, item: Item) {
  if (item.heirloom) { g.heirlooms.push({ ...item, owner: 'guild' }); return; }
  item.owner = 'guild';
  const racks = value(g, 'armoury');
  if (g.armoury.length < racks) { g.armoury.push(item); return; }
  const weakest = g.armoury.filter((x) => !x.locked).sort(better).at(-1);
  if (weakest && better(item, weakest) < 0) { g.armoury = g.armoury.filter((x) => x !== weakest); breakDown(g, weakest); g.armoury.push(item); } else breakDown(g, item);
}

/** Fills empty slots, and swaps lent gear for better, from the guild's racks. */
function kitOut(g: Guild, a: Adventurer) {
  for (const slot of SLOTS) {
    const cur = a.gear[slot];
    if (cur && (cur.owner !== 'guild' || cur.heirloom)) continue;
    const best = g.armoury.filter((x) => x.slot === slot).sort(better)[0];
    if (!best || (cur && better(best, cur) >= 0)) continue;
    g.armoury = g.armoury.filter((x) => x !== best);
    if (cur) stash(g, cur);
    a.gear[slot] = best;
  }
}

/** Adventurers who can afford it buy better gear from the Merchant House with their own purse. */
function buyOwn(g: Guild, a: Adventurer) {
  for (const slot of SLOTS) {
    const cur = a.gear[slot];
    const best = g.market.stock.filter((x) => x.slot === slot && x.price <= a.purse && x.grade > (cur ? cur.grade : -1) && !(cur?.owner === a.id && cur.grade >= x.grade)).sort((x, y) => y.grade - x.grade || x.price - y.price)[0];
    if (!best) continue;
    g.market.stock = g.market.stock.filter((x) => x.id !== best.id);
    a.purse -= best.price;
    const { price, ...item } = best;
    void price;
    if (cur) stash(g, cur);
    a.gear[slot] = { ...item, owner: a.id };
  }
}

/** What each member drinks: ward, then heal, then cure, as their purse and the guild's stash allow. */
function planPotions(g: Guild, party: string[], takes: boolean): Record<string, PotionKind[]> {
  const plan: Record<string, PotionKind[]> = {};
  if (!takes) return plan;
  for (const id of party) {
    const a = byId(g, id);
    plan[id] = [];
    if (!a || !a.autoBuy || a.state !== 'active') continue;
    for (const kind of ['ward', 'heal', 'cure'] as PotionKind[]) {
      if (plan[id].length >= POTIONS_PER_ADVENTURER) break;
      const i = g.potions.findIndex((x) => x.kind === kind);
      if (i < 0 || a.purse < POTIONS[kind].price) continue;
      g.potions.splice(i, 1);
      a.purse -= POTIONS[kind].price;
      g.gold += POTIONS[kind].price;
      plan[id].push(kind);
    }
  }
  return plan;
}

/** Everything done to a party before it leaves, with no dice: gear, purchases and potions. */
function prepare(g: Guild, offer: Offer, party: string[]): Record<string, PotionKind[]> {
  const real = offer.scale !== 'odd';
  for (const id of party) {
    const a = byId(g, id);
    if (!a) continue;
    kitOut(g, a);
    if (real && a.autoBuy && a.state === 'active') buyOwn(g, a);
  }
  return planPotions(g, party, real);
}

// ── Retiring, passing, falling ───────────────────────────────

/** An adventurer's gear goes back to the guild; the best piece stays as an heirloom. */
function gearHome(g: Guild, a: Adventurer, heirloom: boolean) {
  const items = Object.values(a.gear).filter((x): x is Item => !!x);
  a.gear = {};
  const keep = heirloom ? items.filter((x) => !x.heirloom).sort(better)[0] : undefined;
  for (const i of items) {
    if (i === keep) { g.heirlooms.push({ ...i, heirloom: true, from: a.id, owner: 'guild', locked: false }); log(g, { k: 'heirloom', a: a.id, t: i.name }); } else stash(g, i);
  }
}

function retire(g: Guild, a: Adventurer, p: number) {
  breakVow(g, a);
  a.state = 'retired';
  a.endedPhase = p;
  const pension = a.purse;
  g.gold += pension;
  a.purse = 0;
  gearHome(g, a, true);
  const [lo, hi] = RACES[a.race].lifespan;
  a.passPhase = p + rngFor(g.seed, 'pass', a.id).int(lo, hi) * PHASES_PER_YEAR;
  if (g.championId === a.id) g.championId = null;
  log(g, { k: 'retire', a: a.id, v: pension });
  if (isLegend(a)) log(g, { k: 'legend', a: a.id });
}

function pass(g: Guild, a: Adventurer, p: number) {
  if (a.awayOn) return;
  a.state = 'passed';
  a.staffAt = null;
  a.passPhase = p;
  log(g, { k: 'pass', a: a.id });
}

function fall(g: Guild, o: Outing, stage: number) {
  const id = o.result.stages[stage].died!;
  o.applied = stage + 1;
  const a = byId(g, id);
  if (!a || (a.state !== 'active' && !a.lastJob)) return;
  const wasLast = !!a.lastJob;
  if (a.state === 'active') breakVow(g, a);
  const paid = wasLast ? 0 : insurance(a.level, a.talent);
  const lost = Object.values(a.gear).filter((x): x is Item => !!x);
  for (const i of lost) if (i.heirloom) g.heirlooms.push(i);
  a.lostGear = lost.filter((x) => !x.heirloom);
  a.gear = {};
  a.state = 'fallen';
  a.endedPhase = phaseNow(g);
  a.fellAt = o.offer.name;
  a.fellRegion = o.offer.region;
  a.awayOn = null;
  a.lastJob = false;
  a.outings++;
  a.staffAt = null;
  g.gold += a.purse + paid;
  a.purse = 0;
  if (a.level >= STONE_LEVEL) g.regions[o.offer.region].stones++;
  if (g.championId === a.id) g.championId = null;
  log(g, { k: 'fell', a: a.id, o: o.id, v: paid });
  if (o.offer.scale !== 'odd' && !o.offer.recover) g.board.push(makeRecovery(a, o, phaseNow(g)));
}

function returnHome(g: Guild, o: Outing) {
  o.done = true;
  o.applied = o.result.stages.length;
  const p = phaseNow(g);
  const real = o.offer.scale !== 'odd';
  const survivors = o.party.map((id) => byId(g, id)).filter((a): a is Adventurer => !!a && (a.state === 'active' || (a.state === 'retired' && !!a.lastJob)));
  for (const a of survivors) {
    const m = o.result.members[a.id];
    a.awayOn = null;
    a.outings++;
    a.stamina = Math.min(staminaCap(a.wounds), m.stamina);
    a.fatigue = Math.max(m.fatigue, fatigueFloor(a, p));
    if (a.lastJob) { a.lastJob = false; a.recalled = true; }
    const cured = !!o.potions[a.id]?.includes('cure');
    for (const nw of m.wounds ?? []) {
      const phases = cured ? nw.phases / 2 : nw.phases;
      a.wounds.push({ id: 'w' + o.id + a.id + a.wounds.length + nw.text.length, source: nw.source, severity: nw.severity, text: nw.text, left: phases, total: phases });
      log(g, { k: 'hurt', a: a.id, o: o.id, t: nw.text, b: nw.severity, v: Math.max(1, Math.round(phases / recoveryMult(g, nw.source) / PHASES_PER_DAY)) });
    }
    // However many a person carries home, only the worst few stay.
    if (a.wounds.length > 4) a.wounds = a.wounds.sort((x, y) => (y.severity === 'major' ? 2 : y.severity === 'minor' ? 1 : 0) - (x.severity === 'major' ? 2 : x.severity === 'minor' ? 1 : 0)).slice(0, 4);
    a.stamina = Math.min(a.stamina, staminaCap(a.wounds));
    if (a.state === 'active') gainXp(g, a, m.xp);
    // Gear wears out; heirlooms never do.
    if (real) for (const slot of SLOTS) {
      const it = a.gear[slot];
      if (!it || it.heirloom) continue;
      it.wear--;
      if (it.wear <= 0) { delete a.gear[slot]; breakDown(g, it); log(g, { k: 'broke', a: a.id, t: it.name }); }
    }
    for (const b of survivors) if (b.id !== a.id) a.shared[b.id] = (a.shared[b.id] ?? 0) + 1;
  }
  // Loot.
  const gold = o.result.loot.gold;
  const holders = survivors.filter((a) => a.state === 'active');
  const share = holders.length ? Math.floor((gold * PURSE_SHARE) / holders.length) : 0;
  for (const a of holders) a.purse += share;
  g.gold += gold - share * holders.length;
  const room = storageCap(g);
  for (const k of STOCK_KEYS) g.stock[k] = Math.max(g.stock[k], Math.min(room, g.stock[k] + (o.result.loot[k] ?? 0)));
  for (const d of o.result.loot.items ?? []) stash(g, itemFrom(g, d));
  if (gold > g.bestHaul.gold) g.bestHaul = { gold, name: o.offer.name };

  const full = o.result.stages.length === o.offer.stages.length && o.result.stages.every((s) => s.outcome !== 'fail');
  const finished = o.result.stages.length === o.offer.stages.length && o.result.stages[o.result.stages.length - 1].outcome !== 'fail';
  if (full && o.offer.scale === 'expedition' && !o.offer.recover) g.renown += o.offer.tier * o.offer.tier;
  if (full && o.offer.scale === 'odyssey') g.renown += 10 * o.offer.tier;
  if (full && o.offer.tier >= 5) for (const a of survivors) a.clears5++;
  if (o.offer.scale === 'odyssey' && finished && o.offer.stages[o.offer.stages.length - 1].kind === 'boss' && survivors.length && !g.regions[o.offer.region].liberated) {
    g.regions[o.offer.region].liberated = true;
    g.renown += LIBERATED.renown;
    for (const a of survivors) a.liberated++;
    g.monuments.push({ id: 'region:' + o.offer.region, camp: 'region:' + o.offer.region, name: REGIONS[o.offer.region].name + ' freed', seal: REGIONS[o.offer.region].lair!.boss, icon: REGIONS[o.offer.region].icon, size: 'L', date: '', bearer: survivors[0].id, at: g.t });
    log(g, { k: 'liberated', t: o.offer.region });
  }
  if (o.offer.recover && finished) {
    const lost = byId(g, o.offer.recover);
    if (lost && lost.state === 'fallen' && !lost.tomb) {
      lost.tomb = true;
      if (lost.level >= STONE_LEVEL) g.regions[lost.fellRegion ?? o.offer.region].stones++;
      for (const i of lost.lostGear ?? []) stash(g, i);
      lost.lostGear = [];
      log(g, { k: 'tomb', a: lost.id });
    }
  }
  // Vows.
  const bossDown = o.result.stages.some((st, i) => o.offer.stages[i].kind === 'boss' && st.outcome !== 'fail');
  const noDeaths = o.party.every((id) => !o.result.members[id]?.wounds?.some((w) => w.severity === 'major'));
  const freed = o.offer.scale === 'odyssey' && g.regions[o.offer.region].liberated && survivors.some((a) => a.liberated > 0);
  if (real) for (const a of survivors) {
    if (a.state !== 'active') continue;
    if (full && o.offer.scale === 'expedition' && !o.offer.recover) { vowStep(g, a, 'clears'); if (o.offer.tier >= 3) vowStep(g, a, 'high'); }
    if (noDeaths && o.offer.tier >= 2) vowStep(g, a, 'home');
    if (bossDown) vowStep(g, a, 'bosses');
    vowStep(g, a, 'region', 1, o.offer.region);
    vowStep(g, a, 'gold', gold);
    if (o.offer.scale === 'odyssey' && finished) vowStep(g, a, 'odyssey');
    if (freed) vowStep(g, a, 'free');
    if (o.offer.recover && finished) vowStep(g, a, 'rescue');
  }
  if (o.offer.tutorial) g.tutorialDone = true;
  log(g, { k: 'back', o: o.id, v: gold });
  for (const a of survivors) if (a.state === 'active' && p >= a.retirePhase) retire(g, a, p);
  const done = g.outings.filter((x) => x.done);
  if (done.length > KEEP_REPORTS) {
    const drop = new Set(done.slice(0, done.length - KEEP_REPORTS).map((x) => x.id));
    g.outings = g.outings.filter((x) => !drop.has(x.id));
  }
}

// ── Player actions ───────────────────────────────────────────

export type Result = { ok: true; guild: Guild; levels?: number } | { ok: false; reason: string };
const fail = (reason: string): Result => ({ ok: false, reason });

export function hire(g0: Guild, recruitId: string): Result {
  const r = g0.recruits.find((x) => x.adv.id === recruitId);
  if (!r) return fail('They have moved on');
  if (active(g0).length >= rosterLimit(g0)) return fail('The roster is full (' + rosterLimit(g0) + ')');
  if (g0.gold < r.fee) return fail('Not enough gold');
  const g = draft(g0);
  const p = phaseNow(g);
  const adv: Adventurer = { ...structuredClone(r.adv), joinedPhase: p, retirePhase: p + r.adv.career * PHASES_PER_YEAR };
  g.gold -= r.fee;
  g.recruits = g.recruits.filter((x) => x.adv.id !== recruitId);
  g.adventurers.push(adv);
  log(g, { k: 'hire', a: adv.id, v: r.fee });
  return { ok: true, guild: g };
}

/** Lets an adventurer go. Their purse and gear stay with the guild. */
export function release(g0: Guild, id: string): Result {
  const a0 = byId(g0, id);
  if (!a0 || !isActive(a0) || a0.awayOn) return fail('Only adventurers at home can be let go');
  const g = draft(g0);
  const a = byId(g, id)!;
  gearHome(g, a, false);
  a.state = 'left';
  a.endedPhase = phaseNow(g);
  g.gold += a.purse;
  a.purse = 0;
  if (g.championId === id) g.championId = null;
  log(g, { k: 'leave', a: id });
  return { ok: true, guild: g };
}

/** Retires someone now, rather than when their years run out: they join the retirees, with a One Last Job still ahead of them. */
export function retireNow(g0: Guild, id: string): Result {
  const a0 = byId(g0, id);
  if (!a0 || !isActive(a0) || a0.awayOn) return fail('Only adventurers at home can retire');
  const g = draft(g0);
  retire(g, byId(g, id)!, phaseNow(g));
  return { ok: true, guild: g };
}

// ── Treating wounds ──────────────────────────────────────────

const treatBuilding = (w: Pick<Wound, 'source'>): BuildingId => (w.source === 'magical' ? 'chapel' : 'infirmary');
export const TREAT_COST = 60;
/** What treating a major wound costs: more at a bigger Infirmary or Temple, which also does more for it. */
export const treatCost = (g: Guild, w: Pick<Wound, 'source'>) => Math.round(TREAT_COST * (1 + 0.25 * Math.max(0, levelOf(g, treatBuilding(w)) - 1)));
/** The share of the remaining healing time that is left after treatment. */
export const treatLeft = (g: Guild, w: Pick<Wound, 'source'>) => Math.max(0.3, 0.5 - 0.05 * Math.max(0, levelOf(g, treatBuilding(w)) - 1));

export function treatProblem(g: Guild, a: Adventurer, w: Wound): string | null {
  if (w.severity !== 'major') return 'Only major wounds need treatment';
  if (w.treated) return 'Already treated';
  if (a.awayOn) return 'They are away';
  if (levelOf(g, treatBuilding(w)) < 1) return 'Needs ' + (w.source === 'magical' ? 'a Temple' : 'an Infirmary');
  if (g.gold < treatCost(g, w)) return 'Not enough gold';
  return null;
}

/** Treats a major wound at the Infirmary (physical and disease) or the Temple (magical): faster healing, and a smaller chance of a scar. */
export function treat(g0: Guild, advId: string, woundId: string): Result {
  const a0 = byId(g0, advId);
  const w0 = a0?.wounds.find((w) => w.id === woundId);
  if (!a0 || !w0) return fail('No such wound');
  const problem = treatProblem(g0, a0, w0);
  if (problem) return fail(problem);
  const g = draft(g0);
  const a = byId(g, advId)!;
  const w = a.wounds.find((x) => x.id === woundId)!;
  g.gold -= treatCost(g, w);
  w.left *= treatLeft(g, w);
  w.treated = true;
  return { ok: true, guild: g };
}

/** Makes someone Champion. XP banked while there was none goes to them. */
export function setChampion(g0: Guild, id: string): Result {
  const a0 = byId(g0, id);
  if (!a0 || !isActive(a0)) return fail('Only active adventurers can be Champion');
  if (a0.awayOn) return fail('They are away');
  const cur = champion(g0);
  if (cur?.awayOn) return fail('Your Champion is away; switch when they are back');
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
export function setAutoBuy(g0: Guild, id: string, on: boolean): Guild {
  const g = draft(g0);
  const a = byId(g, id);
  if (a) a.autoBuy = on;
  return g;
}

export function postNotice(g0: Guild, cls: ClassId): Result {
  if (g0.notice) return fail('A notice is already up');
  if (g0.gold < NOTICE_FEE) return fail('Not enough gold');
  const g = draft(g0);
  g.gold -= NOTICE_FEE;
  g.notice = { cls };
  log(g, { k: 'notice', t: cls });
  return { ok: true, guild: g };
}

/** Holiday mode: stops the guild's clock until it is switched off. */
export function setHoliday(g0: Guild, on: boolean, now: number): Guild {
  if (on === (g0.holiday !== null)) return g0;
  const g = draft(g0);
  if (on) g.holiday = now;
  else { g.founded += Math.max(0, now - g.holiday!); g.holiday = null; }
  return g;
}

// ── Sending ──────────────────────────────────────────────────

/** Why this party can't take this offer, or null when it can. */
export function sendProblem(g: Guild, offer: Offer, party: string[]): string | null {
  const p = phaseNow(g);
  if (party.length < offer.minParty) return 'Needs at least ' + offer.minParty + (offer.minParty === 1 ? ' adventurer' : ' adventurers');
  if (party.length > offer.maxParty) return 'At most ' + offer.maxParty;
  const members = party.map((id) => byId(g, id));
  if (members.some((a) => !a || !canGoOut(a, p))) return 'Everyone must be at home';
  if (offer.scale === 'odd' && members.some((a) => a && a.state === 'retired')) return 'Retirees only take expeditions and odysseys';
  if (offer.scale !== 'odd' && expeditionsOut(g) >= outLimit(g)) return 'Already ' + outLimit(g) + (outLimit(g) === 1 ? ' expedition' : ' expeditions') + ' out';
  for (const need of offer.needs) if (!members.some((a) => a && hasRole(a, need))) return 'Needs a ' + (need === 'tank' ? 'Tank' : 'Healer');
  return null;
}

/** The conditions as the party sees them: the Library reveals hidden ones. */
export function condView(g: Guild, offer: Offer): { id: ConditionId; hidden: boolean }[] {
  const reveal = [0, 1, 2, 3, 99, 99][levelOf(g, 'library')] ?? 0;
  let seen = 0;
  return offer.conditions.map((c) => (c.hidden && seen++ >= reveal ? c : { id: c.id, hidden: false }));
}

/** What sending now would change: the phase, a liberated region and everything the town adds. */
export function departure(g: Guild, offer: Offer) {
  const phase = phaseAt(g.t) % PHASES_PER_DAY;
  const fx = PHASE_EFFECT[phase];
  const dark = offer.scale !== 'odd' && fx.dark;
  return { phase, fx, dark };
}

/** The numbers a party goes out with, once its gear and potions are settled. `forOdds` leaves out conditions the party can't see. */
function buildCtx(g: Guild, offer: Offer, party: string[], stance: Stance, plan: Record<string, PotionKind[]>, forOdds: boolean): { ctx: Ctx; hidden: number } {
  const { fx, dark } = departure(g, offer);
  const view = condView(g, offer);
  const real = offer.scale !== 'odd';
  const library = real ? 1 + (value(g, 'library') / 100) * staffMult(g, 'library') : 1;
  const conds: ConditionId[] = (forOdds ? view.filter((c) => !c.hidden) : view).map((c) => c.id);
  if (dark && !conds.includes('darkness')) conds.push('darkness');
  const ctx: Ctx = {
    offer, stance, charter: g.charter,
    members: party.map((id) => {
      const a = byId(g, id)!;
      return snapshot(a, { ward: plan[id]?.includes('ward'), heal: plan[id]?.includes('heal'), penalty: a.state === 'retired' && !a.recalled ? LAST_JOB_PENALTY : 0 });
    }),
    conditions: conds,
    lootMult: fx.loot * (g.regions[offer.region].liberated ? LIBERATED.loot : 1),
    goldMult: (g.charter === 'mercantile' ? 1.15 : 1) * (1 + legendBonus(g, 'rogue')) * (1 + party.reduce((n, id) => n + (byId(g, id) ? fxFor(byId(g, id)!).g : 0), 0) / Math.max(1, party.length)),
    phase: departure(g, offer).phase,
    matMult: 1 + legendBonus(g, 'ranger'),
    xpMult: (g.charter === 'martial' ? 1.15 : 1) * library * (1 + legendBonus(g, 'arcanist')),
    injuryMult: (1 - legendBonus(g, 'guardian')) * (1 - stoneCut(g, offer.region)),
  };
  return { ctx, hidden: forOdds ? view.filter((c) => c.hidden).length : 0 };
}

/** What a party would go out with if sent now (for the odds panel): nothing is changed. */
export function ctxFor(g: Guild, offer: Offer, party: string[], stance: Stance): { ctx: Ctx; hidden: number } {
  const g2 = draft(g);
  return buildCtx(g2, offer, party, stance, prepare(g2, offer, party), true);
}

/** How long an outing takes, in game time. */
export function duration(g: Guild, offer: Offer, stance: Stance): number {
  if (offer.scale === 'odd') return (offer.minutes ?? 30) * 60_000;
  const { fx } = departure(g, offer);
  return (offer.phases ?? 1) * PHASE_MS * STANCES[stance].duration * fx.duration * (g.regions[offer.region].liberated ? LIBERATED.duration : 1) * (1 - legendBonus(g, 'blademaster'));
}

/** Sends a party. The outcome is decided now and revealed stage by stage. */
export function send(g0: Guild, offerId: string, party: string[], stance: Stance): Result {
  const offer0 = g0.board.find((o) => o.id === offerId);
  if (!offer0) return fail('That offer is gone');
  const problem = sendProblem(g0, offer0, party);
  if (problem) return fail(problem);
  const g = draft(g0);
  const offer = g.board.find((o) => o.id === offerId)!;
  const id = nextId(g, 'x');
  const potions = prepare(g, offer, party);
  const { ctx } = buildCtx(g, offer, party, stance, potions, false);
  const result = resolve(ctx, rngFor(g.seed, 'outing', id));
  const dur = duration(g, offer, stance);
  const n = offer.stages.length, slot = dur / (n + 1);
  const stageAt = result.stages.map((_, i) => Math.round(g.t + slot * (i + 1)));
  const returnAt = Math.round(stageAt[stageAt.length - 1] + slot);
  g.outings.push({ id, offer, party, stance, departAt: g.t, stageAt, returnAt, result, applied: 0, done: false, read: false, potions, phase: departure(g, offer).phase });
  g.board = g.board.filter((o) => o.id !== offerId);
  for (const pid of party) { const a = byId(g, pid)!; a.awayOn = id; if (a.state === 'retired') a.lastJob = true; }
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

// ── The town ─────────────────────────────────────────────────

const pay = (g: Guild, c: ReturnType<typeof costOf>) => { g.gold -= c.gold; g.stock.wood -= c.wood; g.stock.stone -= c.stone; g.stock.iron -= c.iron; };

/** Starts a building that isn't there yet (level 0) on its spot. */
export function build(g0: Guild, type: BuildingId): Result {
  const problem = buildProblem(g0, type);
  if (problem) return fail(problem);
  const g = draft(g0), c = costOf(g, type, 1);
  pay(g, c);
  g.construction.push({ id: nextId(g, 'c'), type, target: null, level: 1, left: c.phases, total: c.phases });
  return { ok: true, guild: g };
}

export function upgrade(g0: Guild, buildingId: string): Result {
  const b = g0.buildings.find((x) => x.id === buildingId);
  if (!b) return fail('No such building');
  const problem = b.type === 'hall' ? buildProblem(g0, 'hall') : buildProblem(g0, b.type, b);
  if (problem) return fail(problem);
  const g = draft(g0);
  const level = b.type === 'hall' ? b.level + 1 : b.level + 1;
  const c = costOf(g, b.type, level);
  pay(g, c);
  g.construction.push({ id: nextId(g, 'c'), type: b.type, target: b.id, level, left: c.phases, total: c.phases });
  return { ok: true, guild: g };
}

/** Pulls a building down to level 0: its workers are freed, half the materials come back, no gold. */
export function demolish(g0: Guild, buildingId: string): Result {
  const b = g0.buildings.find((x) => x.id === buildingId);
  if (!b || BUILDINGS[b.type].permanent) return fail('That can’t be pulled down');
  if (g0.construction.some((c) => c.target === b.id)) return fail('It is being improved');
  const g = draft(g0);
  const d = BUILDINGS[b.type];
  for (let l = 1; l <= b.level; l++) {
    const c = costOf(g, b.type, l);
    for (const k of ['wood', 'stone', 'iron'] as const) g.stock[k] = Math.min(Math.max(g.stock[k], storageCap(g)), g.stock[k] + Math.floor(c[k] / 2));
  }
  for (const a of g.adventurers) if (a.staffAt === b.id) a.staffAt = null;
  g.buildings = g.buildings.filter((x) => x.id !== b.id);
  log(g, { k: 'demolish', t: d.id });
  return { ok: true, guild: g };
}

/** Posts a retiree to a building, or takes them off it. */
export function assignStaff(g0: Guild, advId: string, buildingId: string | null): Result {
  const a0 = byId(g0, advId);
  if (!a0 || a0.state !== 'retired') return fail('Only retirees can work in town');
  if (a0.awayOn) return fail('They are away');
  const g = draft(g0);
  const a = byId(g, advId)!;
  if (buildingId === null) { a.staffAt = null; return { ok: true, guild: g }; }
  const b = g.buildings.find((x) => x.id === buildingId);
  if (!b || !staffSlots(b)) return fail('Nobody works there yet');
  if (staffOf(g, b).filter((x) => x.id !== a.id).length >= staffSlots(b)) return fail('Every post there is taken');
  a.staffAt = b.id;
  return { ok: true, guild: g };
}

// ── The market, smithy and stillroom ─────────────────────────

export const weekOf = (g: Guild) => Math.floor(dayOf(g.t) / WEEK_DAYS);
export const sellLimit = (g: Guild) => Math.round(value(g, 'market') * staffMult(g, 'market') * (g.charter === 'mercantile' ? 1.5 : 1));
export const soldThisWeek = (g: Guild) => (g.sold.week === weekOf(g) ? g.sold.gold : 0);
export const sellLeft = (g: Guild) => Math.max(0, sellLimit(g) - soldThisWeek(g));

export type Sale = { kind: 'stock'; key: keyof Guild['stock']; n: number } | { kind: 'item'; id: string };

/** Sells materials or gear at the Merchant House, up to the weekly limit. */
export function sell(g0: Guild, s: Sale): Result {
  if (!value(g0, 'market')) return fail('Build a Merchant House first');
  const g = draft(g0);
  let gold = 0;
  if (s.kind === 'stock') {
    const n = Math.min(s.n, g.stock[s.key]);
    gold = n * SELL_PRICE[s.key];
    if (n <= 0) return fail('Nothing to sell');
    const cap = sellLeft(g);
    if (cap <= 0) return fail('The Merchant House has bought all it will this week');
    const fit = Math.min(n, Math.floor(cap / SELL_PRICE[s.key]));
    if (fit <= 0) return fail('The Merchant House has bought all it will this week');
    g.stock[s.key] -= fit;
    gold = fit * SELL_PRICE[s.key];
  } else {
    const it = g.armoury.find((x) => x.id === s.id);
    if (!it) return fail('That isn’t on the racks');
    if (it.locked) return fail('Unlock it first');
    gold = Math.floor(itemValue(it) / 2);
    if (gold > sellLeft(g)) return fail('That is more than the Merchant House will buy this week');
    g.armoury = g.armoury.filter((x) => x.id !== s.id);
  }
  g.gold += gold;
  g.sold = { week: weekOf(g), gold: soldThisWeek(g) + gold };
  return { ok: true, guild: g };
}

/** Buys a piece from the Merchant House for the racks. */
export function buyMarket(g0: Guild, itemId: string): Result {
  const it = g0.market.stock.find((x) => x.id === itemId);
  if (!it) return fail('Already sold');
  if (g0.gold < it.price) return fail('Not enough gold');
  if (g0.armoury.length >= value(g0, 'armoury')) return fail('The racks are full');
  const g = draft(g0);
  g.gold -= it.price;
  g.market.stock = g.market.stock.filter((x) => x.id !== itemId);
  const { price, ...item } = it;
  void price;
  g.armoury.push({ ...item, owner: 'guild' });
  return { ok: true, guild: g };
}

export function forge(g0: Guild, slot: Slot, grade: number): Result {
  const top = levelOf(g0, 'smithy') - 1;
  if (top < 0) return fail('Build a Blacksmith first');
  if (grade > top) return fail('The Blacksmith can’t make that yet');
  if (g0.stock.iron < FORGE_IRON[grade]) return fail('Needs ' + FORGE_IRON[grade] + ' iron');
  if (g0.armoury.length >= value(g0, 'armoury')) return fail('The racks are full');
  const g = draft(g0);
  g.stock.iron -= FORGE_IRON[grade];
  const item = itemFrom(g, makeDraft(rngFor(g.seed, 'forge', g.counter), grade, slot));
  g.armoury.push(item);
  log(g, { k: 'forged', t: item.name });
  return { ok: true, guild: g };
}

export const reforgeCost = (i: Item) => Math.max(1, Math.ceil((FORGE_IRON[i.grade] / 2) * (1 - i.wear / GRADE_DURABILITY[i.grade])));
export function reforge(g0: Guild, itemId: string): Result {
  const it = g0.armoury.find((x) => x.id === itemId);
  if (!it) return fail('That isn’t on the racks');
  if (!levelOf(g0, 'smithy')) return fail('Build a Blacksmith first');
  const cost = reforgeCost(it);
  if (it.wear >= GRADE_DURABILITY[it.grade]) return fail('It is as good as new');
  if (g0.stock.iron < cost) return fail('Needs ' + cost + ' iron');
  const g = draft(g0);
  g.stock.iron -= cost;
  g.armoury.find((x) => x.id === itemId)!.wear = GRADE_DURABILITY[it.grade];
  return { ok: true, guild: g };
}

export function salvage(g0: Guild, itemId: string): Result {
  const it = g0.armoury.find((x) => x.id === itemId);
  if (!it) return fail('That isn’t on the racks');
  if (it.locked) return fail('Unlock it first');
  const g = draft(g0);
  g.armoury = g.armoury.filter((x) => x.id !== itemId);
  breakDown(g, it);
  return { ok: true, guild: g };
}

export function lockItem(g0: Guild, itemId: string): Guild {
  const g = draft(g0);
  const it = g.armoury.find((x) => x.id === itemId);
  if (it) it.locked = !it.locked;
  return g;
}

export const brewCost = (g: Guild, kind: PotionKind) => Math.max(1, Math.round(POTIONS[kind].herbs * (1 - 0.1 * Math.max(0, levelOf(g, 'stillroom') - 3))));
export const POTION_CAP = 30;
export function brew(g0: Guild, kind: PotionKind): Result {
  const lvl = levelOf(g0, 'stillroom');
  if (!lvl) return fail('Build a Stillroom first');
  if (POTIONS[kind].level > lvl) return fail('Needs a level ' + POTIONS[kind].level + ' Stillroom');
  if (g0.stock.herbs < brewCost(g0, kind)) return fail('Needs ' + brewCost(g0, kind) + ' herbs');
  if (g0.potions.length >= POTION_CAP) return fail('The shelves are full');
  const g = draft(g0);
  g.stock.herbs -= brewCost(g, kind);
  const potion: Potion = { id: nextId(g, 'p'), kind, made: phaseNow(g) };
  g.potions.push(potion);
  return { ok: true, guild: g };
}

/** Moves an item between the racks (or the Hall of Heroes) and an adventurer at home. */
export function equip(g0: Guild, advId: string, itemId: string): Result {
  const a0 = byId(g0, advId);
  if (!a0 || !isActive(a0) || a0.awayOn) return fail('They have to be at home');
  const g = draft(g0);
  const a = byId(g, advId)!;
  const fromRacks = g.armoury.find((x) => x.id === itemId);
  const fromHall = g.heirlooms.find((x) => x.id === itemId);
  const item = fromRacks ?? fromHall;
  if (!item) return fail('That isn’t available');
  g.armoury = g.armoury.filter((x) => x.id !== itemId);
  g.heirlooms = g.heirlooms.filter((x) => x.id !== itemId);
  const cur = a.gear[item.slot];
  if (cur) stash(g, cur);
  a.gear[item.slot] = item;
  return { ok: true, guild: g };
}
export function unequip(g0: Guild, advId: string, slot: Slot): Result {
  const a0 = byId(g0, advId);
  if (!a0 || a0.awayOn || !a0.gear[slot]) return fail('Nothing to take off');
  const g = draft(g0);
  const a = byId(g, advId)!;
  const item = a.gear[slot]!;
  delete a.gear[slot];
  stash(g, item);
  return { ok: true, guild: g };
}

// ── Real life ────────────────────────────────────────────────

export interface Pay {
  key: string; xp: number; gold: number; kind: LedgerEntry['kind']; title: string; date: string;
  /** The attribute this work trains, or the class's main attribute. */
  attr: Attr | 'main';
  notable: boolean;
  /** The campaign's Standard-bearer, if it has one. */
  bearerId?: string | null;
  /** A finished campaign raises a monument in the Garden of Valor. */
  monument?: { camp: string; size: 'S' | 'M' | 'L'; seal: string; icon: string };
}
export interface Paid { guild: Guild; entry: LedgerEntry; to: Adventurer | null; levels: number }

/** Pays a real-life reward: XP and practice to the Standard-bearer or Champion, 25% of the gold to their purse, the rest to the guild. */
export function payReal(g0: Guild, pay: Pay): Paid {
  const g = draft(g0);
  const gold = Math.round(pay.gold * realGoldMult(hallLevel(g)));
  const bearer = byId(g, pay.bearerId);
  const to = bearer && isActive(bearer) ? bearer : champion(g) ?? null;
  const purse = to ? Math.round(gold * PURSE_SHARE) : 0;
  const renown = pay.monument ? MONUMENT[pay.monument.size].renown : 0;
  const entry: LedgerEntry = {
    key: pay.key, at: g.t, to: to?.id ?? null, xp: pay.xp, purse, guild: gold - purse, attr: 'might', practice: 0, points: 0, renown,
    kind: pay.kind, title: pay.title, date: pay.date, notable: pay.notable,
  };
  let levels = 0;
  g.gold += entry.guild;
  g.renown += renown;
  if (pay.monument) {
    g.monuments.push({ id: 'camp:' + pay.monument.camp, camp: pay.monument.camp, name: pay.title, seal: pay.monument.seal, icon: pay.monument.icon, size: pay.monument.size, date: pay.date, bearer: to?.id ?? null, at: g.t });
    log(g, { k: 'monument', t: pay.title, a: to?.id });
  }
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

/** Brings in a payment that another device recorded and this one has not seen (sync). The entry keeps its own numbers. */
export function absorbPayment(g0: Guild, e: LedgerEntry): Guild {
  if (g0.ledger.some((x) => x.key === e.key)) return g0;
  const g = draft(g0);
  g.gold += e.guild;
  g.renown += e.renown;
  const a = byId(g, e.to);
  if (a) {
    a.purse += e.purse;
    gainXp(g, a, e.xp);
    a.attrs[e.attr] = Math.min(ATTR_MAX, a.attrs[e.attr] + e.points);
    a.practice[e.attr] += Math.max(0, e.practice - e.points * PRACTICE_PER_POINT);
  } else g.bankedXp += e.xp;
  g.ledger = [...g.ledger, e];
  return g;
}

/** Takes a real-life reward back exactly as it was paid. Levels, attribute points and heirlooms are never lost. */
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
  if (e.renown) {
    g.renown = Math.max(0, g.renown - e.renown);
    g.monuments = g.monuments.filter((m) => m.id !== 'camp:' + key.slice(2));
  }
  return g;
}

export const ledgerEntry = (g: Guild, key: string) => { for (let i = g.ledger.length - 1; i >= 0; i--) if (g.ledger[i].key === key) return g.ledger[i]; return undefined; };

/** A habit that reaches a streak milestone forges an heirloom named for it. Returns null when nothing is new. */
export function awardStreak(g0: Guild, habitId: number, title: string, streak: number, every: 'daily' | 'weekly'): Guild | null {
  const marks = STREAK_MILESTONES[every];
  const got = g0.streaks[habitId] ?? [];
  const fresh = marks.filter((m) => streak >= m && !got.includes(m));
  if (!fresh.length) return null;
  const g = draft(g0);
  for (const m of fresh) {
    const tier = marks.indexOf(m);
    const r = rngFor(g.seed, 'streak', habitId, m);
    const d = makeDraft(r, 2 + tier, 'trinket', r.pick(['darkness', 'cold', 'beasts', 'cursed', 'plague', 'ambush'] as ConditionId[]));
    g.heirlooms.push({ ...d, id: nextId(g, 'i'), owner: 'guild', name: title + ' ' + ['Band', 'Charm', 'Crest'][tier], heirloom: true, note: m + (every === 'daily' ? '-day' : '-week') + ' streak' });
    log(g, { k: 'heirloom', t: title + ' ' + ['Band', 'Charm', 'Crest'][tier], v: m });
  }
  g.streaks = { ...g.streaks, [habitId]: [...got, ...fresh] };
  return g;
}

