import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickadd';
import type { Data } from './model';

const T = '2026-09-25'; // a Friday
const data: Pick<Data, 'camps' | 'companions'> = {
  camps: { reno: { name: 'Renovate the study', short: 'Renovate', desc: '', xp: 250, gold: 100, seal: 'Seal', icon: 'home' } },
  companions: [
    { id: 'sophie', name: 'Sophie de Vries', first: 'Sophie', rel: '', bday: '', notes: [] },
    { id: 'tom', name: 'Tom', first: 'Tom', rel: '', bday: '', notes: [] },
  ],
};
const p = (s: string) => parseQuickAdd(s, data, T);

describe('parseQuickAdd', () => {
  it('reads every kind of token and keeps the rest as the title', () => {
    const r = p('Paint walls !main @study fri ~L #sophie');
    expect(r).toMatchObject({ title: 'Paint walls', quad: 'main', campaign: 'reno', due: '2026-09-25', size: 'L', companions: ['sophie'] });
    expect(r.chips.map((c) => c.kind)).toEqual(['zone', 'campaign', 'date', 'size', 'companion']);
  });

  it('knows zone shorthands', () => {
    expect(p('x !c').quad).toBe('crisis');
    expect(p('x !errands').quad).toBe('errand');
    expect(p('x !s').quad).toBe('side');
  });

  it('reads dates', () => {
    expect(p('x today').due).toBe(T);
    expect(p('x tomorrow').due).toBe('2026-09-26');
    expect(p('x mon').due).toBe('2026-09-28');
    expect(p('x +3d').due).toBe('2026-09-28');
    expect(p('x +2w').due).toBe('2026-10-09');
    expect(p('x 3 oct').due).toBe('2026-10-03');
    expect(p('x oct 3').due).toBe('2026-10-03');
    expect(p('x 1 jan').due).toBe('2027-01-01');
    expect(p('x 2026-12-01').due).toBe('2026-12-01');
    expect(p('Call mom tomorrow').title).toBe('Call mom');
  });

  it('links several companions, once each', () => {
    expect(p('Dinner #sophie #tom #sop').companions).toEqual(['sophie', 'tom']);
  });

  it('keeps unknown symbols in the title and warns', () => {
    const r = p('Fix #9 @nowhere !x');
    expect(r.title).toBe('Fix #9 @nowhere !x');
    expect(r.chips.filter((c) => c.kind === 'warn').map((c) => c.label)).toEqual(['No companion “9”', 'No campaign “nowhere”', 'No zone “x”']);
  });

  it('leaves ordinary words alone', () => {
    expect(p('Mail the letter to Marchant').title).toBe('Mail the letter to Marchant');
    expect(p('Mail the letter to Marchant').due).toBeUndefined();
    expect(p('Call Tom').due).toBeUndefined();
  });
});
