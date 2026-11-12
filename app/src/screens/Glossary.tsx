import { useState } from 'react';
import { addDays, dayDiff, dueLabel, MONL, nextAnnual, shortDate, weekdayDate } from '../domain/dates';
import { calendarItems } from '../domain/calendar';
import { glossaryEvents } from '../domain/logic';
import { GlossaryAdd } from '../components/GlossaryAdd';
import type { Companion, Data, Note, Rhythm } from '../domain/model';
import { NOTE_ICONS, QM, RHYTHM_NAME } from '../domain/model';
import { ageOf, allGroups, lastContact } from '../domain/people';
import { firstLink, mapsUrl, noteMatches, sortNotes } from '../domain/notes';
import { LinkText, NoteBody } from '../components/RichText';
import { Icon, type IconName } from '../components/Icon';
import { AddForm, Empty, onEnter, Seg } from '../components/common';
import { useStore, type GlossaryCat } from '../state/store';

export function Glossary() {
  const { data, ui, setUi } = useStore();
  const query = ui.gSearch.trim().toLowerCase();
  const [dType, dId] = (ui.gDetail || '').split(':');
  const companion = dType === 'companion' ? data.companions.find((c) => c.id === dId) : undefined;
  const note = dType === 'note' ? data.notes.find((x) => x.id === dId) : undefined;

  if (companion) return <div className="screen screen-narrow" style={{ gap: 16 }}><CompanionDetail c={companion} /></div>;
  if (note) return <div className="screen screen-narrow" style={{ gap: 16 }}><NoteDetail n={note} /></div>;

  const wideList = !query && ui.gCat === 'companions';
  return (
    <div className={'screen' + (wideList ? '' : ' screen-narrow')} style={{ gap: 16 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
        <div className="screen-head">
          <span className="kicker">Everything worth remembering</span>
          <h1>Glossary</h1>
        </div>
        <div className="search">
          <span><Icon n="search" size={17} /></span>
          <input className="input" type="search" placeholder="Search companions, tomes and notes" aria-label="Search the Glossary"
            value={ui.gSearch} onChange={(e) => setUi({ gSearch: e.target.value, gDetail: null })} />
        </div>
        {!query && (
          <Seg<GlossaryCat> name="glossary-cat" value={ui.gCat} onChange={(v) => setUi({ gCat: v })}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 42, fontSize: 14 }}
            options={([['companions', 'Companions', 'users'], ['tomes', 'Tomes', 'library'], ['notes', 'Notes', 'map']] as const).map(([k, n, ic]) => ({ key: k, label: <><Icon n={ic} size={15} />{n}</> }))} />
        )}
      </header>
      {!query && <GlossaryAdd />}
      {query ? <SearchResults query={query} /> : ui.gCat === 'companions' ? <CompanionList /> : ui.gCat === 'tomes' ? <TomeList /> : <NoteList />}
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
  for (const n of data.notes) {
    if (!noteMatches(n, query)) continue;
    const hit = n.body.split('\n').find((l) => has(l));
    out.push({ kind: 'Note', icon: n.icon ?? 'pin', title: n.title, sub: hit && !has(n.title) ? hit : n.body.split('\n')[0] || 'Empty note', open: { gDetail: 'note:' + n.id } });
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
  const [group, setGroup] = useState('');
  const groups = allGroups(data.companions);
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
    <div>
      {!data.companions.length && <Empty>No companions yet. Add the people you want to remember things about.</Empty>}
      {groups.length > 0 && (
        <div className="hscroll" style={{ gap: 6, paddingBottom: 6 }} role="group" aria-label="Filter by group">
          <button className="chip" aria-pressed={!group} onClick={() => setGroup('')} style={{ minHeight: 36, padding: '4px 12px' }}>Everyone</button>
          {groups.map((g) => <button key={g} className="chip" aria-pressed={group === g} onClick={() => setGroup(group === g ? '' : g)} style={{ minHeight: 36, padding: '4px 12px' }}>{g}</button>)}
        </div>
      )}
      {/* As many columns as fit; A to Z reads across, then down. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', columnGap: 28 }}>
      {[...data.companions].filter((c) => !group || c.groups?.includes(group)).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).map((c) => {
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
      </div>
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
                    {firstLink(i.t) && <a className="icon-btn" href={firstLink(i.t)!.href} target="_blank" rel="noreferrer noopener" aria-label={'Open link in ' + i.t} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}><Icon n="chevron-right" size={14} /></a>}
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

function NoteList() {
  const { data, setUi, actions } = useStore();
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<IconName>('pin');
  const reset = () => { setTitle(''); setIcon('pin'); };
  const add = () => {
    const t = title.trim();
    if (!t) return false;
    const id = 'n' + Date.now();
    actions.update((d) => ({ ...d, notes: [...d.notes, { id, title: t, body: '', icon, pinned: false, created: Date.now() }] }));
    reset();
    setUi({ gDetail: 'note:' + id });
    return true;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {!data.notes.length && <Empty>No notes yet. Keep anything that isn't a task: ideas, meeting notes, recipes, the wifi password.</Empty>}
      {sortNotes(data.notes).map((n) => (
        <button key={n.id} className="row-btn" onClick={() => setUi({ gDetail: 'note:' + n.id })} style={{ gap: 14, minHeight: 64, padding: '12px 0' }}>
          <span className="icon-box" style={{ width: 44, height: 44 }}><Icon n={n.icon ?? 'pin'} size={19} /></span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="heading" style={{ fontSize: 19, lineHeight: 1.2 }}>{n.title}</span>
            <span className="muted ellipsis" style={{ fontSize: 13 }}>{n.body.split('\n').find((l) => l.trim()) ?? 'Empty note'}</span>
          </span>
          {n.pinned && <span title="Pinned" style={{ color: 'var(--color-accent-700)' }}><Icon n="pin" size={15} /></span>}
          <span style={{ color: 'var(--color-accent-700)' }}><Icon n="chevron-right" size={17} /></span>
        </button>
      ))}
      <AddForm label="New note" onSave={add} invalid={!title.trim()} onCancel={reset}>
        <div className="field"><label htmlFor="nn-title">Title</label><input id="nn-title" className="input" placeholder="e.g. Wifi and router" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onEnter(add)} autoFocus style={{ minHeight: 44 }} /></div>
        <div className="field"><label>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {NOTE_ICONS.map((ic) => (
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
  const updC = (fn: (x: Companion) => Companion) => actions.update((d) => ({ ...d, companions: d.companions.map((x) => (x.id === c.id ? fn(x) : x)) }));
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
        <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 32 }}>{c.name}</h2><div className="muted" style={{ fontStyle: 'italic' }}>{c.rel}{c.groups?.length ? ' · ' + c.groups.join(', ') : ''}</div></div>
        {!editing && <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ minHeight: 40 }}><Icon n="pencil" size={14} />Edit</button>}
      </div>
      {editing && <CompanionEditor c={c} onDone={() => setEditing(false)} onRemove={remove} />}
      {!editing && <CompanionInfo c={c} />}
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
            <span style={{ flex: 1, fontSize: 15, textWrap: 'pretty' }}><LinkText text={n.t} /></span>
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

function NoteDetail({ n }: { n: Note }) {
  const { actions, setUi } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Note>(n);
  const upd = (fn: (y: Note) => Note) => actions.update((d) => ({ ...d, notes: d.notes.map((y) => (y.id === n.id ? fn(y) : y)) }));
  const save = () => {
    if (!draft.title.trim()) return;
    upd(() => ({ ...draft, title: draft.title.trim() }));
    setEditing(false);
  };
  const remove = () => actions.confirm({
    title: 'Delete “' + n.title + '”?', body: 'The note will be gone.', confirmLabel: 'Delete note',
    onConfirm: () => { actions.update((d) => ({ ...d, notes: d.notes.filter((y) => y.id !== n.id) })); setUi({ gDetail: null, gCat: 'notes' }); },
  });

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BackButton label="Notes" cat="notes" />
        <div className="field"><label htmlFor="ne-title">Title</label><input id="ne-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ minHeight: 44 }} /></div>
        <div className="field"><label>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {NOTE_ICONS.map((ic) => (
              <button key={ic} className="chip" aria-pressed={draft.icon === ic} aria-label={ic} onClick={() => setDraft({ ...draft, icon: ic })} style={{ width: 44, height: 44, justifyContent: 'center' }}><Icon n={ic} size={19} /></button>
            ))}
          </div>
        </div>
        <label className="toggle-row"><input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} /><span>Pin to the top</span></label>
        <div className="field"><label htmlFor="ne-body">Note</label>
          <textarea id="ne-body" className="input note-edit" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <span className="muted" style={{ fontSize: 12 }}>
            # heading · - list · [ ] checkbox · **bold** · end a line with @2026-12-01 to show it on your calendar
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="danger-btn" onClick={remove}>Delete note</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ minHeight: 42 }}>Cancel</button>
          <button className="btn btn-primary inked" onClick={save} disabled={!draft.title.trim()} style={{ minHeight: 42 }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton label="Notes" cat="notes" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="icon-box" style={{ width: 64, height: 64, boxShadow: 'inset 0 0 0 4px var(--q-parch), inset 0 0 0 5px var(--q-rule)' }}><Icon n={n.icon ?? 'pin'} size={28} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 30, textWrap: 'pretty' }}>{n.title}</h2></div>
        <button className="icon-btn" onClick={() => upd((y) => ({ ...y, pinned: !y.pinned }))} aria-pressed={n.pinned} aria-label={n.pinned ? 'Unpin' : 'Pin'} style={{ color: n.pinned ? 'var(--color-accent-800)' : undefined }}><Icon n="pin" size={18} /></button>
        <button className="btn btn-secondary" onClick={() => { setDraft(n); setEditing(true); }} style={{ minHeight: 40 }}><Icon n="pencil" size={14} />Edit</button>
      </div>
      <div style={{ borderTop: '1px solid var(--q-rule)', paddingTop: 14 }}>
        <NoteBody body={n.body} onChange={(body) => upd((y) => ({ ...y, body }))} />
      </div>
    </div>
  );
}

/** Label and value rows for what is known about a companion; phone, email and address are links. */
function CompanionInfo({ c }: { c: Companion }) {
  const { data, today, setUi, actions } = useStore();
  const age = ageOf(c, today);
  const person = (id: string) => data.companions.find((x) => x.id === id);
  const chip = (id: string) => { const p = person(id); return p && <button key={id} className="chip" onClick={() => setUi({ gDetail: 'companion:' + id })} style={{ minHeight: 34, padding: '2px 10px', fontSize: 15 }}><Icon n="users" size={13} />{p.name}</button>; };
  const rows: [string, React.ReactNode][] = [];
  if (c.phone) rows.push(['Phone', <LinkText key="p" text={c.phone} />]);
  if (c.email) rows.push(['Email', <LinkText key="e" text={c.email} />]);
  if (c.address) rows.push(['Address', <a key="a" className="auto-link" href={mapsUrl(c.address)} target="_blank" rel="noreferrer noopener">{c.address}</a>]);
  if (age !== null) rows.push(['Age', age + ' (born ' + c.birthYear + ')']);
  if (c.partner && person(c.partner)) rows.push(['Partner', chip(c.partner)]);
  const kids = (c.children ?? []).filter((id) => person(id));
  if (kids.length) rows.push(['Children', <span key="k" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{kids.map(chip)}</span>]);
  if (c.met) rows.push(['How we met', <LinkText key="m" text={c.met} />]);
  if (c.likes) rows.push(['Likes', <LinkText key="l" text={c.likes} />]);
  if (c.dislikes) rows.push(['Dislikes', <LinkText key="d" text={c.dislikes} />]);
  if (c.sizes) rows.push(['Sizes', c.sizes]);
  for (const x of c.extra ?? []) rows.push([x.k, <LinkText key={x.k} text={x.v} />]);
  const gifts = c.gifts ?? [];
  const last = lastContact(data, c, today);
  return (
    <>
      {rows.length > 0 && (
        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
          {rows.map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0', borderTop: '1px solid var(--q-rule)' }}>
              <dt className="label">{k}</dt><dd style={{ margin: 0, fontSize: 16, overflowWrap: 'anywhere' }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {gifts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 23, paddingBottom: 4 }}>Gift ideas</h3>
          {gifts.map((g) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
              <span style={{ flex: 1, fontSize: 15 }}><LinkText text={g.t} /></span>
              {g.tome && data.tomes.some((t) => t.id === g.tome) && <button className="chip" onClick={() => setUi({ gCat: 'tomes', gDetail: null, openTome: g.tome! })} style={{ minHeight: 30, padding: '0 8px', fontSize: 13 }}><Icon n="library" size={12} />{data.tomes.find((t) => t.id === g.tome)!.name}</button>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--q-rule)', paddingTop: 10 }}>
        <span className="muted" style={{ flex: 1, minWidth: 160, fontSize: 13 }}>
          {last ? 'Last in touch ' + dayDiff(today, last) + (dayDiff(today, last) === 1 ? ' day' : ' days') + ' ago' : 'No contact recorded'}
          {c.rhythm ? ' · ' + RHYTHM_NAME[c.rhythm].toLowerCase() : ''}
        </span>
        <button className="btn btn-secondary" style={{ minHeight: 38 }} onClick={() => actions.talkedToday(c.id)}><Icon n="check" size={14} />Talked today</button>
      </div>
    </>
  );
}

/** The form for everything about a companion. */
function CompanionEditor({ c, onDone, onRemove }: { c: Companion; onDone: () => void; onRemove: () => void }) {
  const { data, actions } = useStore();
  const [d, setD] = useState<Companion>({ ...c, gifts: c.gifts ?? [], extra: c.extra ?? [], children: c.children ?? [], groups: c.groups ?? [] });
  // Birthdays keep only month and day; the date field needs a year, so a leap year stands in.
  const [bday, setBday] = useState(c.bday ? '2000-' + c.bday : '');
  const [year, setYear] = useState(c.birthYear ? String(c.birthYear) : '');
  const [group, setGroup] = useState('');
  const [gift, setGift] = useState('');
  const [giftTome, setGiftTome] = useState('');
  const [xk, setXk] = useState('');
  const [xv, setXv] = useState('');
  const set = (patch: Partial<Companion>) => setD((cur) => ({ ...cur, ...patch }));
  const others = data.companions.filter((x) => x.id !== c.id);
  const known = allGroups(data.companions);
  const addGroup = (g: string) => { const v = g.trim(); if (v && !d.groups!.some((x) => x.toLowerCase() === v.toLowerCase())) set({ groups: [...d.groups!, v] }); setGroup(''); };
  const save = () => {
    const n = d.name.trim();
    if (!n) return;
    actions.update((all) => ({ ...all, companions: all.companions.map((x) => (x.id === c.id ? {
      ...d, birthYear: /^\d{4}$/.test(year) ? Number(year) : undefined, name: n, first: n.split(' ')[0], rel: d.rel.trim(), bday: bday ? bday.slice(5) : '',
      phone: d.phone?.trim() || undefined, email: d.email?.trim() || undefined, address: d.address?.trim() || undefined,
      met: d.met?.trim() || undefined, likes: d.likes?.trim() || undefined, dislikes: d.dislikes?.trim() || undefined, sizes: d.sizes?.trim() || undefined,
      partner: d.partner || undefined, children: d.children?.length ? d.children : undefined, groups: d.groups?.length ? d.groups : undefined,
      gifts: d.gifts?.length ? d.gifts : undefined, extra: d.extra?.length ? d.extra : undefined,
      rhythm: d.rhythm || undefined, rhythmSince: d.rhythm ? (d.rhythm !== c.rhythm ? actions.today() : d.rhythmSince) : undefined,
    } : x)) }));
    onDone();
  };
  const text = (id: string, label: string, key: 'phone' | 'email' | 'address' | 'met' | 'likes' | 'dislikes' | 'sizes', type = 'text') => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" type={type} value={d[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} style={{ minHeight: 44 }} /></div>
  );
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
      <div className="field"><label htmlFor="ec-name">Name</label><input id="ec-name" className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} style={{ minHeight: 44 }} /></div>
      <div className="two-col">
        <div className="field"><label htmlFor="ec-rel">Relation</label><input id="ec-rel" className="input" value={d.rel} onChange={(e) => set({ rel: e.target.value })} style={{ minHeight: 44 }} /></div>
        <div className="field"><label htmlFor="ec-bday">Birthday</label><input id="ec-bday" className="input" type="date" value={bday} onChange={(e) => setBday(e.target.value)} style={{ minHeight: 44 }} /></div>
      </div>
      <div className="two-col">
        <div className="field"><label htmlFor="ec-year">Birth year</label><input id="ec-year" className="input" inputMode="numeric" placeholder="e.g. 1990" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{ minHeight: 44 }} /></div>
        {text('ec-phone', 'Phone', 'phone', 'tel')}
      </div>
      {text('ec-email', 'Email', 'email', 'email')}
      {text('ec-addr', 'Address', 'address')}
      <div className="field"><label>Groups</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {d.groups!.map((g) => <button key={g} className="chip" aria-pressed onClick={() => set({ groups: d.groups!.filter((x) => x !== g) })} style={{ minHeight: 34, padding: '2px 10px' }}>{g}<Icon n="x" size={12} /></button>)}
          {known.filter((g) => !d.groups!.includes(g)).map((g) => <button key={g} className="chip" onClick={() => addGroup(g)} style={{ minHeight: 34, padding: '2px 10px', opacity: 0.8 }}>+ {g}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="input" placeholder="New group, e.g. Family" aria-label="New group" value={group} onChange={(e) => setGroup(e.target.value)} onKeyDown={onEnter(() => addGroup(group))} style={{ minHeight: 42 }} />
          <button className="btn btn-secondary" onClick={() => addGroup(group)} style={{ minHeight: 42 }}>Add</button>
        </div>
      </div>
      {others.length > 0 && (
        <>
          <div className="field"><label htmlFor="ec-partner">Partner</label>
            <select id="ec-partner" className="input" value={d.partner ?? ''} onChange={(e) => set({ partner: e.target.value || undefined })} style={{ minHeight: 44 }}>
              <option value="">None</option>{others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Children</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {others.map((x) => { const on = d.children!.includes(x.id); return <button key={x.id} className="chip" aria-pressed={on} onClick={() => set({ children: on ? d.children!.filter((y) => y !== x.id) : [...d.children!, x.id] })} style={{ minHeight: 34, padding: '2px 10px' }}>{on && <Icon n="check" size={12} stroke={2.2} />}{x.name}</button>; })}
            </div>
          </div>
        </>
      )}
      {text('ec-met', 'How we met', 'met')}
      {text('ec-likes', 'Likes', 'likes')}
      {text('ec-dislikes', 'Dislikes', 'dislikes')}
      {text('ec-sizes', 'Sizes', 'sizes')}
      <div className="field"><label>Gift ideas</label>
        {d.gifts!.map((g) => (
          <div key={g.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{g.t}{g.tome ? ' · ' + (data.tomes.find((t) => t.id === g.tome)?.name ?? '') : ''}</span>
            <button className="icon-btn" aria-label={'Remove ' + g.t} onClick={() => set({ gifts: d.gifts!.filter((x) => x.id !== g.id) })}><Icon n="x" size={14} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input className="input" placeholder="A gift idea" aria-label="Gift idea" value={gift} onChange={(e) => setGift(e.target.value)} style={{ flex: '2 1 160px', minHeight: 42 }} />
          {data.tomes.length > 0 && <select className="input" aria-label="Link to a tome" value={giftTome} onChange={(e) => setGiftTome(e.target.value)} style={{ flex: '1 1 120px', minHeight: 42 }}><option value="">No tome</option>{data.tomes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
          <button className="btn btn-secondary" style={{ minHeight: 42 }} onClick={() => { const t = gift.trim(); if (!t) return; set({ gifts: [...d.gifts!, { id: Date.now(), t, tome: giftTome || undefined }] }); setGift(''); setGiftTome(''); }}>Add</button>
        </div>
      </div>
      <div className="field"><label>Other details</label>
        {d.extra!.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ flex: 1 }}><strong>{x.k}</strong>: {x.v}</span>
            <button className="icon-btn" aria-label={'Remove ' + x.k} onClick={() => set({ extra: d.extra!.filter((_, j) => j !== i) })}><Icon n="x" size={14} /></button>
          </div>
        ))}
        <div className="two-col">
          <input className="input" placeholder="Label, e.g. Shoe size" aria-label="Detail label" value={xk} onChange={(e) => setXk(e.target.value)} style={{ minHeight: 42 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" placeholder="Value" aria-label="Detail value" value={xv} onChange={(e) => setXv(e.target.value)} onKeyDown={onEnter(() => { if (xk.trim() && xv.trim()) { set({ extra: [...d.extra!, { k: xk.trim(), v: xv.trim() }] }); setXk(''); setXv(''); } })} style={{ minHeight: 42 }} />
            <button className="btn btn-secondary" style={{ minHeight: 42 }} onClick={() => { if (xk.trim() && xv.trim()) { set({ extra: [...d.extra!, { k: xk.trim(), v: xv.trim() }] }); setXk(''); setXv(''); } }}>Add</button>
          </div>
        </div>
      </div>
      <div className="field"><label htmlFor="ec-rhythm">Keep in touch</label>
        <select id="ec-rhythm" className="input" value={d.rhythm ?? ''} onChange={(e) => set({ rhythm: (e.target.value || null) as Companion['rhythm'] })} style={{ minHeight: 44 }}>
          <option value="">No rhythm</option>
          {(Object.keys(RHYTHM_NAME) as Rhythm[]).map((r) => <option key={r} value={r}>{RHYTHM_NAME[r]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="danger-btn" onClick={onRemove}>Remove</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={onDone} style={{ minHeight: 42 }}>Cancel</button>
        <button className="btn btn-primary inked" onClick={save} disabled={!d.name.trim()} style={{ minHeight: 42 }}>Save</button>
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
