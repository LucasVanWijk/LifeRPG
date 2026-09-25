import { addDays, addMonths, nextAnnual } from './dates';
import type { Data, Every, Quest, Status } from './model';
import { reward, streakText } from './model';

const advance = (due: string, every: Every) =>
  every === 'daily' ? addDays(due, 1) : every === 'monthly' ? addMonths(due, 1) : addDays(due, 7);

export interface Completion { data: Data; xp: number; gold: number; leveledUp: boolean; toastSub: string }

const patchQuest = (data: Data, id: number, patch: Partial<Quest>): Data => ({
  ...data,
  quests: data.quests.map((q) => (q.id === id ? { ...q, ...patch } : q)),
});

/**
 * Pays out a quest. One-off quests move to Done; bounties roll their due date
 * forward and extend the streak. Returns null when there is nothing to pay.
 */
export function completeQuest(data: Data, id: number, today: string): Completion | null {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status === 'done' || q.lastDone === today) return null;
  const r = reward(q);
  let { xp, level, next, gold } = data.hero;
  xp += r.xp;
  gold += r.gold;
  let leveledUp = false;
  while (xp >= next) {
    xp -= next;
    level++;
    next += 100;
    leveledUp = true;
  }
  const patch: Partial<Quest> = q.recur
    ? { due: advance(q.due || today, q.recur.every), recur: { ...q.recur, streak: q.recur.streak + 1 }, lastDone: today, prevDue: q.due }
    : { status: 'done', doneOn: today, prevStatus: q.status };
  const toastSub = q.recur ? q.title + ' · ' + streakText({ ...q.recur, streak: q.recur.streak + 1 }) : q.title;
  return { data: { ...patchQuest(data, id, patch), hero: { ...data.hero, xp, level, next, gold } }, xp: r.xp, gold: r.gold, leveledUp, toastSub };
}

/** Reverses a completion from today (or reopens a done quest) and takes the reward back. */
export function undoQuest(data: Data, id: number, today: string): Data {
  const q = data.quests.find((x) => x.id === id);
  if (!q) return data;
  const r = reward(q);
  const patch: Partial<Quest> =
    q.lastDone === today && q.recur
      ? { due: q.prevDue ?? q.due, recur: { ...q.recur, streak: Math.max(0, q.recur.streak - 1) }, lastDone: null }
      : { status: q.prevStatus && q.prevStatus !== 'done' ? q.prevStatus : 'todo', doneOn: null };
  const hero = { ...data.hero, xp: Math.max(0, data.hero.xp - r.xp), gold: Math.max(0, data.hero.gold - r.gold) };
  return { ...patchQuest(data, id, patch), hero };
}

/** Moving to Done pays out; moving out of Done takes the reward back first. */
export function setStatus(data: Data, id: number, status: Status, today: string): { data: Data; completion: Completion | null } {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status === status) return { data, completion: null };
  if (status === 'done') {
    const c = completeQuest(data, id, today);
    return { data: c ? c.data : data, completion: c };
  }
  const base = q.status === 'done' ? undoQuest(data, id, today) : data;
  return { data: patchQuest(base, id, { status }), completion: null };
}

export { patchQuest };

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
