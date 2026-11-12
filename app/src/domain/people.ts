// Keeping in touch: when did you last talk to someone, and who are you overdue with.
import { addDays, dayDiff } from './dates';
import { eventItems } from './calendar';
import type { Companion, Data } from './model';
import { RHYTHM_DAYS } from './model';

/** The day of the last contact: a dated note (not in the future), a finished quest with them, or a past event with them. */
export function lastContact(d: Pick<Data, 'quests' | 'events'>, c: Companion, today: string): string | null {
  const days: string[] = [];
  for (const n of c.notes) if (n.date && n.date <= today) days.push(n.date);
  for (const q of d.quests) if (q.status === 'done' && q.doneOn && q.companions.includes(c.id)) days.push(q.doneOn);
  for (const e of d.events) {
    if (!e.companions.includes(c.id)) continue;
    // The latest occurrence that has already happened (looking back a year for repeats).
    for (const it of eventItems(e, addDays(today, -366), today)) days.push(it.date);
  }
  const past = days.filter((x) => x <= today).sort();
  return past.at(-1) ?? null;
}

export interface Overdue { c: Companion; last: string | null; days: number }

/** Companions with a rhythm that is overdue, the longest overdue first. `later` hides one for a week. */
export function overdueContacts(d: Pick<Data, 'quests' | 'events' | 'companions'>, today: string): Overdue[] {
  const out: Overdue[] = [];
  for (const c of d.companions) {
    if (!c.rhythm || (c.later && c.later > today)) continue;
    const last = lastContact(d, c, today);
    const from = [last, c.rhythmSince].filter((x): x is string => !!x).sort().at(-1) ?? today;
    const since = dayDiff(today, from);
    if (since >= RHYTHM_DAYS[c.rhythm]) out.push({ c, last, days: since - RHYTHM_DAYS[c.rhythm] });
  }
  return out.sort((a, b) => b.days - a.days || a.c.name.localeCompare(b.c.name));
}

/** All group names in use, sorted. */
export const allGroups = (companions: Pick<Companion, 'groups'>[]) =>
  [...new Set(companions.flatMap((c) => c.groups ?? []))].sort((a, b) => a.localeCompare(b));

/** Age this year from a birth year and a month-day birthday, as of `today`. */
export function ageOf(c: Pick<Companion, 'birthYear' | 'bday'>, today: string): number | null {
  if (!c.birthYear) return null;
  const y = Number(today.slice(0, 4));
  return y - c.birthYear - (c.bday && today.slice(5) < c.bday ? 1 : 0);
}
