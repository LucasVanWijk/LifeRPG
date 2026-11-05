import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CharterId, Stance } from '../domain/guild/content';
import {
  ATTR_NAME, ATTRS, CHARTERS, CLASSES, DAYS_PER_YEAR, GUILD_NAMES, OFFER_KIND, PRACTICE_PER_POINT, RACES, ROLE_NAME, STAGE_ICON, STAGE_NAME, STANCES,
  STOCK_NAME, TOWN_NAMES, xpToNext,
} from '../domain/guild/content';
import { ageYears, canGoOut, fullName, injured, phaseAt, rating, ratingShown, realDuration, role, shortClock, yearsLeft } from '../domain/guild/adventurer';
import { byId, ctxFor, found, sendProblem } from '../domain/guild/engine';
import { odds } from '../domain/guild/resolve';
import { hash } from '../domain/guild/rng';
import { entryText, names, partyNames, stageLines } from '../domain/guild/text';
import type { Duty, Entry, Loot } from '../domain/guild/types';
import { Crest } from '../components/Crest';
import { Icon } from '../components/Icon';
import { CloseBtn, Empty, Seg, Sheet } from '../components/common';
import { AdvCrest, advSub, Bar, Stars, status, useGameNow } from '../components/guildParts';
import { OfferMeta } from '../screens/Guild';
import { useImport } from './ProfileSheet';
import { useStore } from '../state/store';

const pct = (p: number) => (p <= 0 ? '0%' : p < 0.001 ? '<0.1%' : p < 0.1 ? (p * 100).toFixed(1) + '%' : Math.round(p * 100) + '%');
const lootText = (l: Loot) => [l.gold ? l.gold + ' gold' : '', ...(['wood', 'stone', 'iron', 'herbs'] as const).filter((k) => l[k]).map((k) => l[k] + ' ' + STOCK_NAME[k].toLowerCase())].filter(Boolean).join(', ') || 'nothing';

function Head({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6 }}>
      {children}
      <h3 style={{ fontSize: 24, flex: 1, minWidth: 0, lineHeight: 1.15 }}>{title}</h3>
      <CloseBtn onClick={onClose} />
    </div>
  );
}

// ── Adventurer ───────────────────────────────────────────────

export function AdventurerSheet({ id }: { id: string }) {
  const { data, setUi, actions, today } = useStore();
  const g = data.guild!;
  const now = useGameNow(g);
  const a = byId(g, id);
  const close = () => setUi({ advSheet: null });
  if (!a) return null;
  const phase = phaseAt(now);
  const champ = g.championId === a.id;
  const live = a.state === 'active';
  const st = status(g, a, phase, now);
  const bearing = Object.values(data.camps).filter((c) => c.bearerId === a.id && !c.completedOn).map((c) => c.name);
  const ch = a.chapter;
  void today;
  return (
    <Sheet onClose={close} label={fullName(a)}>
      <Head title={fullName(a)} onClose={close}><AdvCrest a={a} size={52} /></Head>
      <div className="meta" style={{ marginTop: -6 }}>
        <span>{advSub(a)}</span><Stars n={a.talent} /><span>{ROLE_NAME[role(a)]}</span>
        {champ && <span style={{ color: 'var(--q-wax)', gap: 4 }}><Icon n="crown" size={12} />Champion</span>}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {live ? 'Age ' + ageYears(a, phase) + ' · sworn ' + yearsLeft(a, phase) + ' more ' + (yearsLeft(a, phase) === 1 ? 'year' : 'years') + ' · ' : ''}{st.text}.
        {' '}{RACES[a.race].trait}: {RACES[a.race].traitText.toLowerCase()}{a.race === 'halfling' && a.luckUsed ? ' (used)' : ''}. {CLASSES[a.cls].blurb}
      </p>

      {live && (
        <div className="two-col">
          {champ
            ? <div className="panel" style={{ padding: '10px 12px', fontSize: 13 }}>Your real-life XP, practice and a quarter of the gold go to {a.first}.</div>
            : <button className="btn btn-primary inked" onClick={() => actions.setChampion(a.id)} disabled={!!a.awayOn} style={{ minHeight: 44 }}><Icon n="crown" size={15} />Make Champion</button>}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
            <span className="label">Level {a.level}{a.level < 20 ? ' · ' + Math.floor(a.xp) + ' / ' + xpToNext(a.level) + ' XP' : ''}</span>
            <Bar value={a.xp} max={xpToNext(a.level)} color="var(--color-accent-500)" label="Experience" />
          </div>
        </div>
      )}
      {bearing.length > 0 && <p style={{ margin: 0, fontSize: 13 }}><Icon n="flag" size={12} /> Standard-bearer for {names(bearing)}.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px' }}>
        {ATTRS.map((k) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="label">{ATTR_NAME[k]}{CLASSES[a.cls].main === k ? ' · main' : ''}</span>
              <span className="heading tnum" style={{ fontSize: 18 }}>{a.attrs[k]}</span>
            </div>
            <Bar value={a.practice[k]} max={PRACTICE_PER_POINT} color="var(--color-accent-400)" label={ATTR_NAME[k] + ' practice'} height={4} />
          </div>
        ))}
      </div>
      <p className="muted" style={{ margin: '-4px 0 0', fontSize: 12 }}>
        The thin bars are practice from real life: Crisis quests train Might, Main quests Wits, Errands Finesse, Side quests Spirit, and habits {a.first}'s main attribute. Every {PRACTICE_PER_POINT} XP adds a point.
      </p>

      {live && (
        <>
          <div className="two-col">
            <div><span className="label">Health {a.health}</span><Bar value={a.health} color="var(--q-moss)" label="Health" /></div>
            <div><span className="label">Fatigue {a.fatigue}</span><Bar value={a.fatigue} color="var(--color-accent-500)" label="Fatigue" /></div>
          </div>
          {injured(a, phase) && <p style={{ margin: 0, color: 'var(--q-wax)', fontSize: 14 }}>Recovering from {a.injury!.text}.</p>}
          {!a.awayOn && (
            <div className="field"><label>At home</label>
              <Seg<Duty> name="duty" value={a.duty} onChange={(v) => actions.setDuty(a.id, v)} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 40 }}
                options={[{ key: 'auto', label: 'Auto' }, { key: 'train', label: 'Train' }, { key: 'rest', label: 'Rest' }]} />
              <span className="muted" style={{ fontSize: 12 }}>Auto rests when health is under 60 or fatigue over 40, and trains otherwise.</span>
            </div>
          )}
        </>
      )}

      <div className="facts" style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--q-rule)', borderBottom: '1px solid var(--q-rule)' }}>
        {[['Rating', ratingShown(a)], ['Purse', a.purse + 'g'], ['Outings', a.outings], ['Joined', shortClock(a.joinedPhase * 3_600_000).split(',')[1]?.trim() ?? '']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0' }}>
            <span className="label" style={{ fontSize: 10 }}>{k}</span><span className="heading tnum" style={{ fontSize: 19 }}>{v}</span>
          </div>
        ))}
      </div>
      {a.scars.length > 0 && <p style={{ margin: 0, fontSize: 14 }}><strong>Scars:</strong> {a.scars.join(', ')}.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ fontSize: 20 }}>{live ? 'Their chapter so far' : 'Their chapter'}</h3>
        {ch.quests + ch.habits + ch.campaigns.length === 0
          ? <Empty>Nothing yet. While {a.first} is Champion or carries a campaign, what you do in real life is written here.</Empty>
          : (
            <>
              <p style={{ margin: 0, fontSize: 14 }}>
                In {a.first}'s time: {ch.quests} {ch.quests === 1 ? 'quest' : 'quests'}, {ch.habits} habit {ch.habits === 1 ? 'check-in' : 'check-ins'}
                {ch.campaigns.length ? ', and ' + names(ch.campaigns) : ''}.
              </p>
              {ch.notable.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                  {[...ch.notable].reverse().map((n, i) => <li key={i}>{n.t} <span className="muted tnum" style={{ fontSize: 12 }}>· {n.d}</span></li>)}
                </ul>
              )}
            </>
          )}
      </div>

      {live && !a.awayOn && (
        <button className="danger-btn" onClick={() => actions.confirm({
          title: 'Let ' + a.first + ' go?', body: a.first + ' leaves the guild for good. Their purse (' + a.purse + 'g) stays with the guild.', confirmLabel: 'Let them go',
          onConfirm: () => actions.release(a.id),
        })}>Let {a.first} go</button>
      )}
    </Sheet>
  );
}

// ── Sending a party ──────────────────────────────────────────

export function SendSheet({ id }: { id: string }) {
  const { data, setUi, actions } = useStore();
  const g = data.guild!;
  const offer = g.board.find((o) => o.id === id);
  const phase = phaseAt(g.t);
  const close = () => setUi({ offerSheet: null });
  const avail = g.adventurers.filter((a) => a.state === 'active');
  const [party, setParty] = useState<string[]>(() => (offer ? avail.filter((a) => canGoOut(a, phase)).sort((x, y) => rating(y) - rating(x)).slice(0, offer.minParty).map((a) => a.id) : []));
  const [stance, setStance] = useState<Stance>('steady');
  const problem = offer ? sendProblem(g, offer, party) : 'Gone';
  const o = useMemo(() => (offer && party.length && party.every((x) => byId(g, x)) ? odds(ctxFor(g, offer, party, stance)) : null), [g, offer, party, stance]);
  if (!offer) return null;
  const toggle = (aid: string) => setParty((p) => (p.includes(aid) ? p.filter((x) => x !== aid) : p.length >= offer.maxParty ? p : [...p, aid]));
  const deathAvg = o ? party.reduce((n, x) => n + o.death[x], 0) / Math.max(1, party.length) : 0;
  const yearsAvg = party.reduce((n, x) => n + yearsLeft(byId(g, x)!, phase), 0) / Math.max(1, party.length);
  const outlook = 1 - Math.pow(1 - deathAvg, yearsAvg * (DAYS_PER_YEAR / 8) * 1.5);
  return (
    <Sheet onClose={close} label={offer.name}>
      <Head title={offer.name} onClose={close}>
        <span className="seal" style={{ width: 40, height: 40, flex: 'none' }}><Icon n={offer.scale === 'odd' ? 'scroll' : OFFER_KIND[offer.kind].icon} size={18} /></span>
      </Head>
      <OfferMeta o={offer} />
      {offer.scale === 'expedition' && (
        <ol className="battle-log" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          {offer.stages.map((s, i) => <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon n={STAGE_ICON[s.kind]} size={13} /><span><strong>{STAGE_NAME[s.kind]}</strong> · {s.title}</span></li>)}
        </ol>
      )}

      <div className="field">
        <label>Party · {party.length} of {offer.maxParty}</label>
        <div className="choice-list">
        {avail.map((a) => {
          const free = canGoOut(a, phase), on = party.includes(a.id);
          return (
            <button key={a.id} className="opt-btn" aria-pressed={on} disabled={!free} onClick={() => toggle(a.id)} style={{ gap: 10, opacity: free ? 1 : 0.5 }}>
              <span className={'checkbox' + (on ? ' on' : '')} style={{ width: 20, height: 20 }}>{on && <Icon n="check" size={13} stroke={2.4} />}</span>
              <AdvCrest a={a} size={26} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span className="heading" style={{ fontSize: 16 }}>{a.first}{g.championId === a.id ? ' ♛' : ''}</span>
                <span className="muted" style={{ fontSize: 12 }}>{advSub(a)} · {free ? 'health ' + a.health + ', fatigue ' + a.fatigue : status(g, a, phase, g.t).text}</span>
              </span>
              <span className="heading tnum" style={{ fontSize: 17 }}>{ratingShown(a)}</span>
            </button>
          );
        })}
        </div>
      </div>

      {offer.scale === 'expedition' && (
        <div className="field"><label>Stance</label>
          <Seg<Stance> name="stance" value={stance} onChange={setStance} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 40 }}
            options={(['cautious', 'steady', 'bold'] as Stance[]).map((k) => ({ key: k, label: STANCES[k].name }))} />
          <span className="muted" style={{ fontSize: 12 }}>{STANCES[stance].text}</span>
        </div>
      )}

      {o && (
        <div className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">The odds</span>
          <div className="tnum" style={{ fontSize: 14 }}>
            {offer.scale === 'expedition' ? <>Clean run {pct(o.full)} · turn back {pct(o.turnBack)} · someone dies {pct(o.anyDeath)}</> : <>Goes well {pct(o.full)}</>}
          </div>
          <div className="tnum" style={{ fontSize: 14 }}>
            Loot about {lootText(o.loot)}{o.goldHigh > o.goldLow ? ' (gold ' + o.goldLow + '–' + o.goldHigh + ')' : ''} · about {o.xp} XP each
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {party.map((x) => (
              <div key={x} className="tnum" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0', borderTop: '1px solid var(--q-rule)' }}>
                <span>{byId(g, x)!.first}</span>
                <span>injury {pct(o.injury[x])} · <span style={{ color: o.death[x] > 0.01 ? 'var(--q-wax)' : undefined }}>death {pct(o.death[x])}</span></span>
              </div>
            ))}
          </div>
          {deathAvg > 0 && offer.scale === 'expedition' && (
            <span className="muted" style={{ fontSize: 12 }}>If they went out like this every time, about {Math.round(outlook * 10)} in 10 would not live to retire.</span>
          )}
        </div>
      )}

      {problem && <p style={{ margin: 0, color: 'var(--q-wax)', fontSize: 14 }}>{problem}</p>}
      <button className="btn btn-primary inked" disabled={!!problem} onClick={() => actions.send(offer.id, party, stance)} style={{ minHeight: 48, fontSize: 17 }}>
        Send {party.length ? names(party.map((x) => byId(g, x)!.first)) : 'them'}
      </button>
    </Sheet>
  );
}

// ── Report ───────────────────────────────────────────────────

export function ReportSheet({ id }: { id: string }) {
  const { data, setUi, actions } = useStore();
  const g = data.guild!;
  const now = useGameNow(g);
  const o = g.outings.find((x) => x.id === id);
  const close = () => setUi({ reportSheet: null });
  useEffect(() => { if (o?.done && !o.read) actions.markRead(o.id); }, [o?.done, o?.read, o?.id, actions]);
  if (!o) return null;
  const seen = o.done ? o.result.stages.length : o.stageAt.filter((t) => t <= now).length;
  const injuredBack = Object.entries(o.result.members).filter(([, m]) => m.injury);
  const fell = o.result.stages.filter((s) => s.died).map((s) => byId(g, s.died)!.first);
  return (
    <Sheet onClose={close} label={o.offer.name}>
      <Head title={o.offer.name} onClose={close}><span className="seal" style={{ width: 40, height: 40, flex: 'none' }}><Icon n="scroll" size={18} /></span></Head>
      <div className="meta" style={{ marginTop: -6 }}>
        <span>{partyNames(g, o)}</span>
        {o.offer.scale === 'expedition' && <span>{STANCES[o.stance].name}</span>}
        <span className="tnum">{o.done ? 'Back ' + shortClock(o.returnAt) : 'Back in ' + realDuration(o.returnAt - now)}</span>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {o.offer.stages.map((plan, i) => {
          const st = o.result.stages[i];
          if (i >= seen) return (i < o.result.stages.length || !o.done) && (
            <li key={i} className="muted" style={{ display: 'flex', gap: 10, fontSize: 14, opacity: 0.6 }}><Icon n={STAGE_ICON[plan.kind]} size={15} /><span>{plan.title} · not yet</span></li>
          );
          const tone = st.outcome === 'fail' ? 'var(--q-wax)' : st.outcome === 'strain' ? 'var(--color-accent-800)' : 'var(--q-moss)';
          return (
            <li key={i} style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: tone, paddingTop: 2 }}><Icon n={STAGE_ICON[plan.kind]} size={15} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="heading" style={{ fontSize: 16 }}>{plan.title}</span>
                <span style={{ fontSize: 12, color: tone, marginLeft: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>{plan.kind === 'rest' ? 'Rest' : st.outcome}</span>
                {stageLines(g, o, i).map((l, k) => <span key={k} style={{ display: 'block', fontSize: 14 }}>{l}</span>)}
              </span>
            </li>
          );
        })}
      </ol>
      {o.done && o.result.turnedBack && <p style={{ margin: 0, fontSize: 14, fontStyle: 'italic' }}>They turned back before the end.</p>}
      {o.done && (
        <div className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          <span className="label">Brought home</span>
          <span>{lootText(o.result.loot)}{o.result.chest ? ' (the chest held ' + lootText(o.result.chest) + ')' : ''}</span>
          <span>{Object.entries(o.result.members).filter(([, m]) => !m.died).map(([k, m]) => byId(g, k)!.first + ' +' + m.xp + ' XP').join(' · ') || 'Nobody came back.'}</span>
          {injuredBack.map(([k, m]) => <span key={k} style={{ color: 'var(--q-wax)' }}>{byId(g, k)!.first}: {m.injury!.text}, {m.injury!.days} days{m.scar ? '. A scar for life: ' + m.scar.toLowerCase() : ''}.</span>)}
          {fell.length > 0 && <span style={{ color: 'var(--q-wax)', fontWeight: 600 }}>{names(fell)} did not come back.</span>}
        </div>
      )}
    </Sheet>
  );
}

// ── While you were away ──────────────────────────────────────

export function AwaySheet({ entries }: { entries: Entry[] }) {
  const { data, setUi } = useStore();
  const g = data.guild!;
  const close = () => setUi({ away: null });
  const shown = entries.filter((e) => e.k !== 'level' || entries.length < 12);
  return (
    <Sheet onClose={close} label="While you were away">
      <Head title="While you were away" onClose={close} />
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.slice(-40).map((e, i) => {
          const t = entryText(g, e);
          return (
            <li key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid var(--q-rule)', fontSize: 14 }}>
              <span style={{ color: t.tone === 'bad' ? 'var(--q-wax)' : t.tone === 'good' ? 'var(--q-moss)' : 'var(--color-accent-700)' }}><Icon n={t.icon} size={15} /></span>
              <span style={{ flex: 1 }}>{t.text}</span>
            </li>
          );
        })}
      </ol>
      <button className="btn btn-primary inked" onClick={() => setUi({ away: null, tab: 'guild', guildTab: 'roster' })} style={{ minHeight: 46 }}>To the guild</button>
    </Sheet>
  );
}

// ── Founding ─────────────────────────────────────────────────

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/** First launch: name the guild and town, pick a charter and a Champion. */
export function Founding() {
  const { actions } = useStore();
  const restore = useImport();
  const [seed] = useState(randomSeed);
  const [name, setName] = useState(() => GUILD_NAMES[seed % GUILD_NAMES.length]);
  const [town, setTown] = useState(() => TOWN_NAMES[(seed >> 3) % TOWN_NAMES.length]);
  const [crestSeed, setCrest] = useState(() => hash(seed, 'crest'));
  const [charter, setCharter] = useState<CharterId>('martial');
  const [step, setStep] = useState<1 | 2>(1);
  const preview = useMemo(() => found({ name, town, charter, crestSeed, seed }, Date.now()), [seed]); // Only the seed shapes the starters.
  const [champ, setChamp] = useState<string | null>(null);
  const box = { width: 'min(460px,100%)', maxHeight: '92vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 12, padding: '24px 20px 18px', border: '1px solid color-mix(in srgb, var(--color-accent-800) 35%, transparent)', borderRadius: 'var(--radius-lg)', boxShadow: 'inset 0 0 0 5px var(--q-parch), inset 0 0 0 6px var(--color-accent-500), var(--shadow-lg)', background: 'var(--q-parch)' };
  return (
    <div className="modal" style={{ zIndex: 70 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="found-title" className="found-box" style={box}>
        {step === 1 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => setCrest(randomSeed())} aria-label="Another crest" title="Another crest" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}><Crest seed={crestSeed} size={58} /></button>
              <div>
                <span className="kicker">Questlog</span>
                <h2 id="found-title" style={{ fontSize: 28, lineHeight: 1.1 }}>Found your guild</h2>
              </div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              You are the guild. Your real-life quests and habits level the adventurer you make Champion, and fund the guild. Adventurers come and go; the guild stays. Tap the crest for another.
            </p>
            <div className="field"><label htmlFor="g-name">Guild name</label><input id="g-name" className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ minHeight: 44, fontSize: 16 }} /></div>
            <div className="field"><label htmlFor="g-town">Home town</label><input id="g-town" className="input" value={town} onChange={(e) => setTown(e.target.value)} style={{ minHeight: 44, fontSize: 16 }} /></div>
            <div className="field"><label>Charter</label>
              <div className="choice-list">
              {CHARTERS.map((c) => (
                <button key={c.id} className="opt-btn" aria-pressed={charter === c.id} onClick={() => setCharter(c.id)} style={{ gap: 10 }}>
                  <span style={{ color: 'var(--color-accent-700)' }}><Icon n={c.icon} size={18} /></span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}><span className="heading" style={{ fontSize: 16 }}>{c.name}</span><span className="muted" style={{ fontSize: 12 }}>{c.text}</span></span>
                </button>
              ))}
              </div>
            </div>
            <button className="btn btn-primary inked" disabled={!name.trim() || !town.trim()} onClick={() => setStep(2)} style={{ minHeight: 46, fontSize: 17 }}>Meet your first adventurers</button>
            <button className="btn btn-ghost inked" onClick={restore.open} style={{ fontSize: 13 }}>Restore a backup instead</button>
            {restore.field}
          </>
        ) : (
          <>
            <span className="kicker">{name}</span>
            <h2 id="found-title" style={{ fontSize: 26, lineHeight: 1.1 }}>Choose your Champion</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Three adventurers signed on for free. Your Champion gets the XP from everything you do in real life, and can still go out on expeditions. You can switch any time they're at home.
            </p>
            <div className="choice-list">
            {preview.adventurers.map((a) => (
              <button key={a.id} className="opt-btn" aria-pressed={champ === a.id} onClick={() => setChamp(a.id)} style={{ gap: 12, alignItems: 'flex-start' }}>
                <AdvCrest a={a} size={40} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span className="heading" style={{ fontSize: 18 }}>{fullName(a)}</span>
                  <span className="meta" style={{ marginTop: 0 }}><span>{advSub(a)}</span><Stars n={a.talent} /></span>
                  <span className="muted" style={{ fontSize: 12 }}>{CLASSES[a.cls].blurb} Age {ageYears(a, 0)}, sworn {a.career} years. {RACES[a.race].trait}: {RACES[a.race].traitText.toLowerCase()}.</span>
                </span>
              </button>
            ))}
            </div>
            <div className="two-col">
              <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ minHeight: 46 }}>Back</button>
              <button className="btn btn-primary inked" disabled={!champ} onClick={() => champ && actions.found({ name: name.trim(), town: town.trim(), charter, crestSeed, seed }, champ)} style={{ minHeight: 46 }}>Found the guild</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
