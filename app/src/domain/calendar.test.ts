import { describe, expect, it } from 'vitest';
import { calendarItems, eventItems, repeatText } from './calendar';
import type { CalEvent } from './model';
import { emptyData, titleFor } from './model';
import { migrate } from './migrate';

const ev = (patch: Partial<CalEvent>): CalEvent => ({ id: 1, title: 'E', start: '2026-09-25', end: '2026-09-25', allDay: true, repeat: null, location: '', notes: '', companions: [], ...patch });
const dates = (e: CalEvent, from: string, to: string) => eventItems(e, from, to).map((i) => i.date);

describe('event repeats', () => {
  it('repeats daily, weekly and yearly', () => {
    expect(dates(ev({ repeat: { every: 'daily', interval: 1 } }), '2026-09-24', '2026-09-27')).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(dates(ev({ repeat: { every: 'weekly', interval: 2 } }), '2026-09-01', '2026-10-31')).toEqual(['2026-09-25', '2026-10-09', '2026-10-23']);
    expect(dates(ev({ repeat: { every: 'yearly', interval: 1 } }), '2027-01-01', '2028-12-31')).toEqual(['2027-09-25', '2028-09-25']);
  });

  it('skips months without the day, and respects until and exceptions', () => {
    expect(dates(ev({ start: '2026-01-31', end: '2026-01-31', repeat: { every: 'monthly', interval: 1 } }), '2026-01-01', '2026-05-31'))
      .toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    expect(dates(ev({ repeat: { every: 'weekly', interval: 1, until: '2026-10-09' }, except: ['2026-10-02'] }), '2026-09-01', '2026-12-31'))
      .toEqual(['2026-09-25', '2026-10-09']);
  });

  it('spreads multi-day events over every day and keeps times on the ends', () => {
    const items = eventItems(ev({ start: '2026-10-12', end: '2026-10-14', allDay: false, startTime: '09:00', endTime: '17:00' }), '2026-10-01', '2026-10-31');
    expect(items.map((i) => [i.date, i.allDay, i.time, i.endTime, i.span?.day])).toEqual([
      ['2026-10-12', false, '09:00', undefined, 1], ['2026-10-13', true, undefined, undefined, 2], ['2026-10-14', false, undefined, '17:00', 3],
    ]);
  });

  it('describes repeats in words', () => {
    expect(repeatText(ev({ repeat: { every: 'weekly', interval: 2, until: '2026-12-01' } }), (d) => d)).toBe('Every 2 weeks on Friday, until 2026-12-01');
    expect(repeatText(ev({ repeat: { every: 'monthly', interval: 1 } }), (d) => d)).toBe('Every month on the 25th');
  });
});

describe('calendarItems', () => {
  it('merges events, open deadlines, birthdays and Glossary dates, ordered within a day', () => {
    const d = {
      ...emptyData(),
      events: [ev({ id: 7, title: 'Dinner', allDay: false, startTime: '19:00' }), ev({ id: 8, title: 'Holiday' })],
      quests: [
        { id: 1, title: 'Pay rent', quad: 'crisis' as const, due: '2026-09-25', size: 'S' as const, campaign: null, status: 'todo' as const, notes: [], steps: [], companions: [] },
        { id: 2, title: 'Done thing', quad: 'side' as const, due: '2026-09-25', size: 'S' as const, campaign: null, status: 'done' as const, notes: [], steps: [], companions: [] },
      ],
      companions: [{ id: 'sam', name: 'Sam', first: 'Sam', rel: '', bday: '09-25', notes: [{ t: 'Moving', date: '2026-09-25', label: 'Sam → moving' }] }],
    };
    const items = calendarItems(d, '2026-09-25', '2026-09-25');
    expect(items.map((i) => i.kind + ':' + i.title)).toEqual([
      'deadline:Pay rent', 'event:Holiday', "birthday:Sam's birthday", 'glossary:Sam → moving', 'event:Dinner',
    ]);
    expect(items[0].target).toBe('quest:1');
  });
});

describe('titles and migration', () => {
  it('names each level band', () => {
    expect([1, 2, 3, 7, 8, 12, 24, 25, 40].map(titleFor)).toEqual(['Wanderer', 'Wanderer', 'Squire', 'Adventurer', 'Ranger', 'Knight', 'Hero', 'Legend', 'Legend']);
  });
  it('gives older logs an empty calendar', () => {
    const { events, ...old } = emptyData();
    void events;
    expect(migrate(old, '2026-09-25')!.events).toEqual([]);
  });
});
