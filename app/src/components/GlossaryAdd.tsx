import { useState } from 'react';
import { applyGlossaryAdd, companionWord, matchCompanions, matchTomes, parseGlossaryAdd, REMINDERS, tomeWord } from '../domain/glossaryadd';
import { useStore } from '../state/store';
import { Icon } from './Icon';

const HELP = [
  ['@sophie', 'companion: adds a note to their page'],
  ['#books', 'tome: adds an item to the list'],
  ['fri', 'date (companion notes and Reminders): today, tomorrow, mon–sun, 3 oct, +3d, +2w'],
  ['neither', 'goes to the “' + REMINDERS + '” codex entry, made if it is missing'],
];

/** A one-line bar for the Glossary: "Ring about the party @sophie fri", "Dune #books" or "Renew passport 3 oct". */
export function GlossaryAdd() {
  const { data, today, actions, showToast } = useStore();
  const [text, setText] = useState('');
  const [help, setHelp] = useState(false);
  const parsed = parseGlossaryAdd(text, data, today);
  const canAdd = !!(parsed.title || parsed.plain);

  // The word being typed, if it starts a @companion or #tome pick.
  const last = /(^|\s)([@#])(\S*)$/.exec(text);
  const q = last ? last[3].toLowerCase() : '';
  const picks = !last ? [] : last[2] === '@'
    ? matchCompanions(data, q).slice(0, 6).map((c) => ({ key: c.id, label: c.name, sub: c.rel, word: companionWord(c) }))
    : matchTomes(data, q).slice(0, 6).map((t) => ({ key: t.id, label: t.name, sub: t.items.length + ' items', word: tomeWord(t) }));
  const pick = (word: string) => setText(text.slice(0, last!.index + last![1].length) + last![2] + word + ' ');

  const add = () => {
    if (!canAdd) return;
    actions.update((d) => applyGlossaryAdd(d, parsed, Date.now()));
    const names = [
      ...parsed.companions.map((id) => data.companions.find((c) => c.id === id)?.name),
      ...parsed.tomes.map((id) => data.tomes.find((t) => t.id === id)?.name),
    ].filter(Boolean);
    showToast('Added to the Glossary', names.length ? names.join(', ') : REMINDERS);
    setText('');
  };
  return (
    <div className="quick-add" style={{ position: 'relative', maxWidth: 760 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: 'var(--color-accent-700)', paddingLeft: 10 }}><Icon n="plus" size={17} /></span>
        <input className="quick-input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Quick add to the Glossary" enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === 'Enter') { if (picks.length) pick(picks[0].word); else add(); } }}
          placeholder="Quick add: Ring about the party @sophie fri" />
        <button className="icon-btn" onClick={() => setHelp(!help)} aria-label="Quick add help" aria-expanded={help} style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>?</button>
        {text.trim() && <button className="btn btn-primary inked" onClick={add} disabled={!canAdd} style={{ minHeight: 36, marginRight: 4 }}>Add</button>}
      </div>
      {picks.length > 0 && (
        <ul className="qa-menu" role="listbox" aria-label={last![2] === '@' ? 'Companions' : 'Tomes'}>
          {picks.map((p) => (
            <li key={p.key} role="option" aria-selected={false}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p.word)}>
                <Icon n={last![2] === '@' ? 'users' : 'library'} size={14} />
                <span className="heading">{p.label}</span>
                {p.sub && <span className="muted">{p.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(help || (text.trim() !== '' && parsed.chips.length > 0)) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 10px 8px' }}>
          {text.trim() !== '' && parsed.chips.map((c, i) => <span key={i} className={'qa-chip' + (c.kind === 'warn' ? ' warn' : '')}>{c.label}</span>)}
          {help && (
            <dl className="qa-help">
              {HELP.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
