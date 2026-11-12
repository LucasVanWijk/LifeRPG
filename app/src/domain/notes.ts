// Notes: free-form text with a little formatting, and the conversion of old Codex entries into notes.
import type { IconName } from '../components/Icon';
import type { Note } from './model';

// Legacy shape of the Codex, only used to migrate it.
export interface CodexField { k: string; v: string; date?: string; label?: string }
export interface CodexEntry { id: string; name: string; sub: string; icon: IconName; fields: CodexField[] }

/** A line that ends in `@2026-12-01` is a dated line: it shows on the calendar and the Home week. */
const DATED = /^(.*?)\s*@(\d{4}-\d{2}-\d{2})\s*$/;

export interface DatedLine { date: string; label: string; line: number }
export function datedLines(body: string): DatedLine[] {
  const out: DatedLine[] = [];
  body.split('\n').forEach((raw, line) => {
    const m = DATED.exec(raw);
    if (!m) return;
    // Strip list and checkbox markers from the label.
    const label = m[1].replace(/^\s*(?:[-*]\s+)?(?:\[[ xX]\]\s+)?/, '').trim();
    if (label) out.push({ date: m[2], label, line });
  });
  return out;
}

/** Each Codex entry becomes a note: the subtitle is the first line, each field a `Label: value` line, dated fields dated lines. */
export function codexToNotes(codex: CodexEntry[], now: number): Note[] {
  return codex.map((x, i) => {
    const lines: string[] = [];
    if (x.sub?.trim()) lines.push(x.sub.trim());
    for (const f of x.fields ?? []) {
      const text = f.v && f.v !== f.k ? f.k + ': ' + f.v : f.k;
      lines.push(f.date ? text + ' @' + f.date : text);
    }
    return { id: 'n' + x.id, title: x.name, body: lines.join('\n'), icon: x.icon, pinned: false, created: now - i, updated: now };
  });
}

export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'item'; checked: boolean | null; text: string; line: number }
  | { kind: 'para'; text: string };

/** Splits a body into blocks: `#` headings, `-` lists, `[ ]` checkboxes and plain paragraphs. */
export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  body.split('\n').forEach((raw, line) => {
    const h = /^(#{1,3})\s+(.*)$/.exec(raw);
    if (h) { out.push({ kind: 'heading', level: h[1].length, text: h[2] }); return; }
    const c = /^\s*(?:[-*]\s+)?\[( |x|X)\]\s?(.*)$/.exec(raw);
    if (c) { out.push({ kind: 'item', checked: c[1] !== ' ', text: c[2], line }); return; }
    const l = /^\s*[-*]\s+(.*)$/.exec(raw);
    if (l) { out.push({ kind: 'item', checked: null, text: l[1], line }); return; }
    if (raw.trim()) out.push({ kind: 'para', text: raw });
  });
  return out;
}

/** Flips the checkbox on a line of the body. */
export function toggleCheckbox(body: string, line: number): string {
  const lines = body.split('\n');
  lines[line] = (lines[line] ?? '').replace(/\[( |x|X)\]/, (_, c: string) => (c === ' ' ? '[x]' : '[ ]'));
  return lines.join('\n');
}

/** The note a title names (case-insensitive), if any. */
export const findNote = (notes: Note[], title: string) => notes.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());

/** A note's title and body matching a search. */
export const noteMatches = (n: Note, q: string) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);

/** Pinned first, then most recently changed. */
export const sortNotes = (notes: Note[]) =>
  [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated ?? b.created) - (a.updated ?? a.created));

export type Segment = { t: 'text'; v: string } | { t: 'bold'; v: string } | { t: 'link'; v: string; href: string };
const LINK = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]|www\.[^\s<>"]+[^\s<>".,;:!?)\]]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\+?\d[\d ()-]{7,}\d)/g;

/** Links in a line: web addresses, email addresses and phone numbers. `**bold**` is picked out when `bold` is set. */
export function segments(text: string, bold = false): Segment[] {
  const out: Segment[] = [];
  const parts = bold ? text.split(/(\*\*[^*]+\*\*)/g) : [text];
  for (const p of parts) {
    if (bold && /^\*\*[^*]+\*\*$/.test(p)) { out.push({ t: 'bold', v: p.slice(2, -2) }); continue; }
    let last = 0;
    for (const m of p.matchAll(LINK)) {
      const s = m[0], i = m.index ?? 0;
      const digits = s.replace(/\D/g, '');
      const isPhone = /^\+?\d/.test(s) && !s.includes('@') && !/^(https?|www)/i.test(s);
      // Dates like 2026-12-01 are not phone numbers.
      if (isPhone && (digits.length < 8 || digits.length > 15 || /^\d{4}-\d{2}-\d{2}$/.test(s))) continue;
      if (i > last) out.push({ t: 'text', v: p.slice(last, i) });
      const href = s.includes('@') && !/^(https?|www)/i.test(s) ? 'mailto:' + s : isPhone ? 'tel:' + s.replace(/[^\d+]/g, '') : /^https?:/i.test(s) ? s : 'https://' + s;
      out.push({ t: 'link', v: s, href });
      last = i + s.length;
    }
    if (last < p.length) out.push({ t: 'text', v: p.slice(last) });
  }
  return out;
}

/** Has anything in this text that would become a link? */
export const hasLink = (text: string) => segments(text).some((s) => s.t === 'link');
export const firstLink = (text: string) => segments(text).find((s): s is Extract<Segment, { t: 'link' }> => s.t === 'link');

/** A maps search for a place (an event's location). */
export const mapsUrl = (place: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);
