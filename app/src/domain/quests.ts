// Quest helpers: what counts as open, today's list, someday, stale, repeating, and how full a day is.
import { addDays, addMonths, dayDiff } from './dates';
import type { Data, Quest, QuestRepeat, SizeKey } from './model';

const DAY = 86_400_000;
export const STALE_DAYS = 30;
/** Points per size for judging how full a day is. */
export const POINTS: Record<SizeKey, number> = { S: 1, M: 2, L: 3 };
/** More than this on one day gets a (soft) warning. */
export const FULL_DAY = 6;

/** Not done and not parked in Someday. */
export const isOpen = (q: Quest) => q.status !== 'done' && !q.someday;
export const isOverdueQuest = (q: Quest, today: string) => isOpen(q) && !!q.due && q.due < today;

/** Sort key for a quest's slot in the day: its due date, then its time (untimed ones after timed ones). */
const slot = (q: Quest, today: string) => (q.due && q.due < today ? q.due : q.due ?? today) + ' ' + (q.dueTime ?? '99:99');

/** Today's Quests: what is due today or earlier, and what was picked for today. */
export function todayQuests(quests: Quest[], today: string): Quest[] {
  return quests
    .filter((q) => isOpen(q) && ((!!q.due && q.due <= today) || q.pick === today))
    .sort((a, b) => slot(a, today).localeCompare(slot(b, today)) || a.id - b.id);
}

export const isPicked = (q: Quest, today: string) => q.pick === today;
export const dayPoints = (qs: Quest[]) => qs.reduce((n, q) => n + POINTS[q.size], 0);
export const dayTooFull = (qs: Quest[]) => dayPoints(qs) > FULL_DAY;

/** Quests picked yesterday (or earlier) that are still open, Crisis quests and Main Quests: what the Plan your day card offers. */
export function planCandidates(quests: Quest[], today: string): { carried: Quest[]; crisis: Quest[]; main: Quest[] } {
  const there = new Set(todayQuests(quests, today).map((q) => q.id));
  const open = quests.filter((q) => isOpen(q) && !there.has(q.id));
  const carried = open.filter((q) => !!q.pick && q.pick < today);
  const taken = new Set(carried.map((q) => q.id));
  const byDueDate = (a: Quest, b: Quest) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.id - b.id;
  return {
    carried,
    crisis: open.filter((q) => q.quad === 'crisis' && !taken.has(q.id)).sort(byDueDate),
    main: open.filter((q) => q.quad === 'main' && !taken.has(q.id)).sort(byDueDate),
  };
}

/** Open quests untouched for 30 days with no due date ahead. */
export function staleQuests(quests: Quest[], today: string, now: number): Quest[] {
  return quests.filter((q) => isOpen(q) && (!q.due || q.due < today) && q.updated !== undefined && now - q.updated >= STALE_DAYS * DAY)
    .sort((a, b) => (a.updated ?? 0) - (b.updated ?? 0));
}
export const somedayQuests = (quests: Quest[]) => quests.filter((q) => q.status !== 'done' && q.someday).sort((a, b) => (a.updated ?? 0) - (b.updated ?? 0));

const step = (day: string, r: QuestRepeat, times: number) =>
  r.unit === 'day' ? addDays(day, r.n * times) : r.unit === 'week' ? addDays(day, 7 * r.n * times) : addMonths(day, (r.unit === 'month' ? r.n : 12 * r.n) * times);

/** The due date of the next round: counted from the due date ("rent on the 1st") or from the day it was finished. */
export function nextDue(q: Pick<Quest, 'due' | 'repeat'>, doneOn: string): string {
  const r = q.repeat!;
  if (r.from === 'done' || !q.due) return step(doneOn, r, 1);
  // From the due date: keep the rhythm, but never land in the past (a rent paid three weeks late is still due on the 1st).
  let n = 1;
  while (step(q.due, r, n) <= doneOn && n < 5000) n++;
  return step(q.due, r, n);
}

export const repeatText = (r: QuestRepeat) => 'Every ' + (r.n > 1 ? r.n + ' ' : '') + r.unit + (r.n > 1 ? 's' : '') + (r.from === 'done' ? ' after done' : ' from the due date');

/** The next quest of a repeating one: same title, size, zone, people, notes and (unticked) steps. */
export function spawnNext(q: Quest, doneOn: string, id: number): Quest {
  const stamp = Date.now();
  return {
    id, title: q.title, quad: q.quad, due: nextDue(q, doneOn), dueTime: q.dueTime, size: q.size, campaign: null, status: 'todo',
    notes: q.notes.map((n, i) => ({ ...n, id: stamp + i })), steps: q.steps.map((s, i) => ({ ...s, id: stamp + 1000 + i, done: false })),
    companions: [...q.companions], repeat: q.repeat,
  };
}

export const freshId = (quests: { id: number }[]) => Math.max(Date.now(), ...quests.map((q) => q.id + 1));

/** The whole quests list of a log, as the Quests screens show it. */
export const openCount = (d: Pick<Data, 'quests'>) => d.quests.filter(isOpen).length;
export { dayDiff };
