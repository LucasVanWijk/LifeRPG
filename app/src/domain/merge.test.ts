import { describe, expect, it } from 'vitest';
import { advance, found, payReal, setChampion } from './guild/engine';
import { PHASE_MS } from './guild/content';
import { mergeData, pruneTombstones, stamp } from './merge';
import type { Data, Quest } from './model';
import { emptyData } from './model';

const quest = (id: number, o: Partial<Quest> = {}): Quest => ({ id, title: 'Q' + id, quad: 'side', due: null, size: 'M', campaign: null, status: 'todo', notes: [], steps: [], companions: [], ...o });
const log = (o: Partial<Data> = {}): Data => ({ ...emptyData(), ...o });

describe('stamp', () => {
  it('stamps new and changed items, and records deletions', () => {
    const a = log({ quests: [quest(1), quest(2)] });
    const s1 = stamp(emptyData(), a, 100);
    expect(s1.quests.map((q) => q.updated)).toEqual([100, 100]);
    const b = { ...s1, quests: [{ ...s1.quests[0], due: '2026-01-01' }] };
    const s2 = stamp(s1, b, 200);
    expect(s2.quests[0].updated).toBe(200);
    expect(s2.quests[0].fu).toMatchObject({ due: 200, title: 100 });
    expect(s2.tombstones).toEqual([{ key: 'quest:2', at: 200 }]);
  });
  it('leaves untouched items alone', () => {
    const a = stamp(emptyData(), log({ quests: [quest(1), quest(2)] }), 100);
    const b = { ...a, quests: [a.quests[0], { ...a.quests[1], title: 'x' }] };
    const s = stamp(a, b, 300);
    expect(s.quests[0].updated).toBe(100);
    expect(s.quests[1].updated).toBe(300);
  });
});

describe('mergeData', () => {
  const base = stamp(emptyData(), log({ quests: [quest(1)] }), 100);
  it('merges quest fields separately', () => {
    const phone = stamp(base, { ...base, quests: [{ ...base.quests[0], due: '2026-05-01' }] }, 200);
    const laptop = stamp(base, { ...base, quests: [{ ...base.quests[0], notes: [{ id: 1, t: 'hi' }] }] }, 300);
    const m = mergeData(phone, laptop, 400).quests[0];
    expect(m.due).toBe('2026-05-01');
    expect(m.notes).toHaveLength(1);
  });
  it('lets the newer edit of one field win', () => {
    const a = stamp(base, { ...base, quests: [{ ...base.quests[0], title: 'A' }] }, 200);
    const b = stamp(base, { ...base, quests: [{ ...base.quests[0], title: 'B' }] }, 300);
    expect(mergeData(a, b, 400).quests[0].title).toBe('B');
    expect(mergeData(b, a, 400).quests[0].title).toBe('B');
  });
  it('lets a newer deletion win, and a newer edit beat an older deletion', () => {
    const deleted = stamp(base, { ...base, quests: [] }, 200);
    expect(mergeData(base, deleted, 300).quests).toHaveLength(0);
    expect(mergeData(deleted, base, 300).quests).toHaveLength(0);
    const edited = stamp(base, { ...base, quests: [{ ...base.quests[0], title: 'again' }] }, 500);
    expect(mergeData(edited, deleted, 600).quests).toHaveLength(1);
  });
  it('unions habit check-ins', () => {
    const h = { id: 1, title: 'Run', every: 'daily' as const, size: 'S' as const, log: ['2026-01-01'], created: '2026-01-01' };
    const b0 = stamp(emptyData(), log({ habits: [h] }), 100);
    const a = stamp(b0, { ...b0, habits: [{ ...b0.habits[0], log: ['2026-01-01', '2026-01-02'] }] }, 200);
    const b = stamp(b0, { ...b0, habits: [{ ...b0.habits[0], log: ['2026-01-01', '2026-01-03'] }] }, 210);
    expect(mergeData(a, b, 300).habits[0].log).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
  it('keeps items only one side has', () => {
    const a = stamp(emptyData(), log({ quests: [quest(1)] }), 100);
    const b = stamp(emptyData(), log({ quests: [quest(2)] }), 100);
    expect(mergeData(a, b, 200).quests.map((q) => q.id).sort()).toEqual([1, 2]);
  });
  it('prunes old tombstones', () => {
    const day = 86_400_000;
    expect(pruneTombstones([{ key: 'quest:1', at: 0 }, { key: 'quest:2', at: 70 * day }], 100 * day)).toEqual([{ key: 'quest:2', at: 70 * day }]);
  });
});

describe('mergeData guild', () => {
  const NOW = Date.UTC(2026, 10, 5, 12);
  const founding = { name: 'T', town: 'Testwick', charter: 'martial' as const, crestSeed: 1, seed: 42 };
  const mk = () => {
    const g = found(founding, NOW);
    const r = setChampion(g, g.adventurers[0].id);
    if (!r.ok) throw new Error(r.reason);
    return r.guild;
  };
  const pay = (key: string) => ({ key, xp: 40, gold: 13, kind: 'quest' as const, title: 'x', date: '2026-11-05', attr: 'main' as const, notable: false });
  it('keeps a payment made on the other device, once', () => {
    const g0 = mk();
    const phone = payReal(g0, pay('q:1')).guild;
    const laptop = advance(g0, NOW + 3 * PHASE_MS).guild; // ran further, but never saw the payment
    const q = { ...quest(1), status: 'done' as const, doneOn: '2026-11-05' };
    const a = stamp(emptyData(), log({ quests: [q], guild: phone }), 100);
    const b = stamp(emptyData(), log({ quests: [q], guild: laptop }), 100);
    const m = mergeData(b, a, 200);
    expect(m.guild!.t).toBe(laptop.t);
    expect(m.guild!.ledger.filter((e) => e.key === 'q:1')).toHaveLength(1);
    expect(mergeData(m, a, 300).guild!.ledger.filter((e) => e.key === 'q:1')).toHaveLength(1);
  });
  it('does not pay for a quest that was reopened', () => {
    const g0 = mk();
    const phone = payReal(g0, pay('q:1')).guild;
    const laptop = advance(g0, NOW + 3 * PHASE_MS).guild;
    const a = stamp(emptyData(), log({ quests: [{ ...quest(1), status: 'done' as const }], guild: phone }), 100);
    const b = stamp(emptyData(), log({ quests: [quest(1)], guild: laptop }), 200);
    expect(mergeData(b, a, 300).guild!.ledger).toHaveLength(0);
  });
});
