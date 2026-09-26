import { useRef } from 'react';
import { addDays, addMonths, MONL, parseDay, weekdayDate, WDL } from '../domain/dates';
import type { CalItem, CalKind } from '../domain/calendar';
import { calendarItems, KINDS } from '../domain/calendar';
import { parseIcs } from '../domain/ics';
import { Icon } from '../components/Icon';
import { ScreenHead } from '../components/common';
import { useStore } from '../state/store';

/** The shape that goes with each kind's colour, so identity never rests on colour alone. */
export function KindMark({ kind, size = 8 }: { kind: CalKind; size?: number }) {
  const k = KINDS[kind];
  const base = { width: size, height: size, flex: 'none' as const, background: k.color, display: 'inline-block' };
  if (k.shape === 'circle') return <span aria-hidden style={{ ...base, borderRadius: '50%' }} />;
  if (k.shape === 'square') return <span aria-hidden style={{ ...base, borderRadius: 1 }} />;
  if (k.shape === 'diamond') return <span aria-hidden style={{ ...base, width: size * 0.8, height: size * 0.8, transform: 'rotate(45deg)', margin: size * 0.1 }} />;
  return <span aria-hidden style={{ ...base, background: 'none', width: 0, height: 0, borderLeft: size / 2 + 'px solid transparent', borderRight: size / 2 + 'px solid transparent', borderBottom: size + 'px solid ' + k.color }} />;
}

export function Legend() {
  return (
    <div className="cal-legend">
      {(Object.keys(KINDS) as CalKind[]).map((k) => <span key={k}><KindMark kind={k} />{KINDS[k].name}</span>)}
    </div>
  );
}

const monthStart = (d: string) => d.slice(0, 8) + '01';

export function Calendar() {
  const { data, ui, setUi, today, isDesk, actions, showToast } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const sel = ui.calDay;
  const first = monthStart(sel);
  const gridStart = addDays(first, -((parseDay(first).getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Drop a trailing week that is entirely next month.
  const weeks = days[35].slice(0, 7) !== first.slice(0, 7) ? 5 : 6;
  const shown = days.slice(0, weeks * 7);
  const items = calendarItems(data, shown[0], shown[shown.length - 1]);
  const byDay = new Map<string, CalItem[]>();
  for (const it of items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
  const month = parseDay(first);
  const go = (months: number) => setUi({ calDay: addMonths(first, months) });

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    const res = parseIcs(await f.text());
    if (file.current) file.current.value = '';
    if (!res.events.length) { showToast('No events found', f.name); return; }
    actions.confirm({
      title: 'Import ' + res.events.length + (res.events.length === 1 ? ' event?' : ' events?'),
      body: (res.simplified ? res.simplified + ' repeat rules are more complex than Questlog supports and will repeat more simply. ' : '') +
        'Events you imported before are skipped.' + (res.skipped ? ' ' + res.skipped + ' entries without a date were left out.' : ''),
      confirmLabel: 'Import', tone: 'go',
      onConfirm: () => { const n = actions.importEvents(res.events); showToast(n + (n === 1 ? ' event imported' : ' events imported'), n < res.events.length ? res.events.length - n + ' already in your calendar' : f.name); },
    });
  };

  return (
    <div className="screen" style={{ gap: 14 }}>
      <ScreenHead kicker={items.filter((i) => i.kind === 'event').length + ' events this month'} title="Calendar">
        <span style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary" onClick={() => file.current?.click()} style={{ minHeight: 40 }} title="Import an .ics file, e.g. exported from Google Calendar">Import</button>
          <button className="btn btn-primary inked" onClick={() => actions.openEvent('new')} style={{ minHeight: 40 }}><Icon n="plus" size={15} />Event</button>
        </span>
        <input ref={file} type="file" accept=".ics,text/calendar" hidden onChange={(e) => importFile(e.target.files?.[0])} />
      </ScreenHead>

      <div className="cal-layout">
        <section className="panel cal-month">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 8px' }}>
            <h2 style={{ flex: 1, fontSize: 26 }}>{MONL[month.getMonth()]} <span className="muted tnum" style={{ fontWeight: 400 }}>{month.getFullYear()}</span></h2>
            <button className="btn btn-ghost inked" onClick={() => setUi({ calDay: today })} disabled={first === monthStart(today)}>Today</button>
            <button className="btn btn-icon btn-secondary" onClick={() => go(-1)} aria-label="Previous month" style={{ width: 40, height: 40 }}><Icon n="chevron-left" size={18} /></button>
            <button className="btn btn-icon btn-secondary" onClick={() => go(1)} aria-label="Next month" style={{ width: 40, height: 40 }}><Icon n="chevron-right" size={18} /></button>
          </div>
          <div className="cal-grid" role="grid" aria-label={MONL[month.getMonth()] + ' ' + month.getFullYear()}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => <div key={w} className="cal-wd" role="columnheader">{isDesk ? w : w[0]}</div>)}
            {shown.map((d) => {
              const list = byDay.get(d) ?? [];
              const out = d.slice(0, 7) !== first.slice(0, 7);
              const cls = 'cal-day' + (out ? ' out' : '') + (d === today ? ' today' : '') + (d === sel ? ' sel' : '');
              return (
                <button key={d} className={cls} role="gridcell" aria-selected={d === sel} onClick={() => setUi({ calDay: d })}
                  aria-label={weekdayDate(d) + (list.length ? ', ' + list.length + (list.length === 1 ? ' item' : ' items') : '')}>
                  <span className="cal-num tnum">{parseDay(d).getDate()}</span>
                  {isDesk ? (
                    <span className="cal-chips">
                      {list.slice(0, 3).map((it, i) => (
                        <span key={i} className="cal-chip" style={{ borderLeftColor: KINDS[it.kind].color }}>
                          {it.time && <span className="tnum" style={{ opacity: 0.75 }}>{it.time} </span>}{it.title}
                        </span>
                      ))}
                      {list.length > 3 && <span className="muted" style={{ fontSize: 11 }}>+{list.length - 3} more</span>}
                    </span>
                  ) : (
                    <span className="cal-dots">
                      {list.slice(0, 4).map((it, i) => <KindMark key={i} kind={it.kind} size={6} />)}
                      {list.length > 4 && <span style={{ fontSize: 9, lineHeight: 1 }}>+{list.length - 4}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ padding: '8px 14px 12px' }}><Legend /></div>
        </section>

        <DayAgenda day={sel} items={byDay.get(sel) ?? calendarItems(data, sel, sel)} />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        To bring over Google Calendar: on a computer open calendar.google.com → Settings → Import &amp; export → Export, unzip the download and choose the .ics file under Import.
      </p>
    </div>
  );
}

/** One day's items, used by the Calendar tab. Tapping opens the event, the quest or the Glossary entry. */
export function DayAgenda({ day, items }: { day: string; items: CalItem[] }) {
  const { data, actions } = useStore();
  const d = parseDay(day);
  const open = (it: CalItem) => {
    const [kind, id] = it.target.split(':');
    if (kind === 'event') actions.openEvent(Number(id));
    else if (kind === 'quest') actions.openQuest(Number(id));
    else actions.goGlossary(it.target);
  };
  const names = (ids?: string[]) => (ids ?? []).map((id) => data.companions.find((c) => c.id === id)?.first).filter(Boolean).join(', ');
  return (
    <section className="panel cal-agenda">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingBottom: 6 }}>
        <h3 style={{ fontSize: 22 }}>{WDL[d.getDay()]} {d.getDate()} {MONL[d.getMonth()]}</h3>
        <button className="btn btn-ghost inked" onClick={() => actions.openEvent('new')}><Icon n="plus" size={14} />Add event</button>
      </div>
      {items.map((it, i) => (
        <button key={i} className="agenda-item" onClick={() => open(it)} style={{ borderLeftColor: KINDS[it.kind].color }}>
          <span className="agenda-time tnum">
            {it.allDay ? 'All day' : (it.time ?? '…') + (it.endTime ? '–' + it.endTime : '')}
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="heading" style={{ fontSize: 17, lineHeight: 1.2 }}>{it.title}</span>
            <span className="meta">
              <span style={{ gap: 5 }}><KindMark kind={it.kind} size={7} />{KINDS[it.kind].name}{it.span ? ' · day ' + it.span.day + ' of ' + it.span.of : ''}</span>
              {it.location && <span style={{ gap: 4 }}><Icon n="pin" size={11} />{it.location}</span>}
              {names(it.companions) && <span style={{ gap: 4 }}><Icon n="users" size={11} />with {names(it.companions)}</span>}
            </span>
          </span>
          <Icon n="chevron-right" size={15} />
        </button>
      ))}
      {!items.length && <p className="muted" style={{ margin: 0, padding: '10px 0', fontStyle: 'italic', fontSize: 14 }}>Nothing planned.</p>}
    </section>
  );
}
