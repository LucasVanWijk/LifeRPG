import { useState, type ReactNode } from 'react';
import type { ClassId } from '../domain/guild/content';
import { CLASS_IDS, CLASSES, MAX_OUT, NOTICE_FEE, OFFER_KIND, RACES, ROSTER_LIMIT, STAGE_ICON, STOCK_NAME, tierLevels } from '../domain/guild/content';
import { ageYears, clockLabel, fullName, isActive, phaseAt, ratingShown, realDuration, shortClock } from '../domain/guild/adventurer';
import { offerMinutes } from '../domain/guild/board';
import { active, champion, expeditionsOut } from '../domain/guild/engine';
import { entryText, partyNames } from '../domain/guild/text';
import type { Guild as GuildT, Offer, Outing } from '../domain/guild/types';
import { Crest } from '../components/Crest';
import { Icon } from '../components/Icon';
import { Empty, Seg } from '../components/common';
import { AdvCrest, AdvRow, advSub, Stars, useGameNow } from '../components/guildParts';
import { useStore, type GuildTab } from '../state/store';

/** The guild: roster, board, tavern and chronicle. */
export function Guild() {
  const { data, ui, setUi } = useStore();
  const g = data.guild;
  const now = useGameNow(g);
  if (!g) return null;
  const unread = g.outings.filter((o) => o.done && !o.read).length;
  return (
    <div className="screen" style={{ gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Crest seed={g.crestSeed} size={46} title={g.name + ' crest'} />
        <div className="screen-head" style={{ flex: 1, minWidth: 0 }}>
          <span className="kicker tnum">{clockLabel(now)}</span>
          <h1 className="ellipsis" style={{ fontSize: 'clamp(26px, 7vw, 38px)' }}>{g.name}</h1>
        </div>
        <span className="stat-pill" title="The guild's gold" aria-label={g.gold + ' gold'}><Icon n="coins" size={16} /><span className="heading tnum">{g.gold}</span></span>
      </header>
      <div className="muted tnum" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: 12, marginTop: -6 }}>
        <span>{g.town}</span>
        {(['wood', 'stone', 'iron', 'herbs'] as const).map((k) => <span key={k}>{STOCK_NAME[k]} {g.stock[k]}</span>)}
        <span>Renown {g.renown}</span>
      </div>
      <Seg<GuildTab> name="guild-tab" value={ui.guildTab} onChange={(v) => setUi({ guildTab: v })}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 42, fontSize: 14, padding: '6px 2px' }}
        options={[
          { key: 'roster', label: <>Roster{unread > 0 && <span className="screen-count" style={{ fontSize: 12, marginLeft: 4 }}>{unread}</span>}</> },
          { key: 'board', label: 'Board' }, { key: 'tavern', label: 'Tavern' }, { key: 'chronicle', label: 'Chronicle' },
        ]} />
      {ui.guildTab === 'roster' && <Roster g={g} now={now} />}
      {ui.guildTab === 'board' && <Board g={g} />}
      {ui.guildTab === 'tavern' && <Tavern g={g} />}
      {ui.guildTab === 'chronicle' && <Chronicle g={g} />}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingBottom: 4 }}>
        <h3 style={{ fontSize: 22 }}>{title}</h3>
        {sub && <span className="muted tnum" style={{ fontSize: 12 }}>{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function OutingCard({ g, o, now }: { g: GuildT; o: Outing; now: number }) {
  const { setUi } = useStore();
  const seen = o.stageAt.filter((t) => t <= now).length;
  const total = o.done ? o.result.stages.length : o.offer.stages.length;
  const fell = o.result.stages.slice(0, o.done ? undefined : seen).filter((s) => s.died).length;
  return (
    <button className="agenda-row" onClick={() => setUi({ reportSheet: o.id })} style={{ gap: 12, padding: '10px 2px' }}>
      <span className="seal" style={{ width: 34, height: 34, flex: 'none' }}><Icon n={o.offer.scale === 'odd' ? 'scroll' : OFFER_KIND[o.offer.kind].icon} size={16} /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="heading ellipsis" style={{ fontSize: 17 }}>{o.offer.name}</span>
        <span className="meta" style={{ marginTop: 0 }}>
          <span>{partyNames(g, o)}</span>
          {o.done ? <span style={{ color: fell ? 'var(--q-wax)' : 'var(--q-moss)' }}>{fell ? fell + ' fell · ' : ''}Report ready</span>
            : <span className="tnum">Back in {realDuration(o.returnAt - now)}</span>}
        </span>
        {!o.done && (
          <span style={{ display: 'flex', gap: 4 }} aria-label={seen + ' of ' + total + ' stages done'}>
            {o.offer.stages.map((st, i) => (
              <span key={i} style={{ width: 22, height: 22, borderRadius: 4, display: 'grid', placeItems: 'center', border: '1px solid var(--q-rule)',
                background: i < seen ? (o.result.stages[i]?.outcome === 'fail' ? 'color-mix(in srgb, var(--q-wax) 25%, transparent)' : 'var(--q-tint)') : 'transparent',
                color: i < seen ? 'var(--q-ink)' : 'var(--color-accent-600)', opacity: i < seen ? 1 : 0.6 }}>
                <Icon n={STAGE_ICON[st.kind]} size={12} />
              </span>
            ))}
          </span>
        )}
      </span>
      <Icon n="chevron-right" size={16} />
    </button>
  );
}

function Roster({ g, now }: { g: GuildT; now: number }) {
  const { setUi } = useStore();
  const phase = phaseAt(now);
  const out = g.outings.filter((o) => !o.done);
  const fresh = g.outings.filter((o) => o.done && !o.read).reverse();
  const members = active(g);
  const gone = g.adventurers.filter((a) => !isActive(a)).reverse();
  const champ = champion(g);
  return (
    <>
      {!champ && (
        <div className="panel backup-nag" role="status">
          <span style={{ color: 'var(--q-wax)' }}><Icon n="crown" size={18} /></span>
          <span style={{ flex: 1, fontSize: 14 }}>
            No Champion. Real-life XP is being banked{g.bankedXp ? ' (' + g.bankedXp + ' XP so far)' : ''} for whoever you choose next: open an adventurer and make them Champion.
          </span>
        </div>
      )}
      {(out.length > 0 || fresh.length > 0) && (
        <Section title="Out and back" sub={expeditionsOut(g) + ' of ' + MAX_OUT + ' expeditions out'}>
          {fresh.map((o) => <OutingCard key={o.id} g={g} o={o} now={now} />)}
          {out.map((o) => <OutingCard key={o.id} g={g} o={o} now={now} />)}
        </Section>
      )}
      <Section title="The roster" sub={members.length + ' of ' + ROSTER_LIMIT}>
        {members.map((a) => <AdvRow key={a.id} g={g} a={a} phase={phase} now={now} onClick={() => setUi({ advSheet: a.id })} />)}
        {!members.length && <Empty>Nobody is left. Hire someone at the Tavern.</Empty>}
      </Section>
      {gone.length > 0 && (
        <Section title="Remembered" sub={gone.filter((a) => a.state === 'fallen').length + ' fallen · ' + gone.filter((a) => a.state === 'retired').length + ' retired'}>
          {gone.map((a) => <AdvRow key={a.id} g={g} a={a} phase={phase} now={now} onClick={() => setUi({ advSheet: a.id })} right={<span />} />)}
        </Section>
      )}
    </>
  );
}

export function OfferMeta({ o }: { o: Offer }) {
  const mins = offerMinutes(o);
  return (
    <span className="meta" style={{ marginTop: 0 }}>
      {o.scale === 'expedition' ? <span>Tier {o.tier} · levels {tierLevels(o.tier).join('–')}</span> : <span>Odd job</span>}
      <span className="tnum">{mins < 60 ? mins + ' min' : mins / 60 + ' h'}</span>
      <span className="tnum">{o.minParty === o.maxParty ? o.minParty : o.minParty + '–' + o.maxParty} {o.maxParty === 1 ? 'adventurer' : 'adventurers'}</span>
      {o.needs.map((n) => <span key={n} style={{ color: 'var(--q-wax)' }}>Needs a {n === 'tank' ? 'Tank' : 'Healer'}</span>)}
    </span>
  );
}

function OfferCard({ o, phase }: { o: Offer; phase: number }) {
  const { setUi } = useStore();
  const days = Math.ceil((o.expires - phase) / 3);
  return (
    <button className="agenda-row" onClick={() => setUi({ offerSheet: o.id })} style={{ gap: 12, padding: '10px 2px' }}>
      <span className="seal" style={{ width: 34, height: 34, flex: 'none' }}><Icon n={o.tutorial ? 'star' : o.scale === 'odd' ? 'scroll' : OFFER_KIND[o.kind].icon} size={16} /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="heading" style={{ fontSize: 17, lineHeight: 1.2 }}>{o.name}</span>
        <OfferMeta o={o} />
        {o.scale === 'expedition' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-accent-700)' }}>
            {o.stages.map((st, i) => <span key={i} title={st.title}><Icon n={STAGE_ICON[st.kind]} size={14} /></span>)}
            <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>{OFFER_KIND[o.kind].name}{o.expires < Number.MAX_SAFE_INTEGER ? ' · leaves in ' + (days <= 1 ? 'a day' : days + ' days') : ''}</span>
          </span>
        )}
        {o.tutorial && <span style={{ fontSize: 12, color: 'var(--q-moss)' }}>Ten minutes, no danger. Start here.</span>}
      </span>
      <Icon n="chevron-right" size={16} />
    </button>
  );
}

function Board({ g }: { g: GuildT }) {
  const phase = phaseAt(g.t);
  const odd = g.board.filter((o) => o.scale === 'odd').sort((a, b) => Number(!!b.tutorial) - Number(!!a.tutorial));
  const exp = g.board.filter((o) => o.scale === 'expedition').sort((a, b) => a.tier - b.tier);
  return (
    <>
      <Section title="Odd jobs" sub="Short and safe · new ones each phase">
        {odd.map((o) => <OfferCard key={o.id} o={o} phase={phase} />)}
        {!odd.length && <Empty>Nothing small going. New jobs come in every hour.</Empty>}
      </Section>
      <Section title="Expeditions" sub={expeditionsOut(g) + ' of ' + MAX_OUT + ' out · new ones each day'}>
        {exp.map((o) => <OfferCard key={o.id} o={o} phase={phase} />)}
        {!exp.length && <Empty>The board is bare. New expeditions are posted every game day (3 hours).</Empty>}
      </Section>
    </>
  );
}

function Tavern({ g }: { g: GuildT }) {
  const { actions } = useStore();
  const [cls, setCls] = useState<ClassId>('cleric');
  const phase = phaseAt(g.t);
  const full = active(g).length >= ROSTER_LIMIT;
  const nextDays = Math.max(0, g.nextTavernDay - Math.floor(phase / 3));
  return (
    <>
      <Section title="At the tavern" sub={'New faces in ' + (nextDays <= 1 ? 'a day' : nextDays + ' days')}>
        {g.recruits.map((r) => {
          const a = r.adv;
          const leaves = Math.ceil((r.leaves - phase) / 3);
          return (
            <div key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--q-rule)' }}>
              <AdvCrest a={a} size={40} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="heading" style={{ fontSize: 18 }}>{fullName(a)}</div>
                <div className="meta" style={{ marginTop: 0 }}>
                  <span>{advSub(a)}</span><Stars n={a.talent} /><span>Rating {ratingShown(a)}</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Age {ageYears(a, phase)} · would serve {a.career} years · {RACES[a.race].trait}: {RACES[a.race].traitText.toLowerCase()}. {CLASSES[a.cls].blurb}
                </div>
                <div className="muted tnum" style={{ fontSize: 12 }}>Might {a.attrs.might} · Finesse {a.attrs.finesse} · Wits {a.attrs.wits} · Spirit {a.attrs.spirit} · leaves in {leaves <= 1 ? 'a day' : leaves + ' days'}</div>
              </div>
              <button className="btn btn-primary inked" onClick={() => actions.hire(a.id)} disabled={full || g.gold < r.fee} style={{ alignSelf: 'center', minHeight: 40, whiteSpace: 'nowrap' }}
                title={full ? 'The roster is full' : g.gold < r.fee ? 'Not enough gold' : undefined}>
                Hire · {r.fee}g
              </button>
            </div>
          );
        })}
        {!g.recruits.length && <Empty>Nobody looking for work right now.</Empty>}
        {full && <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>The roster is full ({ROSTER_LIMIT}). Let someone go from their sheet to make room.</p>}
      </Section>
      <Section title="Post a notice" sub={NOTICE_FEE + ' gold'}>
        {g.notice
          ? <p style={{ margin: 0, fontSize: 14 }}>A notice for a <strong>{CLASSES[g.notice.cls].name}</strong> is up. Someone will answer it when new faces arrive.</p>
          : (
            <>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>Guarantees a recruit of this class the next time new faces arrive.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CLASS_IDS.map((c) => (
                  <button key={c} className="chip" aria-pressed={cls === c} onClick={() => setCls(c)} style={{ gap: 6 }}><Icon n={CLASSES[c].icon} size={14} />{CLASSES[c].name}</button>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={() => actions.postNotice(cls)} disabled={g.gold < NOTICE_FEE} style={{ marginTop: 10, minHeight: 42, alignSelf: 'flex-start' }}>
                Post for a {CLASSES[cls].name} · {NOTICE_FEE}g
              </button>
            </>
          )}
      </Section>
    </>
  );
}

function Chronicle({ g }: { g: GuildT }) {
  const [shown, setShown] = useState(60);
  const list = [...g.chronicle].reverse();
  return (
    <Section title="Chronicle" sub={g.chronicle.length + ' entries'}>
      {list.slice(0, shown).map((e, i) => {
        const t = entryText(g, e);
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
            <span style={{ color: t.tone === 'bad' ? 'var(--q-wax)' : t.tone === 'good' ? 'var(--q-moss)' : 'var(--color-accent-700)', paddingTop: 2 }}><Icon n={t.icon} size={15} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{t.text}</span>
            <span className="muted tnum" style={{ fontSize: 11, whiteSpace: 'nowrap', paddingTop: 2 }}>{shortClock(e.at)}</span>
          </div>
        );
      })}
      {list.length > shown && <button className="btn btn-ghost inked" onClick={() => setShown(shown + 100)} style={{ alignSelf: 'flex-start' }}>Show older</button>}
    </Section>
  );
}

