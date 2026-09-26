import { addDays } from './dates';
import type { Data, Every, Habit, Quest } from './model';
import { emptyData } from './model';
import { chronicle, periodOf } from './logic';

type LegacyQuest = Quest & { recur?: { every: 'daily' | 'weekly' | 'monthly'; streak: number } | null; lastDone?: string | null; prevDue?: string | null };

/**
 * Brings saved or imported data up to the current shape, or returns null if it isn't a Questlog log.
 * Version 1 kept repeating quests ("bounties") on the board; they become habits, with their
 * streak rebuilt as check-ins in the preceding periods.
 */
export function migrate(raw: unknown, today: string): Data | null {
  if (!raw || typeof raw !== 'object') return null;
  const { rewards, ...d } = raw as Partial<Data> & { version?: number; quests?: LegacyQuest[]; rewards?: unknown };
  void rewards; // The Tavern was removed; its rewards are dropped.
  const version = d.version as number | undefined;
  if (!d.hero || !Array.isArray(d.quests) || (version !== 1 && version !== 2)) return null;
  const base = emptyData();
  const out: Data = {
    ...base,
    ...d,
    version: 2,
    hero: { ...base.hero, ...d.hero },
    habits: Array.isArray(d.habits) ? d.habits : [],
    camps: d.camps ?? {},
    companions: d.companions ?? [],
    tomes: d.tomes ?? [],
    codex: d.codex ?? [],
    events: Array.isArray(d.events) ? d.events : [],
    expedition: d.expedition
      ? { ...base.expedition, ...d.expedition, skills: { ...base.expedition.skills, ...d.expedition.skills } }
      : base.expedition,
    quests: [],
  };
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
  // Logs from before Expeditions start with a skill-point pool worth all the XP already earned.
  if (typeof d.hero.points !== 'number') out.hero.points = chronicle(out).reduce((n, e) => n + e.xp, 0);
  return out;
}
