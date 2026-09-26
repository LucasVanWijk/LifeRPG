import type { IconName } from '../components/Icon';
import type { Expedition } from './expedition/engine';
import { newExpedition } from './expedition/engine';

export type QuadKey = 'crisis' | 'main' | 'errand' | 'side';
export type SizeKey = 'S' | 'M' | 'L';
export type Status = 'todo' | 'doing' | 'done';
export type Every = 'daily' | 'weekly';

export interface QuestNote { id: number; t: string }
/** A step on a quest's checklist; steps are not cards of their own and pay nothing. */
export interface QuestStep { id: number; t: string; done: boolean }

/** A one-off task. Repeating things are Habits. */
export interface Quest {
  id: number;
  title: string;
  quad: QuadKey;
  due: string | null;
  size: SizeKey;
  campaign: string | null;
  status: Status;
  notes: QuestNote[];
  steps: QuestStep[];
  /** Ids of the companions this quest involves. */
  companions: string[];
  /** Day the quest was completed (for Today's Quests + undo). */
  doneOn?: string | null;
  prevStatus?: Status | null;
}

/**
 * A repeating habit. Daily habits are checked in once a day; weekly ones `target` times a week
 * (on different days). `log` holds the days it was done.
 */
export interface Habit { id: number; title: string; every: Every; target?: number; size: SizeKey; log: string[]; created: string }

export interface Campaign {
  name: string; short: string; desc: string; xp: number; gold: number; seal: string; icon: IconName;
  /** Day every quest was done and the reward was paid. */
  completedOn?: string | null;
}

export interface CompanionNote { t: string; date?: string; label?: string }
/** bday is MM-DD, or empty when unknown. */
export interface Companion { id: string; name: string; first: string; rel: string; bday: string; notes: CompanionNote[] }

export interface TomeItem { id: number; t: string; done: boolean }
export interface Tome { id: string; name: string; items: TomeItem[] }

export interface CodexField { k: string; v: string; date?: string; label?: string }
export interface CodexEntry { id: string; name: string; sub: string; icon: IconName; fields: CodexField[] }

/**
 * portrait is a small JPEG data URL. An empty name means the welcome screen hasn't been completed.
 * points is the skill-point pool for Expeditions: every XP point earned also adds one.
 */
export interface Hero { name: string; portrait?: string; xp: number; level: number; next: number; gold: number; points: number }

export interface Data {
  version: 2;
  hero: Hero;
  quests: Quest[];
  habits: Habit[];
  camps: Record<string, Campaign>;
  companions: Companion[];
  tomes: Tome[];
  codex: CodexEntry[];
  expedition: Expedition;
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

export const CAMP_ICONS: IconName[] = ['flag', 'compass', 'home', 'mountain', 'crown'];
export const CODEX_ICONS: IconName[] = ['pin', 'car', 'utensils', 'dumbbell', 'home', 'map'];

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

export const heroName = (h: Hero) => h.name || 'Adventurer';

/** A fresh log: level 1, no gold, nothing written down yet. */
export const emptyData = (): Data => ({
  version: 2,
  hero: { name: '', xp: 0, level: 1, next: 100, gold: 0, points: 0 },
  quests: [],
  habits: [],
  camps: {},
  companions: [],
  tomes: [],
  codex: [],
  expedition: newExpedition(Date.now()),
});
