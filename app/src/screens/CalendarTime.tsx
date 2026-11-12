import { useEffect, useRef, type DragEvent } from 'react';
import { addDays, parseDay, WDL, MON } from '../domain/dates';
import type { CalItem } from '../domain/calendar';
import { calendarItems, fromMinutes, KINDS, layoutDay, moveEventTo } from '../domain/calendar';
import { isOpen } from '../domain/quests';
import { Icon } from '../components/Icon';
import { useStore } from '../state/store';

const HOUR = 48; // px per hour
const SNAP = 15; // minutes

/** Day and week views: an hour grid with all-day items in a strip on top. Drag a quest or event onto a slot to move it. */
export function TimeGrid({ days }: { days: string[] }) {
  const { cal, today, actions, showToast } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const items = calendarItems(cal, days[0], days[days.length - 1]);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  // Start the view around the working day.
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 7 * HOUR - 4; }, [days.length]);

  const open = (it: CalItem) => {
    const [kind, id] = it.target.split(':');
    if (kind === 'event') actions.openEvent(Number(id));
    else if (kind === 'quest') actions.openQuest(Number(id));
    else actions.goGlossary(it.target);
  };
  const start = (e: DragEvent, it: CalItem) => {
    const [kind] = it.target.split(':');
    if (kind !== 'event' && kind !== 'quest') { e.preventDefault(); return; }
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.target); } catch { /* older engines */ }
  };
  const drop = (e: DragEvent, day: string, minutes: number | null) => {
    e.preventDefault();
    const [kind, idText] = (e.dataTransfer.getData('text/plain') || '').split(':');
    const id = Number(idText);
    if (kind === 'quest') {
      actions.updateQuest(id, minutes === null ? { due: day, dueTime: undefined } : { due: day, dueTime: fromMinutes(minutes) });
      showToast('Scheduled', day + (minutes === null ? '' : ' · ' + fromMinutes(minutes)));
    } else if (kind === 'event') {
      const ev = cal.events.find((x) => x.id === id);
      if (!ev) return;
      if (ev.repeat) { showToast('Repeating event', 'Open it to change every repeat.'); return; }
      actions.updateEvent(id, moveEventTo(ev, day, ev.allDay ? null : minutes));
    }
  };
  const minutesAt = (e: DragEvent, col: HTMLElement) => {
    const y = e.clientY - col.getBoundingClientRect().top;
    return Math.max(0, Math.min(24 * 60 - SNAP, Math.round(((y / HOUR) * 60) / SNAP) * SNAP));
  };

  const byDay = (d: string) => items.filter((i) => i.date === d);
  const strip = (d: string) => byDay(d).filter((i) => i.allDay || !i.time);
  const tray = cal.quests.filter((q) => isOpen(q) && (!q.due || !q.dueTime) && (!q.due || (q.due >= days[0] && q.due <= days[days.length - 1]) || q.due < today)).slice(0, 12);
  const wide = days.length > 1;

  return (
    <div className="panel tg">
      <div className="tg-scroll-x">
        <div className="tg-inner" style={{ minWidth: wide ? 56 + days.length * 104 : undefined }}>
          <div className="tg-head" style={{ gridTemplateColumns: '48px repeat(' + days.length + ', minmax(0, 1fr))' }}>
            <span />
            {days.map((d) => {
              const dt = parseDay(d);
              return (
                <div key={d} className={'tg-dayhead' + (d === today ? ' today' : '')}>
                  <span className="label" style={{ fontSize: 10 }}>{WDL[dt.getDay()].slice(0, 3)}</span>
                  <span className="heading tnum" style={{ fontSize: 20 }}>{dt.getDate()}</span>
                  {!wide && <span className="muted" style={{ fontSize: 12 }}>{MON[dt.getMonth()]}</span>}
                </div>
              );
            })}
          </div>
          <div className="tg-allday" style={{ gridTemplateColumns: '48px repeat(' + days.length + ', minmax(0, 1fr))' }}>
            <span className="muted" style={{ fontSize: 10, padding: '4px 4px 0 0', textAlign: 'right' }}>all day</span>
            {days.map((d) => (
              <div key={d} className="tg-allcell" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, d, null)}>
                {strip(d).map((it, i) => (
                  <button key={i} className="cal-chip" draggable onDragStart={(e) => start(e, it)} onClick={() => open(it)} style={{ borderLeftColor: KINDS[it.kind].color, textAlign: 'left', cursor: 'pointer' }} title={it.title}>{it.title}</button>
                ))}
              </div>
            ))}
          </div>
          <div className="tg-scroll" ref={scroller}>
            <div className="tg-body" style={{ gridTemplateColumns: '48px repeat(' + days.length + ', minmax(0, 1fr))', height: 24 * HOUR }}>
              <div className="tg-hours">
                {hours.map((h) => <span key={h} style={{ top: h * HOUR - 7 }} className="tnum">{h ? String(h).padStart(2, '0') + ':00' : ''}</span>)}
              </div>
              {days.map((d) => {
                const placed = layoutDay(byDay(d));
                const now = d === today ? new Date() : null;
                return (
                  <div key={d} className={'tg-col' + (d === today ? ' today' : '')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, d, minutesAt(e, e.currentTarget))}>
                    {hours.map((h) => <div key={h} className="tg-line" style={{ top: h * HOUR }} />)}
                    {placed.map((p, i) => (
                      <button key={i} className="tg-block" draggable onDragStart={(e) => start(e, p.item)} onClick={() => open(p.item)}
                        style={{ top: (p.start / 60) * HOUR, height: Math.max(16, ((p.end - p.start) / 60) * HOUR - 2), left: (p.col / p.cols) * 100 + '%', width: 'calc(' + 100 / p.cols + '% - 2px)', borderLeftColor: KINDS[p.item.kind].color }}
                        title={p.item.title + ' ' + fromMinutes(p.start) + '–' + fromMinutes(p.end % 1440)}>
                        <span className="tnum" style={{ opacity: 0.75 }}>{fromMinutes(p.start)}</span> {p.item.title}
                      </button>
                    ))}
                    {now && <div className="tg-now" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {tray.length > 0 && (
        <div className="tg-tray">
          <span className="label">Drag a quest onto a slot to schedule it</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 6 }}>
            {tray.map((q) => (
              <span key={q.id} className="chip" draggable onDragStart={(e) => { try { e.dataTransfer.setData('text/plain', 'quest:' + q.id); e.dataTransfer.effectAllowed = 'move'; } catch { /* ignore */ } }}
                onClick={() => actions.openQuest(q.id)} style={{ minHeight: 34, padding: '2px 10px', fontSize: 14, cursor: 'grab' }}>
                <Icon n="scroll" size={13} />{q.title}{q.due ? ' · ' + q.due.slice(5) : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The seven days of the week containing `day`, Monday first. */
export const weekOf = (day: string) => { const mon = addDays(day, -((parseDay(day).getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); };
