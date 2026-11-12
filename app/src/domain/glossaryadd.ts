// One-line Glossary entry: "Ring about the party @sophie fri", "Dune #books" or just "Renew passport 3 oct".
import { weekdayDate } from './dates';
import type { Data, Note } from './model';
import { findNote } from './notes';
import { readDate } from './quickadd';

export interface GlossaryChip { kind: 'companion' | 'tome' | 'date' | 'note' | 'warn'; label: string }
export interface GlossaryParse {
  /** The text without @, # and date tokens. */
  title: string;
  /** The text with its date words kept, for targets that have no date (tome items). */
  plain: string;
  companions: string[];
  tomes: string[];
  date?: string;
  chips: GlossaryChip[];
}

export const REMINDERS = 'Reminders';

/** The word that picks a companion with @ or a tome with #. */
export const companionWord = (c: { first: string }) => c.first;
export const tomeWord = (t: { name: string }) => t.name.trim().split(/\s+/)[0] ?? '';

export const matchCompanions = (data: Pick<Data, 'companions'>, q: string) =>
  data.companions.filter((c) => c.first.toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q));
export const matchTomes = (data: Pick<Data, 'tomes'>, q: string) =>
  data.tomes.filter((t) => t.name.toLowerCase().split(/\s+/).some((p) => p.startsWith(q)));

export function parseGlossaryAdd(text: string, data: Pick<Data, 'companions' | 'tomes'>, today: string): GlossaryParse {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: GlossaryParse = { title: '', plain: '', companions: [], tomes: [], chips: [] };
  const title: string[] = [], plain: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i], sym = w[0], rest = w.slice(1).toLowerCase();
    if (sym === '@' && rest) {
      const c = matchCompanions(data, rest)[0];
      if (c) { if (!out.companions.includes(c.id)) { out.companions.push(c.id); out.chips.push({ kind: 'companion', label: c.name }); } continue; }
      out.chips.push({ kind: 'warn', label: 'No companion “' + rest + '”' });
    } else if (sym === '#' && rest) {
      const t = matchTomes(data, rest)[0];
      if (t) { if (!out.tomes.includes(t.id)) { out.tomes.push(t.id); out.chips.push({ kind: 'tome', label: t.name }); } continue; }
      out.chips.push({ kind: 'warn', label: 'No tome “' + rest + '”' });
    } else if (!out.date) {
      const d = readDate(words, i, today);
      if (d) {
        out.date = d[0]; out.chips.push({ kind: 'date', label: weekdayDate(d[0]) });
        plain.push(...words.slice(i, i + d[1])); i += d[1] - 1; continue;
      }
    }
    title.push(w); plain.push(w);
  }
  out.title = title.join(' ');
  out.plain = plain.join(' ');
  if (!out.companions.length && !out.tomes.length) out.chips.push({ kind: 'note', label: 'Note · ' + REMINDERS });
  return out;
}

/** Adds the entry to every companion and tome it names, or to the Reminders note (made if missing). */
export function applyGlossaryAdd(d: Data, p: GlossaryParse, now: number): Data {
  const title = p.title || p.plain;
  if (!title) return d;
  let next = d;
  if (p.companions.length) {
    next = { ...next, companions: next.companions.map((c) => (p.companions.includes(c.id)
      ? { ...c, notes: [...c.notes, p.date ? { t: title, date: p.date, label: c.first + ' → ' + title } : { t: title }] }
      : c)) };
  }
  if (p.tomes.length) {
    next = { ...next, tomes: next.tomes.map((t) => (p.tomes.includes(t.id) ? { ...t, items: [...t.items, { id: now, t: p.plain, done: false }] } : t)) };
  }
  if (!p.companions.length && !p.tomes.length) {
    const line = p.date ? title + ' @' + p.date : title;
    const has = findNote(next.notes, REMINDERS);
    const notes: Note[] = has
      ? next.notes.map((n) => (n === has ? { ...n, body: n.body ? n.body + '\n' + line : line } : n))
      : [...next.notes, { id: 'n' + now, title: REMINDERS, body: line, icon: 'calendar', pinned: false, created: now }];
    next = { ...next, notes };
  }
  return next;
}
