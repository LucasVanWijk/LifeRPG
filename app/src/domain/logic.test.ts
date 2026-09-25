import { describe, expect, it } from 'vitest';
import { addMonths, dueLabel } from './dates';
import { completeQuest, glossaryEvents, setStatus, undoQuest } from './logic';
import { reward } from './model';
import { seedData } from './seed';

const T = '2026-09-25';

describe('reward', () => {
  it('gives Main Quests the 1.5× multiplier', () => {
    expect(reward({ size: 'L', quad: 'main' })).toEqual({ xp: 105, gold: 35 });
    expect(reward({ size: 'L', quad: 'side' })).toEqual({ xp: 40, gold: 13 });
    expect(reward({ size: 'S', quad: 'crisis' })).toEqual({ xp: 25, gold: 8 });
  });
});

describe('completeQuest / undoQuest', () => {
  it('pays out a one-off quest and reverses it exactly', () => {
    const d = seedData(T);
    const c = completeQuest(d, 8, T)!; // Pay car insurance: crisis S → 25 XP, 8 gold
    expect(c.xp).toBe(25);
    expect(c.data.hero).toMatchObject({ xp: 365, gold: 433, level: 7 });
    const q = c.data.quests.find((x) => x.id === 8)!;
    expect(q).toMatchObject({ status: 'done', doneOn: T, prevStatus: 'todo' });
    expect(completeQuest(c.data, 8, T)).toBeNull();

    const u = undoQuest(c.data, 8, T);
    expect(u.hero).toEqual(d.hero);
    expect(u.quests.find((x) => x.id === 8)!.status).toBe('todo');
  });

  it('rolls a weekly bounty forward and extends its streak', () => {
    const d = seedData(T);
    const c = completeQuest(d, 3, T)!; // Call mom, weekly, streak 3
    const q = c.data.quests.find((x) => x.id === 3)!;
    expect(q.due).toBe('2026-10-02');
    expect(q.recur).toEqual({ every: 'weekly', streak: 4 });
    expect(c.toastSub).toBe('Call mom · 4-week streak');
    const u = undoQuest(c.data, 3, T).quests.find((x) => x.id === 3)!;
    expect(u.due).toBe(T);
    expect(u.recur!.streak).toBe(3);
  });

  it('levels up and carries the overflow', () => {
    const d = seedData(T);
    d.hero.xp = 490;
    const c = completeQuest(d, 4, T)!; // L main → 105 XP
    expect(c.leveledUp).toBe(true);
    expect(c.data.hero).toMatchObject({ level: 8, xp: 95, next: 600 });
  });
});

describe('setStatus', () => {
  it('pays when dragged to Done and refunds when dragged back', () => {
    const d = seedData(T);
    const a = setStatus(d, 9, 'done', T);
    expect(a.completion?.xp).toBe(60);
    const b = setStatus(a.data, 9, 'doing', T);
    expect(b.data.hero).toEqual(d.hero);
    expect(b.data.quests.find((x) => x.id === 9)!.status).toBe('doing');
  });
});

describe('seed', () => {
  it('shifts sample dates so they stay relative to today', () => {
    const later = seedData('2027-01-10');
    expect(later.quests.find((x) => x.id === 1)!.due).toBe('2027-01-10');
    expect(later.companions.find((c) => c.id === 'tom')!.notes[0].t).toBe('Housewarming on 11 Jan');
  });
  it('puts birthdays and dated notes on the calendar', () => {
    const ev = glossaryEvents(seedData(T), T);
    expect(ev.some((e) => e.date === '2026-09-27' && e.label === "Mom's birthday")).toBe(true);
    expect(ev.some((e) => e.date === '2026-09-29' && e.kind === 'Codex')).toBe(true);
  });
});

describe('dates', () => {
  it('labels due dates like the design', () => {
    expect(dueLabel('2026-09-23', T)).toBe('Overdue · 2 days');
    expect(dueLabel(T, T)).toBe('Due today');
    expect(dueLabel('2026-09-26', T)).toBe('Tomorrow');
    expect(dueLabel('2026-09-28', T)).toBe('Monday');
    expect(dueLabel('2026-10-08', T)).toBe('8 Oct');
  });
  it('clamps month-end when adding months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});
