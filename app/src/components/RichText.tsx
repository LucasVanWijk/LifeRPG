import type { ReactNode } from 'react';
import { parseBody, segments, toggleCheckbox } from '../domain/notes';
import { Icon } from './Icon';

/** Text with its web addresses, email addresses and phone numbers made into links. Links open in a new tab. */
export function LinkText({ text, bold }: { text: string; bold?: boolean }) {
  return (
    <>
      {segments(text, bold).map((s, i) =>
        s.t === 'link'
          ? <a key={i} href={s.href} target="_blank" rel="noreferrer noopener" className="auto-link" onClick={(e) => e.stopPropagation()}>{s.v}</a>
          : s.t === 'bold' ? <strong key={i}>{s.v}</strong> : <span key={i}>{s.v}</span>)}
    </>
  );
}

/** A note's body: `#` headings, `-` lists, `[ ]` checkboxes (tickable), `**bold**`, dated lines marked, links clickable. */
export function NoteBody({ body, onChange }: { body: string; onChange?: (body: string) => void }) {
  const blocks = parseBody(body);
  if (!blocks.length) return <p className="muted" style={{ margin: 0, fontStyle: 'italic' }}>Nothing written yet.</p>;
  const dated = (t: string): ReactNode => {
    const m = /^(.*?)\s*@(\d{4}-\d{2}-\d{2})\s*$/.exec(t);
    return m ? <><LinkText text={m[1]} bold /><span className="pill" style={{ marginLeft: 8 }}><Icon n="calendar" size={12} />{m[2]}</span></> : <LinkText text={t} bold />;
  };
  return (
    <div className="note-body">
      {blocks.map((b, i) => {
        if (b.kind === 'heading') return <div key={i} className="heading" style={{ fontSize: b.level === 1 ? 24 : b.level === 2 ? 20 : 17, marginTop: i ? 10 : 0 }}>{dated(b.text)}</div>;
        if (b.kind === 'para') return <p key={i} style={{ margin: 0 }}>{dated(b.text)}</p>;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {b.checked === null
              ? <span className="bullet" style={{ marginTop: 9 }} />
              : <button onClick={() => onChange?.(toggleCheckbox(body, b.line))} disabled={!onChange} aria-pressed={b.checked} aria-label={(b.checked ? 'Untick ' : 'Tick ') + b.text}
                  style={{ border: 0, background: 'transparent', padding: 0, cursor: onChange ? 'pointer' : 'default', marginTop: 2 }}>
                  <span className={'checkbox' + (b.checked ? ' on' : '')} style={{ width: 19, height: 19 }}>{b.checked && <Icon n="check" size={13} stroke={2.4} />}</span>
                </button>}
            <span style={{ flex: 1, textDecoration: b.checked ? 'line-through' : 'none', color: b.checked ? 'var(--color-accent-700)' : undefined }}>{dated(b.text)}</span>
          </div>
        );
      })}
    </div>
  );
}
