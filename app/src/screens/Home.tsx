import { addDays, longDate, MON, MONL, parseDay, shortDate, WDL } from '../domain/dates';
import { checkedInToday, habitDone, habitProgress, habitStreak } from '../domain/logic';
import type { CalItem } from '../domain/calendar';
import { calendarItems, kindText } from '../domain/calendar';
import { isOverdue, RescheduleButtons } from '../components/Reschedule';
import { KindMark, Legend } from './Calendar';
import { reviewDue, reviewWeek } from '../sheets/ReviewSheet';
import { dismissIosWarning, iosAtRisk } from '../storage';
import { EVERY_NAME, habitReward, homeLayout, QM, reward, streakText } from '../domain/model';
import type { HomeSection } from '../domain/model';
import { champion } from '../domain/guild/engine';
import { realDuration } from '../domain/guild/adventurer';
import { AdvCrest } from '../components/guildParts';
import { Crest } from '../components/Crest';
import { Icon } from '../components/Icon';
import { questView, withNames } from '../components/common';
import { stepCount } from '../components/Steps';
import { QuickAdd } from '../components/QuickAdd';
import { useState, type ReactNode } from 'react';
import { dayPoints, dayTooFull, FULL_DAY, isOpen, planCandidates, todayQuests } from '../domain/quests';
import { backupDue, exportBackup, snoozeBackup } from '../backup';
import { useStore } from '../state/store';

export function Home() {
  const { data, ui, setUi, today, actions, showToast, sync, cal, gstate, gcfg } = useStore();
  const [moving, setMoving] = useState<number | null>(null);
  const [iosNag, setIosNag] = useState(iosAtRisk);
  const [backupNag, setBackupNag] = useState(() => backupDue(data, today));
  const [noticesOpen, setNoticesOpen] = useState(false);
  const g = data.guild;
  const champ = g ? champion(g) : undefined;
  const nextBack = g?.outings.filter((o) => !o.done).sort((a, b) => a.returnAt - b.returnAt)[0];

  const layout = homeLayout(data.profile);
  const notices: { key: string; short: string; long: string; actions: ReactNode }[] = [];
  if (backupNag) notices.push({
    key: 'backup', short: 'Backup due',
    long: (backupNag.days === null ? "You haven't backed up your log yet." : "It's been " + backupNag.days + ' days since your last backup.') + ' Your log only lives in this browser.',
    actions: <>
      <button className="btn btn-ghost inked" onClick={() => { snoozeBackup(addDays(today, 3)); setBackupNag(null); }}>Later</button>
      <button className="btn btn-primary inked" style={{ minHeight: 38 }} onClick={() => { showToast('Backup saved', exportBackup(data, today)); setBackupNag(null); }}>Back up now</button>
    </>,
  });
  if (iosNag) notices.push({
    key: 'ios', short: 'Safari may delete your log',
    long: "Safari deletes data from sites you haven't opened in 7 days. Add Questlog to your Home Screen (Share → Add to Home Screen) to keep your log.",
    actions: <button className="btn btn-ghost inked" onClick={() => { dismissIosWarning(); setIosNag(false); }}>Got it</button>,
  });
  if (reviewDue(data, today)) notices.push({
    key: 'review', short: 'Week in review ready',
    long: 'Your week in review (' + shortDate(reviewWeek(today)) + ' – ' + shortDate(addDays(reviewWeek(today), 6)) + ") is ready: what you did, and what's next.",
    actions: <button className="btn btn-primary inked" style={{ minHeight: 38 }} onClick={() => setUi({ reviewOpen: true })}>Open</button>,
  });

  const todayList = todayQuests(data.quests, today).map((q) => ({ q, checked: false }));
  const full = dayTooFull(todayList.map((t) => t.q));
  const doneToday = data.quests.filter((q) => q.doneOn === today).length;
  const habitsDone = data.habits.filter((h) => habitDone(h, today)).length;
  const todayIds = new Set(todayList.map((t) => t.q.id));
  const upNext = data.quests
    .filter((q) => q.quad === 'main' && isOpen(q) && !todayIds.has(q.id))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.id - b.id);

  const dow = (parseDay(today).getDay() + 6) % 7;
  const mon = addDays(today, -dow + ui.weekOffset * 7), sun = addDays(mon, 6);
  const weekItems = calendarItems(cal, mon, sun);
  const overdueCount = data.quests.filter((q) => isOverdue(q, today)).length;
  const m1 = parseDay(mon), m7 = parseDay(sun);
  const range = m1.getMonth() === m7.getMonth() ? m1.getDate() + ' – ' + m7.getDate() + ' ' + MON[m7.getMonth()] : shortDate(mon) + ' – ' + shortDate(sun);
  const weekTitle = ui.weekOffset === 0 ? 'This week' : ui.weekOffset === 1 ? 'Next week' : ui.weekOffset === -1 ? 'Last week' : 'Week of ' + shortDate(mon);
  const sd = parseDay(ui.selDay);
  const agenda = weekItems.filter((i) => i.date === ui.selDay);
  const openItem = (it: CalItem) => {
    const [kind, id] = it.target.split(':');
    if (kind === 'event') actions.openEvent(Number(id));
    else if (kind === 'quest') actions.openQuest(Number(id));
    else actions.goGlossary(it.target);
  };

  const sections: Record<HomeSection, ReactNode> = {
    today: (
        <section className="panel today home-today" key="today">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 24 }}>Today's Quests</h3>
            <span className="muted tnum" style={{ fontSize: 12 }}>
              {overdueCount > 0 && <span style={{ color: 'var(--q-wax)' }}>{overdueCount} overdue · </span>}{todayList.length} to do · {doneToday} done today
            </span>
          </div>
          {full && <p role="status" style={{ margin: 0, padding: '6px 0 10px', fontSize: 13, color: 'var(--q-wax)' }}>This looks like a full day ({dayPoints(todayList.map((t) => t.q))} points; around {FULL_DAY} is a lot). Move something if you can.</p>}
          {todayList.map(({ q, checked }) => {
            const v = questView(q, today, data.camps);
            return (
              <div key={q.id} className="today-row">
                <button className="today-check" onClick={() => actions.toggleToday(q.id)} aria-label={checked ? 'Undo ' + q.title : 'Complete ' + q.title} aria-pressed={checked}>
                  <span className={'checkbox' + (checked ? ' on' : '')} style={{ width: 22, height: 22 }}>{checked && <Icon n="check" size={15} stroke={2.4} />}</span>
                </button>
                <div onClick={() => actions.openQuest(q.id)} style={{ flex: 1, minWidth: 0, padding: '9px 0', cursor: 'pointer' }}>
                  <div className="heading" style={{ fontSize: 19, lineHeight: 1.2, textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--color-accent-700)' : 'var(--q-ink)' }}>{q.title}</div>
                  <div className="meta">
                    <span style={{ color: v.quad.color }}><span className="dot" />{v.quad.name}</span>
                    <span style={{ color: checked ? 'var(--q-moss)' : v.dueColor }}>{checked ? 'Completed today' : v.dueLabel}</span>
                    {v.campaignName && <span style={{ gap: 4, minWidth: 0, maxWidth: 200 }} title={v.campaignName}><Icon n="flag" size={11} /><span className="ellipsis">{v.campaignName}</span></span>}
                    {stepCount(q) && <span className="tnum">{stepCount(q)} steps</span>}
                    {q.pick === today && <span style={{ gap: 4 }}><Icon n="sun" size={11} />Picked</span>}
                    {withNames(q, data.companions) && <span style={{ gap: 4 }}><Icon n="users" size={11} />{withNames(q, data.companions)}</span>}
                  </div>
                </div>
                {isOverdue(q, today)
                  ? <button className="btn btn-secondary" onClick={() => setMoving(moving === q.id ? null : q.id)} aria-expanded={moving === q.id} style={{ minHeight: 32, padding: '2px 10px', fontSize: 13 }}>Move</button>
                  : <span className="tnum" style={{ fontSize: 12, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>+{v.xp} XP</span>}
                {moving === q.id && <div style={{ flexBasis: '100%', padding: '0 0 10px 34px' }}><RescheduleButtons q={q} compact /></div>}
              </div>
            );
          })}
          {!todayList.length && <p className="muted" style={{ margin: 0, padding: '14px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic' }}>No quests due today.</p>}
        </section>

    ),
    habits: (
        <section className="panel today home-habits" key="habits">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 24 }}>Habits</h3>
            {data.habits.length > 0 && <span className="muted tnum" style={{ fontSize: 12 }}>{habitsDone} of {data.habits.length} done</span>}
          </div>
          {data.habits.map((h) => {
            const done = habitDone(h, today), streak = habitStreak(h, today), prog = habitProgress(h, today);
            // With a weekly target of several days the box is today's check-in; otherwise it is the whole period.
            const multi = prog.target > 1, ticked = multi ? checkedInToday(h, today) : done, locked = multi && done && !ticked;
            return (
              <div key={h.id} className="today-row">
                <button className="today-check" onClick={() => actions.toggleHabit(h.id)} disabled={locked} aria-label={(ticked ? 'Undo ' : 'Check in ') + h.title} aria-pressed={ticked}>
                  <span className={'checkbox' + (ticked || locked ? ' on' : '')} style={{ width: 22, height: 22, borderRadius: '50%', opacity: locked ? 0.5 : 1 }}>{(ticked || locked) && <Icon n="check" size={15} stroke={2.4} />}</span>
                </button>
                <div style={{ flex: 1, minWidth: 0, padding: '9px 0' }}>
                  <div className="heading" style={{ fontSize: 19, lineHeight: 1.2, color: done ? 'var(--color-accent-700)' : 'var(--q-ink)' }}>{h.title}</div>
                  <div className="meta">
                    <span className="tnum">{multi ? prog.target + '× a week · ' + prog.count + ' of ' + prog.target + (done ? ' · week done' : '') : EVERY_NAME[h.every] + (h.every === 'weekly' && done ? ' · done this week' : '')}</span>
                    {streak > 0 && <span style={{ gap: 4, color: 'var(--q-wax)' }}><Icon n="repeat" size={12} />{streakText(streak, h.every)}</span>}
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>+{habitReward(h).xp} XP</span>
              </div>
            );
          })}
          {!data.habits.length && (
            <p className="muted" style={{ margin: 0, padding: '10px 0 12px', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>
              No habits yet. <button className="btn btn-ghost" style={{ padding: '0 4px', fontStyle: 'normal', color: 'var(--color-accent-700)' }}
                onClick={() => { actions.goTab('quests'); setUi({ questView: 'habits' }); }}>Start one</button>
            </p>
          )}
        </section>

    ),
    next: (
        <section className="panel today home-next" key="next">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 24 }}>Up next</h3>
            <span className="tnum" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: QM.main.color }}><span className="dot" />Main Quests</span>
          </div>
          {upNext.slice(0, 5).map((q) => {
            const v = questView(q, today, data.camps);
            return (
              <button key={q.id} className="agenda-row" onClick={() => actions.openQuest(q.id)} style={{ borderBottom: 0, borderTop: '1px solid var(--q-rule)' }}>
                <span style={{ width: 26, display: 'grid', placeItems: 'center', color: QM.main.color }}><Icon n="crown" size={16} /></span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span className="heading" style={{ fontSize: 17, lineHeight: 1.2 }}>{q.title}</span>
                  <span className="meta">
                    <span style={{ color: q.due ? v.dueColor : undefined }}>{q.due ? v.dueLabel : 'No due date'}</span>
                    {stepCount(q) && <span className="tnum">{stepCount(q)} steps</span>}
                    {withNames(q, data.companions) && <span style={{ gap: 4 }}><Icon n="users" size={11} />{withNames(q, data.companions)}</span>}
                    {v.campaignName && <span style={{ gap: 4, maxWidth: 160 }}><Icon n="flag" size={11} /><span className="ellipsis">{v.campaignName}</span></span>}
                  </span>
                </span>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>+{v.xp} XP</span>
              </button>
            );
          })}
          {upNext.length > 5 && (
            <button className="btn btn-ghost inked" style={{ alignSelf: 'flex-start', margin: '4px 0 6px' }} onClick={() => { actions.goTab('quests'); setUi({ questView: 'board', mobileZone: 'main' }); }}>
              {upNext.length - 5} more in Main Quests
            </button>
          )}
          {!upNext.length && (
            <p className="muted" style={{ margin: 0, padding: '10px 0 12px', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>
              Nothing waiting in Main Quests: the important things that aren't urgent yet.
            </p>
          )}
        </section>

    ),
    week: (
        <section className="panel week" key="week">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div><h3 style={{ fontSize: 24 }}>{weekTitle}</h3><div className="muted tnum" style={{ fontSize: 12 }}>{range}</div></div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="btn btn-icon btn-secondary" aria-label="Previous week" style={{ width: 40, height: 40 }}
                onClick={() => setUi((u) => ({ weekOffset: u.weekOffset - 1, selDay: addDays(u.selDay, -7) }))}><Icon n="chevron-left" size={18} /></button>
              <button className="btn btn-icon btn-secondary" aria-label="Next week" style={{ width: 40, height: 40 }}
                onClick={() => setUi((u) => ({ weekOffset: u.weekOffset + 1, selDay: addDays(u.selDay, 7) }))}><Icon n="chevron-right" size={18} /></button>
            </div>
          </div>
          <div className="week-days">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const ds = addDays(mon, i), d = parseDay(ds);
              const marks = weekItems.filter((i) => i.date === ds);
              return (
                <button key={ds} className={'week-day' + (ds === today ? ' is-today' : '') + (ds === ui.selDay ? ' is-sel' : '')} onClick={() => setUi({ selDay: ds })} aria-pressed={ds === ui.selDay}>
                  <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>{WDL[d.getDay()].slice(0, 3)}</span>
                  <span className="num">{d.getDate()}</span>
                  <span className="week-marks">
                    {marks.slice(0, 4).map((it, i) => <KindMark key={i} kind={it.kind} size={6} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <Legend />
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--q-rule)', paddingTop: 10 }}>
            <div className="label" style={{ paddingBottom: 4 }}>{WDL[sd.getDay()] + ' ' + sd.getDate() + ' ' + MONL[sd.getMonth()]}</div>
            {agenda.map((it, k) => (
              <button key={k} className="agenda-row" onClick={() => openItem(it)}>
                <span style={{ width: 26, display: 'grid', placeItems: 'center' }}><KindMark kind={it.kind} size={9} /></span>
                <AgendaText title={it.title} sub={(it.allDay ? '' : (it.time ?? '') + (it.endTime ? '–' + it.endTime : '') + ' · ') + kindText(it) + (it.kind === 'deadline' ? ' · +' + reward(data.quests.find((q) => 'quest:' + q.id === it.target)!).xp + ' XP' : '')} color="var(--color-accent-800)" />
                <Icon n="chevron-right" size={15} />
              </button>
            ))}
            {!agenda.length && (
              <p className="muted" style={{ margin: 0, padding: '8px 0', fontStyle: 'italic', fontSize: 14 }}>A quiet day. Nothing planned.</p>
            )}
          </div>
        </section>
    ),
    keep: null,
    guild: g ? (
        <section className="panel home-strip" key="guild">
          <button className="strip-btn" onClick={() => actions.goTab('guild')} aria-label={champ ? 'Open the guild, Champion ' + champ.first : 'Open the guild'}>
            {champ ? <AdvCrest a={champ} size={34} /> : g ? <Crest seed={g.crestSeed} size={34} /> : null}
            <span className="ellipsis" style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 15 }}>
              <span className="heading" style={{ fontSize: 17 }}>{champ ? champ.first + ' ' + champ.family : g ? 'No Champion' : 'The guild'}</span>
              {champ && <span className="muted"> · Lv {champ.level}</span>}
            </span>
            <span className="tnum" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-accent-700)' }}>
              <Icon n="coins" size={16} /><span className="heading" style={{ fontSize: 17, color: 'var(--q-ink)' }}>{g?.gold ?? 0}</span>
            </span>
            {nextBack && <span className="muted ellipsis" style={{ fontSize: 12, maxWidth: 110 }}>back in {realDuration(nextBack.returnAt - (Date.now() - g!.founded))}</span>}
            <Icon n="chevron-right" size={16} />
          </button>
        </section>
    ) : null,
  };

  return (
    <div className="screen">
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div className="screen-head">
          <span className="kicker">Questlog</span>
          <h1>{longDate(today)}</h1>
        </div>
        <button className="btn btn-icon btn-ghost inked" onClick={() => setUi({ profileOpen: true })} aria-label="Settings and backup" title="Settings and backup" style={{ width: 44, height: 44 }}>
          <Icon n="wrench" size={19} />
        </button>
      </header>
      {notices.length > 0 && (
        <div className="panel notices" role="status">
          <button className="notices-line" onClick={() => setNoticesOpen(!noticesOpen)} aria-expanded={noticesOpen}>
            <span style={{ color: 'var(--q-wax)' }}><Icon n="alert" size={16} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, textAlign: 'left' }} className="ellipsis">
              {notices.length === 1 ? notices[0].short : notices.length + ' notices: ' + notices.map((n) => n.short).join(' · ')}
            </span>
            <Icon n={noticesOpen ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          {noticesOpen && notices.map((n) => (
            <div key={n.key} className="notice-row">
              <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{n.long}</span>
              <span style={{ display: 'flex', gap: 6 }}>{n.actions}</span>
            </div>
          ))}
        </div>
      )}
      {(sync.status === 'paused' || sync.status === 'error' || (gcfg.on && (gstate.status === 'paused' || gstate.status === 'error'))) && (
        <button className="panel sync-line" onClick={() => { void actions.syncNow(); void actions.calendarSyncNow(); }}>
          <Icon n="repeat" size={15} />
          <span style={{ flex: 1, textAlign: 'left' }}>{sync.status === 'error' ? (sync.error ?? 'Sync failed') + ' · tap to retry' : gstate.status === 'error' && sync.status !== 'paused' ? (gstate.error ?? 'Calendar sync failed') + ' · tap to retry' : 'Sync paused · tap to resume'}</span>
        </button>
      )}
      <PlanDay />
      <QuickAdd />
      <div className="home-grid">
        {layout.order.filter((k) => !layout.hidden.includes(k)).map((k) => sections[k])}
      </div>
    </div>
  );
}

/** The first time the app is opened each day: pick what to do from yesterday's leftovers, Crisis quests and Main Quests. */
function PlanDay() {
  const { data, today, actions } = useStore();
  const { carried, crisis, main } = planCandidates(data.quests, today);
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(carried.map((q) => q.id)));
  const offered = [...carried, ...crisis, ...main];
  if (data.profile.plannedDay === today || !offered.length) return null;
  const picked = data.quests.filter((q) => chosen.has(q.id));
  const load = todayQuests(data.quests, today).concat(picked);
  const toggle = (id: number) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const done = () => actions.planDay([...chosen]);
  const group = (title: string, list: typeof offered) => list.length > 0 && (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="label" style={{ padding: '6px 0 2px' }}>{title}</span>
      {list.map((q) => (
        <label key={q.id} className="toggle-row" style={{ minHeight: 40 }}>
          <input type="checkbox" checked={chosen.has(q.id)} onChange={() => toggle(q.id)} />
          <span style={{ flex: 1, minWidth: 0 }}>{q.title}</span>
          <span className="tnum muted" style={{ fontSize: 12 }}>{q.size}{q.due ? ' · ' + shortDate(q.due) : ''}</span>
        </label>
      ))}
    </div>
  );
  return (
    <section className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ fontSize: 22 }}>Plan your day</h3>
        <button className="btn btn-ghost" onClick={() => actions.planDay([])} style={{ minHeight: 32 }}>Skip</button>
      </div>
      {group('Picked yesterday, not done', carried)}
      {group('Crisis', crisis)}
      {group('Main Quests', main.slice(0, 8))}
      {dayTooFull(load) && <p role="status" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--q-wax)' }}>That is a full day ({dayPoints(load)} points). You can still go ahead.</p>}
      <button className="btn btn-primary inked" onClick={done} style={{ minHeight: 42, marginTop: 6 }}>{chosen.size ? 'Pick ' + chosen.size + ' for today' : 'Nothing extra today'}</button>
    </section>
  );
}

function AgendaText({ title, sub, color }: { title: string; sub: string; color: string }) {
  return (
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <span className="heading" style={{ fontSize: 17, lineHeight: 1.2 }}>{title}</span>
      <span style={{ fontSize: 12, color }}>{sub}</span>
    </span>
  );
}
