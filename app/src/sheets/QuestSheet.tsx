import { useState } from 'react';
import { weekdayDate } from '../domain/dates';
import type { QuadKey, Quest, QuestNote, QuestStep } from '../domain/model';
import { QM, QUADS, reward, STATUS_NAME, STATUSES } from '../domain/model';
import { Icon } from '../components/Icon';
import { StepChecklist, stepCount } from '../components/Steps';
import { CloseBtn, CompleteButton, DoneBanner, onEnter, questView, Seg, Sheet } from '../components/common';
import { useStore } from '../state/store';

const uid = () => Date.now() + Math.floor(Math.random() * 1000);

function Kicker({ quad, campName }: { quad: QuadKey; campName?: string }) {
  return (
    <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: QM[quad].color }}>
      <span className="dot" style={{ width: 8, height: 8 }} /><span className="ellipsis">{QM[quad].name + (campName ? ' · ' + campName : '')}</span>
    </span>
  );
}

function RewardBadge({ q }: { q: Pick<Quest, 'size' | 'quad'> }) {
  const r = reward(q);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
      <span className="pill" style={{ fontSize: 13, padding: '3px 9px' }}><Icon n="sparkles" size={13} />+{r.xp} XP · +{r.gold} gold</span>
    </div>
  );
}

/** A list of short lines (notes or steps) that can be edited in place, removed, and added to. */
function LineEditor<T extends { id: number; t: string }>({ label, items, set, make, placeholder }: {
  label: string; items: T[]; set: (items: T[]) => void; make: (t: string) => T; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (!t) return; set([...items, make(t)]); setDraft(''); };
  return (
    <div className="field"><label>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((n) => (
          <div key={n.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="input" value={n.t} aria-label={label} onChange={(e) => { const t = e.target.value; set(items.map((x) => (x.id === n.id ? { ...x, t } : x))); }} style={{ flex: 1, minHeight: 42, fontSize: 14 }} />
            <button className="btn btn-icon btn-ghost inked" onClick={() => set(items.filter((x) => x.id !== n.id))} aria-label={'Remove ' + n.t} style={{ width: 42, height: 42, flex: 'none' }}><Icon n="x" size={16} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="input" placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEnter(add)} style={{ flex: 1, minHeight: 42, fontSize: 14, borderStyle: 'dashed' }} />
          <button className="btn btn-primary btn-icon" onClick={add} aria-label={placeholder} style={{ width: 42, height: 42, flex: 'none' }}><Icon n="plus" size={18} /></button>
        </div>
      </div>
    </div>
  );
}

/** The quest form, shared by New Quest and Edit quest. */
function QuestForm({ q, set, isNew, onStatus }: { q: Omit<Quest, 'id'>; set: (patch: Partial<Quest>) => void; isNew: boolean; onStatus?: (s: Quest['status']) => void }) {
  const { data } = useStore();
  const camp = q.campaign ? data.camps[q.campaign] : undefined;
  return (
    <>
      <input className="title-input" value={q.title} onChange={(e) => set({ title: e.target.value })} aria-label="Title" placeholder="What needs doing?" autoFocus={isNew}
        style={isNew ? undefined : { marginTop: -8, borderBottom: '1px solid var(--q-rule)', padding: '4px 0 8px', fontSize: 29, lineHeight: 1.15 }} />
      {isNew
        ? <p className="muted" style={{ margin: '-4px 0 0', fontSize: 12 }}>Only a title is needed; everything else can be filled in later.</p>
        : <RewardBadge q={q} />}
      <LineEditor<QuestStep> label="Steps" placeholder="Add a step" items={q.steps} set={(steps) => set({ steps })} make={(t) => ({ id: uid(), t, done: false })} />
      <LineEditor<QuestNote> label="Notes" placeholder="Add a note" items={q.notes} set={(notes) => set({ notes })} make={(t) => ({ id: uid(), t })} />
      <div className="field"><label>Quadrant</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {QUADS.map((z) => (
            <button key={z.key} className="opt-btn" aria-pressed={q.quad === z.key} onClick={() => set({ quad: z.key })}>
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
        <div className="field"><label htmlFor="q-due">Due date</label><input id="q-due" className="input" type="date" value={q.due || ''} onChange={(e) => set({ due: e.target.value || null })} style={{ minHeight: 44 }} /></div>
        <div className="field"><label>Size</label>
          <Seg name="q-size" value={q.size} onChange={(s) => set({ size: s })} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', width: '100%' }}
            optStyle={{ justifyContent: 'center', minHeight: 42, padding: '6px 4px' }} options={(['S', 'M', 'L'] as const).map((k) => ({ key: k, label: k }))} />
        </div>
      </div>
      <div className="field"><label htmlFor="q-camp">Campaign</label>
        <select id="q-camp" className="input" value={q.campaign || ''} onChange={(e) => set({ campaign: e.target.value || null })} style={{ minHeight: 44 }}>
          <option value="">None</option>
          {Object.entries(data.camps).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
        </select>
      </div>
      {camp && onStatus && (
        <div className="field"><label>Status in {camp.name}</label>
          <Seg name="q-status" value={q.status} onChange={onStatus} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', width: '100%' }}
            optStyle={{ justifyContent: 'center', minHeight: 42 }} options={STATUSES.map(([k, n]) => ({ key: k, label: n }))} />
        </div>
      )}
    </>
  );
}

/** New Quest: the edit form on a draft. Starts in the campaign or zone you are looking at. */
export function NewQuestSheet() {
  const { data, ui, setUi, actions } = useStore();
  const onCampaigns = ui.tab === 'quests' && ui.questView === 'campaign';
  const campKey = data.camps[ui.campaign] ? ui.campaign : Object.keys(data.camps)[0] ?? null;
  const [q, setQ] = useState<Omit<Quest, 'id'>>(() => ({
    title: '', quad: (ui.tab === 'quests' && ui.questView === 'board' && ui.mobileZone) || 'side', due: null, size: 'M',
    campaign: onCampaigns ? campKey : null, status: 'todo', notes: [], steps: [],
  }));
  const close = () => setUi({ newOpen: false });
  const create = () => {
    if (!q.title.trim()) return;
    actions.createQuest({ ...q, title: q.title.trim() });
    close();
  };
  return (
    <Sheet onClose={close} label="New Quest">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <Kicker quad={q.quad} campName={q.campaign ? data.camps[q.campaign]?.name : undefined} />
        <CloseBtn onClick={close} />
      </div>
      <h3 style={{ fontSize: 26, marginTop: -6 }}>New Quest</h3>
      <QuestForm q={q} set={(patch) => setQ((cur) => ({ ...cur, ...patch }))} isNew />
      <RewardBadge q={q} />
      <button className="btn btn-primary" onClick={create} disabled={!q.title.trim()} style={{ minHeight: 50, fontSize: 18, color: 'var(--color-accent-700)', borderColor: 'var(--color-accent-600)' }}>Pin to the board</button>
    </Sheet>
  );
}

/** Quest detail (read-only, with steps, notes and completion) and Edit quest. */
export function QuestSheet({ quest: q }: { quest: Quest }) {
  const { data, ui, setUi, today, actions } = useStore();
  const [noteDraft, setNoteDraft] = useState('');
  const [stepDraft, setStepDraft] = useState('');
  const v = questView(q, today, data.camps);
  const camp = q.campaign ? data.camps[q.campaign] : undefined;
  const editing = ui.sheetMode === 'edit';
  const close = () => setUi({ openId: null });
  const upd = (patch: Partial<Quest>) => actions.updateQuest(q.id, patch);
  const addNote = () => { const t = noteDraft.trim(); if (!t) return; upd({ notes: [...q.notes, { id: uid(), t }] }); setNoteDraft(''); };
  const addStep = () => { const t = stepDraft.trim(); if (!t) return; upd({ steps: [...q.steps, { id: uid(), t, done: false }] }); setStepDraft(''); };
  const complete = () => { actions.complete(q.id); close(); };
  const remove = () => actions.confirm({
    title: 'Delete this quest?',
    body: '“' + q.title + '” and its steps and notes will be gone. Rewards already earned are kept.',
    confirmLabel: 'Delete quest',
    onConfirm: () => actions.deleteQuest(q.id),
  });
  const finish = v.done ? <DoneBanner onReopen={() => actions.undo(q.id)} /> : <CompleteButton label="Complete quest" onClick={complete} />;
  const count = stepCount(q);

  return (
    <Sheet onClose={close} label={editing ? 'Edit quest' : q.title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <Kicker quad={q.quad} campName={camp?.name} />
        {editing
          ? <button className="btn btn-primary inked" onClick={() => setUi({ sheetMode: 'view' })} style={{ minHeight: 40 }}><Icon n="check" size={15} />Done</button>
          : <button className="btn btn-secondary" onClick={() => setUi({ sheetMode: 'edit' })} style={{ minHeight: 40 }}><Icon n="pencil" size={15} />Edit</button>}
        <CloseBtn onClick={close} />
      </div>

      {!editing ? (
        <>
          <h2 style={{ margin: '-4px 0 0', fontSize: 30, lineHeight: 1.12, textWrap: 'pretty' }}>{q.title}</h2>
          <RewardBadge q={q} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, borderTop: '1px solid var(--q-rule)' }}>
            {[
              { k: 'Quadrant', v: QM[q.quad].name, color: QM[q.quad].color },
              { k: 'Due', v: q.due ? weekdayDate(q.due) : 'No due date', color: q.due && q.due < today && !v.done ? 'var(--q-wax)' : 'var(--q-ink)' },
              { k: 'Size', v: q.size },
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
              <h3 style={{ fontSize: 22 }}>Steps</h3>
              {count && <span className="muted tnum" style={{ fontSize: 12 }}>{count} done</span>}
            </div>
            <div style={{ borderTop: '1px solid var(--q-rule)' }}>
              <StepChecklist quest={q} onToggle={(sid) => actions.toggleStep(q.id, sid)} />
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: q.steps.length ? '1px solid var(--q-rule)' : undefined }}>
              <input className="input" placeholder="Add a step" value={stepDraft} onChange={(e) => setStepDraft(e.target.value)} onKeyDown={onEnter(addStep)} style={{ flex: 1, minHeight: 44 }} />
              <button className="btn btn-primary inked" onClick={addStep} style={{ minHeight: 44 }}>Add</button>
            </div>
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
              <input className="input" placeholder="Add a note" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={onEnter(addNote)} style={{ flex: 1, minHeight: 44 }} />
              <button className="btn btn-primary inked" onClick={addNote} style={{ minHeight: 44 }}>Add</button>
            </div>
          </div>
          {finish}
        </>
      ) : (
        <>
          <QuestForm q={q} set={upd} isNew={false} onStatus={(s) => actions.setStatus(q.id, s)} />
          {finish}
          <button className="danger-btn" onClick={remove}><Icon n="x" size={15} />Delete quest</button>
        </>
      )}
    </Sheet>
  );
}
