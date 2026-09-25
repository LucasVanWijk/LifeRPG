import { useState } from 'react';
import { addDays, MON, parseDay, shortDate, WDL } from '../domain/dates';
import type { ChronicleEntry } from '../domain/logic';
import { chronicle, periodOf } from '../domain/logic';
import { Icon, type IconName } from '../components/Icon';
import { CloseBtn, Sheet } from '../components/common';
import { useStore } from '../state/store';

const KIND_ICON: Record<ChronicleEntry['kind'], IconName> = { quest: 'scroll', habit: 'repeat', campaign: 'flag' };
const WEEKS_SHOWN = 8;

/** History: everything completed, grouped by week with the XP earned. */
export function ChronicleSheet() {
  const { data, setUi, today } = useStore();
  const [shown, setShown] = useState(WEEKS_SHOWN);
  const close = () => setUi({ chronicleOpen: false });
  const entries = chronicle(data);
  const weeks: { monday: string; items: ChronicleEntry[]; xp: number }[] = [];
  for (const e of entries) {
    const monday = periodOf(e.date, 'weekly');
    let w = weeks[weeks.length - 1];
    if (!w || w.monday !== monday) { w = { monday, items: [], xp: 0 }; weeks.push(w); }
    w.items.push(e);
    w.xp += e.xp;
  }
  const thisMonday = periodOf(today, 'weekly');
  const weekTitle = (m: string) => (m === thisMonday ? 'This week' : m === addDays(thisMonday, -7) ? 'Last week' : 'Week of ' + shortDate(m));
  const totalXp = entries.reduce((n, e) => n + e.xp, 0);

  return (
    <Sheet onClose={close} label="History">
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}>
        <h3 style={{ fontSize: 26 }}>History</h3>
        <span style={{ marginLeft: 'auto' }}><CloseBtn onClick={close} /></span>
      </div>
      <p className="muted tnum" style={{ margin: '-8px 0 0', fontSize: 13 }}>
        {entries.length ? entries.length + ' things done · ' + totalXp + ' XP earned in all' : 'Completed quests, habit check-ins and finished campaigns will be listed here.'}
      </p>
      {weeks.slice(0, shown).map((w) => (
        <section key={w.monday} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingBottom: 4 }}>
            <h3 style={{ fontSize: 20 }}>{weekTitle(w.monday)}</h3>
            <span className="tnum" style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>+{w.xp} XP</span>
          </div>
          {w.items.map((e, i) => {
            const d = parseDay(e.date);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
                <span className="muted tnum" style={{ width: 76, flex: 'none', fontSize: 12, whiteSpace: 'nowrap' }}>{WDL[d.getDay()].slice(0, 3)} {d.getDate()} {MON[d.getMonth()]}</span>
                <span style={{ color: e.kind === 'campaign' ? 'var(--q-wax)' : 'var(--color-accent-700)' }}><Icon n={KIND_ICON[e.kind]} size={15} /></span>
                <span className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: e.kind === 'campaign' ? 600 : 400 }}>
                  {e.kind === 'campaign' ? 'Campaign complete: ' + e.title : e.title}
                </span>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>+{e.xp} XP</span>
              </div>
            );
          })}
        </section>
      ))}
      {weeks.length > shown && <button className="btn btn-secondary" onClick={() => setShown(shown + WEEKS_SHOWN)} style={{ minHeight: 44 }}>Show earlier weeks</button>}
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>XP shown is what each item is worth now; editing a quest's size or zone after finishing it changes this figure, not what you earned.</p>
    </Sheet>
  );
}

