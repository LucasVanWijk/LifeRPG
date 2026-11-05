import { useState, type ReactNode } from 'react';
import type { ClassId } from '../domain/guild/content';
import {
  CLASS_IDS, CLASSES, CONDITIONS, NOTICE_FEE, OFFER_KIND, RACES, REGIONS, STAGE_ICON, STOCK_NAME, TIER_HALL, tierLevels,
} from '../domain/guild/content';
import { ageYears, clockLabel, fullName, phaseAt, ratingShown, realDuration } from '../domain/guild/adventurer';
import { offerMinutes } from '../domain/guild/board';
import { active, champion, condView, expeditionsOut } from '../domain/guild/engine';
import { partyNames } from '../domain/guild/text';
import { TRAIT } from '../domain/guild/traits';
import { hallLevel, outLimit, rosterLimit, tierLimit } from '../domain/guild/town';
import type { Guild as GuildT, Offer, Outing } from '../domain/guild/types';
import { Crest } from '../components/Crest';
import { Icon } from '../components/Icon';
import { Empty, Seg } from '../components/common';
import { AdvCrest, AdvRow, advSub, Stars, useGameNow } from '../components/guildParts';
import { useStore, type GuildTab } from '../state/store';
import { Legacy } from './Legacy';
import { Town } from './Town';

/** The guild: roster, board, town, tavern and legacy. */
export function Guild() {
  const { data, ui, setUi, actions } = useStore();
  const g = data.guild;
  const now = useGameNow(g);
  if (!g) return null;
  const unread = g.outings.filter((o) => o.done && !o.read).length;
  return (
    <div className="screen" style={{ gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Crest seed={g.crestSeed} size={46} title={g.name + ' crest'} />
        <div className="screen-head" style={{ flex: 1, minWidth: 0 }}>
          <span className="kicker tnum">{g.holiday !== null ? 'On holiday · the clock is stopped' : clockLabel(now)}</span>
          <h1 className="ellipsis" style={{ fontSize: 'clamp(26px, 7vw, 38px)' }}>{g.name}</h1>
        </div>
        <span className="stat-pill" title="The guild's gold" aria-label={g.gold + ' gold'}><Icon n="coins" size={16} /><span className="heading tnum">{g.gold}</span></span>
      </header>
      <div className="muted tnum" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: 12, marginTop: -6 }}>
        <span>{g.town}</span>
        {(['wood', 'stone', 'iron', 'herbs'] as const).map((k) => <span key={k}>{STOCK_NAME[k]} {g.stock[k]}</span>)}
        <span>Renown {g.renown}</span>
      </div>
      {g.holiday !== null && (
        <div className="panel backup-nag" role="status">
          <span style={{ color: 'var(--color-accent-700)' }}><Icon n="sun" size={18} /></span>
          <span style={{ flex: 1, fontSize: 14 }}>Holiday mode is on. Nothing in the guild moves until you switch it off. Real-life rewards still count.</span>
          <button className="btn btn-primary inked" onClick={() => actions.holiday(false)} style={{ minHeight: 38 }}>Come back</button>
        </div>
      )}
      <Seg<GuildTab> name="guild-tab" value={ui.guildTab} onChange={(v) => setUi({ guildTab: v })}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 42, fontSize: 13, padding: '6px 2px' }}
        options={[
          { key: 'roster', label: <>Roster{unread > 0 && <span className="screen-count" style={{ fontSize: 11, marginLeft: 3 }}>{unread}</span>}</> },
          { key: 'board', label: 'Board' }, { key: 'town', label: 'Town' }, { key: 'tavern', label: 'Tavern' }, { key: 'legacy', label: 'Legacy' },
        ]} />
      {ui.guildTab === 'roster' && <Roster g={g} now={now} />}
      {ui.guildTab === 'board' && <Board g={g} />}
      {ui.guildTab === 'town' && <Town g={g} />}
      {ui.guildTab === 'tavern' && <Tavern g={g} />}
      {ui.guildTab === 'legacy' && <Legacy g={g} now={now} />}
    </div>
  );
}

export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingBottom: 4 }}>
        <h3 style={{ fontSize: 22 }}>{title}</h3>
        {sub && <span className="muted tnum" style={{ fontSize: 12, textAlign: 'right' }}>{sub}</span>}
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
          <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }} aria-label={seen + ' of ' + total + ' stages done'}>
            {o.offer.stages.map((st, i) => (
              <span key={i} style={{ width: 20, height: 20, borderRadius: 4, display: 'grid', placeItems: 'center', border: '1px solid var(--q-rule)',
                background: i < seen ? (o.result.stages[i]?.outcome === 'fail' ? 'color-mix(in srgb, var(--q-wax) 25%, transparent)' : 'var(--q-tint)') : 'transparent',
                color: i < seen ? 'var(--q-ink)' : 'var(--color-accent-600)', opacity: i < seen ? 1 : 0.6 }}>
                <Icon n={STAGE_ICON[st.kind]} size={11} />
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
  const retired = g.adventurers.filter((a) => a.state === 'retired').reverse();
  const children = g.adventurers.filter((a) => a.state === 'child');
  const gone = g.adventurers.filter((a) => a.state === 'fallen' || a.state === 'passed' || a.state === 'left').reverse();
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
        <Section title="Out and back" sub={expeditionsOut(g) + ' of ' + outLimit(g) + ' expeditions out'}>
          {fresh.map((o) => <OutingCard key={o.id} g={g} o={o} now={now} />)}
          {out.map((o) => <OutingCard key={o.id} g={g} o={o} now={now} />)}
        </Section>
      )}
      <Section title="The roster" sub={members.length + ' of ' + rosterLimit(g)}>
        {members.map((a) => <AdvRow key={a.id} g={g} a={a} phase={phase} now={now} onClick={() => setUi({ advSheet: a.id })} />)}
        {!members.length && <Empty>Nobody is left. Hire someone at the Tavern.</Empty>}
      </Section>
      {(retired.length > 0 || children.length > 0) && (
        <Section title="Living in town" sub={retired.length + ' retired' + (children.length ? ' · ' + children.length + ' children' : '')}>
          {retired.map((a) => <AdvRow key={a.id} g={g} a={a} phase={phase} now={now} onClick={() => setUi({ advSheet: a.id })} right={<span />} />)}
          {children.map((a) => <AdvRow key={a.id} g={g} a={a} phase={phase} now={now} onClick={() => setUi({ advSheet: a.id })} right={<span />} />)}
        </Section>
      )}
      {gone.length > 0 && (
        <Section title="Remembered" sub={gone.filter((a) => a.state === 'fallen').length + ' fallen · ' + gone.filter((a) => a.state === 'passed').length + ' passed'}>
          {gone.slice(0, 12).map((a) => <AdvRow key={a.id} g={g} a={a} phase={phase} now={now} onClick={() => setUi({ advSheet: a.id })} right={<span />} />)}
          {gone.length > 12 && <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>All of them are in the Legacy tab.</p>}
        </Section>
      )}
    </>
  );
}

/** Where an offer is, how long it takes, and what the party will face. */
export function OfferMeta({ o, g }: { o: Offer; g?: GuildT }) {
  const mins = offerMinutes(o);
  const conds = g ? condView(g, o) : o.conditions;
  return (
    <>
      <span className="meta" style={{ marginTop: 0 }}>
        {o.scale === 'odd' ? <span>Odd job</span> : <span>{o.scale === 'odyssey' ? 'Odyssey' : 'Tier ' + o.tier + ' · levels ' + tierLevels(o.tier).join('–')}</span>}
        {o.scale !== 'odd' && <span>{REGIONS[o.region].name}</span>}
        <span className="tnum">{mins < 60 ? mins + ' min' : mins >= 24 * 60 ? Math.round(mins / 60 / 24 * 10) / 10 + ' days' : Math.round(mins / 6) / 10 + ' h'}</span>
        <span className="tnum">{o.minParty === o.maxParty ? o.minParty : o.minParty + '–' + o.maxParty} {o.maxParty === 1 ? 'adventurer' : 'adventurers'}</span>
        {o.needs.map((n) => <span key={n} style={{ color: 'var(--q-wax)' }}>Needs a {n === 'tank' ? 'Tank' : 'Healer'}</span>)}
      </span>
      {conds.length > 0 && (
        <span className="meta" style={{ marginTop: 0 }}>
          {conds.map((c, i) => (
            <span key={i} style={{ gap: 4, color: c.hidden ? 'var(--color-accent-600)' : 'var(--color-accent-800)' }} title={c.hidden ? 'Hidden until the Library reveals it' : CONDITIONS[c.id].text}>
              <Icon n={c.hidden ? 'search' : CONDITIONS[c.id].icon} size={12} />{c.hidden ? '?' : CONDITIONS[c.id].name}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

function OfferCard({ o, g, phase }: { o: Offer; g: GuildT; phase: number }) {
  const { setUi } = useStore();
  const days = Math.ceil((o.expires - phase) / 3);
  return (
    <button className="agenda-row" onClick={() => setUi({ offerSheet: o.id })} style={{ gap: 12, padding: '10px 2px' }}>
      <span className="seal" style={{ width: 34, height: 34, flex: 'none' }}>
        <Icon n={o.tutorial ? 'star' : o.recover ? 'skull' : o.scale === 'odd' ? 'scroll' : o.scale === 'odyssey' ? 'compass' : OFFER_KIND[o.kind].icon} size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="heading" style={{ fontSize: 17, lineHeight: 1.2 }}>{o.name}</span>
        <OfferMeta o={o} g={g} />
        {o.scale !== 'odd' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-accent-700)', flexWrap: 'wrap' }}>
            {o.stages.map((st, i) => <span key={i} title={st.title}><Icon n={STAGE_ICON[st.kind]} size={13} /></span>)}
            <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
              {o.recover ? 'Recovery' : OFFER_KIND[o.kind].name}{o.expires < Number.MAX_SAFE_INTEGER ? ' · leaves in ' + (days <= 1 ? 'a day' : days + ' days') : ''}
            </span>
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
  const rec = g.board.filter((o) => o.recover);
  const exp = g.board.filter((o) => o.scale === 'expedition' && !o.recover).sort((a, b) => a.tier - b.tier);
  const ody = g.board.filter((o) => o.scale === 'odyssey');
  const hall = hallLevel(g);
  const nextTier = tierLimit(g) < 5 ? tierLimit(g) + 1 : 0;
  return (
    <>
      <Section title="Odd jobs" sub="Short and safe · new ones each phase">
        {odd.map((o) => <OfferCard key={o.id} o={o} g={g} phase={phase} />)}
        {!odd.length && <Empty>Nothing small going. New jobs come in every hour.</Empty>}
      </Section>
      {rec.length > 0 && (
        <Section title="Bring them home" sub="Recovery expeditions">
          {rec.map((o) => <OfferCard key={o.id} o={o} g={g} phase={phase} />)}
        </Section>
      )}
      <Section title="Expeditions" sub={expeditionsOut(g) + ' of ' + outLimit(g) + ' out · new ones each day'}>
        {exp.map((o) => <OfferCard key={o.id} o={o} g={g} phase={phase} />)}
        {!exp.length && <Empty>The board is bare. New expeditions are posted every game day (3 hours).</Empty>}
        {nextTier > 0 && <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>Tier {nextTier} expeditions open at Guild Hall level {TIER_HALL[nextTier - 1]} (yours is {hall}).</p>}
      </Section>
      {(ody.length > 0 || hall >= 3) && (
        <Section title="Odysseys" sub="Days long · the lair of a region">
          {ody.map((o) => <OfferCard key={o.id} o={o} g={g} phase={phase} />)}
          {!ody.length && <Empty>No lairs known. Odysseys need a Cartographer to chart a region beyond the Hearthlands, and a lair not yet freed.</Empty>}
        </Section>
      )}
    </>
  );
}

function Tavern({ g }: { g: GuildT }) {
  const { actions } = useStore();
  const [cls, setCls] = useState<ClassId>('cleric');
  const phase = phaseAt(g.t);
  const full = active(g).length >= rosterLimit(g);
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
                <div style={{ fontSize: 13 }}>{a.traitIds.map((id) => TRAIT[id]?.name).filter(Boolean).join(' · ')}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Age {ageYears(a, phase)} · would serve {a.career} years · {RACES[a.race].trait}: {RACES[a.race].traitText.toLowerCase()}. {CLASSES[a.cls].blurb}
                </div>
                <div className="muted tnum" style={{ fontSize: 12 }}>Might {a.attrs.might} · Finesse {a.attrs.finesse} · Wits {a.attrs.wits} · Spirit {a.attrs.spirit} · leaves in {leaves <= 1 ? 'a day' : leaves + ' days'}</div>
                {r.fee === 0 && <div style={{ fontSize: 12, color: 'var(--q-moss)' }}>One of the family: joins for free.</div>}
              </div>
              <button className="btn btn-primary inked" onClick={() => actions.hire(a.id)} disabled={full || g.gold < r.fee} style={{ alignSelf: 'center', minHeight: 40, whiteSpace: 'nowrap' }}
                title={full ? 'The roster is full' : g.gold < r.fee ? 'Not enough gold' : undefined}>
                {r.fee ? 'Hire · ' + r.fee + 'g' : 'Welcome'}
              </button>
            </div>
          );
        })}
        {!g.recruits.length && <Empty>Nobody looking for work right now.</Empty>}
        {full && <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>The roster is full ({rosterLimit(g)}). Let someone go from their sheet, or enlarge the Adventurers’ Lodge.</p>}
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

