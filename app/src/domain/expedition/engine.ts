// Expeditions: a small idle game. Pure functions over plain data, so it can be tested and saved as-is.
import type { Dungeon, Drop, Item, Monster, Recipe, Skill } from './content';
import {
  DUNGEON, FISTS, HP_REGEN_MS, ITEMS, MAX_LEVEL, OFFLINE_CAP_MS, PRACTICE_XP, RECIPE, ROUND_MS, SHOP, SKILL_NAME, SKILLS, xpForLevel,
} from './content';

export interface Activity {
  kind: 'recipe' | 'dungeon';
  id: string;
  /** Time already spent on the current action or combat round. */
  progress: number;
  /** Dungeons: which room, the monster's remaining HP, and the dice seed. */
  room?: number;
  monsterHp?: number;
  seed?: number;
}

export interface Expedition {
  /** Skill XP; the level is worked out from it. */
  skills: Record<Skill, number>;
  bank: Record<string, number>;
  equipment: { weapon?: string; armour?: string };
  hp: number;
  activity: Activity | null;
  lastTick: number;
  /** The last few lines of the battle log. */
  log: string[];
  clears: Record<string, number>;
}

export interface Summary {
  elapsed: number;
  capped: boolean;
  gained: Record<string, number>;
  used: Record<string, number>;
  kills: number;
  clears: number;
  stopped: string | null;
}

const LOG_LINES = 30;

export function newExpedition(now: number): Expedition {
  const skills = Object.fromEntries(SKILLS.map((s) => [s.key, 0])) as Record<Skill, number>;
  const e: Expedition = { skills, bank: {}, equipment: {}, hp: 0, activity: null, lastTick: now, log: [], clears: {} };
  e.hp = maxHp(e);
  return e;
}

export function levelOf(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}
export const level = (e: Expedition, s: Skill) => levelOf(e.skills[s]);
export const maxHp = (e: Expedition) => 10 + 2 * level(e, 'hitpoints');
export const weaponOf = (e: Expedition): Item => (e.equipment.weapon && ITEMS[e.equipment.weapon]) || FISTS;
export const armourClass = (e: Expedition) => 10 + Math.floor(level(e, 'defence') / 3) + ((e.equipment.armour && ITEMS[e.equipment.armour]?.ac) || 0);
export const toHitBonus = (e: Expedition) => Math.floor(level(e, 'attack') / 2) + (weaponOf(e).acc ?? 0);
export const damageBonus = (e: Expedition) => Math.floor(level(e, 'strength') / 3) + (weaponOf(e).dmg ?? 0);

/** XP still needed for the next level, or 0 at the cap. */
export const xpToNext = (e: Expedition, s: Skill) => {
  const l = level(e, s);
  return l >= MAX_LEVEL ? 0 : xpForLevel(l + 1) - e.skills[s];
};

const add = (bag: Record<string, number>, item: string, n: number) => { bag[item] = (bag[item] ?? 0) + n; };
const have = (e: Expedition, item: string) => e.bank[item] ?? 0;

/** Actions the bank can pay for. */
export const affordable = (e: Expedition, r: Recipe) => Math.min(...Object.entries(r.use).map(([item, n]) => Math.floor(have(e, item) / n)));

/** The best food in the bank, if any. */
export function bestFood(e: Expedition): string | null {
  let best: string | null = null;
  for (const [id, n] of Object.entries(e.bank)) {
    const h = ITEMS[id]?.heals;
    if (n > 0 && h && (!best || h > (ITEMS[best].heals ?? 0))) best = id;
  }
  return best;
}
export const foodCount = (e: Expedition) => Object.entries(e.bank).reduce((s, [id, n]) => s + (ITEMS[id]?.heals ? n : 0), 0);

// ── Dice: a seeded generator, so offline catch-up and tests are repeatable ──

function rng(seed: number) {
  let s = seed >>> 0;
  return {
    next() { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
    roll(sides: number) { return 1 + Math.floor(this.next() * sides); },
    get seed() { return s; },
  };
}

// ── Starting, stopping, catching up ──────────────────────────

export type StartResult = { ok: true; exp: Expedition } | { ok: false; reason: string };

export function start(e: Expedition, kind: Activity['kind'], id: string, now: number): StartResult {
  if (kind === 'recipe') {
    const r = RECIPE[id];
    if (!r) return { ok: false, reason: 'Unknown activity' };
    if (level(e, r.skill) < r.level) return { ok: false, reason: SKILL_NAME[r.skill] + ' level ' + r.level + ' needed' };
    if (affordable(e, r) < 1) return { ok: false, reason: 'Missing ' + missing(e, r) };
    return { ok: true, exp: { ...e, activity: { kind, id, progress: 0 }, lastTick: now } };
  }
  const d = DUNGEON[id];
  if (!d) return { ok: false, reason: 'Unknown dungeon' };
  if (have(e, 'torch') < 1) return { ok: false, reason: 'You need a torch' };
  const bank = { ...e.bank, torch: have(e, 'torch') - 1 };
  const log = [...e.log, '— You light a torch and enter ' + d.name + '.'].slice(-LOG_LINES);
  return { ok: true, exp: { ...e, bank, log, activity: { kind, id, progress: 0, room: 0, monsterHp: d.rooms[0].hp, seed: (now ^ 0x9e3779b9) >>> 0 }, lastTick: now } };
}

const missing = (e: Expedition, r: Recipe) => Object.entries(r.use).filter(([item, n]) => have(e, item) < n).map(([item]) => ITEMS[item]?.name.toLowerCase() ?? item).join(' and ');

export const stop = (e: Expedition, now: number): Expedition => ({ ...e, activity: null, lastTick: now });

/**
 * Plays out the time since the last tick (at most 8 hours): recipe actions, combat rounds,
 * and HP regeneration while resting.
 */
export function advance(e0: Expedition, now: number): { exp: Expedition; summary: Summary } {
  const raw = Math.max(0, now - e0.lastTick);
  const elapsed = Math.min(raw, OFFLINE_CAP_MS);
  const summary: Summary = { elapsed, capped: raw > OFFLINE_CAP_MS, gained: {}, used: {}, kills: 0, clears: 0, stopped: null };
  const e: Expedition = { ...e0, skills: { ...e0.skills }, bank: { ...e0.bank }, clears: { ...e0.clears }, log: [...e0.log], lastTick: now };
  let rest = elapsed;

  if (e.activity?.kind === 'recipe') rest = runRecipe(e, RECIPE[e.activity.id], elapsed, summary);
  else if (e.activity?.kind === 'dungeon') rest = runDungeon(e, DUNGEON[e.activity.id], elapsed, summary);

  // Resting heals between runs.
  if (!e.activity || e.activity.kind !== 'dungeon') e.hp = Math.min(maxHp(e), e.hp + Math.floor(rest / HP_REGEN_MS));
  e.log = e.log.slice(-LOG_LINES);
  return { exp: e, summary };
}

function runRecipe(e: Expedition, r: Recipe | undefined, elapsed: number, sum: Summary): number {
  const act = e.activity!;
  if (!r) { e.activity = null; return elapsed; }
  const total = act.progress + elapsed;
  const want = Math.floor(total / r.time);
  const can = affordable(e, r);
  const n = Math.min(want, can);
  for (const [item, k] of Object.entries(r.use)) { e.bank[item] = have(e, item) - k * n; add(sum.used, item, k * n); }
  add(e.bank, r.out, r.outN * n);
  add(sum.gained, r.out, r.outN * n);
  e.skills[r.skill] += PRACTICE_XP * n;
  if (want > can || affordable(e, r) < 1) {
    e.activity = null;
    sum.stopped = 'Out of ' + missing(e, r);
    return Math.max(0, elapsed - (n * r.time - act.progress));
  }
  e.activity = { ...act, progress: total - n * r.time };
  return 0;
}

function rollDrops(drops: Drop[], dice: ReturnType<typeof rng>, e: Expedition, sum: Summary, lines: string[]) {
  for (const d of drops) {
    if (dice.next() < d.chance) {
      add(e.bank, d.item, d.n);
      add(sum.gained, d.item, d.n);
      lines.push('  Loot: ' + (d.n > 1 ? d.n + '× ' : '') + ITEMS[d.item].name);
    }
  }
}

/** Eats until you are out of reach of the monster's biggest possible hit (or at least half HP), while food lasts. */
function eat(e: Expedition, m: Monster, lines: string[]) {
  const safe = Math.max(maxHp(e) / 2, m.die * 2 + m.dmg);
  while (e.hp <= safe && e.hp < maxHp(e)) {
    const food = bestFood(e);
    if (!food) return;
    e.bank[food] -= 1;
    const heal = ITEMS[food].heals!;
    e.hp = Math.min(maxHp(e), e.hp + heal);
    lines.push('  You eat ' + ITEMS[food].name.toLowerCase() + ' (+' + heal + ' HP).');
  }
}

function runDungeon(e: Expedition, d: Dungeon | undefined, elapsed: number, sum: Summary): number {
  let act = e.activity!;
  if (!d) { e.activity = null; return elapsed; }
  const dice = rng(act.seed ?? 1);
  let total = act.progress + elapsed;
  const lines: string[] = [];
  const weapon = weaponOf(e);
  while (total >= ROUND_MS) {
    total -= ROUND_MS;
    const m: Monster = d.rooms[act.room!];
    let mhp = act.monsterHp!;

    // Your swing.
    const roll = dice.roll(20), bonus = toHitBonus(e), crit = roll === 20;
    if (crit || (roll !== 1 && roll + bonus >= m.ac)) {
      const dmg = dice.roll(weapon.die!) + (crit ? dice.roll(weapon.die!) : 0) + damageBonus(e);
      mhp -= dmg;
      lines.push('You roll ' + roll + ' + ' + bonus + ' = ' + (roll + bonus) + ' vs AC ' + m.ac + (crit ? ' — critical! ' : ' — hit for ') + dmg + (crit ? ' damage' : '') + '.');
    } else lines.push('You roll ' + roll + ' + ' + bonus + ' = ' + (roll + bonus) + ' vs AC ' + m.ac + ' — miss.');
    e.skills.attack += PRACTICE_XP / 2;
    e.skills.strength += PRACTICE_XP / 2;

    if (mhp <= 0) {
      sum.kills++;
      lines.push('The ' + m.name.toLowerCase() + ' falls.');
      e.skills.hitpoints += PRACTICE_XP * Math.ceil(m.hp / 5);
      rollDrops(m.drops, dice, e, sum, lines);
      const nextRoom = act.room! + 1;
      if (nextRoom < d.rooms.length) {
        act = { ...act, room: nextRoom, monsterHp: d.rooms[nextRoom].hp };
        lines.push('A ' + d.rooms[nextRoom].name.toLowerCase() + ' steps out of the dark.');
        continue;
      }
      // Cleared: open the chest, then go again if there is a torch.
      sum.clears++;
      add(e.clears, d.id, 1);
      lines.push('— ' + d.name + ' cleared! You open the chest.');
      rollDrops(d.chest, dice, e, sum, lines);
      if (have(e, 'torch') < 1) {
        e.activity = null;
        sum.stopped = 'Out of torches';
        e.log.push(...lines);
        return total;
      }
      e.bank.torch -= 1;
      add(sum.used, 'torch', 1);
      lines.push('— You light another torch and go back in.');
      act = { ...act, room: 0, monsterHp: d.rooms[0].hp };
      continue;
    }
    act = { ...act, monsterHp: mhp };

    // The monster's swing.
    const mroll = dice.roll(20), ac = armourClass(e), mcrit = mroll === 20;
    if (mcrit || (mroll !== 1 && mroll + m.toHit >= ac)) {
      const dmg = dice.roll(m.die) + (mcrit ? dice.roll(m.die) : 0) + m.dmg;
      e.hp -= dmg;
      lines.push('  The ' + m.name.toLowerCase() + ' rolls ' + (mroll + m.toHit) + ' vs your AC ' + ac + (mcrit ? ' — critical, ' : ' — hits you for ') + dmg + '.');
    } else lines.push('  The ' + m.name.toLowerCase() + ' rolls ' + (mroll + m.toHit) + ' vs your AC ' + ac + ' — misses.');
    e.skills.defence += PRACTICE_XP / 2;

    if (e.hp > 0) eat(e, m, lines);
    if (e.hp <= 0) {
      e.hp = 1;
      e.activity = null;
      sum.stopped = 'Defeated by the ' + m.name.toLowerCase();
      lines.push('— You are beaten and crawl back to town. Your loot is safe.');
      e.log.push(...lines);
      return total;
    }
    // Only the latest lines matter; keep the working list short during long catch-ups.
    if (lines.length > LOG_LINES * 4) lines.splice(0, lines.length - LOG_LINES);
  }
  e.activity = { ...act, progress: total, seed: dice.seed };
  e.log.push(...lines);
  return 0;
}

// ── Shop, gear and training ──────────────────────────────────

export type Buy = { ok: true; exp: Expedition; gold: number } | { ok: false; reason: string };

export function buy(e: Expedition, gold: number, shopId: string): Buy {
  const s = SHOP.find((x) => x.id === shopId);
  if (!s) return { ok: false, reason: 'Not for sale' };
  if (gold < s.price) return { ok: false, reason: 'You need ' + (s.price - gold) + ' more gold' };
  const bank = { ...e.bank };
  for (const [item, n] of Object.entries(s.gives)) add(bank, item, n);
  return { ok: true, exp: { ...e, bank }, gold: gold - s.price };
}

export function equip(e: Expedition, item: string): Expedition {
  const it = ITEMS[item];
  if (!it || have(e, item) < 1 || (it.kind !== 'weapon' && it.kind !== 'armour')) return e;
  return { ...e, equipment: { ...e.equipment, [it.kind]: item } };
}

/** Spends skill points on a skill, up to the next level. Returns the points used. */
export function train(e: Expedition, points: number, s: Skill): { exp: Expedition; used: number } {
  const used = Math.min(Math.floor(points), Math.ceil(xpToNext(e, s)));
  if (used <= 0) return { exp: e, used: 0 };
  const exp = { ...e, skills: { ...e.skills, [s]: e.skills[s] + used } };
  // A new hitpoints level also raises current HP.
  if (s === 'hitpoints') exp.hp += maxHp(exp) - maxHp(e);
  return { exp, used };
}
