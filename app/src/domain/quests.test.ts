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

import { layoutDay, moveEventTo } from './calendar';
import type { CalEvent } from './model';

describe('day layout', () => {
  const item = (time: string, endTime?: string) => ({ date: T, kind: 'event' as const, title: time, allDay: false, time, endTime, target: 'event:1' });
  it('puts overlapping items side by side and leaves the rest full width', () => {
    const p = layoutDay([item('09:00', '10:00'), item('09:30', '10:30'), item('09:45', '10:15'), item('12:00', '13:00')]);
    expect(p.map((x) => [x.col, x.cols])).toEqual([[0, 3], [1, 3], [2, 3], [0, 1]]);
  });
  it('gives a quest at a time a short block and skips all-day items', () => {
    const p = layoutDay([item('14:30'), { ...item('00:00'), allDay: true }]);
    expect(p).toHaveLength(1);
    expect(p[0].end - p[0].start).toBe(45);
  });
});

describe('moving an event', () => {
  const ev: CalEvent = { id: 1, title: 'x', start: '2026-11-12', end: '2026-11-12', allDay: false, startTime: '09:00', endTime: '10:30', repeat: null, location: '', notes: '', companions: [] };
  it('keeps its length and can cross midnight', () => {
    expect(moveEventTo(ev, '2026-11-14', 14 * 60)).toMatchObject({ start: '2026-11-14', startTime: '14:00', end: '2026-11-14', endTime: '15:30' });
    expect(moveEventTo(ev, '2026-11-14', 23 * 60)).toMatchObject({ end: '2026-11-15', endTime: '00:30' });
  });
});

import { prepQuest } from './quests';
describe('preparation quests', () => {
  const e = { id: 7, title: 'Dinner', start: '2026-11-20', startTime: '19:00', allDay: false, companions: ['sophie'] };
  it('is due the day before, or the same day for an evening event, and carries the people', () => {
    expect(prepQuest({ ...e, startTime: '10:00' })).toMatchObject({ due: '2026-11-19', event: 7, companions: ['sophie'] });
    expect(prepQuest(e).due).toBe('2026-11-20');
    expect(prepQuest({ ...e, allDay: true }).due).toBe('2026-11-19');
  });
});

import { adjustAmount, toggleHabit } from './logic';
import type { Habit } from './model';
describe('habits with amounts', () => {
  const water: Habit = { id: 1, title: 'Water', every: 'daily', size: 'S', log: [], created: T, amount: 8, unit: 'glasses', step: 1 };
  const withHabit = (h: Habit = water): Data => ({ ...emptyData(), habits: [h] });
  it('is done and paid once, when the count reaches the amount', () => {
    let d = withHabit();
    for (let i = 0; i < 7; i++) d = adjustAmount(d, 1, 1, T).data;
    expect(d.habits[0].counts![T]).toBe(7);
    expect(d.habits[0].log).toEqual([]);
    const o = adjustAmount(d, 1, 1, T);
    expect(o.data.habits[0].log).toEqual([T]);
    expect(o.toasts.length).toBeGreaterThan(0);
    const more = adjustAmount(o.data, 1, 2, T);
    expect(more.data.habits[0].log).toEqual([T]);
    expect(more.toasts).toHaveLength(0);
  });
  it('takes the day back when the count falls below the amount', () => {
    const done = adjustAmount(withHabit({ ...water, counts: { [T]: 7 } }), 1, 1, T).data;
    const back = adjustAmount(done, 1, -3, T).data;
    expect(back.habits[0].log).toEqual([]);
    expect(back.habits[0].counts![T]).toBe(5);
  });
  it('a tap on the box adds a step, and on a finished day resets it', () => {
    const d1 = toggleHabit(withHabit({ ...water, step: 4 }), 1, T).data;
    expect(d1.habits[0].counts![T]).toBe(4);
    const d2 = toggleHabit(d1, 1, T).data;
    expect(d2.habits[0].counts![T]).toBe(8);
    expect(d2.habits[0].log).toEqual([T]);
    const d3 = toggleHabit(d2, 1, T).data;
    expect(d3.habits[0].log).toEqual([]);
    expect(d3.habits[0].counts?.[T]).toBeUndefined();
  });
});
