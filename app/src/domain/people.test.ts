import { describe, expect, it } from 'vitest';
import { ageOf, lastContact, overdueContacts } from './people';
import { parseQuickAdd } from './quickadd';
import type { CalEvent, Companion, Quest } from './model';

const T = '2026-11-12';
const c = (id: string, o: Partial<Companion> = {}): Companion => ({ id, name: id, first: id, rel: '', bday: '', notes: [], ...o });
const ev = (o: Partial<CalEvent>): CalEvent => ({ id: 1, title: 'x', start: T, end: T, allDay: true, repeat: null, location: '', notes: '', companions: [], ...o });
const quest = (o: Partial<Quest>): Quest => ({ id: 1, title: 'q', quad: 'side', due: null, size: 'S', campaign: null, status: 'done', notes: [], steps: [], companions: [], ...o });

describe('keep in touch', () => {
  it('takes the latest of dated notes, finished quests and past events', () => {
    const who = c('sophie', { notes: [{ t: 'a', date: '2026-10-01' }, { t: 'future', date: '2026-12-25' }] });
    const d = { quests: [quest({ companions: ['sophie'], doneOn: '2026-10-20' })], events: [ev({ start: '2026-10-30', end: '2026-10-30', companions: ['sophie'] }), ev({ id: 2, start: '2026-11-20', end: '2026-11-20', companions: ['sophie'] })] };
    expect(lastContact(d, who, T)).toBe('2026-10-30');
    expect(lastContact({ quests: [], events: [] }, c('x'), T)).toBeNull();
  });
  it('lists who is overdue, longest first, honouring Later and the day the rhythm was set', () => {
    const d = { quests: [], events: [], companions: [
      c('a', { rhythm: 'week', rhythmSince: '2026-10-01' }),
      c('b', { rhythm: 'month', rhythmSince: '2026-10-01', notes: [{ t: 'talked', date: '2026-11-10' }] }),
      c('c', { rhythm: 'week', rhythmSince: '2026-10-20' }),
      c('d', { rhythm: 'week', rhythmSince: '2026-10-01', later: '2026-11-15' }),
      c('e', { rhythm: 'quarter', rhythmSince: '2026-11-01' }),
    ] };
    expect(overdueContacts(d, T).map((o) => o.c.id)).toEqual(['a', 'c']);
  });
  it('works out age from the birth year and birthday', () => {
    expect(ageOf({ birthYear: 1990, bday: '03-14' }, T)).toBe(36);
    expect(ageOf({ birthYear: 1990, bday: '12-14' }, T)).toBe(35);
    expect(ageOf({ bday: '12-14' }, T)).toBeNull();
  });
});

describe('groups in quick add', () => {
  const data = { camps: {}, companions: [c('sophie', { groups: ['Family'] }), c('tom', { groups: ['Family', 'Football'] }), c('daan', { groups: ['Colleagues'] })] };
  it('#family adds everyone in the group, #sophie one person', () => {
    expect(parseQuickAdd('Plan dinner #family', data, T).companions).toEqual(['sophie', 'tom']);
    expect(parseQuickAdd('Call #sophie', data, T).companions).toEqual(['sophie']);
    expect(parseQuickAdd('x #nobody', data, T).chips[0].kind).toBe('warn');
  });
});
