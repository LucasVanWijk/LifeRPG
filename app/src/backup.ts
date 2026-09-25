// Backup file export, and the "when did I last back up" record the reminder on Home uses.
import { dayDiff } from './domain/dates';
import type { Data } from './domain/model';

const EXPORT_KEY = 'questlog:lastExport';
const SNOOZE_KEY = 'questlog:backupSnoozedUntil';
/** Days without a backup before Home reminds you. */
export const BACKUP_EVERY_DAYS = 14;

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const lastExport = () => read(EXPORT_KEY);

/** Downloads the whole log as JSON and returns the file name. */
export function exportBackup(data: Data, today: string): string {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'questlog-backup-' + today + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  write(EXPORT_KEY, today);
  return a.download;
}

const hasContent = (d: Data) =>
  d.quests.length + d.habits.length + Object.keys(d.camps).length + d.companions.length + d.tomes.length + d.codex.length + d.rewards.length > 0;

/** Days since the last backup when a reminder is due, or null when it isn't. */
export function backupDue(data: Data, today: string): { days: number | null } | null {
  if (!hasContent(data)) return null;
  const snoozed = read(SNOOZE_KEY);
  if (snoozed && snoozed > today) return null;
  const last = lastExport();
  if (!last) return { days: null };
  const days = dayDiff(today, last);
  return days >= BACKUP_EVERY_DAYS ? { days } : null;
}

export const snoozeBackup = (until: string) => write(SNOOZE_KEY, until);
