import type { IconName } from '../components/Icon';

export type QuadKey = 'crisis' | 'main' | 'errand' | 'side';
export type SizeKey = 'S' | 'M' | 'L';
export type Status = 'todo' | 'doing' | 'done';
export type Every = 'daily' | 'weekly' | 'monthly';

export interface Recur { every: Every; streak: number }
export interface QuestNote { id: number; t: string }

export interface Quest {
  id: number;
  title: string;
  quad: QuadKey;
  due: string | null;
  size: SizeKey;
  campaign: string | null;
  status: Status;
  recur: Recur | null;
  notes: QuestNote[];
  /** Day a one-off quest was completed (for Today's Quests + undo). */
  doneOn?: string | null;
  prevStatus?: Status | null;
  /** Day a bounty was last completed, and the due date it had before advancing. */
  lastDone?: string | null;
  prevDue?: string | null;
}

export interface Campaign { name: string; short: string; desc: string; xp: number; gold: number; seal: string; icon: IconName }

export interface CompanionNote { t: string; date?: string; label?: string }
/** bday is MM-DD, or empty when unknown. */
export interface Companion { id: string; name: string; first: string; rel: string; bday: string; notes: CompanionNote[] }

export interface TomeItem { id: number; t: string; done: boolean }
export interface Tome { id: string; name: string; items: TomeItem[] }

export interface CodexField { k: string; v: string; date?: string; label?: string }
export interface CodexEntry { id: string; name: string; sub: string; icon: IconName; fields: CodexField[] }

export interface Reward { id: number; title: string; price: number }

export interface Hero { name: string; xp: number; level: number; next: number; gold: number }

export interface Data {
  version: 1;
  hero: Hero;
  quests: Quest[];
  camps: Record<string, Campaign>;
  companions: Companion[];
  tomes: Tome[];
  codex: CodexEntry[];
  rewards: Reward[];
}

export interface Quad { key: QuadKey; name: string; sub: string; icon: IconName; mult: number; color: string; light: string }

export const QUADS: Quad[] = [
  { key: 'crisis', name: 'Crisis', sub: 'Urgent · important', icon: 'alert', mult: 1.25, color: 'var(--q-wax)', light: 'oklch(0.74 0.12 30)' },
  { key: 'main', name: 'Main Quests', sub: 'Important · not urgent', icon: 'crown', mult: 1.5, color: 'var(--color-accent-700)', light: 'var(--color-accent-300)' },
  { key: 'errand', name: 'Errands', sub: 'Urgent · not important', icon: 'clock', mult: 0.8, color: 'oklch(0.45 0.08 255)', light: 'oklch(0.77 0.07 255)' },
  { key: 'side', name: 'Side Quests', sub: 'Neither', icon: 'feather', mult: 0.6, color: 'oklch(0.46 0.07 195)', light: 'oklch(0.78 0.07 195)' },
];
export const QM = Object.fromEntries(QUADS.map((q) => [q.key, q])) as Record<QuadKey, Quad>;

export const SIZE: Record<SizeKey, { xp: number; name: string }> = {
  S: { xp: 20, name: 'Small' },
  M: { xp: 40, name: 'Medium' },
  L: { xp: 70, name: 'Large' },
};

export const CSIZE: Record<SizeKey, { name: string; xp: number; gold: number }> = {
  S: { name: 'Short', xp: 120, gold: 50 },
  M: { name: 'Medium', xp: 250, gold: 100 },
  L: { name: 'Epic', xp: 450, gold: 180 },
};

export const STATUSES: [Status, string][] = [['todo', 'To Do'], ['doing', 'Doing'], ['done', 'Done']];
export const STATUS_NAME: Record<Status, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };

export const CAMP_ICONS: IconName[] = ['flag', 'compass', 'home', 'mountain', 'crown'];

/** XP scales with size and the quadrant multiplier (Main Quests ×1.5), rounded to 5; gold is a third of XP. */
export const reward = (q: Pick<Quest, 'size' | 'quad'>) => {
  const xp = Math.max(5, Math.round((SIZE[q.size].xp * QM[q.quad].mult) / 5) * 5);
  return { xp, gold: Math.round(xp / 3) };
};

const UNIT: Record<Every, string> = { daily: 'day', weekly: 'week', monthly: 'month' };
export const streakText = (r: Recur) => r.streak + '-' + UNIT[r.every] + ' streak';
export const recurName = (r: Recur | null) => (r ? r.every[0].toUpperCase() + r.every.slice(1) + ' bounty' : 'Once');

/** Small tilt for pinned notes so the board doesn't look machine-aligned. */
const ROT = [-1.4, 0.9, -0.5, 1.2, -0.9, 0.5, 1.5];
export const noteRotation = (id: number, scale = 1, shift = 0) => ROT[(id + shift) % ROT.length] * scale + 'deg';

/** A fresh log: level 1, no gold, nothing written down yet. */
export const emptyData = (): Data => ({
  version: 1,
  hero: { name: 'Adventurer', xp: 0, level: 1, next: 100, gold: 0 },
  quests: [],
  camps: {},
  companions: [],
  tomes: [],
  codex: [],
  rewards: [],
});

export const CODEX_ICONS: IconName[] = ['pin', 'car', 'utensils', 'dumbbell', 'home', 'map'];
