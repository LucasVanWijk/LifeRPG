import { describe, expect, it } from 'vitest';
import type { Tome, TomeItem } from './model';
import { finishedIn, sortItems, toggleItem, yearText } from './tomes';

const item = (id: number, o: Partial<TomeItem> = {}): TomeItem => ({ id, t: 'Book ' + id, done: false, ...o });

describe('log tomes', () => {
  it('dates an item when ticked and clears it when unticked', () => {
    const done = toggleItem(item(1), '2026-11-12');
    expect(done).toMatchObject({ done: true, finished: '2026-11-12' });
    expect(toggleItem(done, '2026-11-13')).toMatchObject({ done: false, finished: undefined });
    expect(toggleItem(item(1, { finished: '2026-05-01' }), '2026-11-12').finished).toBe('2026-05-01');
  });
  it('counts the year', () => {
    const t: Tome = { id: 't', name: 'Books', noun: 'books', log: true, items: [item(1, { done: true, finished: '2026-02-01' }), item(2, { done: true, finished: '2025-12-31' }), item(3)] };
    expect(finishedIn(t, 2026)).toBe(1);
    expect(yearText(t, 2026)).toBe('1 books in 2026');
    expect(yearText({ ...t, noun: undefined }, 2025)).toBe('1 finished in 2025');
  });
  it('sorts by date or rating, finished first', () => {
    const items = [item(1), item(2, { done: true, finished: '2026-01-01', rating: 5 }), item(3, { done: true, finished: '2026-06-01', rating: 3 })];
    expect(sortItems(items, 'date').map((i) => i.id)).toEqual([3, 2, 1]);
    expect(sortItems(items, 'rating').map((i) => i.id)).toEqual([2, 3, 1]);
    expect(sortItems(items, 'added')).toBe(items);
  });
});
