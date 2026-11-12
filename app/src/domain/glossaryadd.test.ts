import { describe, expect, it } from 'vitest';
import { applyGlossaryAdd, parseGlossaryAdd } from './glossaryadd';
import { emptyData } from './model';
import type { Data } from './model';

const T = '2026-09-25'; // a Friday
const base = (): Data => ({
  ...emptyData(),
  companions: [{ id: 'sophie', name: 'Sophie de Vries', first: 'Sophie', rel: '', bday: '', notes: [] }],
  tomes: [{ id: 'b', name: 'Books to read', items: [] }],
});
const run = (s: string, d = base()) => applyGlossaryAdd(d, parseGlossaryAdd(s, d, T), 99);

describe('Glossary quick add', () => {
  it('adds a dated note to a companion picked with @', () => {
    const d = run('Call about the party @sophie fri');
    expect(d.companions[0].notes).toEqual([{ t: 'Call about the party', date: '2026-09-25', label: 'Sophie → Call about the party' }]);
    expect(d.notes).toHaveLength(0);
  });

  it('adds an item to a tome picked with # and keeps its date words', () => {
    const d = run('Dune fri #books');
    expect(d.tomes[0].items).toEqual([{ id: 99, t: 'Dune fri', done: false }]);
    expect(d.notes).toHaveLength(0);
  });

  it('files into every target named', () => {
    const d = run('Gift idea @sophie #books');
    expect(d.companions[0].notes).toHaveLength(1);
    expect(d.tomes[0].items).toHaveLength(1);
  });

  it('creates the Reminders note when neither is named, then reuses it', () => {
    let d = run('Renew passport 3 oct');
    expect(d.notes).toHaveLength(1);
    expect(d.notes[0]).toMatchObject({ title: 'Reminders', body: 'Renew passport @2026-10-03' });
    d = run('Buy stamps', d);
    expect(d.notes).toHaveLength(1);
    expect(d.notes[0].body).toBe('Renew passport @2026-10-03\nBuy stamps');
  });

  it('warns about unknown names and falls back to Reminders', () => {
    const r = parseGlossaryAdd('Hello @nobody', base(), T);
    expect(r.chips.map((c) => c.kind)).toEqual(['warn', 'note']);
    expect(r.title).toBe('Hello @nobody');
  });
});
