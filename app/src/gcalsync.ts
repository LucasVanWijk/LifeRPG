// One round of Google Calendar sync, as plain functions over data so it can be tested without a network.
import type { CalEvent, GoogleLink, Tombstone } from './domain/model';
import type { EventCache, GCalConfig, GEvent, Pulled } from './gcal';
import { fromGoogle, needsFull, resolve, toGoogle, windowFor } from './gcal';

export interface GcalApi {
  pull(cal: string, o: { syncToken?: string; timeMin: string; timeMax: string }): Promise<Pulled>;
  insert(cal: string, body: Record<string, unknown>): Promise<GEvent>;
  patch(cal: string, id: string, body: Record<string, unknown>): Promise<GEvent | null>;
  remove(cal: string, id: string): Promise<void>;
}

/** What the round decided about Questlog's own events; the store applies these to the latest log. */
export type Change =
  | { kind: 'link'; id: number; g: GoogleLink }
  | { kind: 'pull'; id: number; patch: Partial<CalEvent>; g: GoogleLink }
  | { kind: 'remove'; id: number };

export interface RoundResult { cfg: GCalConfig; cache: EventCache; changes: Change[] }

export async function syncRound(a: {
  api: GcalApi; cfg: GCalConfig; cache: EventCache; events: CalEvent[]; tombstones: Tombstone[]; today: string; tz: string; now: number;
}): Promise<RoundResult> {
  const { api, tz, now } = a;
  const cfg: GCalConfig = { ...a.cfg, tokens: { ...a.cfg.tokens }, full: { ...a.cfg.full }, deleted: [...a.cfg.deleted] };
  const cache: EventCache = {};
  const changes: Change[] = [];
  const byG = (id: string) => a.events.find((e) => e.g?.id === id);
  const removed = new Set<number>();

  // 1. Pull what changed in Google.
  for (const cal of cfg.shown) {
    let full = needsFull(cfg, cal, a.today);
    const win = windowFor(a.today);
    let r = await api.pull(cal, full ? win : { ...win, syncToken: cfg.tokens[cal] });
    if (r.reset) { full = true; r = await api.pull(cal, win); }
    const mine = new Map((full ? [] : a.cache[cal] ?? []).map((e) => [e.g!.id, e]));
    for (const ge of r.events) {
      const local = byG(ge.id);
      if (ge.status === 'cancelled') {
        mine.delete(ge.id);
        if (local && !removed.has(local.id)) { removed.add(local.id); changes.push({ kind: 'remove', id: local.id }); cfg.deleted.push('event:' + local.id); }
        continue;
      }
      // Occurrences of a repeating event that Questlog itself created are already shown by that event.
      if (ge.recurringEventId && byG(ge.recurringEventId)) continue;
      if (local) {
        mine.delete(ge.id);
        if (resolve(local, ge) === 'pull') {
          const f = fromGoogle(ge, cal);
          if (f) {
            const { title, start, end, allDay, startTime, endTime, location, notes } = f;
            changes.push({ kind: 'pull', id: local.id, g: { ...local.g!, rev: ge.updated, at: now, link: ge.htmlLink }, patch: { title, start, end, allDay, startTime, endTime, location, notes: notes || local.notes, updated: now } });
          }
        }
        continue;
      }
      const f = fromGoogle(ge, cal);
      if (f) mine.set(ge.id, f);
    }
    cache[cal] = [...mine.values()];
    if (r.syncToken) cfg.tokens[cal] = r.syncToken;
    if (full) cfg.full[cal] = a.today;
  }

  // 2. Push Questlog's own events: new ones, and changed ones.
  const target = cfg.calendars.find((c) => c.id === cfg.target && c.writable) ? cfg.target : '';
  for (const e of a.events) {
    if (e.uid || e.g?.series || removed.has(e.id)) continue;
    if (!e.g) {
      if (!target) continue;
      const made = await api.insert(target, toGoogle(e, tz));
      changes.push({ kind: 'link', id: e.id, g: { cal: target, id: made.id, rev: made.updated, at: e.updated ?? 0, link: made.htmlLink } });
    } else if ((e.updated ?? 0) > (e.g.at ?? 0) && !changes.some((c) => c.kind === 'pull' && c.id === e.id)) {
      const res = await api.patch(e.g.cal, e.g.id, toGoogle(e, tz));
      if (!res) { removed.add(e.id); changes.push({ kind: 'remove', id: e.id }); cfg.deleted.push('event:' + e.id); }
      else changes.push({ kind: 'link', id: e.id, g: { ...e.g, rev: res.updated, at: e.updated ?? 0, link: res.htmlLink ?? e.g.link } });
    }
  }

  // 3. Delete in Google what was deleted here.
  for (const t of a.tombstones) {
    if (!t.g || cfg.deleted.includes(t.key)) continue;
    await api.remove(t.g.cal, t.g.id);
    cfg.deleted.push(t.key);
  }
  const live = new Set(a.tombstones.map((t) => t.key));
  cfg.deleted = cfg.deleted.filter((k, i, all) => (live.has(k) || k.startsWith('event:')) && all.indexOf(k) === i).slice(-500);
  return { cfg, cache, changes };
}

/** Applies a round's decisions to the latest list of events. */
export function applyChanges(events: CalEvent[], changes: Change[]): CalEvent[] {
  const gone = new Set(changes.filter((c) => c.kind === 'remove').map((c) => c.id));
  return events.filter((e) => !gone.has(e.id)).map((e) => {
    let out = e;
    for (const c of changes) {
      if (c.kind === 'link' && c.id === e.id) out = { ...out, g: c.g };
      else if (c.kind === 'pull' && c.id === e.id) out = { ...out, ...c.patch, g: c.g };
    }
    return out;
  });
}
