import { addDays, parseDay, shortDate } from '../domain/dates';
import { calendarItems, KINDS } from '../domain/calendar';
import { chronicle, habitStreak, habitTarget, periodOf } from '../domain/logic';
import { EVERY_NAME, streakText } from '../domain/model';
import type { Data } from '../domain/model';
import { Icon } from '../components/Icon';
import { CloseBtn, Sheet } from '../components/common';
import { isOverdue, RescheduleButtons } from '../components/Reschedule';
import { KindMark } from '../screens/Calendar';
import { useStore } from '../state/store';

/** The week to review: this week on Sunday, otherwise the week that just ended. */
export const reviewWeek = (today: string) => {
  const monday = periodOf(today, 'weekly');
  return parseDay(today).getDay() === 0 ? monday : addDays(monday, -7);
};

/** Home shows the review card until that week's review is done (and only once there is something to review). */
export const reviewDue = (data: Data, today: string) =>
  (data.quests.length + data.habits.length > 0) && data.hero.reviewedWeek !== reviewWeek(today);

export function ReviewSheet() {
  const { data, today, setUi, actions } = useStore();
  const monday = reviewWeek(today), sunday = addDays(monday, 6);
  const inWeek = (d: string) => d >= monday && d <= sunday;
  const done = chronicle(data).filter((e) => inWeek(e.date));
  const quests = done.filter((e) => e.kind === 'quest');
  const xp = done.reduce((n, e) => n + e.xp, 0);
  const overdue = data.quests.filter((q) => isOverdue(q, today));
  const coming = calendarItems(data, today, addDays(today, 6));
  const close = () => setUi({ reviewOpen: false });

  return (
    <Sheet onClose={close} label="Weekly review">
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}>
        <div style={{ flex: 1 }}>
          <span className="kicker">Your week in review</span>
          <h3 style={{ fontSize: 26 }}>{shortDate(monday)} – {shortDate(sunday)}</h3>
        </div>
        <CloseBtn onClick={close} />
      </div>

      <div className="facts" style={{ gridTemplateColumns: 'repeat(3,1fr)', borderTop: '1px solid var(--q-rule)', borderBottom: '1px solid var(--q-rule)' }}>
        {[['Quests done', quests.length], ['Check-ins', done.filter((e) => e.kind === 'habit').length], ['XP earned', xp]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0' }}>
            <span className="label" style={{ fontSize: 10 }}>{k}</span>
            <span className="heading tnum" style={{ fontSize: 24 }}>{v}</span>
          </div>
        ))}
      </div>
      {quests.length > 0 && (
        <div>
          <div className="label">Finished</div>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>{quests.map((e) => e.title).join(' · ')}</p>
        </div>
      )}

      {data.habits.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 21, paddingBottom: 4 }}>Habits</h3>
          {data.habits.map((h) => {
            const days = new Set(h.log.filter(inWeek)).size;
            const target = h.every === 'daily' ? 7 : habitTarget(h);
            const streak = habitStreak(h, today);
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--q-rule)' }}>
                <span style={{ flex: 1, minWidth: 0 }}>{h.title} <span className="muted" style={{ fontSize: 12 }}>· {EVERY_NAME[h.every]}</span></span>
                <span className="tnum" style={{ fontSize: 13, color: days >= target ? 'var(--q-moss)' : 'var(--color-accent-800)' }}>{Math.min(days, 7)}/{target}{h.every === 'daily' ? ' days' : ''}</span>
                {streak > 0 && <span className="tnum" style={{ fontSize: 12, color: 'var(--q-wax)' }}>{streakText(streak, h.every)}</span>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: 21, paddingBottom: 4 }}>Overdue</h3>
        {overdue.map((q) => (
          <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
            <span><span className="heading" style={{ fontSize: 17 }}>{q.title}</span> <span className="tnum" style={{ fontSize: 12, color: 'var(--q-wax)' }}>was due {shortDate(q.due!)}</span></span>
            <RescheduleButtons q={q} compact />
          </div>
        ))}
        {!overdue.length && <p className="muted" style={{ margin: 0, padding: '8px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>Nothing overdue.</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: 21, paddingBottom: 4 }}>Coming up</h3>
        {coming.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--q-rule)', fontSize: 14 }}>
            <span className="muted tnum" style={{ width: 54, flex: 'none', fontSize: 12 }}>{shortDate(it.date)}</span>
            <KindMark kind={it.kind} />
            <span style={{ flex: 1, minWidth: 0 }} className="ellipsis">{it.title}</span>
            <span className="muted" style={{ fontSize: 11 }}>{it.time ?? KINDS[it.kind].name}</span>
          </div>
        ))}
        {!coming.length && <p className="muted" style={{ margin: 0, padding: '8px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>A quiet week ahead.</p>}
      </div>

      <button className="btn btn-primary inked" onClick={() => actions.markReviewed(monday)} style={{ minHeight: 46 }}><Icon n="check" size={16} />Done</button>
    </Sheet>
  );
}
