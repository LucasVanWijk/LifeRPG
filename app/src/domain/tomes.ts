// Log tomes: books read, films watched. Ticking an item dates it; the tome counts the year and can be sorted.
import type { Tome, TomeItem } from './model';

export type TomeSort = 'added' | 'date' | 'rating';

/** Ticking sets the date finished (unless one was typed in); unticking clears it. */
export function toggleItem(i: TomeItem, today: string): TomeItem {
  return i.done ? { ...i, done: false, finished: undefined } : { ...i, done: true, finished: i.finished ?? today };
}

export const finishedIn = (t: Tome, year: number) => t.items.filter((i) => i.done && i.finished?.startsWith(String(year))).length;

/** "14 books in 2026". */
export const yearText = (t: Tome, year: number) => finishedIn(t, year) + ' ' + (t.noun?.trim() || 'finished') + ' in ' + year;

/** Items in the order asked for: as added, by date finished (newest first), or by rating (best first). Unfinished ones come last. */
export function sortItems(items: TomeItem[], by: TomeSort): TomeItem[] {
  if (by === 'added') return items;
  const key = (i: TomeItem) => (by === 'date' ? i.finished ?? '' : String(i.rating ?? 0));
  return [...items].sort((a, b) => Number(b.done) - Number(a.done) || key(b).localeCompare(key(a)));
}
