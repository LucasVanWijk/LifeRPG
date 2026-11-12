import { describe, expect, it } from 'vitest';
import { completeQuest, undoQuest } from './logic';
import type { Data, Quest } from './model';
import { emptyData } from './model';
import { calendarItems } from './calendar';
import { dayTooFull, nextDue, planCandidates, staleQuests, todayQuests } from './quests';

const T = '2026-11-12';
const q = (id: number, o: Partial<Quest> = {}): Quest => ({ id, title: 'Q' + id, quad: 'side', due: null, size: 'M', campaign: null, status: 'todo', notes: [], steps: [], companions: [], ...o });
const log = (quests: Quest[]): Data => ({ ...emptyData(), quests });
const DAY = 86_400_000;

describe('today', () => {
  it('lists due, overdue and picked quests by time, and leaves out someday', () => {
    const list = todayQuests([
      q(1, { due: T }), q(2, { due: T, dueTime: '08:30' }), q(3, { pick: T }), q(4, { due: '2026-11-10' }), q(5, { due: T, someday: true }), q(6, { due: '2026-11-20' }), q(7, { pick: '2026-11-11' }),
    ], T);
    expect(list.map((x) => x.id)).toEqual([4, 2, 1, 3]);
  });
  it('warns above six points, never blocks', () => {
    expect(dayTooFull([q(1, { size: 'L' }), q(2, { size: 'L' })])).toBe(false);
    expect(dayTooFull([q(1, { size: 'L' }), q(2, { size: 'L' }), q(3, { size: 'S' })])).toBe(true);
  });
  it('offers yesterday\'s picks, Crisis and Main quests, but not what is already on the list', () => {
    const c = planCandidates([q(1, { pick: '2026-11-11' }), q(2, { quad: 'crisis' }), q(3, { quad: 'main', due: T }), q(4, { quad: 'main' }), q(5, { quad: 'main', status: 'done' })], T);
    expect([c.carried, c.crisis, c.main].map((l) => l.map((x) => x.id))).toEqual([[1], [2], [4]]);
  });
});

describe('stale', () => {
  it('needs 30 quiet days, no date ahead, and not someday', () => {
    const now = Date.now();
    const quests = [q(1, { updated: now - 31 * DAY }), q(2, { updated: now - 5 * DAY }), q(3, { updated: now - 40 * DAY, due: '2026-12-01' }), q(4, { updated: now - 40 * DAY, someday: true }), q(5, { updated: now - 40 * DAY, due: '2026-10-01' })];
    expect(staleQuests(quests, T, now).map((x) => x.id)).toEqual([5, 1]);
  });
});

describe('repeating', () => {
  it('counts from the due date without landing in the past, or from the day it was done', () => {
    const r = { unit: 'month' as const, n: 1, from: 'due' as const };
    expect(nextDue({ due: '2026-11-01', repeat: r }, '2026-11-20')).toBe('2026-12-01');
    expect(nextDue({ due: '2026-08-01', repeat: r }, '2026-11-20')).toBe('2026-12-01');
    expect(nextDue({ due: '2026-11-01', repeat: { ...r, from: 'done' } }, '2026-11-20')).toBe('2026-12-20');
    expect(nextDue({ due: null, repeat: { unit: 'week', n: 2, from: 'due' } }, T)).toBe('2026-11-26');
  });
  it('creates the next quest when finished, with steps unticked, and takes it back on undo', () => {
    const base = q(1, { due: '2026-11-01', repeat: { unit: 'month', n: 1, from: 'due' }, steps: [{ id: 1, t: 'a', done: true }], notes: [{ id: 1, t: 'n' }], campaign: 'x' });
    const done = completeQuest(log([base]), 1, T)!.data;
    expect(done.quests).toHaveLength(2);
    const next = done.quests[1];
    expect(next).toMatchObject({ title: 'Q1', due: '2026-12-01', status: 'todo', campaign: null });
    expect(next.steps[0].done).toBe(false);
    expect(next.notes).toHaveLength(1);
    const back = undoQuest(done, 1, T).data;
    expect(back.quests).toHaveLength(1);
    expect(back.quests[0].status).toBe('todo');
  });
  it('keeps the next one if it was already touched', () => {
    const base = q(1, { due: '2026-11-01', repeat: { unit: 'day', n: 1, from: 'done' } });
    const done = completeQuest(log([base]), 1, T)!.data;
    const touched = { ...done, quests: done.quests.map((x) => (x.id === done.quests[0].spawned ? { ...x, status: 'doing' as const } : x)) };
    expect(undoQuest(touched, 1, T).data.quests).toHaveLength(2);
  });
});

describe('calendar', () => {
  it('shows timed deadlines at their time and hides someday quests', () => {
    const items = calendarItems({ ...emptyData(), quests: [q(1, { due: T, dueTime: '14:30' }), q(2, { due: T, someday: true })] }, T, T);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ time: '14:30', allDay: false });
  });
});
