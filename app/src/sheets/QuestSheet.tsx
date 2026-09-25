import { useState } from 'react';
import { weekdayDate } from '../domain/dates';
import type { Quest, QuestNote } from '../domain/model';
import { QM, QUADS, SIZE, STATUS_NAME, STATUSES } from '../domain/model';
import { Icon } from '../components/Icon';
import { CloseBtn, CompleteButton, DoneBanner, onEnter, questView, Seg, Sheet } from '../components/common';
import { useStore } from '../state/store';

/** Quest detail (read-only, with notes and completion) and Edit quest, as a bottom sheet on mobile or side panel on desktop. */
export function QuestSheet({ quest: q }: { quest: Quest }) {
  const { data, ui, setUi, today, actions } = useStore();
  const [draft, setDraft] = useState('');
  const v = questView(q, today, data.camps);
  const camp = q.campaign ? data.camps[q.campaign] : undefined;
  const editing = ui.sheetMode === 'edit';
  const close = () => setUi({ openId: null });
  const upd = (patch: Partial<Quest>) => actions.updateQuest(q.id, patch);
  const setNotes = (fn: (ns: QuestNote[]) => QuestNote[]) => upd({ notes: fn(q.notes) });
  const addNote = () => { const t = draft.trim(); if (!t) return; setNotes((ns) => [...ns, { id: Date.now(), t }]); setDraft(''); };
  const complete = () => { actions.complete(q.id); close(); };
  const remove = () => actions.confirm({
    title: 'Delete this quest?',
    body: '“' + q.title + '” and its notes will be gone. Rewards already earned are kept.',
    confirmLabel: 'Delete quest',
    onConfirm: () => actions.deleteQuest(q.id),
  });

  const badges = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
      <span className="pill" style={{ fontSize: 13, padding: '3px 9px' }}><Icon n="sparkles" size={13} />+{v.xp} XP · +{v.gold} gold</span>
    </div>
  );
  const finish = v.done ? <DoneBanner onReopen={() => actions.undo(q.id)} /> : <CompleteButton label="Complete quest" onClick={complete} />;

  return (
    <Sheet onClose={close} label={editing ? 'Edit quest' : q.title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: v.quad.color }}>
          <span className="dot" style={{ width: 8, height: 8 }} /><span className="ellipsis">{QM[q.quad].name + (camp ? ' · ' + camp.name : '')}</span>
        </span>
        {editing
          ? <button className="btn btn-primary inked" onClick={() => setUi({ sheetMode: 'view' })} style={{ minHeight: 40 }}><Icon n="check" size={15} />Done</button>
          : <button className="btn btn-secondary" onClick={() => setUi({ sheetMode: 'edit' })} style={{ minHeight: 40 }}><Icon n="pencil" size={15} />Edit</button>}
        <CloseBtn onClick={close} />
      </div>

      {!editing ? (
        <>
          <h2 style={{ margin: '-4px 0 0', fontSize: 30, lineHeight: 1.12, textWrap: 'pretty' }}>{q.title}</h2>
          {badges}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, borderTop: '1px solid var(--q-rule)' }}>
            {[
              { k: 'Quadrant', v: QM[q.quad].name, color: QM[q.quad].color },
              { k: 'Due', v: q.due ? weekdayDate(q.due) : 'No due date', color: q.due && q.due < today && !v.done ? 'var(--q-wax)' : 'var(--q-ink)' },
              { k: 'Size', v: SIZE[q.size].name },
              { k: 'Campaign', v: camp ? camp.name : 'None' },
              { k: 'Status', v: STATUS_NAME[q.status], color: v.done ? 'var(--q-moss)' : undefined },
            ].map((f) => (
              <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0', borderBottom: '1px solid var(--q-rule)' }}>
                <span className="label">{f.k}</span>
                <span className="heading" style={{ fontSize: 18, lineHeight: 1.2, color: f.color || 'var(--q-ink)' }}>{f.v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 4 }}>
              <h3 style={{ fontSize: 22 }}>Notes</h3>
              <span className="muted tnum" style={{ fontSize: 12 }}>{q.notes.length} {q.notes.length === 1 ? 'note' : 'notes'}</span>
            </div>
            {q.notes.map((n) => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: '1px solid var(--q-rule)' }}>
                <span className="bullet" /><span style={{ flex: 1, fontSize: 15, textWrap: 'pretty' }}>{n.t}</span>
              </div>
            ))}
            {!q.notes.length && <p className="muted" style={{ margin: 0, padding: '10px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>No notes yet.</p>}
            <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--q-rule)' }}>
              <input className="input" placeholder="Add a note" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter(addNote)} style={{ flex: 1, minHeight: 44 }} />
              <button className="btn btn-primary inked" onClick={addNote} style={{ minHeight: 44 }}>Add</button>
            </div>
          </div>
          {finish}
        </>
      ) : (
        <>
          <input className="title-input" value={q.title} onChange={(e) => upd({ title: e.target.value })} aria-label="Title"
            style={{ marginTop: -8, borderBottom: '1px solid var(--q-rule)', padding: '4px 0 8px', fontSize: 29, lineHeight: 1.15 }} />
          {badges}
          <div className="field"><label>Notes</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.notes.map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="input" value={n.t} aria-label="Note" onChange={(e) => { const t = e.target.value; setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, t } : x))); }} style={{ flex: 1, minHeight: 42, fontSize: 14 }} />
                  <button className="btn btn-icon btn-ghost inked" onClick={() => setNotes((ns) => ns.filter((x) => x.id !== n.id))} aria-label="Remove note" style={{ width: 42, height: 42, flex: 'none' }}><Icon n="x" size={16} /></button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" placeholder="Add a note" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter(addNote)} style={{ flex: 1, minHeight: 42, fontSize: 14, borderStyle: 'dashed' }} />
                <button className="btn btn-primary btn-icon" onClick={addNote} aria-label="Add note" style={{ width: 42, height: 42, flex: 'none' }}><Icon n="plus" size={18} /></button>
              </div>
            </div>
          </div>
          <div className="field"><label>Quadrant</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {QUADS.map((z) => (
                <button key={z.key} className="opt-btn" aria-pressed={q.quad === z.key} onClick={() => upd({ quad: z.key })}>
                  <span style={{ color: z.color }}><Icon n={z.icon} size={16} /></span>
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span className="heading" style={{ fontSize: 16 }}>{z.name}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{z.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="two-col">
            <div className="field"><label htmlFor="q-due">Due date</label><input id="q-due" className="input" type="date" value={q.due || ''} onChange={(e) => upd({ due: e.target.value || null })} style={{ minHeight: 44 }} /></div>
            <div className="field"><label>Size</label>
              <Seg name="q-size" value={q.size} onChange={(s) => upd({ size: s })} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', width: '100%' }}
                optStyle={{ justifyContent: 'center', minHeight: 42, padding: '6px 4px' }} options={(['S', 'M', 'L'] as const).map((k) => ({ key: k, label: k }))} />
            </div>
          </div>
          <div className="field"><label htmlFor="q-camp">Campaign</label>
              <select id="q-camp" className="input" value={q.campaign || ''} onChange={(e) => upd({ campaign: e.target.value || null })} style={{ minHeight: 44 }}>
                <option value="">None</option>
                {Object.entries(data.camps).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
              </select>
          </div>
          {camp && (
            <div className="field"><label>Status in {camp.short}</label>
              <Seg name="q-status" value={q.status} onChange={(s) => actions.setStatus(q.id, s)} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', width: '100%' }}
                optStyle={{ justifyContent: 'center', minHeight: 42 }} options={STATUSES.map(([k, n]) => ({ key: k, label: n }))} />
            </div>
          )}
          {finish}
          <button className="danger-btn" onClick={remove}><Icon n="x" size={15} />Delete quest</button>
        </>
      )}
    </Sheet>
  );
}
