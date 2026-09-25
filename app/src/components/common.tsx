import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { dayDiff, dueLabel } from '../domain/dates';
import type { Campaign, Hero, Quest } from '../domain/model';
import { heroName, QM, reward } from '../domain/model';
import { Icon } from './Icon';

/** Display fields shared by every quest card. */
export function questView(q: Quest, today: string, camps: Record<string, Campaign>) {
  const r = reward(q);
  const c = q.campaign ? camps[q.campaign] : undefined;
  const done = q.status === 'done';
  const overdue = !!q.due && dayDiff(q.due, today) < 0;
  return {
    ...r,
    done,
    hasDue: !!q.due && !done,
    dueLabel: q.due ? dueLabel(q.due, today) : '',
    dueColor: overdue ? 'var(--q-wax)' : 'var(--color-accent-800)',
    campaignName: c ? c.short : '',
    quad: QM[q.quad],
  };
}

export const byDue = (a: Quest, b: Quest) => (a.due || '9999').localeCompare(b.due || '9999');

export function Kicker({ children }: { children: ReactNode }) {
  return <span className="kicker">{children}</span>;
}

export function ScreenHead({ kicker, title, children }: { kicker: ReactNode; title: string; children?: ReactNode }) {
  return (
    <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div className="screen-head">
        <Kicker>{kicker}</Kicker>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Seg<T extends string>({ name, options, value, onChange, optStyle, style }: {
  name: string; options: { key: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; optStyle?: CSSProperties; style?: CSSProperties;
}) {
  return (
    <div className="seg" style={style} role="radiogroup">
      {options.map((o) => (
        <label key={o.key} className="seg-opt" style={optStyle}>
          <input type="radio" name={name} checked={value === o.key} onChange={() => onChange(o.key)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-body">
          <span className="grabber" />
          {children}
        </div>
      </div>
    </>
  );
}

export function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn-icon btn-ghost inked" onClick={onClick} aria-label="Close" style={{ width: 40, height: 40 }}>
      <Icon n="x" size={19} />
    </button>
  );
}

export function CompleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="complete-btn" onClick={onClick}>
      <span className="seal" style={{ width: 30, height: 30, boxShadow: 'inset 0 0 0 2px var(--q-wax), inset 0 0 0 3px rgba(255,230,200,.35)' }}>
        <Icon n="check" size={16} stroke={2.4} />
      </span>
      {label}
    </button>
  );
}

export function DoneBanner({ onReopen }: { onReopen: () => void }) {
  return (
    <div className="done-banner">
      <span className="heading" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
        <Icon n="check" size={18} stroke={2.2} />Quest complete
      </span>
      <button className="btn btn-ghost inked" onClick={onReopen}>Reopen</button>
    </div>
  );
}

/** Enter submits in single-line add fields. */
export const onEnter = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter') fn(); };

/** The hero's portrait: their picture if they chose one, otherwise a monogram. */
export function Portrait({ hero, size, fontSize }: { hero: Hero; size: number; fontSize: number }) {
  return (
    <span className="portrait" style={{ width: size, height: size, fontSize, overflow: 'hidden' }}>
      {hero.portrait
        ? <img src={hero.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', padding: 5 }} />
        : heroName(hero)[0]}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted" style={{ margin: 0, padding: '14px 0', fontStyle: 'italic', fontSize: 14 }}>{children}</p>;
}

/** A dashed "add" button that opens an inline form; onSave returns false to keep the form open. */
export function AddForm({ label, children, onSave, onCancel, invalid }: { label: string; children: ReactNode; onSave: () => boolean; onCancel: () => void; invalid: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button className="dashed-btn" onClick={() => setOpen(true)} style={{ gap: 8, minHeight: 50, marginTop: 10, fontSize: 17 }}><Icon n="plus" size={17} />{label}</button>;
  }
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, padding: 14 }}>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => { onCancel(); setOpen(false); }} style={{ minHeight: 42 }}>Cancel</button>
        <button className="btn btn-primary inked" onClick={() => { if (onSave()) setOpen(false); }} disabled={invalid} style={{ minHeight: 42 }}>Add</button>
      </div>
    </div>
  );
}

