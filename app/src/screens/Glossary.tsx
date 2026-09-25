import { useState, type ReactNode } from 'react';
import { dayDiff, MONL, nextAnnual, shortDate } from '../domain/dates';
import { glossaryEvents } from '../domain/logic';
import type { Companion, CodexEntry, Data } from '../domain/model';
import { CODEX_ICONS } from '../domain/model';
import { Icon, type IconName } from '../components/Icon';
import { onEnter, Seg } from '../components/common';
import { useStore, type GlossaryCat } from '../state/store';

export function Glossary() {
  const { data, ui, setUi } = useStore();
  const query = ui.gSearch.trim().toLowerCase();
  const [dType, dId] = (ui.gDetail || '').split(':');
  const companion = dType === 'companion' ? data.companions.find((c) => c.id === dId) : undefined;
  const codex = dType === 'codex' ? data.codex.find((x) => x.id === dId) : undefined;

  if (companion) return <div className="screen screen-narrow" style={{ gap: 16 }}><CompanionDetail c={companion} /></div>;
  if (codex) return <div className="screen screen-narrow" style={{ gap: 16 }}><CodexDetail x={codex} /></div>;

  return (
    <div className="screen screen-narrow" style={{ gap: 16 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="screen-head">
          <span className="kicker">Everything worth remembering</span>
          <h1>Glossary</h1>
        </div>
        <div className="search">
          <span><Icon n="search" size={17} /></span>
          <input className="input" type="search" placeholder="Search companions, tomes and codex" aria-label="Search the Glossary"
            value={ui.gSearch} onChange={(e) => setUi({ gSearch: e.target.value, gDetail: null })} />
        </div>
        {!query && (
          <Seg<GlossaryCat> name="glossary-cat" value={ui.gCat} onChange={(v) => setUi({ gCat: v })}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 42, fontSize: 14 }}
            options={([['companions', 'Companions', 'users'], ['tomes', 'Tomes', 'library'], ['codex', 'Codex', 'map']] as const).map(([k, n, ic]) => ({ key: k, label: <><Icon n={ic} size={15} />{n}</> }))} />
        )}
      </header>
      {query ? <SearchResults query={query} /> : ui.gCat === 'companions' ? <CompanionList /> : ui.gCat === 'tomes' ? <TomeList /> : <CodexList />}
    </div>
  );
}

function search(data: Data, query: string) {
  const has = (s?: string) => (s || '').toLowerCase().includes(query);
  const out: { kind: string; icon: IconName; title: string; sub: string; open: Partial<{ gDetail: string; gCat: GlossaryCat; openTome: string }> }[] = [];
  for (const c of data.companions) {
    const hit = c.notes.find((n) => has(n.t));
    if (has(c.name) || has(c.rel) || hit) out.push({ kind: 'Companion', icon: 'users', title: c.name, sub: hit ? hit.t : c.rel, open: { gDetail: 'companion:' + c.id } });
  }
  for (const t of data.tomes) {
    const hit = t.items.find((i) => has(i.t));
    if (has(t.name) || hit) out.push({ kind: 'Tome', icon: 'library', title: t.name, sub: hit ? hit.t : t.items.length + ' items', open: { gCat: 'tomes', openTome: t.id } });
  }
  for (const x of data.codex) {
    const hit = x.fields.find((f) => has(f.v) || has(f.k));
    if (has(x.name) || has(x.sub) || hit) out.push({ kind: 'Codex', icon: x.icon, title: x.name, sub: hit ? hit.k + ': ' + hit.v : x.sub, open: { gDetail: 'codex:' + x.id } });
  }
  return out;
}

function SearchResults({ query }: { query: string }) {
  const { data, ui, setUi } = useStore();
  const results = search(data, query);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="muted" style={{ fontSize: 12, paddingBottom: 6 }}>
        {results.length ? results.length + (results.length === 1 ? ' result' : ' results') : 'Nothing matches “' + ui.gSearch.trim() + '”'}
      </div>
      {results.map((r, i) => (
        <button key={i} className="row-btn" onClick={() => setUi({ gSearch: '', ...r.open })} style={{ gap: 12, minHeight: 56, padding: '10px 0' }}>
          <span style={{ width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center', border: '1px solid var(--q-rule)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent-800)' }}><Icon n={r.icon} size={17} /></span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="heading" style={{ fontSize: 18, lineHeight: 1.2 }}>{r.title}</span>
            <span className="muted ellipsis" style={{ fontSize: 13 }}>{r.sub}</span>
          </span>
          <span className="tag tag-accent" style={{ flex: 'none' }}>{r.kind}</span>
        </button>
      ))}
    </div>
  );
}

function CompanionList() {
  const { data, setUi, today, actions } = useStore();
  const events = glossaryEvents(data, today);
  const [name, setName] = useState('');
  const [rel, setRel] = useState('');
  const [bday, setBday] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n) return false;
    const id = 'p' + Date.now();
    actions.update((d) => ({ ...d, companions: [...d.companions, { id, name: n, first: n.split(' ')[0], rel: rel.trim(), bday: bday ? bday.slice(5) : '', notes: [] }] }));
    setName(''); setRel(''); setBday('');
    setUi({ gDetail: 'companion:' + id });
    return true;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {!data.companions.length && <Empty>No companions yet. Add the people you want to remember things about.</Empty>}
      {data.companions.map((c) => {
        const next = events.filter((e) => e.who === c.first && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
        return (
          <button key={c.id} className="row-btn" onClick={() => setUi({ gDetail: 'companion:' + c.id })} style={{ gap: 14, minHeight: 68, padding: '12px 0' }}>
            <span className="portrait" style={{ width: 46, height: 46, fontSize: 21, boxShadow: 'inset 0 0 0 3px var(--q-parch), inset 0 0 0 4px var(--color-accent-500)' }}>{c.name[0]}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span className="heading" style={{ fontSize: 19, lineHeight: 1.2 }}>{c.name}</span>
              <span className="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>{c.rel}</span>
            </span>
            {next && dayDiff(next.date, today) <= 30 && <span className="pill" style={{ padding: '3px 8px' }}><span className="diamond" />{shortDate(next.date)}</span>}
            <span style={{ color: 'var(--color-accent-700)' }}><Icon n="chevron-right" size={17} /></span>
          </button>
        );
      })}
      <AddForm label="Add companion" onSave={add} invalid={!name.trim()} onCancel={() => { setName(''); setRel(''); setBday(''); }}>
        <div className="field"><label htmlFor="nc-name">Name</label><input id="nc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{ minHeight: 44 }} /></div>
        <div className="two-col">
          <div className="field"><label htmlFor="nc-rel">Relation</label><input id="nc-rel" className="input" placeholder="e.g. Best friend" value={rel} onChange={(e) => setRel(e.target.value)} style={{ minHeight: 44 }} /></div>
          <div className="field"><label htmlFor="nc-bday">Birthday</label><input id="nc-bday" className="input" type="date" value={bday} onChange={(e) => setBday(e.target.value)} style={{ minHeight: 44 }} /></div>
        </div>
      </AddForm>
    </div>
  );
}

function TomeList() {
  const { data, ui, setUi, actions } = useStore();
  const [draft, setDraft] = useState('');
  const [tomeName, setTomeName] = useState('');
  const addTome = () => {
    const n = tomeName.trim();
    if (!n) return false;
    const id = 't' + Date.now();
    actions.update((d) => ({ ...d, tomes: [...d.tomes, { id, name: n, items: [] }] }));
    setUi({ openTome: id });
    setTomeName('');
    return true;
  };
  const updTome = (tid: string, fn: (items: Data['tomes'][number]['items']) => Data['tomes'][number]['items']) =>
    actions.update((d) => ({ ...d, tomes: d.tomes.map((t) => (t.id === tid ? { ...t, items: fn(t.items) } : t)) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!data.tomes.length && <Empty>No tomes yet. A tome is a list: shows to watch, gift ideas, books to read.</Empty>}
      {data.tomes.map((t) => {
        const open = ui.openTome === t.id, left = t.items.filter((i) => !i.done).length;
        const add = () => { const v = draft.trim(); if (!v) return; updTome(t.id, (items) => [...items, { id: Date.now(), t: v, done: false }]); setDraft(''); };
        return (
          <section key={t.id} className="panel">
            <button onClick={() => { setUi({ openTome: open ? null : t.id }); setDraft(''); }} aria-expanded={open}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '12px 14px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--q-ink)', fontFamily: 'var(--font-body)' }}>
              <span style={{ color: 'var(--color-accent-700)' }}><Icon n="library" size={19} /></span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="heading" style={{ fontSize: 19, lineHeight: 1.2 }}>{t.name}</span>
                <span className="muted tnum" style={{ fontSize: 12 }}>{left} of {t.items.length} open</span>
              </span>
              <Icon n={open ? 'chevron-up' : 'chevron-down'} size={17} />
            </button>
            {open && (
              <div style={{ padding: '0 14px 12px' }}>
                {t.items.map((i) => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid var(--q-rule)' }}>
                    <button onClick={() => updTome(t.id, (items) => items.map((y) => (y.id === i.id ? { ...y, done: !y.done } : y)))} aria-label={(i.done ? 'Uncheck ' : 'Check ') + i.t} aria-pressed={i.done}
                      style={{ width: 40, height: 44, flex: 'none', display: 'grid', placeItems: 'center', border: 0, background: 'transparent', cursor: 'pointer', marginLeft: -9 }}>
                      <span className={'checkbox' + (i.done ? ' on' : '')} style={{ width: 19, height: 19 }}>{i.done && <Icon n="check" size={13} stroke={2.4} />}</span>
                    </button>
                    <input className="bare-input" value={i.t} aria-label="Item"
                      onChange={(e) => { const v = e.target.value; updTome(t.id, (items) => items.map((y) => (y.id === i.id ? { ...y, t: v } : y))); }}
                      onBlur={() => { if (!i.t.trim()) updTome(t.id, (items) => items.filter((y) => y.id !== i.id)); }}
                      style={{ color: i.done ? 'var(--color-accent-700)' : 'var(--q-ink)', textDecoration: i.done ? 'line-through' : 'none' }} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--q-rule)' }}>
                  <input className="input" placeholder="Add an item" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter(add)} style={{ minHeight: 42 }} />
                  <button className="btn btn-primary btn-icon" onClick={add} aria-label="Add item" style={{ width: 42, height: 42, flex: 'none' }}><Icon n="plus" size={18} /></button>
                </div>
              </div>
            )}
          </section>
        );
      })}
      <AddForm label="New tome" onSave={addTome} invalid={!tomeName.trim()} onCancel={() => setTomeName('')}>
        <div className="field"><label htmlFor="nt-name">Name</label><input id="nt-name" className="input" placeholder="e.g. Books to read" value={tomeName} onChange={(e) => setTomeName(e.target.value)} onKeyDown={onEnter(addTome)} autoFocus style={{ minHeight: 44 }} /></div>
      </AddForm>
    </div>
  );
}

function CodexList() {
  const { data, setUi, actions } = useStore();
  const [name, setName] = useState('');
  const [sub, setSub] = useState('');
  const [icon, setIcon] = useState<IconName>('pin');
  const reset = () => { setName(''); setSub(''); setIcon('pin'); };
  const add = () => {
    const n = name.trim();
    if (!n) return false;
    const id = 'x' + Date.now();
    actions.update((d) => ({ ...d, codex: [...d.codex, { id, name: n, sub: sub.trim(), icon, fields: [] }] }));
    reset();
    setUi({ gDetail: 'codex:' + id });
    return true;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {!data.codex.length && <Empty>No codex entries yet. Keep the facts you look up often: your car, your dentist, a locker code.</Empty>}
      {data.codex.map((x) => (
        <button key={x.id} className="row-btn" onClick={() => setUi({ gDetail: 'codex:' + x.id })} style={{ gap: 14, minHeight: 64, padding: '12px 0' }}>
          <span className="icon-box" style={{ width: 44, height: 44 }}><Icon n={x.icon} size={19} /></span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="heading" style={{ fontSize: 19, lineHeight: 1.2 }}>{x.name}</span>
            <span className="muted" style={{ fontSize: 13 }}>{x.sub}</span>
          </span>
          <span style={{ color: 'var(--color-accent-700)' }}><Icon n="chevron-right" size={17} /></span>
        </button>
      ))}
      <AddForm label="New codex entry" onSave={add} invalid={!name.trim()} onCancel={reset}>
        <div className="field"><label htmlFor="nx-name">Name</label><input id="nx-name" className="input" placeholder="e.g. Car" value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{ minHeight: 44 }} /></div>
        <div className="field"><label htmlFor="nx-sub">Subtitle</label><input id="nx-sub" className="input" placeholder="e.g. Volkswagen Golf, grey" value={sub} onChange={(e) => setSub(e.target.value)} style={{ minHeight: 44 }} /></div>
        <div className="field"><label>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CODEX_ICONS.map((ic) => (
              <button key={ic} className="chip" aria-pressed={icon === ic} aria-label={ic} onClick={() => setIcon(ic)} style={{ width: 44, height: 44, justifyContent: 'center' }}><Icon n={ic} size={19} /></button>
            ))}
          </div>
        </div>
      </AddForm>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="muted" style={{ margin: 0, padding: '14px 0', fontStyle: 'italic', fontSize: 14 }}>{children}</p>;
}

/** A dashed "add" button that opens an inline form; onSave returns false to keep the form open. */
function AddForm({ label, children, onSave, onCancel, invalid }: { label: string; children: ReactNode; onSave: () => boolean; onCancel: () => void; invalid: boolean }) {
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

function BackButton({ label, cat }: { label: string; cat: GlossaryCat }) {
  const { setUi } = useStore();
  return (
    <button className="btn btn-ghost" onClick={() => setUi({ gDetail: null, gCat: cat })} style={{ alignSelf: 'flex-start', minHeight: 40, color: 'var(--color-accent-700)', marginLeft: -6 }}>
      <Icon n="chevron-left" size={17} />{label}
    </button>
  );
}

function CompanionDetail({ c }: { c: Companion }) {
  const { today, actions } = useStore();
  const [draft, setDraft] = useState('');
  const [date, setDate] = useState('');
  const [bm, bd] = c.bday ? c.bday.split('-').map(Number) : [0, 0];
  const inDays = c.bday ? dayDiff(nextAnnual(c.bday, today), today) : null;
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    const n = date ? { t, date, label: c.first + ' → ' + t } : { t };
    actions.update((d) => ({ ...d, companions: d.companions.map((x) => (x.id === c.id ? { ...x, notes: [...x.notes, n] } : x)) }));
    setDraft('');
    setDate('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton label="Companions" cat="companions" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="portrait" style={{ width: 84, height: 84, fontSize: 40 }}>{c.name[0]}</div>
        <div><h2 style={{ fontSize: 32 }}>{c.name}</h2><div className="muted" style={{ fontStyle: 'italic' }}>{c.rel}</div></div>
      </div>
      <div className="facts" style={{ borderTop: '1px solid var(--q-rule)', borderBottom: '1px solid var(--q-rule)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0' }}>
          <span className="label">Birthday</span>
          <span className="heading" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 19 }}><Icon n="cake" size={16} />{c.bday ? bd + ' ' + MONL[bm - 1] : 'Unknown'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0 12px 16px', borderLeft: '1px solid var(--q-rule)' }}>
          <span className="label">Turns a year older</span>
          <span className="heading" style={{ fontSize: 19 }}>{inDays === null ? '—' : inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : 'In ' + inDays + ' days'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
          <h3 style={{ fontSize: 23 }}>Notes</h3><span className="muted" style={{ fontSize: 12 }}>Dated notes appear on your week</span>
        </div>
        {c.notes.map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: '1px solid var(--q-rule)' }}>
            <span className="bullet" />
            <span style={{ flex: 1, fontSize: 15, textWrap: 'pretty' }}>{n.t}</span>
            {n.date && <span className="pill" style={{ flex: 'none' }}><Icon n="calendar" size={12} />{shortDate(n.date)}</span>}
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTop: '1px solid var(--q-rule)' }}>
          <input className="input" placeholder="Add a note" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter(add)} style={{ flex: '1 1 180px', minHeight: 44 }} />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Optional date" style={{ flex: '0 1 150px', minHeight: 44, width: 'auto' }} />
          <button className="btn btn-primary" onClick={add} style={{ minHeight: 44 }}>Add</button>
        </div>
      </div>
    </div>
  );
}

function CodexDetail({ x }: { x: CodexEntry }) {
  const { actions } = useStore();
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  const [date, setDate] = useState('');
  const add = () => {
    const key = k.trim(), val = v.trim();
    if (!key || !(val || date)) return;
    const f = date ? { k: key, v: val || shortDate(date), date, label: x.name + ' → ' + key } : { k: key, v: val };
    actions.update((d) => ({ ...d, codex: d.codex.map((y) => (y.id === x.id ? { ...y, fields: [...y.fields, f] } : y)) }));
    setK(''); setV(''); setDate('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton label="Codex" cat="codex" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="icon-box" style={{ width: 64, height: 64, boxShadow: 'inset 0 0 0 4px var(--q-parch), inset 0 0 0 5px var(--q-rule)' }}><Icon n={x.icon} size={28} /></span>
        <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 30, textWrap: 'pretty' }}>{x.name}</h2><div className="muted" style={{ fontStyle: 'italic' }}>{x.sub}</div></div>
      </div>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
        {x.fields.map((f, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 0', borderTop: '1px solid var(--q-rule)' }}>
            <dt className="label">{f.k}</dt>
            <dd className="tnum" style={{ margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 16 }}>
              {f.v}
              {f.date && <span className="pill" style={{ fontVariantNumeric: 'normal' }}><Icon n="calendar" size={12} />On your week · {shortDate(f.date)}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--q-rule)' }}>
        <span className="muted" style={{ fontSize: 12 }}>Add a detail. Give it a date to show it on your week.</span>
        <div className="two-col">
          <input className="input" placeholder="Label, e.g. Phone" aria-label="Detail label" value={k} onChange={(e) => setK(e.target.value)} style={{ minHeight: 44 }} />
          <input className="input" placeholder="Value" aria-label="Detail value" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={onEnter(add)} style={{ minHeight: 44 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" type="date" aria-label="Optional date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: '1 1 auto', minHeight: 44 }} />
          <button className="btn btn-primary inked" onClick={add} disabled={!k.trim() || !(v.trim() || date)} style={{ minHeight: 44 }}>Add</button>
        </div>
      </div>
    </div>
  );
}
