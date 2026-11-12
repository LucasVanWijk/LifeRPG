import type { IconName } from '../components/Icon';
import type { Guild } from './guild/types';

export type QuadKey = 'crisis' | 'main' | 'errand' | 'side';
export type SizeKey = 'S' | 'M' | 'L';
export type Status = 'todo' | 'doing' | 'done';
export type Every = 'daily' | 'weekly';

export interface QuestNote { id: number; t: string }
/** A step on a quest's checklist; steps are not cards of their own and pay nothing. */
export interface QuestStep { id: number; t: string; done: boolean }

export interface QuestRepeat { unit: 'day' | 'week' | 'month' | 'year'; n: number; from: 'due' | 'done' }

/** A one-off task. Repeating things are Habits. */
export interface Quest {
  id: number;
  title: string;
  quad: QuadKey;
  due: string | null;
  /** Optional time of day (HH:MM) on the due date. */
  dueTime?: string;
  size: SizeKey;
  campaign: string | null;
  status: Status;
  notes: QuestNote[];
  steps: QuestStep[];
  /** Ids of the companions this quest involves. */
  companions: string[];
  /** The day this quest was picked for (shows on Today's Quests that day without changing its due date). */
  pick?: string;
  /** Comes back when finished: every N days, weeks, months or years, counted from the due date or from when it was done. */
  repeat?: QuestRepeat | null;
  /** Parked in the Someday list: not on the board, not open, never overdue. */
  someday?: boolean;
  /** The next quest this one created when it was finished (so undo can take it back). */
  spawned?: number;
  /** Day the quest was completed (for Today's Quests + undo). */
  doneOn?: string | null;
  prevStatus?: Status | null;
  /** When the quest last changed (epoch ms). Set by the store, used to merge copies from other devices. */
  updated?: number;
  /** When each field last changed, so two devices editing different fields keep both edits. */
  fu?: Record<string, number>;
}

/**
 * A repeating habit. Daily habits are checked in once a day; weekly ones `target` times a week
 * (on different days). `log` holds the days it was done.
 */
export interface Habit { id: number; title: string; every: Every; target?: number; size: SizeKey; log: string[]; created: string; updated?: number }

export interface Campaign {
  name: string; short: string; desc: string; xp: number; gold: number; seal: string; icon: IconName;
  /** Day every quest was done and the reward was paid. */
  completedOn?: string | null;
  /** The adventurer who carries this campaign: its quests' rewards go to them instead of the Champion. */
  bearerId?: string | null;
  updated?: number;
}

export interface CompanionNote { t: string; date?: string; label?: string }
/** bday is MM-DD, or empty when unknown. */
export interface Companion { id: string; name: string; first: string; rel: string; bday: string; notes: CompanionNote[]; updated?: number }

export interface TomeItem { id: number; t: string; done: boolean }
export interface Tome { id: string; name: string; items: TomeItem[]; updated?: number }


/** What's left of the old Hero: there is no "you" in the game, only the guild. */
export interface Profile {
  /** Monday of the last week whose review was finished. */
  reviewedWeek?: string;
  /** Which sections Home shows and in what order. Stored with the data, so it syncs between devices. */
  home?: HomeLayout;
  /** The last day the "Plan your day" card was dealt with. */
  plannedDay?: string;
  updated?: number;
}

export type HomeSection = 'today' | 'habits' | 'next' | 'week' | 'keep' | 'guild';
export interface HomeLayout { order: HomeSection[]; hidden: HomeSection[] }
export const HOME_SECTIONS: { key: HomeSection; name: string }[] = [
  { key: 'today', name: "Today's Quests" },
  { key: 'habits', name: 'Habits' },
  { key: 'next', name: 'Up next' },
  { key: 'week', name: 'The week' },
  { key: 'keep', name: 'Keep in touch' },
  { key: 'guild', name: 'Guild strip' },
];
export const DEFAULT_HOME_ORDER: HomeSection[] = HOME_SECTIONS.map((s) => s.key);

/** The saved layout made complete: unknown sections dropped, missing ones appended in default order. */
export function homeLayout(p: Profile): HomeLayout {
  const known = new Set<HomeSection>(DEFAULT_HOME_ORDER);
  const order = (p.home?.order ?? []).filter((k, i, a) => known.has(k) && a.indexOf(k) === i);
  for (const k of DEFAULT_HOME_ORDER) if (!order.includes(k)) order.push(k);
  const hidden = (p.home?.hidden ?? []).filter((k, i, a) => known.has(k) && a.indexOf(k) === i);
  return { order, hidden };
}

export type Repeat = { every: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval: number; until?: string };

/** A calendar event. Dates are local days; `end` is inclusive, so a one-day event has end === start. */
export interface CalEvent {
  id: number;
  /** From an imported .ics file, so importing the same file again skips it. */
  uid?: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  repeat: Repeat | null;
  /** Occurrences that were cancelled (EXDATE). */
  except?: string[];
  location: string;
  notes: string;
  companions: string[];
  updated?: number;
  /** Link to the Google Calendar copy of this event. */
  g?: GoogleLink;
}

/**
 * Where an event lives in Google Calendar. `rev` is Google's own change time at the last sync,
 * `at` this event's `updated` at that moment: if either has moved, that side changed since.
 * `series` marks one occurrence of a repeating Google event (the whole series is edited in Google).
 */
export interface GoogleLink { cal: string; id: string; rev?: string; at?: number; series?: string; link?: string }

/** A free-form note: ideas, meeting notes, recipes. The body is plain text with a little formatting. */
export interface Note { id: string; title: string; body: string; icon?: IconName; pinned: boolean; created: number; updated?: number }

/** Left behind by a deletion, so the deletion wins over an older copy on another device. */
export interface Tombstone { key: string; at: number; /** An event deleted here that still exists in Google Calendar. */ g?: { cal: string; id: string } }
/** Days a tombstone is kept. */
export const TOMBSTONE_DAYS = 60;

export interface Data {
  version: 4;
  profile: Profile;
  /** Null until the guild is founded. */
  guild: Guild | null;
  quests: Quest[];
  habits: Habit[];
  camps: Record<string, Campaign>;
  companions: Companion[];
  tomes: Tome[];
  notes: Note[];
  events: CalEvent[];
  tombstones: Tombstone[];
}

export interface Quad { key: QuadKey; name: string; sub: string; icon: IconName; mult: number; color: string; light: string }

export const QUADS: Quad[] = [
  { key: 'crisis', name: 'Crisis', sub: 'Urgent · important', icon: 'alert', mult: 1.25, color: 'var(--q-wax)', light: 'oklch(0.74 0.12 30)' },
  { key: 'main', name: 'Main Quests', sub: 'Important · not urgent', icon: 'crown', mult: 1.5, color: 'var(--color-accent-700)', light: 'var(--color-accent-300)' },
  { key: 'errand', name: 'Errands', sub: 'Urgent · not important', icon: 'clock', mult: 0.8, color: 'oklch(0.45 0.08 255)', light: 'oklch(0.77 0.07 255)' },
  { key: 'side', name: 'Side Quests', sub: 'Neither', icon: 'feather', mult: 0.6, color: 'oklch(0.46 0.07 195)', light: 'oklch(0.78 0.07 195)' },
];
export const QM = Object.fromEntries(QUADS.map((q) => [q.key, q])) as Record<QuadKey, Quad>;

/** Quest sizes are shown by their token (S, M, L). */
export const SIZE: Record<SizeKey, { xp: number }> = {
  S: { xp: 20 },
  M: { xp: 40 },
  L: { xp: 70 },
};

export const CSIZE: Record<SizeKey, { name: string; xp: number; gold: number }> = {
  S: { name: 'Short', xp: 120, gold: 50 },
  M: { name: 'Medium', xp: 250, gold: 100 },
  L: { name: 'Epic', xp: 450, gold: 180 },
};
/** The size a campaign was created with, recovered from its reward. */
export const campSize = (c: Pick<Campaign, 'xp'>): SizeKey =>
  (Object.keys(CSIZE) as SizeKey[]).find((k) => CSIZE[k].xp === c.xp) ?? 'M';

export const STATUSES: [Status, string][] = [['todo', 'To Do'], ['doing', 'Doing'], ['done', 'Done']];
export const STATUS_NAME: Record<Status, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };

export const CAMP_ICONS: IconName[] = ['flag', 'compass', 'home', 'mountain', 'crown', 'star', 'trophy', 'sword', 'shield', 'flame', 'sparkles', 'heart', 'tree', 'plane', 'briefcase', 'graduation-cap', 'wrench', 'palette', 'music', 'gamepad', 'sun', 'moon', 'gift', 'feather'];
export const NOTE_ICONS: IconName[] = ['pin', 'car', 'utensils', 'dumbbell', 'home', 'map', 'gift', 'briefcase', 'music', 'coffee', 'plane', 'camera', 'gamepad', 'tree', 'graduation-cap', 'cart', 'palette', 'wrench', 'heart', 'star', 'cake', 'beer', 'calendar', 'clock', 'book-open', 'backpack', 'store', 'fish']


/** XP scales with size and the quadrant multiplier (Main Quests ×1.5), rounded to 5; gold is a third of XP. */
export const reward = (q: Pick<Quest, 'size' | 'quad'>) => {
  const xp = Math.max(5, Math.round((SIZE[q.size].xp * QM[q.quad].mult) / 5) * 5);
  return { xp, gold: Math.round(xp / 3) };
};

/** Habits pay half a quest of the same size, since they come round again. */
export const habitReward = (h: Pick<Habit, 'size'>) => {
  const xp = SIZE[h.size].xp / 2;
  return { xp, gold: Math.round(xp / 3) };
};

export const EVERY_NAME: Record<Every, string> = { daily: 'Daily', weekly: 'Weekly' };
const UNIT: Record<Every, string> = { daily: 'day', weekly: 'week' };
export const streakText = (n: number, every: Every) => n + '-' + UNIT[every] + ' streak';

/** Small tilt for pinned notes so the board doesn't look machine-aligned. */
const ROT = [-1.4, 0.9, -0.5, 1.2, -0.9, 0.5, 1.5];
export const noteRotation = (id: number, scale = 1, shift = 0) => ROT[(id + shift) % ROT.length] * scale + 'deg';

/** A fresh log: no guild yet, nothing written down. */
export const emptyData = (): Data => ({
  version: 4,
  profile: {},
  guild: null,
  quests: [],
  habits: [],
  camps: {},
  companions: [],
  tomes: [],
  notes: [],
  events: [],
  tombstones: [],
});
