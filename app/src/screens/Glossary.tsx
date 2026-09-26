import { useState } from 'react';
import { addDays, dayDiff, dueLabel, MONL, nextAnnual, shortDate, weekdayDate } from '../domain/dates';
import { calendarItems } from '../domain/calendar';
import { glossaryEvents } from '../domain/logic';
import type { Companion, CodexEntry, CodexField, Data } from '../domain/model';
import { CODEX_ICONS, QM } from '../domain/model';
import { Icon, type IconName } from '../components/Icon';
import { AddForm, Empty, onEnter, Seg } from '../components/common';
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
                    <button className="icon-btn" onClick={() => updTome(t.id, (items) => items.filter((y) => y.id !== i.id))} aria-label={'Remove ' + i.t} style={{ width: 32, height: 32 }}><Icon n="x" size={14} /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--q-rule)' }}>
                  <input className="input" placeholder="Add an item" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter(add)} style={{ minHeight: 42 }} />
                  <button className="btn btn-primary btn-icon" onClick={add} aria-label="Add item" style={{ width: 42, height: 42, flex: 'none' }}><Icon n="plus" size={18} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--q-rule)' }}>
                  <label className="label" htmlFor={'tn-' + t.id} style={{ flex: 'none' }}>Tome name</label>
                  <input id={'tn-' + t.id} className="bare-input" value={t.name} style={{ fontSize: 14 }}
                    onChange={(e) => { const v = e.target.value; actions.update((d) => ({ ...d, tomes: d.tomes.map((x) => (x.id === t.id ? { ...x, name: v } : x)) })); }}
                    onBlur={() => { if (!t.name.trim()) actions.update((d) => ({ ...d, tomes: d.tomes.map((x) => (x.id === t.id ? { ...x, name: 'Untitled tome' } : x)) })); }} />
                  <button className="danger-btn" style={{ minHeight: 36, padding: '4px 10px', fontSize: 14 }} onClick={() => actions.confirm({
                    title: 'Delete “' + t.name + '”?', body: 'The tome and its ' + t.items.length + (t.items.length === 1 ? ' item' : ' items') + ' will be gone.', confirmLabel: 'Delete tome',
                    onConfirm: () => actions.update((d) => ({ ...d, tomes: d.tomes.filter((x) => x.id !== t.id) })),
                  })}>Delete</button>
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

function BackButton({ label, cat }: { label: string; cat: GlossaryCat }) {
  const { setUi } = useStore();
  return (
    <button className="btn btn-ghost" onClick={() => setUi({ gDetail: null, gCat: cat })} style={{ alignSelf: 'flex-start', minHeight: 40, color: 'var(--color-accent-700)', marginLeft: -6 }}>
      <Icon n="chevron-left" size={17} />{label}
    </button>
  );
}

function CompanionDetail({ c }: { c: Companion }) {
  const { today, actions, setUi } = useStore();
  const [draft, setDraft] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [rel, setRel] = useState(c.rel);
  // Birthdays keep only month and day; the date field needs a year, so a leap year stands in.
  const [bday, setBday] = useState(c.bday ? '2000-' + c.bday : '');
  const updC = (fn: (x: Companion) => Companion) => actions.update((d) => ({ ...d, companions: d.companions.map((x) => (x.id === c.id ? fn(x) : x)) }));
  const save = () => {
    const n = name.trim();
    if (!n) return;
    updC((x) => ({ ...x, name: n, first: n.split(' ')[0], rel: rel.trim(), bday: bday ? bday.slice(5) : '' }));
    setEditing(false);
  };
  const remove = () => actions.confirm({
    title: 'Remove ' + c.name + '?', body: 'Their notes and dates leave the Glossary and your week.', confirmLabel: 'Remove companion',
    onConfirm: () => {
      actions.update((d) => ({ ...d, companions: d.companions.filter((x) => x.id !== c.id), quests: d.quests.map((q) => (q.companions.includes(c.id) ? { ...q, companions: q.companions.filter((x) => x !== c.id) } : q)), events: d.events.map((e) => (e.companions.includes(c.id) ? { ...e, companions: e.companions.filter((x) => x !== c.id) } : e)) }));
      setUi({ gDetail: null, gCat: 'companions' });
    },
  });
  const [bm, bd] = c.bday ? c.bday.split('-').map(Number) : [0, 0];
  const inDays = c.bday ? dayDiff(nextAnnual(c.bday, today), today) : null;
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    const n = date ? { t, date, label: c.first + ' → ' + t } : { t };
    updC((x) => ({ ...x, notes: [...x.notes, n] }));
    setDraft('');
    setDate('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton label="Companions" cat="companions" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="portrait" style={{ width: 84, height: 84, fontSize: 40 }}>{c.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 32 }}>{c.name}</h2><div className="muted" style={{ fontStyle: 'italic' }}>{c.rel}</div></div>
        {!editing && <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ minHeight: 40 }}><Icon n="pencil" size={14} />Edit</button>}
      </div>
      {editing && (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
          <div className="field"><label htmlFor="ec-name">Name</label><input id="ec-name" className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ minHeight: 44 }} /></div>
          <div className="two-col">
            <div className="field"><label htmlFor="ec-rel">Relation</label><input id="ec-rel" className="input" value={rel} onChange={(e) => setRel(e.target.value)} style={{ minHeight: 44 }} /></div>
            <div className="field"><label htmlFor="ec-bday">Birthday</label><input id="ec-bday" className="input" type="date" value={bday} onChange={(e) => setBday(e.target.value)} style={{ minHeight: 44 }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="danger-btn" onClick={remove}>Remove</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => { setEditing(false); setName(c.name); setRel(c.rel); setBday(c.bday ? '2000-' + c.bday : ''); }} style={{ minHeight: 42 }}>Cancel</button>
            <button className="btn btn-primary inked" onClick={save} disabled={!name.trim()} style={{ minHeight: 42 }}>Save</button>
          </div>
        </div>
      )}
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
      <CompanionQuests id={c.id} />
      <CompanionEvents id={c.id} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
          <h3 style={{ fontSize: 23 }}>Notes</h3><span className="muted" style={{ fontSize: 12 }}>Dated notes appear on your week</span>
        </div>
        {c.notes.map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: '1px solid var(--q-rule)' }}>
            <span className="bullet" />
            <span style={{ flex: 1, fontSize: 15, textWrap: 'pretty' }}>{n.t}</span>
            {n.date && <span className="pill" style={{ flex: 'none' }}><Icon n="calendar" size={12} />{shortDate(n.date)}</span>}
            <button className="icon-btn" onClick={() => updC((x) => ({ ...x, notes: x.notes.filter((_, j) => j !== i) }))} aria-label="Remove note" style={{ width: 30, height: 30, marginTop: -3 }}><Icon n="x" size={14} /></button>
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
  const { actions, setUi } = useStore();
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CodexEntry>(x);
  const updX = (fn: (y: CodexEntry) => CodexEntry) => actions.update((d) => ({ ...d, codex: d.codex.map((y) => (y.id === x.id ? fn(y) : y)) }));
  const add = () => {
    const key = k.trim(), val = v.trim();
    if (!key || !(val || date)) return;
    const f = date ? { k: key, v: val || shortDate(date), date, label: x.name + ' → ' + key } : { k: key, v: val };
    updX((y) => ({ ...y, fields: [...y.fields, f] }));
    setK(''); setV(''); setDate('');
  };
  const startEdit = () => { setDraft(x); setEditing(true); };
  const setField = (i: number, patch: Partial<CodexField>) => setDraft((dr) => ({ ...dr, fields: dr.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const save = () => {
    if (!draft.name.trim()) return;
    const name = draft.name.trim();
    updX(() => ({
      ...draft, name, sub: draft.sub.trim(),
      fields: draft.fields.filter((f) => f.k.trim()).map((f) => (f.date ? { ...f, k: f.k.trim(), label: name + ' → ' + f.k.trim() } : { k: f.k.trim(), v: f.v })),
    }));
    setEditing(false);
  };
  const remove = () => actions.confirm({
    title: 'Delete “' + x.name + '”?', body: 'The entry and all its details will be gone.', confirmLabel: 'Delete entry',
    onConfirm: () => { actions.update((d) => ({ ...d, codex: d.codex.filter((y) => y.id !== x.id) })); setUi({ gDetail: null, gCat: 'codex' }); },
  });

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BackButton label="Codex" cat="codex" />
        <div className="field"><label htmlFor="ex-name">Name</label><input id="ex-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ minHeight: 44 }} /></div>
        <div className="field"><label htmlFor="ex-sub">Subtitle</label><input id="ex-sub" className="input" value={draft.sub} onChange={(e) => setDraft({ ...draft, sub: e.target.value })} style={{ minHeight: 44 }} /></div>
        <div className="field"><label>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CODEX_ICONS.map((ic) => (
              <button key={ic} className="chip" aria-pressed={draft.icon === ic} aria-label={ic} onClick={() => setDraft({ ...draft, icon: ic })} style={{ width: 44, height: 44, justifyContent: 'center' }}><Icon n={ic} size={19} /></button>
            ))}
          </div>
        </div>
        <div className="field"><label>Details</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.fields.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="input" aria-label="Detail label" value={f.k} onChange={(e) => setField(i, { k: e.target.value })} style={{ flex: '1 1 110px', minHeight: 42, fontSize: 13 }} />
                {f.date
                  ? <input className="input" type="date" aria-label="Date" value={f.date} onChange={(e) => e.target.value && setField(i, { date: e.target.value, v: shortDate(e.target.value) })} style={{ flex: '2 1 150px', minHeight: 42 }} />
                  : <input className="input" aria-label="Detail value" value={f.v} onChange={(e) => setField(i, { v: e.target.value })} style={{ flex: '2 1 150px', minHeight: 42 }} />}
                <button className="icon-btn" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, j) => j !== i) })} aria-label={'Remove ' + f.k}><Icon n="x" size={15} /></button>
              </div>
            ))}
            {!draft.fields.length && <span className="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>No details.</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="danger-btn" onClick={remove}>Delete entry</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ minHeight: 42 }}>Cancel</button>
          <button className="btn btn-primary inked" onClick={save} disabled={!draft.name.trim()} style={{ minHeight: 42 }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton label="Codex" cat="codex" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="icon-box" style={{ width: 64, height: 64, boxShadow: 'inset 0 0 0 4px var(--q-parch), inset 0 0 0 5px var(--q-rule)' }}><Icon n={x.icon} size={28} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 30, textWrap: 'pretty' }}>{x.name}</h2><div className="muted" style={{ fontStyle: 'italic' }}>{x.sub}</div></div>
        <button className="btn btn-secondary" onClick={startEdit} style={{ minHeight: 40 }}><Icon n="pencil" size={14} />Edit</button>
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

/** Quests that involve a companion: open ones to tap into, and how many are done. */
function CompanionQuests({ id }: { id: string }) {
  const { data, today, actions } = useStore();
  const qs = data.quests.filter((q) => q.companions.includes(id));
  const open = qs.filter((q) => q.status !== 'done').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const done = qs.length - open.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
        <h3 style={{ fontSize: 23 }}>Quests</h3>
        <span className="muted tnum" style={{ fontSize: 12 }}>{open.length} open{done ? ' · ' + done + ' done' : ''}</span>
      </div>
      {open.map((q) => (
        <button key={q.id} className="row-btn" onClick={() => actions.openQuest(q.id)} style={{ gap: 10, minHeight: 48, padding: '8px 0' }}>
          <span style={{ color: QM[q.quad].color }}><Icon n={QM[q.quad].icon} size={16} /></span>
          <span className="heading" style={{ flex: 1, minWidth: 0, fontSize: 17 }}>{q.title}</span>
          {q.due && <span className="muted tnum" style={{ fontSize: 12 }}>{dueLabel(q.due, today)}</span>}
          <span style={{ color: 'var(--color-accent-700)' }}><Icon n="chevron-right" size={16} /></span>
        </button>
      ))}
      {!open.length && (
        <p className="muted" style={{ margin: 0, padding: '10px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>
          No open quests. Link one from a quest's edit screen, or type #name in quick add.
        </p>
      )}
    </div>
  );
}

/** The next few calendar events a companion is part of. */
function CompanionEvents({ id }: { id: string }) {
  const { data, today, actions } = useStore();
  const upcoming = calendarItems({ ...data, quests: [] }, today, addDays(today, 365))
    .filter((it) => it.kind === 'event' && it.companions?.includes(id) && (!it.span || it.span.day === 1))
    .slice(0, 5);
  if (!data.events.some((e) => e.companions.includes(id))) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
        <h3 style={{ fontSize: 23 }}>Upcoming</h3>
      </div>
      {upcoming.map((it, i) => (
        <button key={i} className="row-btn" onClick={() => actions.openEvent(Number(it.target.split(':')[1]))} style={{ gap: 10, minHeight: 48, padding: '8px 0' }}>
          <span className="muted tnum" style={{ width: 86, flex: 'none', fontSize: 12 }}>{weekdayDate(it.date)}</span>
          <span className="heading" style={{ flex: 1, minWidth: 0, fontSize: 17 }}>{it.title}</span>
          {it.time && <span className="muted tnum" style={{ fontSize: 12 }}>{it.time}</span>}
          <span style={{ color: 'var(--color-accent-700)' }}><Icon n="chevron-right" size={16} /></span>
        </button>
      ))}
      {!upcoming.length && <p className="muted" style={{ margin: 0, padding: '10px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>No upcoming events.</p>}
    </div>
  );
}
