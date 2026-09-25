import { addDays, longDate, MON, MONL, parseDay, shortDate, WDL } from '../domain/dates';
import { glossaryEvents, habitDone, habitStreak } from '../domain/logic';
import { EVERY_NAME, habitReward, heroName, QM, reward, streakText } from '../domain/model';
import { Icon } from '../components/Icon';
import { Portrait, questView } from '../components/common';
import { useStore } from '../state/store';

export function Home() {
  const { data, ui, setUi, today, actions } = useStore();
  const { hero } = data;
  const active = data.quests.filter((q) => q.status !== 'done');

  const todayList = data.quests
    .filter((q) => (q.status !== 'done' && q.due && q.due <= today) || q.doneOn === today)
    .map((q) => ({ q, checked: q.doneOn === today }))
    .sort((a, b) => Number(a.checked) - Number(b.checked) || (a.q.due || today).localeCompare(b.q.due || today));
  const doneToday = todayList.filter((t) => t.checked).length;
  const habitsDone = data.habits.filter((h) => habitDone(h, today)).length;
  const seals = Object.entries(data.camps).filter(([, c]) => c.completedOn);

  const dow = (parseDay(today).getDay() + 6) % 7;
  const mon = addDays(today, -dow + ui.weekOffset * 7), sun = addDays(mon, 6);
  const events = glossaryEvents(data, today);
  const m1 = parseDay(mon), m7 = parseDay(sun);
  const range = m1.getMonth() === m7.getMonth() ? m1.getDate() + ' – ' + m7.getDate() + ' ' + MON[m7.getMonth()] : shortDate(mon) + ' – ' + shortDate(sun);
  const weekTitle = ui.weekOffset === 0 ? 'This week' : ui.weekOffset === 1 ? 'Next week' : ui.weekOffset === -1 ? 'Last week' : 'Week of ' + shortDate(mon);
  const sd = parseDay(ui.selDay);
  const agendaQuests = active.filter((q) => q.due === ui.selDay);
  const agendaEvents = events.filter((e) => e.date === ui.selDay);

  return (
    <div className="screen">
      <header className="screen-head">
        <span className="kicker">Questlog</span>
        <h1>{longDate(today)}</h1>
      </header>
      <div className="home-grid">
        <section className="panel-framed hero-card">
          <button className="hero-btn" onClick={() => setUi({ profileOpen: true })} aria-label="Open your profile">
            <Portrait hero={hero} size={76} fontSize={38} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="heading" style={{ display: 'block', fontSize: 28, lineHeight: 1.05 }}>{heroName(hero)}</span>
              <span className="muted" style={{ fontStyle: 'italic', fontSize: 15 }}>Level {hero.level} Wanderer</span>
            </span>
            <span style={{ color: 'var(--color-accent-700)' }}><Icon n="chevron-right" size={18} /></span>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="muted tnum" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ letterSpacing: '.12em', textTransform: 'uppercase', fontSize: 11 }}>Experience</span>
              <span>{hero.xp} / {hero.next} XP</span>
            </div>
            <div className="bar" role="progressbar" aria-valuenow={hero.xp} aria-valuemax={hero.next} aria-label="Experience">
              <div style={{ width: Math.round((hero.xp / hero.next) * 100) + '%' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{hero.next - hero.xp} XP to level {hero.level + 1}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--q-rule)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-accent-700)' }}>
              <Icon n="coins" size={20} />
              <span className="heading tnum" style={{ fontSize: 24, color: 'var(--q-ink)' }}>{hero.gold}</span>
              <span className="muted" style={{ fontSize: 13 }}>gold</span>
            </span>
            <button className="btn btn-ghost" onClick={() => actions.goTab('adventure')} style={{ color: 'var(--color-accent-700)' }}>Visit the Tavern</button>
          </div>
          {seals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--q-rule)' }}>
              <span className="label">Seals earned</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {seals.map(([k, c]) => (
                  <button key={k} className="seal" title={c.seal + ' · ' + c.name} aria-label={c.seal + ', ' + c.name}
                    onClick={() => { actions.goTab('quests'); setUi({ questView: 'campaign', campaign: k }); }}
                    style={{ width: 34, height: 34, border: 0, cursor: 'pointer' }}><Icon n={c.icon} size={15} /></button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel today home-today">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 24 }}>Today's Quests</h3>
            <span className="muted tnum" style={{ fontSize: 12 }}>{doneToday} of {todayList.length} done</span>
          </div>
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
                    {v.campaignName && <span style={{ gap: 4 }}><Icon n="flag" size={11} />{v.campaignName}</span>}
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>+{v.xp} XP</span>
              </div>
            );
          })}
          {!todayList.length && <p className="muted" style={{ margin: 0, padding: '14px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic' }}>No quests due today.</p>}
        </section>

        <section className="panel today home-habits">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 24 }}>Habits</h3>
            {data.habits.length > 0 && <span className="muted tnum" style={{ fontSize: 12 }}>{habitsDone} of {data.habits.length} done</span>}
          </div>
          {data.habits.map((h) => {
            const done = habitDone(h, today), streak = habitStreak(h, today);
            return (
              <div key={h.id} className="today-row">
                <button className="today-check" onClick={() => actions.toggleHabit(h.id)} aria-label={(done ? 'Undo ' : 'Check in ') + h.title} aria-pressed={done}>
                  <span className={'checkbox' + (done ? ' on' : '')} style={{ width: 22, height: 22, borderRadius: '50%' }}>{done && <Icon n="check" size={15} stroke={2.4} />}</span>
                </button>
                <div style={{ flex: 1, minWidth: 0, padding: '9px 0' }}>
                  <div className="heading" style={{ fontSize: 19, lineHeight: 1.2, color: done ? 'var(--color-accent-700)' : 'var(--q-ink)' }}>{h.title}</div>
                  <div className="meta">
                    <span>{EVERY_NAME[h.every]}{h.every === 'weekly' && done ? ' · done this week' : ''}</span>
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

        <section className="panel week">
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
              const dots = active.filter((q) => q.due === ds).slice(0, 3);
              const hasEvent = events.some((e) => e.date === ds);
              return (
                <button key={ds} className={'week-day' + (ds === today ? ' is-today' : '') + (ds === ui.selDay ? ' is-sel' : '')} onClick={() => setUi({ selDay: ds })} aria-pressed={ds === ui.selDay}>
                  <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>{WDL[d.getDay()].slice(0, 3)}</span>
                  <span className="num">{d.getDate()}</span>
                  <span className="week-marks">
                    {dots.map((q) => <span key={q.id} className="ink-dot" />)}
                    {hasEvent && <span className="diamond" style={{ marginLeft: 1 }} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="muted" style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="ink-dot" />Quest due</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="diamond" />From the Glossary</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--q-rule)', paddingTop: 10 }}>
            <div className="label" style={{ paddingBottom: 4 }}>{WDL[sd.getDay()] + ' ' + sd.getDate() + ' ' + MONL[sd.getMonth()]}</div>
            {agendaQuests.map((q) => (
              <button key={'q' + q.id} className="agenda-row" onClick={() => actions.openQuest(q.id)}>
                <span style={{ width: 26, display: 'grid', placeItems: 'center', color: 'var(--color-accent-800)' }}><Icon n="scroll" size={17} /></span>
                <AgendaText title={q.title} sub={QM[q.quad].name + ' · +' + reward(q).xp + ' XP'} color={QM[q.quad].color} />
                <Icon n="chevron-right" size={15} />
              </button>
            ))}
            {agendaEvents.map((e, i) => (
              <button key={'e' + i} className="agenda-row" onClick={() => actions.goGlossary(e.target)}>
                <span style={{ width: 26, display: 'grid', placeItems: 'center' }}><span className="diamond" style={{ width: 9, height: 9 }} /></span>
                <AgendaText title={e.label} sub={'Glossary · ' + e.kind} color="var(--color-accent-800)" />
                <Icon n="chevron-right" size={15} />
              </button>
            ))}
            {!agendaQuests.length && !agendaEvents.length && (
              <p className="muted" style={{ margin: 0, padding: '8px 0', fontStyle: 'italic', fontSize: 14 }}>A quiet day. Nothing planned.</p>
            )}
          </div>
        </section>
      </div>
    </div>
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
