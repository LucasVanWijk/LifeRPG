import { useState } from 'react';
import { weekdayDate } from '../domain/dates';
import { repeatText } from '../domain/calendar';
import type { CalEvent, Repeat } from '../domain/model';
import { Icon } from '../components/Icon';
import { CloseBtn, Seg, Sheet } from '../components/common';
import { KindMark } from '../screens/Calendar';
import { useStore } from '../state/store';

type Draft = Omit<CalEvent, 'id'>;
type RepeatKey = 'none' | Repeat['every'];

/** Shows an event, or the form to create or edit one. Changes to a repeating event apply to every repeat. */
export function EventSheet({ id }: { id: number | 'new' }) {
  const { data, ui, setUi, actions } = useStore();
  const existing = id === 'new' ? undefined : data.events.find((e) => e.id === id);
  const editing = id === 'new' || ui.eventMode === 'edit';
  const close = () => setUi({ eventSheet: null });
  if (id !== 'new' && !existing) return null;

  if (!editing && existing) {
    const e = existing;
    const same = e.start === e.end;
    const when = e.allDay
      ? (same ? weekdayDate(e.start) : weekdayDate(e.start) + ' – ' + weekdayDate(e.end)) + ' · all day'
      : weekdayDate(e.start) + ' ' + (e.startTime ?? '') + ' – ' + (same ? '' : weekdayDate(e.end) + ' ') + (e.endTime ?? '');
    const people = e.companions.map((cid) => data.companions.find((c) => c.id === cid)).filter((c) => !!c);
    return (
      <Sheet onClose={close} label={e.title}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
          <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 7 }} className="kicker"><KindMark kind="event" />Event</span>
          <button className="btn btn-secondary" onClick={() => setUi({ eventMode: 'edit' })} style={{ minHeight: 40 }}><Icon n="pencil" size={15} />Edit</button>
          <CloseBtn onClick={close} />
        </div>
        <h2 style={{ margin: '-4px 0 0', fontSize: 30, lineHeight: 1.12, textWrap: 'pretty' }}>{e.title}</h2>
        <div className="event-facts">
          <div><Icon n="calendar" size={16} /><span className="tnum">{when}</span></div>
          <div><Icon n="repeat" size={16} /><span>{repeatText(e, weekdayDate)}</span></div>
          {e.location && <div><Icon n="pin" size={16} /><span>{e.location}</span></div>}
        </div>
        {people.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span className="label" style={{ marginRight: 4 }}>With</span>
            {people.map((c) => (
              <button key={c!.id} className="chip" onClick={() => { close(); actions.goGlossary('companion:' + c!.id); }} style={{ minHeight: 34, padding: '2px 10px', fontSize: 15 }}>
                <Icon n="users" size={13} />{c!.name}
              </button>
            ))}
          </div>
        )}
        {e.notes && <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 15, borderTop: '1px solid var(--q-rule)', paddingTop: 12 }}>{e.notes}</p>}
      </Sheet>
    );
  }
  return <EventForm existing={existing} />;
}

function EventForm({ existing }: { existing?: CalEvent }) {
  const { data, ui, setUi, actions } = useStore();
  const [e, setE] = useState<Draft>(() => existing ?? {
    title: '', start: ui.calDay, end: ui.calDay, allDay: false, startTime: '09:00', endTime: '10:00',
    repeat: null, location: '', notes: '', companions: [],
  });
  const set = (patch: Partial<Draft>) => setE((cur) => {
    const next = { ...cur, ...patch };
    if (next.end < next.start) next.end = next.start;
    return next;
  });
  const repeatKey: RepeatKey = e.repeat?.every ?? 'none';
  const setRepeat = (k: RepeatKey) => set({ repeat: k === 'none' ? null : { every: k, interval: e.repeat?.interval ?? 1, until: e.repeat?.until } });
  const timeOk = e.allDay || e.start < e.end || (e.startTime ?? '') <= (e.endTime ?? '');
  const valid = e.title.trim() && timeOk;
  const close = () => (existing ? setUi({ eventMode: 'view' }) : setUi({ eventSheet: null }));
  const save = () => {
    if (!valid) return;
    const clean: Draft = { ...e, title: e.title.trim(), startTime: e.allDay ? undefined : e.startTime, endTime: e.allDay ? undefined : e.endTime };
    if (existing) { actions.updateEvent(existing.id, clean); setUi({ eventMode: 'view', calDay: clean.start }); }
    else actions.createEvent(clean);
  };
  const remove = () => existing && actions.confirm({
    title: 'Delete this event?',
    body: '“' + existing.title + '”' + (existing.repeat ? ' and every repeat of it' : '') + ' will be removed from your calendar.',
    confirmLabel: 'Delete event',
    onConfirm: () => actions.deleteEvent(existing.id),
  });

  return (
    <Sheet onClose={() => setUi({ eventSheet: null })} label={existing ? 'Edit event' : 'New event'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <h3 style={{ flex: 1, fontSize: 26 }}>{existing ? 'Edit event' : 'New event'}</h3>
        <CloseBtn onClick={() => setUi({ eventSheet: null })} />
      </div>
      <input className="title-input" value={e.title} onChange={(ev) => set({ title: ev.target.value })} placeholder="Add a title" aria-label="Title" autoFocus={!existing} />
      <label className="toggle-row">
        <input type="checkbox" checked={e.allDay} onChange={(ev) => set({ allDay: ev.target.checked })} />
        <span>All day</span>
      </label>
      <div className="two-col">
        <div className="field"><label htmlFor="ev-start">Starts</label><input id="ev-start" className="input" type="date" value={e.start} onChange={(ev) => ev.target.value && set({ start: ev.target.value })} style={{ minHeight: 44 }} /></div>
        {!e.allDay && <div className="field"><label htmlFor="ev-st">at</label><input id="ev-st" className="input" type="time" value={e.startTime ?? ''} onChange={(ev) => set({ startTime: ev.target.value })} style={{ minHeight: 44 }} /></div>}
      </div>
      <div className="two-col">
        <div className="field"><label htmlFor="ev-end">Ends</label><input id="ev-end" className="input" type="date" value={e.end} min={e.start} onChange={(ev) => ev.target.value && set({ end: ev.target.value })} style={{ minHeight: 44 }} /></div>
        {!e.allDay && <div className="field"><label htmlFor="ev-et">at</label><input id="ev-et" className="input" type="time" value={e.endTime ?? ''} onChange={(ev) => set({ endTime: ev.target.value })} style={{ minHeight: 44 }} /></div>}
      </div>
      {!timeOk && <p style={{ margin: '-6px 0 0', fontSize: 12, color: 'var(--q-wax)' }}>The event ends before it starts.</p>}
      <div className="field"><label>Repeats</label>
        <Seg<RepeatKey> name="ev-repeat" value={repeatKey} onChange={setRepeat} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', width: '100%' }}
          optStyle={{ justifyContent: 'center', minHeight: 40, padding: '6px 2px', fontSize: 13 }}
          options={[{ key: 'none', label: 'No' }, { key: 'daily', label: 'Daily' }, { key: 'weekly', label: 'Weekly' }, { key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly' }]} />
      </div>
      {e.repeat && (
        <div className="two-col">
          <div className="field"><label htmlFor="ev-int">Every</label>
            <select id="ev-int" className="input" value={e.repeat.interval} onChange={(ev) => set({ repeat: { ...e.repeat!, interval: Number(ev.target.value) } })} style={{ minHeight: 44 }}>
              {[1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n === 1 ? 'Every ' : 'Every ' + n + ' '}{{ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[e.repeat!.every]}{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="ev-until">Until (optional)</label><input id="ev-until" className="input" type="date" value={e.repeat.until ?? ''} min={e.start} onChange={(ev) => set({ repeat: { ...e.repeat!, until: ev.target.value || undefined } })} style={{ minHeight: 44 }} /></div>
        </div>
      )}
      {existing?.repeat && <p className="muted" style={{ margin: '-6px 0 0', fontSize: 12 }}>Changes apply to every repeat.</p>}
      <div className="field"><label htmlFor="ev-loc">Location</label><input id="ev-loc" className="input" value={e.location} onChange={(ev) => set({ location: ev.target.value })} placeholder="Add a place" style={{ minHeight: 44 }} /></div>
      {data.companions.length > 0 && (
        <div className="field"><label>Companions</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.companions.map((c) => {
              const on = e.companions.includes(c.id);
              return (
                <button key={c.id} className="chip" aria-pressed={on} onClick={() => set({ companions: on ? e.companions.filter((x) => x !== c.id) : [...e.companions, c.id] })} style={{ minHeight: 38, padding: '4px 10px', fontSize: 15 }}>
                  {on && <Icon n="check" size={13} stroke={2.2} />}{c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="field"><label htmlFor="ev-notes">Notes</label><textarea id="ev-notes" className="input" value={e.notes} onChange={(ev) => set({ notes: ev.target.value })} style={{ minHeight: 70, fontSize: 14 }} /></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {existing && <button className="danger-btn" onClick={remove}>Delete</button>}
        <span style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={close} style={{ minHeight: 44 }}>Cancel</button>
        <button className="btn btn-primary inked" onClick={save} disabled={!valid} style={{ minHeight: 44 }}>{existing ? 'Save' : 'Add event'}</button>
      </div>
    </Sheet>
  );
}
