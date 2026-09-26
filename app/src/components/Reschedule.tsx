import { addDays } from '../domain/dates';
import type { Quest } from '../domain/model';
import { useStore } from '../state/store';

/** Quick fixes for an overdue quest: move it to tomorrow or a week out, or drop the date. */
export function RescheduleButtons({ q, compact = false }: { q: Quest; compact?: boolean }) {
  const { today, actions, showToast } = useStore();
  const move = (due: string | null, label: string) => { actions.updateQuest(q.id, { due }); showToast('Rescheduled', q.title + ' · ' + label); };
  const style = compact ? { minHeight: 30, padding: '2px 8px', fontSize: 12 } : { minHeight: 36, fontSize: 13 };
  return (
    <span className="reschedule" role="group" aria-label={'Reschedule ' + q.title}>
      <button className="btn btn-secondary" style={style} onClick={() => move(addDays(today, 1), 'tomorrow')}>Tomorrow</button>
      <button className="btn btn-secondary" style={style} onClick={() => move(addDays(today, 7), 'next week')}>Next week</button>
      <button className="btn btn-ghost inked" style={style} onClick={() => move(null, 'no date')}>No date</button>
    </span>
  );
}

export const isOverdue = (q: Quest, today: string) => q.status !== 'done' && !!q.due && q.due < today;
