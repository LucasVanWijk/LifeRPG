import { describe, expect, it } from 'vitest';
import { codexToNotes, datedLines, parseBody, segments, toggleCheckbox } from './notes';
import { migrate } from './migrate';

describe('notes', () => {
  it('turns a Codex entry into a note', () => {
    const [n] = codexToNotes([{ id: 'car', name: 'Car', sub: 'Golf, grey', icon: 'car', fields: [{ k: 'Plate', v: 'K-482-RD' }, { k: 'APK date', v: '29 Sep', date: '2026-09-29', label: 'Car → APK' }, { k: 'Reminder', v: '' }] }], 5);
    expect(n).toMatchObject({ id: 'ncar', title: 'Car', icon: 'car' });
    expect(n.body).toBe('Golf, grey\nPlate: K-482-RD\nAPK date: 29 Sep @2026-09-29\nReminder');
  });
  it('finds dated lines, ignoring list and checkbox markers', () => {
    expect(datedLines('hello\n- [ ] Pay rent @2026-12-01\nAPK date: x @2026-09-29').map((l) => [l.date, l.label])).toEqual([['2026-12-01', 'Pay rent'], ['2026-09-29', 'APK date: x']]);
  });
  it('parses headings, lists and checkboxes, and toggles a checkbox', () => {
    const body = '# Title\n- one\n[ ] two\n- [x] three\ntext';
    expect(parseBody(body).map((b) => b.kind + (b.kind === 'item' ? String(b.checked) : ''))).toEqual(['heading', 'itemnull', 'itemfalse', 'itemtrue', 'para']);
    expect(toggleCheckbox(body, 2).split('\n')[2]).toBe('[x] two');
    expect(toggleCheckbox(body, 3).split('\n')[3]).toBe('- [ ] three');
  });
  it('finds links, emails and phone numbers but not dates', () => {
    const s = segments('see https://example.com/a. mail me@x.nl or call 030 271 44 90, due 2026-12-01 and www.foo.org');
    expect(s.filter((x) => x.t === 'link').map((x) => (x as { href: string }).href)).toEqual(['https://example.com/a', 'mailto:me@x.nl', 'tel:0302714490', 'https://www.foo.org']);
  });
  it('picks out bold', () => {
    expect(segments('a **b** c', true).map((x) => x.t)).toEqual(['text', 'bold', 'text']);
  });
  it('migrates a Codex in an old log into notes', () => {
    const d = migrate({ version: 4, profile: {}, quests: [], habits: [], camps: {}, companions: [], tomes: [], events: [], codex: [{ id: 'x', name: 'Gym', sub: '', icon: 'pin', fields: [{ k: 'Code', v: '4471' }] }] }, '2026-10-01')!;
    expect(d.notes).toHaveLength(1);
    expect(d.notes[0]).toMatchObject({ title: 'Gym', body: 'Code: 4471' });
    expect('codex' in d).toBe(false);
  });
});
