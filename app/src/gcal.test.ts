import { describe, expect, it } from 'vitest';
import { fromGoogle, resolve, toGoogle } from './gcal';
import { applyChanges, syncRound } from './gcalsync';
import type { GcalApi } from './gcalsync';
import { emptyConfig } from './gcal';
import type { CalEvent } from './domain/model';

const ev = (o: Partial<CalEvent> = {}): CalEvent => ({ id: 1, title: 'Dinner', start: '2026-11-20', end: '2026-11-20', allDay: false, startTime: '19:00', endTime: '21:00', repeat: null, location: '', notes: '', companions: [], ...o });

describe('conversion', () => {
  it('reads all-day events with Google\'s exclusive end', () => {
    const e = fromGoogle({ id: 'a', summary: 'Trip', start: { date: '2026-11-20' }, end: { date: '2026-11-23' } }, 'primary')!;
    expect([e.start, e.end, e.allDay]).toEqual(['2026-11-20', '2026-11-22', true]);
  });
  it('reads timed events in local time', () => {
    const d = new Date(2026, 10, 20, 9, 30);
    const e = fromGoogle({ id: 'a', start: { dateTime: d.toISOString() }, end: { dateTime: new Date(2026, 10, 20, 10, 0).toISOString() } }, 'primary')!;
    expect([e.start, e.startTime, e.endTime]).toEqual(['2026-11-20', '09:30', '10:00']);
    expect(e.title).toBe('(no title)');
  });
  it('writes all-day and repeating events', () => {
    expect(toGoogle(ev({ allDay: true, start: '2026-11-20', end: '2026-11-21' }), 'UTC')).toMatchObject({ start: { date: '2026-11-20' }, end: { date: '2026-11-22' } });
    const r = toGoogle(ev({ repeat: { every: 'weekly', interval: 2, until: '2026-12-31' }, except: ['2026-12-04'] }), 'Europe/Amsterdam');
    expect(r.recurrence).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959Z', 'EXDATE;TZID=Europe/Amsterdam:20261204T190000']);
  });
});

describe('resolve', () => {
  const g = { cal: 'c', id: 'x', rev: 'R1', at: 100 };
  it('keeps, pulls, pushes, and lets the newest win a conflict', () => {
    expect(resolve({ updated: 100, g }, { updated: 'R1' })).toBe('keep');
    expect(resolve({ updated: 100, g }, { updated: 'R2' })).toBe('pull');
    expect(resolve({ updated: 200, g }, { updated: 'R1' })).toBe('push');
    expect(resolve({ updated: 200, g }, { updated: new Date(300).toISOString() })).toBe('pull');
    expect(resolve({ updated: 400, g }, { updated: new Date(300).toISOString() })).toBe('push');
  });
});

describe('syncRound', () => {
  const calendars = [{ id: 'primary', name: 'Me', writable: true, primary: true }];
  const cfg = { ...emptyConfig(), on: true, calendars, shown: ['primary'], target: 'primary' };
  const fake = (pulled: Record<string, unknown>[] = []) => {
    const log: string[] = [];
    const api: GcalApi = {
      async pull() { return { events: pulled as never, syncToken: 'T1' }; },
      async insert(_c, b) { log.push('insert ' + (b.summary as string)); return { id: 'g1', updated: 'R1' }; },
      async patch(_c, id) { log.push('patch ' + id); return { id, updated: 'R9' }; },
      async remove(_c, id) { log.push('remove ' + id); },
    };
    return { api, log };
  };
  const base = { cfg, cache: {}, tombstones: [], today: '2026-11-12', tz: 'UTC', now: 1000 };

  it('pushes new events and caches Google-only ones', async () => {
    const { api, log } = fake([{ id: 'gx', summary: 'Dentist', start: { date: '2026-11-15' }, end: { date: '2026-11-16' }, updated: 'R5' }]);
    const r = await syncRound({ ...base, api, events: [ev({ updated: 50 })] });
    expect(log).toEqual(['insert Dinner']);
    expect(r.cache.primary.map((e) => e.title)).toEqual(['Dentist']);
    expect(r.cfg.tokens.primary).toBe('T1');
    expect(applyChanges([ev({ updated: 50 })], r.changes)[0].g).toMatchObject({ id: 'g1', cal: 'primary' });
  });
  it('does not push imported events or occurrences of a series it created', async () => {
    const { api, log } = fake([{ id: 'g1_20261120', recurringEventId: 'g1', summary: 'Dinner', start: { date: '2026-11-20' }, end: { date: '2026-11-21' } }]);
    const mirrored = ev({ updated: 10, g: { cal: 'primary', id: 'g1', rev: 'R1', at: 10 }, repeat: { every: 'weekly', interval: 1 } });
    const r = await syncRound({ ...base, api, events: [mirrored, ev({ id: 2, uid: 'x@y' })] });
    expect(log).toEqual([]);
    expect(r.cache.primary).toEqual([]);
  });
  it('pulls Google edits, removes cancelled events and deletes what was deleted here', async () => {
    const { api, log } = fake([
      { id: 'g1', summary: 'Dinner at 8', start: { dateTime: new Date(2026, 10, 20, 20, 0).toISOString() }, end: { dateTime: new Date(2026, 10, 20, 22, 0).toISOString() }, updated: 'R2' },
      { id: 'g2', status: 'cancelled' },
    ]);
    const events = [ev({ updated: 10, g: { cal: 'primary', id: 'g1', rev: 'R1', at: 10 } }), ev({ id: 2, updated: 10, g: { cal: 'primary', id: 'g2', rev: 'R1', at: 10 } })];
    const r = await syncRound({ ...base, api, events, tombstones: [{ key: 'event:3', at: 5, g: { cal: 'primary', id: 'g3' } }] });
    const after = applyChanges(events, r.changes);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ title: 'Dinner at 8', startTime: '20:00' });
    expect(log).toEqual(['remove g3']);
  });
  it('pushes a local edit', async () => {
    const { api, log } = fake([]);
    await syncRound({ ...base, api, events: [ev({ updated: 500, g: { cal: 'primary', id: 'g1', rev: 'R1', at: 10 } })] });
    expect(log).toEqual(['patch g1']);
  });
});
