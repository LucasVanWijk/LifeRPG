import { worst } from '../domain/guild/wounds';
import { useEffect, useState, type ReactNode } from 'react';
import type { Adventurer, Guild } from '../domain/guild/types';
import { BUILDINGS, CLASSES, RACES } from '../domain/guild/content';
import { fullName, ratingShown, realDuration } from '../domain/guild/adventurer';
import { effectiveDuty } from '../domain/guild/engine';
import { hash } from '../domain/guild/rng';
import { Crest } from './Crest';
import { Icon } from './Icon';

/** Game time now, refreshed every `ms` while shown, so countdowns move. */
export function useGameNow(guild: Guild | null, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return guild ? Math.max(guild.t, now - guild.founded) : 0;
}

export function Bar({ value, max = 100, color, label, height = 8 }: { value: number; max?: number; color: string; label: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="hp-bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemax={max} style={{ height }}>
      <div style={{ width: pct + '%', background: color }} />
    </div>
  );
}

export function Stars({ n, label = 'Talent' }: { n: number; label?: string }) {
  return (
    <span aria-label={label + ' ' + n + ' of 5'} title={label + ' ' + n + ' of 5'} style={{ letterSpacing: 1, color: 'var(--color-accent-600)', fontSize: 13, whiteSpace: 'nowrap' }}>
      {'★'.repeat(n)}<span style={{ opacity: 0.3 }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export const AdvCrest = ({ a, size = 40 }: { a: Adventurer; size?: number }) =>
  <Crest seed={hash(a.id, a.first, a.family)} charge={CLASSES[a.cls].icon} size={size} />;

export const advSub = (a: Adventurer) => 'Level ' + a.level + ' ' + CLASSES[a.cls].name + ' · ' + RACES[a.race].name;

/** Where they are and what they're doing, in a few words. */
export function status(g: Guild, a: Adventurer, phase: number, now: number): { text: string; tone: 'go' | 'rest' | 'bad' | 'away' | 'gone' } {
  if (a.state === 'passed') return { text: 'Passed away', tone: 'gone' };
  if (a.state === 'child') return { text: 'Growing up', tone: 'gone' };
  if (a.state === 'retired') {
    const post = a.staffAt ? g.buildings.find((b) => b.id === a.staffAt) : undefined;
    if (a.awayOn) { const o = g.outings.find((x) => x.id === a.awayOn); return { text: 'One last job' + (o ? ' · back in ' + realDuration(o.returnAt - now) : ''), tone: 'away' }; }
    return { text: post ? 'Retired · works at the ' + BUILDINGS[post.type].name : 'Retired', tone: 'gone' };
  }
  if (a.state === 'fallen') return { text: 'Fell' + (a.fellAt ? ' at ' + a.fellAt : ''), tone: 'gone' };
  if (a.state === 'left') return { text: 'Left the guild', tone: 'gone' };
  if (a.awayOn) {
    const o = g.outings.find((x) => x.id === a.awayOn);
    return { text: o ? o.offer.name + ' · back in ' + realDuration(o.returnAt - now) : 'Away', tone: 'away' };
  }
  const w = worst(a.wounds);
  if (w === 'major') return { text: 'Badly wounded', tone: 'bad' };
  if (w === 'minor') return { text: 'Wounded', tone: 'bad' };
  const duty = effectiveDuty(a, phase);
  return duty === 'rest' ? { text: 'Resting', tone: 'rest' } : { text: { train: 'Training', labour: 'Labouring', patrol: 'On patrol' }[duty], tone: 'go' };
}
const TONE = { go: 'var(--q-moss)', rest: 'var(--color-accent-700)', bad: 'var(--q-wax)', away: 'oklch(0.45 0.08 255)', gone: 'var(--color-accent-700)' };

export function AdvRow({ g, a, phase, now, onClick, right }: { g: Guild; a: Adventurer; phase: number; now: number; onClick: () => void; right?: ReactNode }) {
  const s = status(g, a, phase, now);
  const champ = g.championId === a.id;
  return (
    <button className="agenda-row" onClick={onClick} style={{ gap: 12, alignItems: 'center', padding: '10px 2px' }}>
      <AdvCrest a={a} size={36} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="heading" style={{ fontSize: 18, lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="ellipsis">{fullName(a)}</span>
          {champ && <span title="Champion" aria-label="Champion" style={{ color: 'var(--q-wax)' }}><Icon n="crown" size={14} /></span>}
        </span>
        <span className="meta" style={{ marginTop: 0 }}>
          <span>{advSub(a)}</span>
          <Stars n={a.talent} />
          <span style={{ color: TONE[s.tone] }}>{s.text}</span>
        </span>
        {a.state === 'active' && (
          <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxWidth: 260 }}>
            <Bar value={a.stamina} color="var(--q-moss)" label="Stamina" height={5} />
            <Bar value={a.fatigue} color="var(--color-accent-500)" label="Fatigue" height={5} />
          </span>
        )}
      </span>
      {right ?? <span className="heading tnum" title="Rating" style={{ fontSize: 18, color: 'var(--color-accent-800)' }}>{ratingShown(a)}</span>}
    </button>
  );
}
