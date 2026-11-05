import { useState } from 'react';
import { parseQuickAdd } from '../domain/quickadd';
import { useStore } from '../state/store';
import { Icon } from './Icon';

const HELP = [
  ['!main', 'zone: !crisis !main !errand !side, or !c !m !e !s'],
  ['@study', 'campaign (any word of its name)'],
  ['fri', 'due: today, tomorrow, mon–sun, 3 oct, +3d, +2w'],
  ['~L', 'size S, M or L'],
  ['#Sophie', 'companion (repeat for more)'],
];

/** A one-line bar that pins a quest straight away: "Paint walls !main @study fri ~L #Sophie". */
export function QuickAdd() {
  const { data, today, actions } = useStore();
  const [text, setText] = useState('');
  const [help, setHelp] = useState(false);
  const parsed = parseQuickAdd(text, data, today);
  const pin = () => {
    if (!parsed.title) return;
    actions.createQuest({
      title: parsed.title, quad: parsed.quad ?? 'side', due: parsed.due ?? null, size: parsed.size ?? 'M',
      campaign: parsed.campaign ?? null, status: 'todo', notes: [], steps: [], companions: parsed.companions,
    });
    setText('');
  };
  return (
    <div className="quick-add">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: 'var(--color-accent-700)', paddingLeft: 10 }}><Icon n="plus" size={17} /></span>
        <input className="quick-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pin()}
          placeholder="Quick add: Paint walls !main fri ~L" aria-label="Quick add a quest" enterKeyHint="done" />
        <button className="icon-btn" onClick={() => setHelp(!help)} aria-label="Quick add help" aria-expanded={help} style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>?</button>
        {text.trim() && <button className="btn btn-primary inked" onClick={pin} disabled={!parsed.title} style={{ minHeight: 36, marginRight: 4 }}>Pin</button>}
      </div>
      {(parsed.chips.length > 0 || help) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 10px 8px' }}>
          {parsed.chips.map((c, i) => <span key={i} className={'qa-chip' + (c.kind === 'warn' ? ' warn' : '')}>{c.label}</span>)}
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
