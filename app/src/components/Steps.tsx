import type { Quest } from '../domain/model';
import { Icon } from './Icon';

/**
 * A quest's steps as a tickable checklist. On cards it is compact and stops clicks from
 * opening the card, so a step can be ticked straight from the board.
 */
export function StepChecklist({ quest, onToggle, compact = false }: { quest: Quest; onToggle: (stepId: number) => void; compact?: boolean }) {
  if (!quest.steps.length) return null;
  const box = compact ? 14 : 20;
  return (
    <ul className={'steps' + (compact ? ' compact' : '')} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {quest.steps.map((s) => (
        <li key={s.id}>
          <button onClick={() => onToggle(s.id)} aria-pressed={s.done} aria-label={(s.done ? 'Untick ' : 'Tick ') + s.t} draggable={false}>
            <span className={'checkbox' + (s.done ? ' on' : '')} style={{ width: box, height: box }}>{s.done && <Icon n="check" size={box - 5} stroke={2.6} />}</span>
            <span className="step-text" style={{ textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--color-accent-700)' : 'inherit' }}>{s.t}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "2/5" for a quest with steps, or null. */
export const stepCount = (q: Quest) => (q.steps.length ? q.steps.filter((s) => s.done).length + '/' + q.steps.length : null);
