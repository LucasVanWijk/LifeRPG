// A small .ics (iCalendar) reader for importing a Google Calendar export once.
import { addDays, addMonths, isoDay } from './dates';
import type { CalEvent, Repeat } from './model';

export interface IcsResult { events: Omit<CalEvent, 'id'>[]; simplified: number; skipped: number }

/** Unfolds continuation lines and splits "NAME;PARAM=X:value". */
function lines(text: string) {
  const raw = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  return raw.filter(Boolean).map((l) => {
    const i = l.indexOf(':');
    const head = i < 0 ? l : l.slice(0, i), value = i < 0 ? '' : l.slice(i + 1);
    const [name, ...params] = head.split(';');
    const p: Record<string, string> = {};
    for (const x of params) { const [k, v] = x.split('='); if (k) p[k.toUpperCase()] = (v ?? '').replace(/^"|"$/g, ''); }
    return { name: name.toUpperCase(), params: p, value };
  });
}

const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** Hour and minute offset of a named time zone at a moment, via the browser's Intl data. */
function zoneOffsetMs(tz: string, utc: number): number {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const parts = Object.fromEntries(f.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return asUtc - utc;
  } catch {
    return -new Date(utc).getTimezoneOffset() * 60000; // unknown zone: treat as local
  }
}

/** Parses DTSTART/DTEND/EXDATE/UNTIL values into a local day (and time, unless it is a date). */
export function parseIcsDate(value: string, params: Record<string, string> = {}): { date: string; time?: string } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined || params.VALUE === 'DATE') return { date: y + '-' + mo + '-' + d };
  let local: Date;
  if (z) local = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)));
  else if (params.TZID) {
    // The wall-clock time is in TZID: find the UTC instant, then show it in the device's zone.
    const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
    local = new Date(guess - zoneOffsetMs(params.TZID, guess));
  } else local = new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)); // floating time
  return { date: isoDay(local), time: String(local.getHours()).padStart(2, '0') + ':' + String(local.getMinutes()).padStart(2, '0') };
}

const FREQ: Record<string, Repeat['every']> = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
/** Date of the n-th repeat after start. */
const nth = (start: string, every: Repeat['every'], n: number) =>
  every === 'daily' ? addDays(start, n) : every === 'weekly' ? addDays(start, 7 * n) : addMonths(start, every === 'monthly' ? n : 12 * n);

export function parseIcs(text: string): IcsResult {
  const out: IcsResult = { events: [], simplified: 0, skipped: 0 };
  let cur: ReturnType<typeof lines> | null = null;
  for (const l of lines(text)) {
    if (l.name === 'BEGIN' && l.value.toUpperCase() === 'VEVENT') { cur = []; continue; }
    if (l.name === 'END' && l.value.toUpperCase() === 'VEVENT') {
      if (cur) { const e = toEvent(cur, out); if (e) out.events.push(e); else out.skipped++; }
      cur = null;
      continue;
    }
    if (cur) cur.push(l);
  }
  return out;
}

function toEvent(props: ReturnType<typeof lines>, res: IcsResult): Omit<CalEvent, 'id'> | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const ds = get('DTSTART');
  const start = ds && parseIcsDate(ds.value, ds.params);
  if (!start) return null;
  const allDay = !start.time;
  const de = get('DTEND');
  let end = de ? parseIcsDate(de.value, de.params) : null;
  // All-day DTEND is exclusive in iCalendar; ours is inclusive.
  if (end && allDay) end = { date: addDays(end.date, -1) };
  if (!end || end.date < start.date) end = { date: start.date, time: start.time };

  let repeat: Repeat | null = null;
  const rr = get('RRULE');
  if (rr) {
    const rule = Object.fromEntries(rr.value.split(';').map((kv) => kv.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
    const every = FREQ[rule.FREQ?.toUpperCase()];
    const byParts = Object.keys(rule).filter((k) => k.startsWith('BY'));
    // A weekly BYDAY with one day equal to the start day is just "weekly"; anything richer is simplified.
    const simpleByDay = byParts.length === 1 && byParts[0] === 'BYDAY' && every === 'weekly' && !rule.BYDAY.includes(',');
    if (every) {
      const interval = Math.max(1, parseInt(rule.INTERVAL ?? '1', 10) || 1);
      let until = rule.UNTIL ? parseIcsDate(rule.UNTIL)?.date : undefined;
      if (!until && rule.COUNT) until = nth(start.date, every, (parseInt(rule.COUNT, 10) - 1) * interval);
      repeat = { every, interval, until };
      if (byParts.length && !simpleByDay) res.simplified++;
    } else res.simplified++;
  }
  const except = props.filter((p) => p.name === 'EXDATE').flatMap((p) => p.value.split(',').map((v) => parseIcsDate(v, p.params)?.date)).filter((d): d is string => !!d);

  return {
    uid: get('UID')?.value,
    title: unescape(get('SUMMARY')?.value ?? '(no title)'),
    start: start.date, end: end.date, allDay,
    startTime: start.time, endTime: allDay ? undefined : end.time,
    repeat, except: except.length ? except : undefined,
    location: unescape(get('LOCATION')?.value ?? ''), notes: unescape(get('DESCRIPTION')?.value ?? ''), companions: [],
  };
}
