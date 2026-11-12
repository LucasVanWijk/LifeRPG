import { addDays } from './dates';
import type { Data, Every, Habit, Quest } from './model';
import { emptyData } from './model';
import { periodOf } from './logic';
import { upgradeGuild } from './guild/engine';
import type { CodexEntry } from './notes';
import { codexToNotes } from './notes';

type LegacyQuest = Quest & { recur?: { every: 'daily' | 'weekly' | 'monthly'; streak: number } | null; lastDone?: string | null; prevDue?: string | null };

/**
 * Brings saved or imported data up to the current shape, or returns null if it isn't a Questlog log.
 * Version 4 added per-item update times, tombstones and notes. Version 3 replaced the Hero and the idle Expeditions with the guild: older logs keep their quests,
 * habits, campaigns, calendar and Glossary, and found a new guild on first open.
 * Version 1 kept repeating quests ("bounties") on the board; they become habits, with their
 * streak rebuilt as check-ins in the preceding periods.
 */
export function migrate(raw: unknown, today: string): Data | null {
  if (!raw || typeof raw !== 'object') return null;
  const { rewards, hero, expedition, sync, ...d } = raw as Partial<Data> & { sync?: unknown; version?: number; quests?: LegacyQuest[]; rewards?: unknown; hero?: { reviewedWeek?: string }; expedition?: unknown };
  void rewards; void expedition; void sync;
  const version = d.version as number | undefined;
  if (!Array.isArray(d.quests) || (version !== 1 && version !== 2 && version !== 3 && version !== 4)) return null;
  if (version! < 3 && !hero) return null;
  const base = emptyData();
  const out: Data = {
    ...base,
    ...d,
    version: 4,
    profile: version! >= 3 ? { ...d.profile } : { reviewedWeek: hero?.reviewedWeek },
    guild: version! >= 3 && d.guild ? upgradeGuild(d.guild) : null,
    habits: Array.isArray(d.habits) ? d.habits : [],
    camps: d.camps ?? {},
    companions: d.companions ?? [],
    tomes: d.tomes ?? [],
    events: Array.isArray(d.events) ? d.events : [],
    notes: Array.isArray(d.notes) ? d.notes : [],
    tombstones: Array.isArray(d.tombstones) ? d.tombstones : [],
    quests: [],
  };
  // The Codex became notes: each entry is a note, once (a copy from an older device converts the same way).
  const old = (d as { codex?: CodexEntry[] }).codex;
  if (Array.isArray(old) && old.length) {
    const have = new Set(out.notes.map((n) => n.id));
    out.notes = [...out.notes, ...codexToNotes(old, Date.now()).filter((n) => !have.has(n.id))];
  }
  delete (out as { codex?: unknown }).codex;
  let nextHabitId = Math.max(0, ...out.habits.map((h) => h.id)) + 1;
  for (const q of d.quests) {
    const { recur, lastDone, prevDue, ...quest } = q;
    void prevDue;
    if (!recur) { out.quests.push({ ...quest, notes: quest.notes ?? [], steps: quest.steps ?? [], companions: quest.companions ?? [] }); continue; }
    const every: Every = recur.every === 'daily' ? 'daily' : 'weekly';
    const step = every === 'daily' ? 1 : 7;
    const log: string[] = [];
    // The streak ends in the current period if it was done today, otherwise in the one before.
    let p = periodOf(lastDone === today ? today : addDays(today, -step), every);
    for (let i = 0; i < recur.streak; i++, p = addDays(p, -step)) log.push(p);
    const habit: Habit = { id: nextHabitId++, title: q.title, every, size: q.size, log: log.reverse(), created: log[0] ?? today };
    out.habits.push(habit);
  }
  return out;
}
