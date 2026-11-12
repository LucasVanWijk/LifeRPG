import { useState } from 'react';
import type { Shared } from '../domain/share';
import { sharedBody, sharedTitle } from '../domain/share';
import { CloseBtn, Seg, Sheet } from '../components/common';
import { useStore } from '../state/store';

type Target = 'note' | 'tome' | 'companion';

/** "Save to Glossary": what another app shared (or a blank new note) becomes a note, a tome item or a companion note. */
export function ShareSheet({ shared }: { shared: Shared }) {
  const { data, setUi, actions, showToast } = useStore();
  const blank = !shared.title && !shared.text && !shared.url;
  const [target, setTarget] = useState<Target>('note');
  const [title, setTitle] = useState(blank ? '' : sharedTitle(shared));
  const [body, setBody] = useState(sharedBody(shared));
  const [tomeId, setTomeId] = useState(data.tomes[0]?.id ?? '');
  const [personId, setPersonId] = useState(data.companions[0]?.id ?? '');
  const line = [title, shared.url].filter(Boolean).join(' ').trim();
  const close = () => setUi({ capture: null });

  const valid = target === 'note' ? !!(title.trim() || body.trim()) : target === 'tome' ? !!(tomeId && line) : !!(personId && (body.trim() || line));
  const save = () => {
    if (!valid) return;
    const now = Date.now();
    if (target === 'note') {
      const id = 'n' + now;
      actions.update((d) => ({ ...d, notes: [...d.notes, { id, title: title.trim() || sharedTitle({ ...shared, text: body }), body: body.trim(), icon: 'pin', pinned: false, created: now }] }));
      setUi({ capture: null, tab: 'glossary', gCat: 'notes', gDetail: 'note:' + id });
      showToast('Note saved', title.trim() || 'New note');
    } else if (target === 'tome') {
      actions.update((d) => ({ ...d, tomes: d.tomes.map((t) => (t.id === tomeId ? { ...t, items: [...t.items, { id: now, t: line, done: false }] } : t)) }));
      setUi({ capture: null });
      showToast('Added to a tome', data.tomes.find((t) => t.id === tomeId)?.name ?? '');
    } else {
      const text = [title, body].filter(Boolean).join(': ').trim();
      actions.update((d) => ({ ...d, companions: d.companions.map((c) => (c.id === personId ? { ...c, notes: [...c.notes, { t: text }] } : c)) }));
      setUi({ capture: null });
      showToast('Note added', data.companions.find((c) => c.id === personId)?.name ?? '');
    }
  };

  return (
    <Sheet onClose={close} label={blank ? 'New note' : 'Save to Glossary'}>
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}><h3 style={{ flex: 1, fontSize: 26 }}>{blank ? 'New note' : 'Save to Glossary'}</h3><CloseBtn onClick={close} /></div>
      <Seg<Target> name="share-target" value={target} onChange={setTarget} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 42, fontSize: 14 }}
        options={[{ key: 'note', label: 'New note' }, { key: 'tome', label: 'Tome item' }, { key: 'companion', label: 'Companion' }]} />
      {target === 'tome' && (
        data.tomes.length
          ? <div className="field"><label htmlFor="sh-tome">Tome</label><select id="sh-tome" className="input" value={tomeId} onChange={(e) => setTomeId(e.target.value)} style={{ minHeight: 44 }}>{data.tomes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          : <p className="muted" style={{ margin: 0 }}>You have no tomes yet. Make one in the Glossary first.</p>
      )}
      {target === 'companion' && (
        data.companions.length
          ? <div className="field"><label htmlFor="sh-person">Companion</label><select id="sh-person" className="input" value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ minHeight: 44 }}>{data.companions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          : <p className="muted" style={{ margin: 0 }}>You have no companions yet. Add one in the Glossary first.</p>
      )}
      <div className="field"><label htmlFor="sh-title">{target === 'tome' ? 'Item' : 'Title'}</label><input id="sh-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={blank} style={{ minHeight: 44 }} /></div>
      {target !== 'tome' && (
        <div className="field"><label htmlFor="sh-body">{target === 'note' ? 'Note' : 'Details'}</label><textarea id="sh-body" className="input note-edit" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 120 }} /></div>
      )}
      {target === 'tome' && shared.url && <p className="muted" style={{ margin: 0, fontSize: 13 }}>The link is added to the item.</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={close} style={{ minHeight: 44 }}>Cancel</button>
        <button className="btn btn-primary inked" onClick={save} disabled={!valid} style={{ minHeight: 44 }}>Save</button>
      </div>
    </Sheet>
  );
}
