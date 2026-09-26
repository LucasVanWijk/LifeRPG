import { describe, expect, it } from 'vitest';
import { parseIcs } from './ics';

const wrap = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((e) => ['BEGIN:VEVENT', e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

describe('parseIcs', () => {
  it('reads all-day events with an exclusive end, unfolding and unescaping text', () => {
    const r = parseIcs(wrap('UID:a1\r\nSUMMARY:Trip to Ireland\\, west coast\r\nDTSTART;VALUE=DATE:20261012\r\nDTEND;VALUE=DATE:20261023\r\nDESCRIPTION:Line one\\nLine\r\n  two\r\nLOCATION:Galway'));
    expect(r.events[0]).toMatchObject({ uid: 'a1', title: 'Trip to Ireland, west coast', start: '2026-10-12', end: '2026-10-22', allDay: true, location: 'Galway', notes: 'Line one\nLine two' });
  });

  it('converts UTC and TZID times to local time', () => {
    // Tests run with TZ=UTC (see package.json), so local time equals UTC here.
    const r = parseIcs(wrap('SUMMARY:Call\r\nDTSTART:20260925T170000Z\r\nDTEND:20260925T173000Z', 'SUMMARY:Dentist\r\nDTSTART;TZID=Europe/Amsterdam:20260925T090000\r\nDTEND;TZID=Europe/Amsterdam:20260925T100000'));
    expect(r.events.map((e) => [e.start, e.startTime, e.endTime])).toEqual([['2026-09-25', '17:00', '17:30'], ['2026-09-25', '07:00', '08:00']]);
  });

  it('reads repeats with COUNT, UNTIL, INTERVAL and EXDATE', () => {
    const r = parseIcs(wrap(
      'SUMMARY:Gym\r\nDTSTART;VALUE=DATE:20260907\r\nRRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4\r\nEXDATE;VALUE=DATE:20260914',
      'SUMMARY:Rent\r\nDTSTART;VALUE=DATE:20260131\r\nRRULE:FREQ=MONTHLY;INTERVAL=2;UNTIL=20261231T000000Z',
    ));
    expect(r.events[0]).toMatchObject({ repeat: { every: 'weekly', interval: 1, until: '2026-09-28' }, except: ['2026-09-14'] });
    expect(r.events[1].repeat).toEqual({ every: 'monthly', interval: 2, until: '2026-12-31' });
    expect(r.simplified).toBe(0);
  });

  it('counts rules it has to simplify and skips events without a start', () => {
    const r = parseIcs(wrap('SUMMARY:Lessons\r\nDTSTART;VALUE=DATE:20260907\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE', 'SUMMARY:Broken'));
    expect(r.events).toHaveLength(1);
    expect(r.simplified).toBe(1);
    expect(r.skipped).toBe(1);
  });
});
