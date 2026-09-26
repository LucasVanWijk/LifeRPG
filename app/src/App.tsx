import { useEffect } from 'react';
import { Icon, type IconName } from './components/Icon';
import { heroName, titleFor } from './domain/model';
import { Adventure } from './screens/Adventure';
import { Calendar } from './screens/Calendar';
import { EventSheet } from './sheets/EventSheet';
import { ReviewSheet } from './sheets/ReviewSheet';
import { Glossary } from './screens/Glossary';
import { Home } from './screens/Home';
import { Quests } from './screens/Quests';
import { CampaignSheet } from './sheets/CreateSheets';
import { ProfileSheet, Welcome } from './sheets/ProfileSheet';
import { ChronicleSheet } from './sheets/ChronicleSheet';
import { NewQuestSheet, QuestSheet } from './sheets/QuestSheet';
import { useStore, type Tab } from './state/store';

const NAV: [Tab, string, IconName][] = [['home', 'Home', 'home'], ['quests', 'Quests', 'scroll'], ['calendar', 'Calendar', 'calendar'], ['glossary', 'Glossary', 'book-open'], ['adventure', 'Adventure', 'compass']];

export function App() {
  const { data, ui, setUi, isDesk, toast, lastToast, canUndo, scrollRef, actions } = useStore();
  const { hero } = data;
  const openQuest = data.quests.find((q) => q.id === ui.openId);
  const shown = toast || lastToast;

  // Escape closes whatever overlay is on top.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setUi((u) => (u.confirm ? { confirm: null } : u.levelUp ? { levelUp: false } : { openId: null, newOpen: false, campSheet: null, profileOpen: false, chronicleOpen: false, reviewOpen: false, eventSheet: null }));
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [setUi]);

  return (
    <div className={'app' + (isDesk ? ' desk' : '')}>
      {isDesk && (
        <aside className="sidebar">
          <div className="brand"><span className="seal">Q</span><span className="brand-name">Questlog</span></div>
          <nav className="side-nav" aria-label="Main">
            {NAV.map(([k, n, ic]) => (
              <button key={k} onClick={() => actions.goTab(k)} aria-current={ui.tab === k ? 'page' : undefined}><Icon n={ic} size={20} />{n}</button>
            ))}
          </nav>
          <div className="side-hero" role="button" tabIndex={0} aria-label="Open your profile" onClick={() => setUi({ profileOpen: true })} onKeyDown={(e) => e.key === 'Enter' && setUi({ profileOpen: true })}>
            <div className="heading" style={{ fontSize: 18 }}>{heroName(hero)}</div>
            <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--color-accent-800)' }}>Level {hero.level} {titleFor(hero.level)}</div>
            <div className="bar"><div style={{ width: Math.round((hero.xp / hero.next) * 100) + '%' }} /></div>
            <div className="muted tnum" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{hero.xp} / {hero.next} XP</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon n="coins" size={13} />{hero.gold}</span>
            </div>
          </div>
        </aside>
      )}

      <div className="app-main">
        <main ref={scrollRef} className={'app-scroll' + (ui.tab === 'quests' ? ' fill' : '')}>
          {ui.tab === 'home' && <Home />}
          {ui.tab === 'quests' && <Quests />}
          {ui.tab === 'glossary' && <Glossary />}
          {ui.tab === 'calendar' && <Calendar />}
          {ui.tab === 'adventure' && <Adventure />}
        </main>

        {!isDesk && (
          <nav className="tabbar" aria-label="Main">
            {NAV.map(([k, n, ic]) => (
              <button key={k} onClick={() => actions.goTab(k)} aria-current={ui.tab === k ? 'page' : undefined}>
                <span className="ind" /><Icon n={ic} size={22} /><span>{n}</span>
              </button>
            ))}
          </nav>
        )}

        {ui.tab === 'calendar' ? (
          <button className="fab" onClick={() => actions.openEvent('new')} aria-label="New event">
            <Icon n="plus" size={22} stroke={2} />{isDesk && <span>New Event</span>}
          </button>
        ) : (
          <button className="fab" onClick={() => setUi({ newOpen: true, openId: null, campSheet: null })} aria-label="New Quest">
            <Icon n="plus" size={22} stroke={2} />{isDesk && <span>New Quest</span>}
          </button>
        )}

        <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">
          <span style={{ color: 'var(--color-accent-600)' }}><Icon n="sparkles" size={17} /></span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span className="heading tnum" style={{ fontSize: 17 }}>{shown.text}</span>
            <span className="muted" style={{ fontSize: 12 }}>{shown.sub}</span>
          </span>
          {canUndo && <button className="toast-undo" onClick={actions.undoLast}>Undo</button>}
        </div>
      </div>

      {openQuest && <QuestSheet key={openQuest.id} quest={openQuest} />}
      {ui.newOpen && <NewQuestSheet />}
      {ui.campSheet && <CampaignSheet key={ui.campSheet} campKey={ui.campSheet === 'new' ? null : ui.campSheet} />}
      {ui.profileOpen && <ProfileSheet />}
      {ui.chronicleOpen && <ChronicleSheet />}
      {ui.reviewOpen && <ReviewSheet />}
      {ui.eventSheet !== null && <EventSheet key={String(ui.eventSheet)} id={ui.eventSheet} />}
      {!hero.name && <Welcome />}

      {ui.confirm && (
        <div className="modal" style={{ zIndex: 80 }} onClick={(e) => e.target === e.currentTarget && setUi({ confirm: null })}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" style={{ background: 'var(--q-parch)', width: 'min(400px,100%)' }}>
            <div id="confirm-title" className="dialog-title" style={{ fontSize: 24 }}>{ui.confirm.title}</div>
            <div className="dialog-body">{ui.confirm.body}</div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setUi({ confirm: null })} style={{ minHeight: 44 }} autoFocus={ui.confirm.tone !== 'go'}>{ui.confirm.cancelLabel ?? 'Cancel'}</button>
              <button className={ui.confirm.tone === 'go' ? 'btn btn-primary inked' : 'danger-btn'} style={{ minHeight: 44 }} autoFocus={ui.confirm.tone === 'go'}
                onClick={() => { const c = ui.confirm!; setUi({ confirm: null }); c.onConfirm(); }}>{ui.confirm.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}


      {ui.levelUp && (
        <div className="modal" style={{ zIndex: 55, background: 'color-mix(in srgb, var(--color-neutral-900) 40%, transparent)' }}>
          <div role="alertdialog" aria-modal="true" aria-label="Level up" style={{ width: 'min(320px,100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 22px 20px', textAlign: 'center', border: '1px solid color-mix(in srgb, var(--color-accent-800) 35%, transparent)', borderRadius: 'var(--radius-lg)', boxShadow: 'inset 0 0 0 5px var(--q-parch), inset 0 0 0 6px var(--color-accent-500), var(--shadow-lg)', background: 'var(--q-parch)' }}>
            <span className="seal heading tnum" style={{ width: 72, height: 72, fontSize: 34, boxShadow: 'inset 0 0 0 5px var(--q-wax), inset 0 0 0 6px rgba(255,230,200,.35), 0 3px 8px rgba(40,10,0,.35)' }}>{hero.level}</span>
            <span className="kicker">Level up</span>
            <div className="heading" style={{ fontSize: 26, lineHeight: 1.1 }}>{heroName(hero)} reaches level {hero.level}{titleFor(hero.level) !== titleFor(hero.level - 1) ? ' and becomes a ' + titleFor(hero.level) : ''}</div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>{hero.next} XP to the next level.</p>
            <button className="btn btn-primary inked" onClick={() => setUi({ levelUp: false })} style={{ minHeight: 44, minWidth: 140, marginTop: 6 }} autoFocus>Onward</button>
          </div>
        </div>
      )}
    </div>
  );
}
