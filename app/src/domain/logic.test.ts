import { describe, expect, it } from 'vitest';
import { addMonths, dueLabel } from './dates';
import { bestStreak, chronicle, completeQuest, deleteCampaign, deleteQuest, habitDone, habitProgress, glossaryEvents, habitStreak, periodOf, setStatus, toggleHabit, undoQuest } from './logic';
import { migrate } from './migrate';
import type { Data, Habit, Quest } from './model';
import { emptyData, habitReward, reward } from './model';
import { sampleData } from './sample';
import { found, setChampion } from './guild/engine';
import { RACES, xpToNext } from './guild/content';

const founding = { name: 'Test Company', town: 'Testwick', charter: 'martial' as const, crestSeed: 1, seed: 42 };
/** The data with a freshly founded guild whose first adventurer is Champion. */
const G = (d: Data): Data => {
  const g = found(founding, Date.UTC(2026, 8, 25));
  const c = setChampion(g, g.adventurers[0].id);
  if (!c.ok) throw new Error(c.reason);
  return { ...d, guild: c.guild };
};

const T = '2026-09-25'; // a Friday
const quest = (id: number, patch: Partial<Quest> = {}): Quest =>
  ({ id, title: 'Q' + id, quad: 'side', due: null, size: 'S', campaign: null, status: 'todo', notes: [], steps: [], companions: [], ...patch });

describe('reward', () => {
  it('gives Main Quests the 1.5× multiplier', () => {
    expect(reward({ size: 'L', quad: 'main' })).toEqual({ xp: 105, gold: 35 });
    expect(reward({ size: 'L', quad: 'side' })).toEqual({ xp: 40, gold: 13 });
    expect(reward({ size: 'S', quad: 'crisis' })).toEqual({ xp: 25, gold: 8 });
  });
  it('pays habits half a quest of the same size', () => {
    expect(habitReward({ size: 'M' })).toEqual({ xp: 20, gold: 7 });
  });
});

describe('completeQuest / undoQuest', () => {
  it('pays out a quest to the Champion and the guild, and reverses it exactly', () => {
    const d = G(sampleData(T));
    const champ = d.guild!.adventurers[0];
    const xp = Math.round(25 * RACES[champ.race].xpMult);
    const c = completeQuest(d, 8, T)!; // Pay car insurance: crisis S → 25 XP, 8 gold
    expect(c.toasts[0]).toMatchObject({ text: '+' + xp + ' XP to ' + champ.first + ' · +6g', sub: 'Pay car insurance · +2g to their purse', undo: true });
    expect(c.data.guild!.gold).toBe(d.guild!.gold + 6);
    expect(c.data.guild!.adventurers[0].purse).toBe(champ.purse + 2);
    expect(c.data.guild!.adventurers[0].practice.might).toBe(xp);
    expect(c.data.quests.find((x) => x.id === 8)).toMatchObject({ status: 'done', doneOn: T, prevStatus: 'todo' });
    expect(completeQuest(c.data, 8, T)).toBeNull();
    const u = undoQuest(c.data, 8, T).data;
    expect(u.guild).toEqual(d.guild);
    expect(u.quests.find((x) => x.id === 8)!.status).toBe('todo');
  });

  it('shows the level-up when the Champion levels', () => {
    const d = G(sampleData(T));
    const champ = d.guild!.adventurers[0];
    d.guild!.adventurers[0] = { ...champ, xp: xpToNext(champ.level) - 10 };
    const c = completeQuest(d, 4, T)!; // L main → 105 XP
    expect(c.levelUp).toEqual({ name: champ.first, level: champ.level + 1 });
  });

  it('pays nothing into a guild that has not been founded yet', () => {
    const d: Data = { ...emptyData(), quests: [quest(1, { quad: 'main', size: 'L' })] };
    const c = completeQuest(d, 1, T)!;
    expect(c.levelUp).toBeNull();
    expect(c.data.guild).toBeNull();
    expect(c.toasts[0].text).toBe('+105 XP · +35 gold');
  });
});

describe('migrate to the guild', () => {
  it('keeps the quest log, drops the old Hero and Expeditions, and founds a new guild', () => {
    const old = { version: 2, hero: { name: 'Old', xp: 10, level: 3, next: 300, gold: 50, points: 4, reviewedWeek: '2026-09-21' }, expedition: { skills: {} }, quests: [quest(1)], habits: [], camps: {}, companions: [], tomes: [], codex: [], events: [] };
    const d = migrate(old, T)!;
    expect(d.version).toBe(4);
    expect(d.guild).toBeNull();
    expect(d.profile).toEqual({ reviewedWeek: '2026-09-21' });
    expect(d.quests).toHaveLength(1);
    expect('hero' in d || 'expedition' in d).toBe(false);
  });
});

describe('setStatus', () => {
  it('pays when dragged to Done and refunds when dragged back', () => {
    const d = sampleData(T);
    const a = setStatus(d, 9, 'done', T);
    expect(a.toasts[0].text).toBe('+60 XP · +20 gold');
    const b = setStatus(a.data, 9, 'doing', T);
    expect(b.data.guild).toEqual(d.guild);
    expect(b.data.quests.find((x) => x.id === 9)!.status).toBe('doing');
  });
});

describe('campaign rewards', () => {
  const camp = { name: 'Trip', short: 'Trip', desc: '', xp: 250, gold: 100, seal: "Wayfarer's seal", icon: 'compass' as const };
  const withCamp = (): Data => ({ ...emptyData(), camps: { trip: { ...camp } }, quests: [quest(1, { campaign: 'trip', status: 'done' }), quest(2, { campaign: 'trip' })] });

  it('pays the reward when the last quest is done', () => {
    const c = completeQuest(withCamp(), 2, T)!;
    expect(c.data.camps.trip.completedOn).toBe(T);
    expect(c.toasts.map((t) => t.text)).toEqual(['+10 XP · +3 gold', 'Campaign complete · Trip']);
    const g = completeQuest(G(withCamp()), 2, T)!;
    expect(g.data.guild!.gold - G(withCamp()).guild!.gold).toBe(2 + 75);
    expect(g.data.guild!.adventurers[0].chapter.campaigns).toEqual(['Trip']);
  });

  it('takes the reward back if reopened the same day, keeps it on later days', () => {
    const start = G(withCamp()).guild!.gold;
    const c = completeQuest(G(withCamp()), 2, T)!;
    const same = undoQuest(c.data, 2, T).data;
    expect(same.camps.trip.completedOn).toBeNull();
    expect(same.guild!.gold).toBe(start);
    const later = undoQuest(c.data, 2, '2026-09-26').data;
    expect(later.camps.trip.completedOn).toBe(T);
    expect(later.guild!.gold).toBe(start + 75);
  });

  it('keeps the reward when finished quests are deleted', () => {
    const start = G(withCamp()).guild!.gold;
    const c = completeQuest(G(withCamp()), 2, T)!;
    const d = deleteQuest(deleteQuest(c.data, 1, T).data, 2, T).data;
    expect(d.camps.trip.completedOn).toBe(T);
    expect(d.guild!.gold).toBe(start + 77);
  });

  it('pays a campaign’s quests to its Standard-bearer', () => {
    const d = G(withCamp());
    const bearer = d.guild!.adventurers[2];
    d.camps.trip.bearerId = bearer.id;
    const c = completeQuest(d, 2, T)!;
    expect(c.data.guild!.adventurers[2].chapter).toMatchObject({ quests: 1, campaigns: ['Trip'] });
    expect(c.data.guild!.adventurers[0].chapter.quests).toBe(0);
  });

  it('keeps quests when a campaign is deleted', () => {
    const d = deleteCampaign(withCamp(), 'trip');
    expect(d.camps).toEqual({});
    expect(d.quests.map((q) => q.campaign)).toEqual([null, null]);
  });
});

describe('habits', () => {
  const h = (patch: Partial<Habit>): Habit => ({ id: 1, title: 'Read', every: 'daily', size: 'S', log: [], created: T, ...patch });

  it('groups weekly check-ins by the Monday of the week', () => {
    expect(periodOf('2026-09-27', 'weekly')).toBe('2026-09-21');
    expect(periodOf('2026-09-21', 'weekly')).toBe('2026-09-21');
  });

  it('counts streaks back from today, or from yesterday while today is open', () => {
    const daily = h({ log: ['2026-09-22', '2026-09-23', '2026-09-24'] });
    expect(habitStreak(daily, T)).toBe(3);
    expect(habitStreak(daily, '2026-09-26')).toBe(0);
    const weekly = h({ every: 'weekly', log: ['2026-09-01', '2026-09-10', '2026-09-16'] });
    expect(habitStreak(weekly, T)).toBe(3);
    expect(bestStreak(h({ log: ['2026-09-01', '2026-09-02', '2026-09-05', '2026-09-06', '2026-09-07'] }))).toBe(3);
  });

  it('checks in once per period and undoes cleanly', () => {
    const d: Data = { ...emptyData(), habits: [h({ log: ['2026-09-24'] })] };
    const a = toggleHabit(d, 1, T);
    expect(a.toasts[0]).toMatchObject({ text: '+10 XP · +3 gold', sub: 'Read · 2-day streak' });
    expect(a.data.habits[0].log).toEqual(['2026-09-24', T]);
    const b = toggleHabit(a.data, 1, T);
    expect(b.data.habits[0].log).toEqual(['2026-09-24']);
    expect(b.data.guild).toEqual(d.guild);
  });

  it('pays a check-in to the Champion and takes exactly that back', () => {
    const d = G({ ...emptyData(), habits: [h({ log: ['2026-09-24'] })] });
    const a = toggleHabit(d, 1, T);
    expect(a.data.guild!.ledger).toHaveLength(1);
    expect(a.data.guild!.adventurers[0].chapter.habits).toBe(1);
    expect(toggleHabit(a.data, 1, T).data.guild).toEqual(d.guild);
  });
});

describe('weekly targets', () => {
  const gym = (log: string[]): Habit => ({ id: 1, title: 'Gym', every: 'weekly', target: 3, size: 'M', log, created: '2026-09-01' });

  it('checks in once a day until the week is on target', () => {
    let d: Data = { ...emptyData(), habits: [gym(['2026-09-21', '2026-09-23'])] }; // Mon, Wed
    const a = toggleHabit(d, 1, T); // Fri
    expect(a.toasts[0].sub).toBe('Gym · 1-week streak');
    expect(habitDone(a.data.habits[0], T)).toBe(true);
    d = a.data;
    expect(toggleHabit(d, 1, T).data.habits[0].log).toEqual(['2026-09-21', '2026-09-23']); // undo today only
    const again = toggleHabit({ ...d, habits: [gym(['2026-09-21', '2026-09-22', '2026-09-23'])] }, 1, T);
    expect(again.toasts).toHaveLength(0); // already on target, nothing more to pay
  });

  it('counts a week toward the streak only when the target is met', () => {
    const h = gym(['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-15', '2026-09-16', '2026-09-21']);
    expect(habitProgress(h, T)).toEqual({ count: 1, target: 3 });
    expect(habitStreak(h, T)).toBe(0); // last week (15 Sep) missed the target
    expect(bestStreak(h)).toBe(1); // the week of 8 Sep
    const onTrack = gym(['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21']);
    expect(habitStreak(onTrack, T)).toBe(1); // last week met; this week still open
  });

  it('shows progress in the toast before the target', () => {
    const a = toggleHabit({ ...emptyData(), habits: [gym([])] }, 1, T);
    expect(a.toasts[0].sub).toBe('Gym · 1 of 3 this week');
  });
});

describe('chronicle', () => {
  it('lists completed quests, check-ins and campaigns, newest first', () => {
    const d: Data = {
      ...emptyData(),
      quests: [quest(1, { title: 'Done', status: 'done', doneOn: '2026-09-20' }), quest(2, { title: 'Open' })],
      habits: [{ id: 1, title: 'Read', every: 'daily', size: 'S', log: ['2026-09-24'], created: T }],
      camps: { c: { name: 'Trip', short: 'Trip', desc: '', xp: 250, gold: 100, seal: 'Seal', icon: 'flag', completedOn: '2026-09-22' } },
    };
    expect(chronicle(d).map((e) => [e.date, e.kind, e.title, e.xp])).toEqual([
      ['2026-09-24', 'habit', 'Read', 10], ['2026-09-22', 'campaign', 'Trip', 250], ['2026-09-20', 'quest', 'Done', 10],
    ]);
  });
});

describe('migrate', () => {
  it('turns version-1 bounties into habits with their streak', () => {
    const v1 = {
      version: 1, hero: { name: 'Rowan', xp: 0, level: 1, next: 100, gold: 0 }, camps: {}, companions: [], tomes: [], codex: [], rewards: [],
      quests: [quest(1), { ...quest(2, { title: 'Call mom' }), recur: { every: 'weekly', streak: 3 } }],
    };
    const d = migrate(v1, T)!;
    expect(d.version).toBe(4);
    expect(d.quests.map((q) => q.id)).toEqual([1]);
    expect(d.habits[0]).toMatchObject({ title: 'Call mom', every: 'weekly' });
    expect(habitStreak(d.habits[0], T)).toBe(3);
  });
  it('gives older quests an empty checklist', () => {
    const { steps, ...old } = quest(1);
    void steps;
    const d = migrate({ ...emptyData(), quests: [old] }, T)!;
    expect(d.quests[0].steps).toEqual([]);
  });
  it('rejects things that are not a Questlog log', () => {
    expect(migrate({ foo: 1 }, T)).toBeNull();
    expect(migrate('nope', T)).toBeNull();
  });
});

describe('sample data', () => {
  it('shifts sample dates so they stay relative to today', () => {
    const later = sampleData('2027-01-10');
    expect(later.quests.find((x) => x.id === 1)!.due).toBe('2027-01-10');
    expect(later.companions.find((c) => c.id === 'tom')!.notes[0].t).toBe('Housewarming on 11 Jan');
  });
  it('puts birthdays and dated notes on the calendar', () => {
    const ev = glossaryEvents(sampleData(T), T);
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
