import { addDays, nextAnnual, parseDay } from './dates';
import type { Data, Every, Habit, Hero, Quest, Status } from './model';
import { habitReward, reward, streakText } from './model';

/** undo: the toast offers to reverse the action that produced it. */
export interface Toast { text: string; sub: string; undo?: boolean }
/** The result of anything that pays out: new data, what to announce, and whether to show the level-up screen. */
export interface Outcome { data: Data; toasts: Toast[]; leveledUp: boolean }

const none = (data: Data): Outcome => ({ data, toasts: [], leveledUp: false });
const merge = (a: Outcome, b: Outcome): Outcome => ({ data: b.data, toasts: [...a.toasts, ...b.toasts], leveledUp: a.leveledUp || b.leveledUp });

export function gain(hero: Hero, xpGain: number, goldGain: number): { hero: Hero; leveledUp: boolean } {
  let { xp, level, next } = hero;
  xp += xpGain;
  let leveledUp = false;
  while (xp >= next) {
    xp -= next;
    level++;
    next += 100;
    leveledUp = true;
  }
  return { hero: { ...hero, xp, level, next, gold: hero.gold + goldGain, points: (hero.points ?? 0) + xpGain }, leveledUp };
}

/** Takes a reward back. Levels are never lost; XP, gold and skill points stop at zero. */
export const lose = (hero: Hero, xp: number, gold: number): Hero =>
  ({ ...hero, xp: Math.max(0, hero.xp - xp), gold: Math.max(0, hero.gold - gold), points: Math.max(0, (hero.points ?? 0) - xp) });

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
      const g = gain(d.hero, c.xp, c.gold);
      out = merge(out, {
        data: { ...d, hero: g.hero, camps: { ...d.camps, [key]: { ...c, completedOn: today } } },
        toasts: [{ text: 'Campaign complete · ' + c.name, sub: c.seal + ' · +' + c.xp + ' XP · +' + c.gold + ' gold', undo: true }],
        leveledUp: g.leveledUp,
      });
    } else if (c.completedOn === today && qs.some((q) => q.status !== 'done')) {
      out = merge(out, none({ ...d, hero: lose(d.hero, c.xp, c.gold), camps: { ...d.camps, [key]: { ...c, completedOn: null } } }));
    }
  }
  return out;
}

/** Pays out a quest and moves it to Done. Returns null when there is nothing to pay. */
export function completeQuest(data: Data, id: number, today: string): Outcome | null {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status === 'done') return null;
  const r = reward(q);
  const g = gain(data.hero, r.xp, r.gold);
  const paid: Outcome = {
    data: { ...patchQuest(data, id, { status: 'done', doneOn: today, prevStatus: q.status }), hero: g.hero },
    toasts: [{ text: '+' + r.xp + ' XP · +' + r.gold + ' gold', sub: q.title, undo: true }],
    leveledUp: g.leveledUp,
  };
  return merge(paid, settleCampaigns(paid.data, today));
}

/** Reopens a done quest and takes its reward back. */
export function undoQuest(data: Data, id: number, today: string): Outcome {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status !== 'done') return none(data);
  const r = reward(q);
  const reopened = patchQuest(data, id, { status: q.prevStatus && q.prevStatus !== 'done' ? q.prevStatus : 'todo', doneOn: null });
  return settleCampaigns({ ...reopened, hero: lose(data.hero, r.xp, r.gold) }, today);
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
    const removed = h.log.length - log.length;
    return none({ ...data, hero: lose(data.hero, r.xp * removed, r.gold * removed), habits: setLog(log) });
  }
  if (habitDone(h, today)) return none(data);
  const g = gain(data.hero, r.xp, r.gold);
  const next = { ...h, log: [...h.log, today] };
  const prog = habitProgress(next, today);
  const sub = prog.count < prog.target ? prog.count + ' of ' + prog.target + ' this week' : streakText(habitStreak(next, today), h.every);
  return {
    data: { ...data, hero: g.hero, habits: setLog(next.log) },
    toasts: [{ text: '+' + r.xp + ' XP · +' + r.gold + ' gold', sub: h.title + ' · ' + sub, undo: true }],
    leveledUp: g.leveledUp,
  };
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

export interface CalendarEvent { date: string; label: string; kind: 'Companion' | 'Codex'; target: string; who?: string }

/** Birthdays and dated Glossary notes that show on the Home week strip. */
export function glossaryEvents(data: Data, today: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const y = Number(today.slice(0, 4));
  for (const c of data.companions) {
    if (c.bday) for (const yr of [y - 1, y, y + 1]) out.push({ date: yr + '-' + c.bday, label: c.first + "'s birthday", kind: 'Companion', target: 'companion:' + c.id, who: c.first });
    for (const n of c.notes) if (n.date) out.push({ date: n.date, label: n.label || c.first + ': ' + n.t, kind: 'Companion', target: 'companion:' + c.id, who: c.first });
  }
  for (const x of data.codex)
    for (const f of x.fields) if (f.date) out.push({ date: f.date, label: f.label || x.name + ': ' + f.k, kind: 'Codex', target: 'codex:' + x.id });
  return out;
}

export const nextBirthday = (bday: string, today: string) => nextAnnual(bday, today);
