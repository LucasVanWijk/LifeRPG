// Google Calendar: reads events into a local cache, mirrors Questlog's own events both ways.
// Google's repeating events arrive already expanded (one event per occurrence), so every occurrence shows and
// one can be edited alone; changing a whole series happens in Google Calendar itself.
import { addDays, dayDiff, isoDay } from './domain/dates';
import type { CalEvent, GoogleLink, Repeat } from './domain/model';
import { CALENDAR_SCOPE, gfetch, GoogleError } from './google';

const BASE = 'https://www.googleapis.com/calendar/v3';
const CFG_KEY = 'questlog:gcal';
const CACHE_KEY = 'questlog:gcalEvents';

/** Days of history and future that are fetched. */
export const PAST_DAYS = 30;
export const FUTURE_DAYS = 365;

export interface GCalendar { id: string; name: string; color?: string; primary?: boolean; writable: boolean }
export interface GCalConfig {
  on: boolean;
  calendars: GCalendar[];
  /** Calendar ids that are shown. */
  shown: string[];
  /** Where new Questlog events go. */
  target: string;
  /** Incremental sync token per calendar. */
  tokens: Record<string, string>;
  /** Day of the last full fetch per calendar; the window is refreshed weekly. */
  full: Record<string, string>;
  /** Tombstone keys whose Google copy was already deleted. */
  deleted: string[];
  at?: string;
}
export const emptyConfig = (): GCalConfig => ({ on: false, calendars: [], shown: [], target: '', tokens: {}, full: {}, deleted: [] });

export function loadConfig(): GCalConfig {
  try { return { ...emptyConfig(), ...(JSON.parse(localStorage.getItem(CFG_KEY) ?? 'null') ?? {}) }; } catch { return emptyConfig(); }
}
export function saveConfig(c: GCalConfig) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch { /* private mode */ } }
export type EventCache = Record<string, CalEvent[]>;
export function loadCache(): EventCache {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') ?? {}; } catch { return {}; }
}
export function saveCache(c: EventCache) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* quota */ } }

export const gcalScope = () => CALENDAR_SCOPE;

// ── Google event ⇄ Questlog event ───────────────────────────

export interface GEvent {
  id: string; status?: string; summary?: string; description?: string; location?: string; updated?: string; etag?: string; htmlLink?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[]; recurringEventId?: string;
}

const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** A stable negative number for a Google event, so cached events never collide with Questlog's own ids. */
export function cacheId(cal: string, id: string): number {
  let h = 0;
  for (const c of cal + '|' + id) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return -(Math.abs(h) + 1);
}

/** The Questlog view of a Google event, or null when it has no usable start. Times are shown in the device's time zone. */
export function fromGoogle(g: GEvent, cal: string): CalEvent | null {
  if (!g.start || !g.end) return null;
  const link: GoogleLink = { cal, id: g.id, rev: g.updated, series: g.recurringEventId, link: g.htmlLink };
  const base = { id: cacheId(cal, g.id), title: g.summary || '(no title)', repeat: null as Repeat | null, location: g.location ?? '', notes: g.description ?? '', companions: [] as string[], g: link };
  if (g.start.date) {
    // All-day: Google's end date is exclusive.
    const end = g.end.date ? addDays(g.end.date, -1) : g.start.date;
    return { ...base, start: g.start.date, end: end < g.start.date ? g.start.date : end, allDay: true };
  }
  if (!g.start.dateTime || !g.end.dateTime) return null;
  const s = new Date(g.start.dateTime), e = new Date(g.end.dateTime);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  return { ...base, start: isoDay(s), end: isoDay(e), allDay: false, startTime: hhmm(s), endTime: hhmm(e) };
}

const RRULE_FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' } as const;
const compact = (d: string) => d.replace(/-/g, '');

/** The Google request body for a Questlog event. */
export function toGoogle(e: CalEvent, tz: string): Record<string, unknown> {
  const body: Record<string, unknown> = { summary: e.title, description: e.notes, location: e.location };
  if (e.allDay) {
    body.start = { date: e.start };
    body.end = { date: addDays(e.end, 1) };
  } else {
    body.start = { dateTime: e.start + 'T' + (e.startTime || '00:00') + ':00', timeZone: tz };
    body.end = { dateTime: e.end + 'T' + (e.endTime || e.startTime || '00:00') + ':00', timeZone: tz };
  }
  if (e.repeat) {
    const { every, interval, until } = e.repeat;
    const rule = 'RRULE:FREQ=' + RRULE_FREQ[every] + (interval > 1 ? ';INTERVAL=' + interval : '') + (until ? ';UNTIL=' + compact(until) + (e.allDay ? '' : 'T235959Z') : '');
    const rec = [rule];
    for (const x of e.except ?? []) rec.push(e.allDay ? 'EXDATE;VALUE=DATE:' + compact(x) : 'EXDATE;TZID=' + tz + ':' + compact(x) + 'T' + (e.startTime || '00:00').replace(':', '') + '00');
    body.recurrence = rec;
  } else if (e.g && !e.g.series) body.recurrence = [];
  return body;
}

// ── Conflicts ───────────────────────────────────────────────

export type Resolution = 'keep' | 'pull' | 'push';
/**
 * Decides what to do with an event that exists on both sides. Whichever changed since the last sync wins;
 * when both did, the most recently changed version wins.
 */
export function resolve(local: Pick<CalEvent, 'updated' | 'g'>, remote: { updated?: string }): Resolution {
  const g = local.g!;
  const remoteChanged = !!remote.updated && remote.updated !== g.rev;
  const localChanged = (local.updated ?? 0) > (g.at ?? 0);
  if (!remoteChanged && !localChanged) return 'keep';
  if (remoteChanged && !localChanged) return 'pull';
  if (!remoteChanged) return 'push';
  return (local.updated ?? 0) > Date.parse(remote.updated!) ? 'push' : 'pull';
}

/** The window of days that is fetched, as RFC 3339 times. */
export function windowFor(today: string) {
  return { timeMin: new Date(addDays(today, -PAST_DAYS) + 'T00:00:00').toISOString(), timeMax: new Date(addDays(today, FUTURE_DAYS) + 'T00:00:00').toISOString() };
}
export const needsFull = (c: GCalConfig, cal: string, today: string) => !c.tokens[cal] || !c.full[cal] || dayDiff(today, c.full[cal]) >= 7;

// ── API ─────────────────────────────────────────────────────

const call = (url: string, tok: string, init?: RequestInit) => gfetch(url, tok, init, 'Google Calendar');

export async function listCalendars(tok: string): Promise<GCalendar[]> {
  const res = await call(BASE + '/users/me/calendarList?minAccessRole=reader', tok);
  const j = (await res.json()) as { items?: { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; accessRole?: string }[] };
  return (j.items ?? []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor, primary: c.primary, writable: c.accessRole === 'owner' || c.accessRole === 'writer' }));
}

export interface Pulled { events: GEvent[]; syncToken?: string; reset?: boolean }
/** Events of a calendar: the whole window, or only what changed since `syncToken`. A 410 means the token expired. */
export async function pullEvents(tok: string, cal: string, opts: { syncToken?: string; timeMin: string; timeMax: string }): Promise<Pulled> {
  const events: GEvent[] = [];
  let page: string | undefined, next: string | undefined;
  do {
    const q = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '250' });
    if (opts.syncToken) q.set('syncToken', opts.syncToken);
    else { q.set('timeMin', opts.timeMin); q.set('timeMax', opts.timeMax); }
    if (page) q.set('pageToken', page);
    const res = await call(BASE + '/calendars/' + encodeURIComponent(cal) + '/events?' + q, tok);
    if (res.status === 410) return { events: [], reset: true };
    const j = (await res.json()) as { items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string };
    events.push(...(j.items ?? []));
    page = j.nextPageToken;
    next = j.nextSyncToken ?? next;
  } while (page);
  return { events, syncToken: next };
}

export async function insertEvent(tok: string, cal: string, body: Record<string, unknown>): Promise<GEvent> {
  const res = await call(BASE + '/calendars/' + encodeURIComponent(cal) + '/events', tok, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}
export async function patchEvent(tok: string, cal: string, id: string, body: Record<string, unknown>): Promise<GEvent | null> {
  const res = await call(BASE + '/calendars/' + encodeURIComponent(cal) + '/events/' + encodeURIComponent(id), tok, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.status === 404 || res.status === 410 ? null : res.json();
}
export async function removeEvent(tok: string, cal: string, id: string): Promise<void> {
  await call(BASE + '/calendars/' + encodeURIComponent(cal) + '/events/' + encodeURIComponent(id), tok, { method: 'DELETE' });
}

export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export { GoogleError };
