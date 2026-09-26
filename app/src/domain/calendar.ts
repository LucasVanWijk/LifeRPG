// Everything on the calendar for a range of days: your events (with repeats), quest deadlines,
// birthdays and dated Glossary notes.
import { addDays, dayDiff, parseDay } from './dates';
import { glossaryEvents } from './logic';
import type { CalEvent, Data } from './model';

export type CalKind = 'event' | 'deadline' | 'birthday' | 'glossary';

/**
 * One fixed colour and marker shape per kind. The colours pass the categorical palette checks
 * on parchment (contrast, lightness, normal vision); red and green sit in the colour-blind
 * floor band, so every kind also has its own shape and a text label wherever it appears.
 */
export const KINDS: Record<CalKind, { name: string; color: string; shape: 'circle' | 'square' | 'triangle' | 'diamond' }> = {
  event: { name: 'Event', color: '#1f5fbf', shape: 'circle' },
  deadline: { name: 'Quest deadline', color: '#b8321a', shape: 'square' },
  birthday: { name: 'Birthday', color: '#c94f9c', shape: 'triangle' },
  glossary: { name: 'Glossary date', color: '#1a8a55', shape: 'diamond' },
};
const KIND_ORDER: CalKind[] = ['deadline', 'event', 'birthday', 'glossary'];

export interface CalItem {
  date: string;
  kind: CalKind;
  title: string;
  allDay: boolean;
  time?: string;
  endTime?: string;
  location?: string;
  companions?: string[];
  /** 'event:3', 'quest:12', or a Glossary target like 'companion:sophie'. */
  target: string;
  /** For multi-day events: which day of how many. */
  span?: { day: number; of: number };
}

/** Start dates of a repeating event that could touch [from, to]. */
function starts(e: CalEvent, from: string, to: string): string[] {
  const length = dayDiff(e.end, e.start);
  const out: string[] = [];
  if (!e.repeat) return e.start <= to && e.end >= from ? [e.start] : [];
  const { every, interval = 1, until } = e.repeat;
  const step = Math.max(1, interval);
  const s = parseDay(e.start);
  const last = until && until < to ? until : to;
  for (let i = 0; i < 5000; i++) {
    let d: string;
    if (every === 'daily' || every === 'weekly') {
      d = addDays(e.start, i * step * (every === 'weekly' ? 7 : 1));
    } else {
      const months = every === 'monthly' ? i * step : i * step * 12;
      const t = new Date(s.getFullYear(), s.getMonth() + months, s.getDate());
      // The 31st doesn't exist every month (nor 29 Feb every year): skip those.
      if (t.getDate() !== s.getDate()) continue;
      d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    }
    if (d > last) break;
    if (addDays(d, length) >= from && !e.except?.includes(d)) out.push(d);
  }
  return out;
}

export function eventItems(e: CalEvent, from: string, to: string): CalItem[] {
  const length = dayDiff(e.end, e.start);
  const out: CalItem[] = [];
  for (const s of starts(e, from, to)) {
    for (let k = 0; k <= length; k++) {
      const date = addDays(s, k);
      if (date < from || date > to) continue;
      out.push({
        date, kind: 'event', title: e.title, allDay: e.allDay || (length > 0 && k > 0 && k < length),
        time: e.allDay ? undefined : k === 0 ? e.startTime : undefined,
        endTime: e.allDay ? undefined : k === length ? e.endTime : undefined,
        location: e.location || undefined, companions: e.companions, target: 'event:' + e.id,
        span: length > 0 ? { day: k + 1, of: length + 1 } : undefined,
      });
    }
  }
  return out;
}

/** Everything between `from` and `to` (inclusive), sorted by day, then all-day first, then time. */
export function calendarItems(data: Pick<Data, 'events' | 'quests' | 'companions' | 'codex'>, from: string, to: string): CalItem[] {
  const items: CalItem[] = [];
  for (const e of data.events) items.push(...eventItems(e, from, to));
  for (const q of data.quests) {
    if (q.status !== 'done' && q.due && q.due >= from && q.due <= to) {
      items.push({ date: q.due, kind: 'deadline', title: q.title, allDay: true, companions: q.companions, target: 'quest:' + q.id });
    }
  }
  for (const g of glossaryEvents(data as Data, from)) {
    if (g.date < from || g.date > to) continue;
    const birthday = g.label.endsWith("'s birthday");
    items.push({ date: g.date, kind: birthday ? 'birthday' : 'glossary', title: g.label, allDay: true, target: g.target });
  }
  return items.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    Number(b.allDay) - Number(a.allDay) ||
    (a.time ?? '').localeCompare(b.time ?? '') ||
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORD = (n: number) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

/** "Every 2 weeks on Monday, until 1 Dec". */
export function repeatText(e: CalEvent, fmt: (d: string) => string): string {
  if (!e.repeat) return 'Does not repeat';
  const { every, interval = 1, until } = e.repeat;
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[every];
  const d = parseDay(e.start);
  const on = every === 'weekly' ? ' on ' + WEEKDAY[d.getDay()] : every === 'monthly' ? ' on the ' + ORD(d.getDate()) : every === 'yearly' ? ' on ' + fmt(e.start) : '';
  return (interval > 1 ? 'Every ' + interval + ' ' + unit + 's' : 'Every ' + unit) + on + (until ? ', until ' + fmt(until) : '');
}
