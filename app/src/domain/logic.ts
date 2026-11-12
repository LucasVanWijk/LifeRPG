import { addDays, nextAnnual, parseDay } from './dates';
import type { Data, Every, Habit, Quest, Status } from './model';
import { campSize, habitReward, reward, streakText } from './model';
import type { Pay } from './guild/engine';
import { awardStreak, payReal, refund } from './guild/engine';
import { ATTR_NAME, QUAD_ATTR } from './guild/content';
import { datedLines } from './notes';
import { freshId, spawnNext } from './quests';

/** undo: the toast offers to reverse the action that produced it. */
export interface Toast { text: string; sub: string; undo?: boolean }
export interface LevelUp { name: string; level: number }
/** The result of anything that pays out: new data, what to announce, and whether to show the level-up screen. */
export interface Outcome { data: Data; toasts: Toast[]; levelUp: LevelUp | null }

const none = (data: Data): Outcome => ({ data, toasts: [], levelUp: null });
const merge = (a: Outcome, b: Outcome): Outcome => ({ data: b.data, toasts: [...a.toasts, ...b.toasts], levelUp: b.levelUp ?? a.levelUp });

/**
 * Pays a real-life reward into the guild: XP to the campaign's Standard-bearer or the Champion
 * (banked when there is neither), 25% of the gold to their purse, 75% to the guild.
 */
function pay(data: Data, p: Pay, sub: string): Outcome {
  if (!data.guild) return { data, toasts: [{ text: '+' + p.xp + ' XP · +' + p.gold + ' gold', sub, undo: true }], levelUp: null };
  const r = payReal(data.guild, p);
  const e = r.entry;
  const extra = e.points ? ' · ' + ATTR_NAME[e.attr] + ' +' + e.points : '';
  const toast: Toast = r.to
    ? { text: '+' + e.xp + ' XP to ' + r.to.first + ' · +' + e.guild + 'g', sub: sub + ' · +' + e.purse + 'g to their purse' + extra, undo: true }
    : { text: '+' + e.xp + ' XP banked · +' + e.guild + 'g', sub: sub + ' · no Champion to receive it yet', undo: true };
  const to = r.to ? r.guild.adventurers.find((a) => a.id === r.to!.id)! : null;
  return { data: { ...data, guild: r.guild }, toasts: [toast], levelUp: to && r.levels ? { name: to.first, level: to.level } : null };
}
const takeBack = (data: Data, key: string): Data => (data.guild ? { ...data, guild: refund(data.guild, key) } : data);

export const patchQuest = (data: Data, id: number, patch: Partial<Quest>): Data => ({
  ...data,
  quests: data.quests.map((q) => (q.id === id ? { ...q, ...patch } : q)),
});

/**
 * Pays a campaign's reward the moment its last quest is done. A campaign finished today
 * that gets an open quest again (one reopened or added) gives the reward back; deleting
 * its quests doesn't, and one finished on an earlier day keeps its seal.
 */
export function settleCampaigns(data: Data, today: string): Outcome {
  let out = none(data);
  for (const [key, c] of Object.entries(data.camps)) {
    const qs = out.data.quests.filter((q) => q.campaign === key);
    const complete = qs.length > 0 && qs.every((q) => q.status === 'done');
    const d = out.data;
    if (complete && !c.completedOn) {
      const paid = pay({ ...d, camps: { ...d.camps, [key]: { ...c, completedOn: today } } },
        { key: 'c:' + key, xp: c.xp, gold: c.gold, kind: 'campaign', title: c.name, date: today, attr: 'main', notable: false, bearerId: c.bearerId, monument: { camp: key, size: campSize(c), seal: c.seal, icon: c.icon } }, c.seal);
      paid.toasts[0] = { ...paid.toasts[0], text: 'Campaign complete · ' + c.name, sub: paid.toasts[0].text + ' · ' + paid.toasts[0].sub };
      out = merge(out, paid);
    } else if (c.completedOn === today && qs.some((q) => q.status !== 'done')) {
      out = merge(out, none({ ...takeBack(d, 'c:' + key), camps: { ...d.camps, [key]: { ...c, completedOn: null } } }));
    }
  }
  return out;
}

/** Pays out a quest and moves it to Done. Returns null when there is nothing to pay. */
export function completeQuest(data: Data, id: number, today: string): Outcome | null {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status === 'done') return null;
  const r = reward(q);
  const camp = q.campaign ? data.camps[q.campaign] : undefined;
  // A repeating quest hands over to the next one, with the next due date.
  const next = q.repeat ? spawnNext(q, today, freshId(data.quests)) : null;
  const closed = patchQuest(data, id, { status: 'done', doneOn: today, prevStatus: q.status, pick: undefined, ...(next ? { spawned: next.id } : {}) });
  const paid = pay(next ? { ...closed, quests: [...closed.quests, next] } : closed, {
    key: 'q:' + id, xp: r.xp, gold: r.gold, kind: 'quest', title: q.title, date: today, attr: QUAD_ATTR[q.quad],
    notable: q.quad === 'main' || q.size === 'L', bearerId: camp?.bearerId,
  }, q.title);
  return merge(paid, settleCampaigns(paid.data, today));
}

/** Reopens a done quest and takes its reward back. */
export function undoQuest(data: Data, id: number, today: string): Outcome {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status !== 'done') return none(data);
  // The next round it created goes away again, if nobody has touched it.
  const nextQ = q.spawned ? data.quests.find((x) => x.id === q.spawned) : undefined;
  const untouched = !!nextQ && nextQ.status === 'todo' && !nextQ.steps.some((s) => s.done);
  const back = untouched ? { ...data, quests: data.quests.filter((x) => x.id !== q.spawned) } : data;
  const reopened = patchQuest(back, id, { status: q.prevStatus && q.prevStatus !== 'done' ? q.prevStatus : 'todo', doneOn: null, spawned: undefined });
  return settleCampaigns(takeBack(reopened, 'q:' + id), today);
}

/** Moving to Done pays out; moving out of Done takes the reward back first. */
export function setStatus(data: Data, id: number, status: Status, today: string): Outcome {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status === status) return none(data);
  if (status === 'done') return completeQuest(data, id, today) ?? none(data);
  const base = q.status === 'done' ? undoQuest(data, id, today) : none(data);
  return merge(base, settleCampaigns(patchQuest(base.data, id, { status }), today));
}

export const deleteQuest = (data: Data, id: number, today: string) =>
  settleCampaigns({ ...data, quests: data.quests.filter((q) => q.id !== id) }, today);

/** Quests of a deleted campaign stay on the board without one. */
export function deleteCampaign(data: Data, key: string): Data {
  const camps = { ...data.camps };
  delete camps[key];
  return { ...data, camps, quests: data.quests.map((q) => (q.campaign === key ? { ...q, campaign: null } : q)) };
}

// ── Habits ──────────────────────────────────────────────────

/** The day that identifies a habit period: the day itself, or the Monday of its week. */
export function periodOf(day: string, every: Every): string {
  if (every === 'daily') return day;
  return addDays(day, -((parseDay(day).getDay() + 6) % 7));
}
const stepBack = (period: string, every: Every) => addDays(period, every === 'daily' ? -1 : -7);

/** Check-ins a habit needs per period: always 1 for daily habits, the weekly target otherwise. */
export const habitTarget = (h: Habit) => (h.every === 'weekly' ? Math.max(1, h.target ?? 1) : 1);

const countIn = (h: Habit, period: string) => new Set(h.log.filter((d) => periodOf(d, h.every) === period)).size;

/** This period's check-ins against the target, e.g. 2 of 3 this week. */
export const habitProgress = (h: Habit, today: string) => ({ count: countIn(h, periodOf(today, h.every)), target: habitTarget(h) });

/** The period's target is met. */
export const habitDone = (h: Habit, today: string) => countIn(h, periodOf(today, h.every)) >= habitTarget(h);

/** Checked in today (for habits that take several check-ins a week). */
export const checkedInToday = (h: Habit, today: string) => h.log.includes(today);

const metPeriods = (h: Habit) => {
  const counts = new Map<string, Set<string>>();
  for (const d of h.log) {
    const p = periodOf(d, h.every);
    counts.set(p, (counts.get(p) ?? new Set()).add(d));
  }
  const t = habitTarget(h);
  return new Set([...counts].filter(([, days]) => days.size >= t).map(([p]) => p));
};

/** Consecutive periods on target, counting back from this period (or the last one, if this one isn't met yet). */
export function habitStreak(h: Habit, today: string): number {
  const met = metPeriods(h);
  let p = periodOf(today, h.every);
  if (!met.has(p)) p = stepBack(p, h.every);
  let n = 0;
  while (met.has(p)) { n++; p = stepBack(p, h.every); }
  return n;
}

export function bestStreak(h: Habit): number {
  const periods = [...metPeriods(h)].sort();
  let best = 0, run = 0, prev = '';
  for (const p of periods) {
    run = prev && stepBack(p, h.every) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = p;
  }
  return best;
}

/**
 * Checks a habit in, or takes the check-in back. Habits done once per period toggle the whole period;
 * habits with a weekly target of several days check in once per day, until the target is reached.
 */
export function toggleHabit(data: Data, id: number, today: string): Outcome {
  const h = data.habits.find((x) => x.id === id);
  if (!h) return none(data);
  const r = habitReward(h);
  const target = habitTarget(h);
  const cur = periodOf(today, h.every);
  const setLog = (log: string[]) => data.habits.map((x) => (x.id === id ? { ...x, log } : x));
  if (target === 1 ? habitDone(h, today) : checkedInToday(h, today)) {
    const log = target === 1 ? h.log.filter((d) => periodOf(d, h.every) !== cur) : h.log.filter((d) => d !== today);
    const removed = h.log.filter((d) => !log.includes(d));
    let d = { ...data, habits: setLog(log) };
    for (const day of removed) d = takeBack(d, 'h:' + id + ':' + day);
    return none(d);
  }
  if (habitDone(h, today)) return none(data);
  const next = { ...h, log: [...h.log, today] };
  const prog = habitProgress(next, today);
  const sub = prog.count < prog.target ? prog.count + ' of ' + prog.target + ' this week' : streakText(habitStreak(next, today), h.every);
  const paid = pay({ ...data, habits: setLog(next.log) }, {
    key: 'h:' + id + ':' + today, xp: r.xp, gold: r.gold, kind: 'habit', title: h.title, date: today, attr: 'main', notable: false,
  }, h.title + ' · ' + sub);
  // A streak milestone forges an heirloom, and it stays even if the streak breaks later.
  const forged = paid.data.guild ? awardStreak(paid.data.guild, id, h.title, habitStreak(next, today), h.every) : null;
  if (forged) return { ...paid, data: { ...paid.data, guild: forged }, toasts: [...paid.toasts, { text: 'Heirloom forged', sub: h.title + ' · see the Hall of Heroes' }] };
  return paid;
}

// ── Chronicle ───────────────────────────────────────────────

export interface ChronicleEntry { date: string; kind: 'quest' | 'habit' | 'campaign'; title: string; xp: number; gold: number }

/** Everything completed, newest first: quests, habit check-ins and finished campaigns. */
export function chronicle(data: Data): ChronicleEntry[] {
  const out: ChronicleEntry[] = [];
  for (const q of data.quests) if (q.status === 'done' && q.doneOn) out.push({ date: q.doneOn, kind: 'quest', title: q.title, ...reward(q) });
  for (const h of data.habits) {
    const r = habitReward(h);
    for (const d of new Set(h.log)) out.push({ date: d, kind: 'habit', title: h.title, ...r });
  }
  for (const c of Object.values(data.camps)) if (c.completedOn) out.push({ date: c.completedOn, kind: 'campaign', title: c.name, xp: c.xp, gold: c.gold });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ── Calendar ────────────────────────────────────────────────

export interface CalendarEvent { date: string; label: string; kind: 'Companion' | 'Note'; target: string; who?: string; /** The companion or note a dated line belongs to. */ source?: string }

/** Birthdays and dated Glossary notes that show on the Home week strip. */
export function glossaryEvents(data: Data, today: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const y = Number(today.slice(0, 4));
  for (const c of data.companions) {
    if (c.bday) for (const yr of [y - 1, y, y + 1]) out.push({ date: yr + '-' + c.bday, label: c.first + "'s birthday", kind: 'Companion', target: 'companion:' + c.id, who: c.first });
    for (const n of c.notes) if (n.date && !n.contact) out.push({ date: n.date, label: n.label || n.t, kind: 'Companion', target: 'companion:' + c.id, who: c.first, source: c.first });
  }
  for (const n of data.notes)
    for (const l of datedLines(n.body)) out.push({ date: l.date, label: l.label, kind: 'Note', target: 'note:' + n.id, source: n.title });
  return out;
}

export const nextBirthday = (bday: string, today: string) => nextAnnual(bday, today);
