// Per-item merge of two copies of the log (this device and another one), and the bookkeeping that feeds it:
// every item carries an `updated` time, quests also per field, and deletions leave a tombstone.
import type { Campaign, Data, Habit, Quest, Tombstone } from './model';
import { TOMBSTONE_DAYS } from './model';
import { absorbPayment } from './guild/engine';
import type { Guild } from './guild/types';

const DAY = 86_400_000;

/** The quest fields that merge on their own. `status` also carries `doneOn` and `prevStatus`. */
export const QUEST_FIELDS = ['title', 'quad', 'due', 'size', 'campaign', 'status', 'notes', 'steps', 'companions'] as const;
const FIELD_OF: Record<string, string> = { doneOn: 'status', prevStatus: 'status' };

type Collection = 'quests' | 'habits' | 'companions' | 'tomes' | 'notes' | 'events';
const COLLECTIONS: [Collection, string][] = [['quests', 'quest'], ['habits', 'habit'], ['companions', 'companion'], ['tomes', 'tome'], ['notes', 'note'], ['events', 'event']];
type Item = { id: number | string; updated?: number };

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

// ── Stamping ────────────────────────────────────────────────

/**
 * Compares the log before and after an edit and records it: changed items get `updated = now`
 * (quests also per changed field), and deleted items leave a tombstone.
 * Returns `next` itself when nothing relevant changed.
 */
export function stamp(prev: Data, next: Data, now: number): Data {
  if (prev === next) return next;
  let out = next;
  const set = (patch: Partial<Data>) => { out = { ...out, ...patch }; };
  const tombs: Tombstone[] = [];

  for (const [col, kind] of COLLECTIONS) {
    if (prev[col] === next[col]) continue;
    const before = new Map((prev[col] as Item[]).map((x) => [x.id, x]));
    const seen = new Set<number | string>();
    let changed = false;
    const items = (next[col] as Item[]).map((it) => {
      seen.add(it.id);
      const old = before.get(it.id);
      if (old === it) return it;
      changed = true;
      if (col === 'quests') return stampQuest(old as Quest | undefined, it as Quest, now);
      return { ...it, updated: now };
    });
    for (const id of before.keys()) if (!seen.has(id)) tombs.push({ key: kind + ':' + id, at: now });
    if (changed) set({ [col]: items } as Partial<Data>);
  }
  if (prev.camps !== next.camps) {
    let camps = next.camps, changed = false;
    for (const [k, c] of Object.entries(next.camps)) {
      if (prev.camps[k] !== c) { camps = { ...camps, [k]: { ...c, updated: now } }; changed = true; }
    }
    for (const k of Object.keys(prev.camps)) if (!(k in next.camps)) tombs.push({ key: 'camp:' + k, at: now });
    if (changed) set({ camps });
  }
  if (prev.profile !== next.profile) set({ profile: { ...next.profile, updated: now } });
  if (tombs.length) set({ tombstones: [...next.tombstones.filter((t) => !tombs.some((n) => n.key === t.key)), ...tombs] });
  return out;
}

function stampQuest(old: Quest | undefined, q: Quest, now: number): Quest {
  const fu = { ...(old?.fu ?? {}) };
  if (!old) for (const f of QUEST_FIELDS) fu[f] = now;
  else {
    for (const k of Object.keys(q) as (keyof Quest)[]) {
      if (k === 'updated' || k === 'fu' || k === 'id') continue;
      if (!same(q[k], old[k])) fu[FIELD_OF[k] ?? k] = now;
    }
    for (const k of Object.keys(old) as (keyof Quest)[]) if (!(k in q) && k !== 'fu') fu[FIELD_OF[k] ?? k] = now;
  }
  return { ...q, updated: now, fu };
}

/** Drops tombstones older than 60 days. */
export const pruneTombstones = (ts: Tombstone[], now: number) => ts.filter((t) => now - t.at < TOMBSTONE_DAYS * DAY);

// ── Merging ─────────────────────────────────────────────────

const stampOf = (x: { updated?: number }) => x.updated ?? 0;

function mergeQuest(a: Quest, b: Quest): Quest {
  const t = (q: Quest, f: string) => q.fu?.[f] ?? stampOf(q);
  const out: Quest = { ...a };
  const fu: Record<string, number> = {};
  for (const f of QUEST_FIELDS) {
    const win = t(b, f) > t(a, f) ? b : a;
    (out as unknown as Record<string, unknown>)[f] = (win as unknown as Record<string, unknown>)[f];
    fu[f] = t(win, f);
    if (f === 'status') {
      out.doneOn = win.doneOn;
      out.prevStatus = win.prevStatus;
    }
  }
  // Fields outside the list (e.g. future ones) follow the newer copy as a whole.
  const newer = stampOf(b) > stampOf(a) ? b : a;
  for (const k of Object.keys(newer) as (keyof Quest)[]) if (!(QUEST_FIELDS as readonly string[]).includes(k) && !['doneOn', 'prevStatus', 'fu', 'updated', 'id'].includes(k)) (out as unknown as Record<string, unknown>)[k] = newer[k];
  out.fu = fu;
  out.updated = Math.max(stampOf(a), stampOf(b));
  return out;
}

function mergeHabit(a: Habit, b: Habit): Habit {
  const newer = stampOf(b) > stampOf(a) ? b : a;
  return { ...newer, log: [...new Set([...a.log, ...b.log])].sort(), updated: Math.max(stampOf(a), stampOf(b)) };
}

function mergeList<T extends Item>(kind: string, a: T[], b: T[], tombs: Map<string, number>, pick: (x: T, y: T) => T): T[] {
  const bm = new Map(b.map((x) => [x.id, x]));
  const out: T[] = [];
  const done = new Set<number | string>();
  const alive = (x: T) => (tombs.get(kind + ':' + x.id) ?? -1) < stampOf(x);
  for (const x of a) {
    done.add(x.id);
    const y = bm.get(x.id);
    const m = y ? pick(x, y) : x;
    if (alive(m)) out.push(m);
  }
  for (const y of b) if (!done.has(y.id) && alive(y)) out.push(y);
  return out;
}

const newest = <T extends { updated?: number }>(local: T, remote: T) => (stampOf(remote) > stampOf(local) ? remote : local);

/** Does the merged log still hold the thing a ledger key was paid for? */
function stillEarned(key: string, d: Data): boolean {
  const [kind, id, day] = key.split(':');
  if (kind === 'q') return d.quests.some((q) => String(q.id) === id && q.status === 'done');
  if (kind === 'h') return d.habits.some((h) => String(h.id) === id && h.log.includes(day));
  if (kind === 'c') return !!d.camps[key.slice(2)]?.completedOn;
  return false;
}

function mergeGuild(local: Guild | null, remote: Guild | null, merged: Data): Guild | null {
  if (!local || !remote) return local ?? remote;
  // A simulation can't be split field by field: the one that has run furthest wins as a whole.
  const remoteWins = remote.t !== local.t ? remote.t > local.t : remote.ledger.length > local.ledger.length;
  const [win, lose] = remoteWins ? [remote, local] : [local, remote];
  let g = win;
  // Payments for real-life work done on the other device are never lost, nor paid twice (they are keyed).
  const have = new Set(win.ledger.map((e) => e.key));
  for (const e of lose.ledger) if (!have.has(e.key) && stillEarned(e.key, merged)) g = absorbPayment(g, e);
  return g;
}

/** Merges the log from another device into this one, item by item. Neither input is changed. */
export function mergeData(local: Data, remote: Data, now: number): Data {
  const tombs = new Map<string, number>();
  for (const t of [...local.tombstones, ...remote.tombstones]) tombs.set(t.key, Math.max(t.at, tombs.get(t.key) ?? 0));

  const camps: Record<string, Campaign> = {};
  for (const k of new Set([...Object.keys(local.camps), ...Object.keys(remote.camps)])) {
    const l = local.camps[k], r = remote.camps[k];
    const c = l && r ? newest(l, r) : (l ?? r);
    if ((tombs.get('camp:' + k) ?? -1) < stampOf(c)) camps[k] = c;
  }

  const pickers: Record<Collection, (x: never, y: never) => unknown> = {
    quests: mergeQuest as never, habits: mergeHabit as never,
    companions: newest as never, tomes: newest as never, notes: newest as never, events: newest as never,
  };
  const lists = {} as Record<Collection, never[]>;
  for (const [col, kind] of COLLECTIONS) lists[col] = mergeList(kind, local[col] as Item[], remote[col] as Item[], tombs, pickers[col] as never) as never[];

  const out: Data = {
    ...(stampOf(remote.profile) > stampOf(local.profile) ? remote : local),
    ...lists,
    version: 4,
    camps,
    profile: {
      ...newest(local.profile, remote.profile),
      reviewedWeek: [local.profile.reviewedWeek, remote.profile.reviewedWeek].filter(Boolean).sort().at(-1),
      updated: Math.max(stampOf(local.profile), stampOf(remote.profile)) || undefined,
    },
    codex: local.codex,
    guild: null,
    tombstones: pruneTombstones([...tombs].map(([key, at]) => ({ key, at })), now),
  };
  out.guild = mergeGuild(local.guild, remote.guild, out);
  return out;
}
