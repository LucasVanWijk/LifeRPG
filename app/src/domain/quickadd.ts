// One-line quest entry: "Paint walls !main @study fri ~L #Sophie".
import { addDays, isoDay, parseDay, weekdayDate } from './dates';
import type { Data, QuadKey, SizeKey } from './model';
import { QM, QUADS } from './model';

export interface QuickChip { kind: 'zone' | 'campaign' | 'date' | 'size' | 'companion' | 'warn'; label: string }
export interface QuickParse {
  title: string;
  quad?: QuadKey;
  campaign?: string;
  due?: string;
  size?: SizeKey;
  companions: string[];
  chips: QuickChip[];
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const ZONE_WORDS: Record<string, QuadKey> = { c: 'crisis', crisis: 'crisis', m: 'main', main: 'main', e: 'errand', errand: 'errand', errands: 'errand', s: 'side', side: 'side' };

const month = (w: string) => (w.length >= 3 ? MONTHS.findIndex((m) => m.startsWith(w)) : -1);
const dayNum = (w: string) => (/^\d{1,2}$/.test(w) && +w >= 1 && +w <= 31 ? +w : 0);

/** The next date (today or later) that falls on this day of this month. */
function nextDate(m: number, d: number, today: string): string {
  const t = parseDay(today);
  let date = new Date(t.getFullYear(), m, d);
  if (isoDay(date) < today) date = new Date(t.getFullYear() + 1, m, d);
  return isoDay(date);
}

/** Reads one date starting at token i; returns the date and how many tokens it used. */
function readDate(words: string[], i: number, today: string): [string, number] | null {
  const w = words[i].toLowerCase();
  if (w === 'today' || w === 'tod') return [today, 1];
  if (w === 'tomorrow' || w === 'tmr') return [addDays(today, 1), 1];
  const wd = w.length >= 3 ? WEEKDAYS.findIndex((d) => d.startsWith(w)) : -1;
  if (wd >= 0) return [addDays(today, (wd - parseDay(today).getDay() + 7) % 7), 1];
  const rel = /^\+(\d{1,3})([dw])$/.exec(w);
  if (rel) return [addDays(today, +rel[1] * (rel[2] === 'w' ? 7 : 1)), 1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(w) && !isNaN(parseDay(w).getTime())) return [w, 1];
  const next = words[i + 1]?.toLowerCase();
  if (next !== undefined) {
    if (dayNum(w) && month(next) >= 0) return [nextDate(month(next), dayNum(w), today), 2];
    if (month(w) >= 0 && dayNum(next)) return [nextDate(month(w), dayNum(next), today), 2];
  }
  return null;
}

export function parseQuickAdd(text: string, data: Pick<Data, 'camps' | 'companions'>, today: string): QuickParse {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: QuickParse = { title: '', companions: [], chips: [] };
  const title: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i], sym = w[0], rest = w.slice(1).toLowerCase();
    if (sym === '!' && rest) {
      const q = ZONE_WORDS[rest] ?? QUADS.find((z) => z.key.startsWith(rest) || z.name.toLowerCase().startsWith(rest))?.key;
      if (q && !out.quad) { out.quad = q; out.chips.push({ kind: 'zone', label: QM[q].name }); continue; }
      if (!q) out.chips.push({ kind: 'warn', label: 'No zone “' + rest + '”' });
    } else if (sym === '@' && rest) {
      const hit = Object.entries(data.camps).find(([, c]) => c.name.toLowerCase().split(/\s+/).some((p) => p.startsWith(rest)));
      if (hit && !out.campaign) { out.campaign = hit[0]; out.chips.push({ kind: 'campaign', label: hit[1].name }); continue; }
      if (!hit) out.chips.push({ kind: 'warn', label: 'No campaign “' + rest + '”' });
    } else if (sym === '~' && /^[sml]$/.test(rest)) {
      out.size = rest.toUpperCase() as SizeKey;
      out.chips.push({ kind: 'size', label: 'Size ' + out.size });
      continue;
    } else if (sym === '#' && rest) {
      const c = data.companions.find((x) => x.first.toLowerCase().startsWith(rest) || x.name.toLowerCase().startsWith(rest));
      if (c) {
        if (!out.companions.includes(c.id)) { out.companions.push(c.id); out.chips.push({ kind: 'companion', label: c.name }); }
        continue;
      }
      out.chips.push({ kind: 'warn', label: 'No companion “' + rest + '”' });
    } else if (!out.due) {
      const d = readDate(words, i, today);
      if (d) { out.due = d[0]; out.chips.push({ kind: 'date', label: weekdayDate(d[0]) }); i += d[1] - 1; continue; }
    }
    title.push(w);
  }
  out.title = title.join(' ');
  return out;
}
