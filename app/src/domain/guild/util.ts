// Small helpers shared by the engine and the legacy rules.
import { isActive } from './adventurer';
import { PHASE_MS, PHASES_PER_YEAR, ROUTINE_ENTRIES, ROUTINE_KEEP_YEARS } from './content';
import type { Entry, Guild } from './types';

export const log = (g: Guild, e: Omit<Entry, 'at'>, at = g.t) => { g.chronicle = [...g.chronicle, { at, ...e }]; };
export const nextId = (g: Guild, prefix: string) => prefix + (++g.counter).toString(36);
export const byId = (g: Guild, id: string | null | undefined) => (id ? g.adventurers.find((a) => a.id === id) : undefined);
export const active = (g: Guild) => g.adventurers.filter(isActive);
export const champion = (g: Guild) => { const a = byId(g, g.championId); return a && isActive(a) ? a : undefined; };

/** Drops routine chronicle lines older than ROUTINE_KEEP_YEARS (major wounds are kept). Leaves the array alone when there is nothing to drop. */
export function trimChronicle(g: Guild) {
  const cutoff = g.t - ROUTINE_KEEP_YEARS * PHASES_PER_YEAR * PHASE_MS;
  const routine = (e: Entry) => ROUTINE_ENTRIES.has(e.k) && !(e.k === 'hurt' && e.b === 'major');
  let old = false;
  for (const e of g.chronicle) { if (e.at >= cutoff) break; if (routine(e)) { old = true; break; } }
  if (old) g.chronicle = g.chronicle.filter((e) => e.at >= cutoff || !routine(e));
}
