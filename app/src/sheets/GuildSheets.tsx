import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CharterId, Slot, Stance } from '../domain/guild/content';
import {
  ATTR_NAME, ATTRS, BUILDINGS, CHARTERS, CLASSES, CONDITIONS, DAYS_PER_YEAR, GRADES, GUILD_NAMES, OFFER_KIND, PRACTICE_PER_POINT, RACES, REGIONS, ROLE_NAME, SLOT_NAME, SLOTS, STAGE_ICON,
  STAGE_NAME, STANCES, STOCK_NAME, TOWN_NAMES, xpToNext, MAX_LEVEL,
} from '../domain/guild/content';
import { ageYears, canGoOut, fullName, phaseAt, rating, ratingShown, realDuration, rolesOf, shortClock, yearsLeft } from '../domain/guild/adventurer';
import { TRAIT } from '../domain/guild/traits';
import { CONVICTION, VOW_REWARD_TEXT, vowText } from '../domain/guild/vows';
import { byId, ctxFor, departure, found, recoveryMult, sendProblem, treatCost, treatProblem } from '../domain/guild/engine';
import { conditionFactor, fatigueFloor, SEVERITY_NAME, SOURCE_NAME, staminaCap, worst } from '../domain/guild/wounds';
import { oddsRange } from '../domain/guild/resolve';
import { hash } from '../domain/guild/rng';
import { entryText, lowerFirst, names, partyNames, stageLines } from '../domain/guild/text';
import type { Adventurer, Duty, Entry, Guild, Item, Loot } from '../domain/guild/types';
import { Crest } from '../components/Crest';
import { Icon } from '../components/Icon';
import { CloseBtn, Empty, Seg, Sheet } from '../components/common';
import { AdvCrest, advSub, Bar, Stars, status, useGameNow } from '../components/guildParts';
import { OfferMeta } from '../screens/Guild';
import { useImport } from './ProfileSheet';
import { useStore } from '../state/store';

const pct = (p: number) => (p <= 0 ? '0%' : p < 0.001 ? '<0.1%' : p < 0.1 ? (p * 100).toFixed(1) + '%' : Math.round(p * 100) + '%');
const lootText = (l: Loot) => [l.gold ? l.gold + ' gold' : '', l.items?.length ? l.items.map((i) => i.name.toLowerCase()).join(', ') : '', ...(['wood', 'stone', 'iron', 'herbs'] as const).filter((k) => l[k]).map((k) => l[k] + ' ' + STOCK_NAME[k].toLowerCase())].filter(Boolean).join(', ') || 'nothing';

export function Head({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6 }}>
      {children}
      <h3 style={{ fontSize: 24, flex: 1, minWidth: 0, lineHeight: 1.15 }}>{title}</h3>
      <CloseBtn onClick={onClose} />
    </div>
  );
}

// ── Adventurer ───────────────────────────────────────────────

function Gear({ g, a }: { g: Guild; a: Adventurer }) {
  const { actions } = useStore();
  const [open, setOpen] = useState<Slot | null>(null);
  const home = a.state === 'active' && !a.awayOn;
  const options = (slot: Slot): Item[] => [...g.armoury, ...g.heirlooms].filter((i) => i.slot === slot).sort((x, y) => y.grade - x.grade);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ fontSize: 20 }}>Gear</h3>
      {SLOTS.map((slot) => {
        const i = a.gear[slot];
        return (
          <div key={slot} style={{ borderTop: '1px solid var(--q-rule)', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="label" style={{ width: 62 }}>{SLOT_NAME[slot]}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                {i ? <>{i.name} <span className="muted" style={{ fontSize: 12 }}>· {GRADES[i.grade]}{i.heirloom ? ' · heirloom' : ' · ' + i.wear + ' left'}{i.counters ? ' · counters ' + CONDITIONS[i.counters].name.toLowerCase() : ''}{i.owner === 'guild' ? ' · lent' : ''}</span></> : <span className="muted">nothing</span>}
              </span>
              {home && i && <button className="btn btn-ghost inked" onClick={() => actions.unequip(a.id, slot)} style={{ minHeight: 34, padding: '0 8px' }}>Take off</button>}
              {home && <button className="btn btn-secondary" onClick={() => setOpen(open === slot ? null : slot)} aria-expanded={open === slot} style={{ minHeight: 34, padding: '0 10px' }}>Change</button>}
            </div>
            {open === slot && (
              <div style={{ paddingTop: 6 }}>
                {options(slot).map((o) => (
                  <button key={o.id} className="opt-btn" onClick={() => { actions.equip(a.id, o.id); setOpen(null); }} style={{ width: '100%', marginTop: 4, minHeight: 40 }}>
                    <span style={{ flex: 1, fontSize: 14 }}>{o.name} <span className="muted" style={{ fontSize: 12 }}>· {GRADES[o.grade]}{o.heirloom ? ' · heirloom' : ' · ' + o.wear + ' left'}{o.counters ? ' · counters ' + CONDITIONS[o.counters].name.toLowerCase() : ''}</span></span>
                  </button>
                ))}
                {!options(slot).length && <Empty>Nothing on the racks for this slot.</Empty>}
              </div>
            )}
          </div>
        );
      })}
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 6, fontSize: 14 }}>
        <input type="checkbox" checked={a.autoBuy} onChange={(e) => actions.setAutoBuy(a.id, e.target.checked)} />
        <span>Spend their own gold on better gear and potions before an expedition</span>
      </label>
    </div>
  );
}

export function AdventurerSheet({ id }: { id: string }) {
  const { data, setUi, actions } = useStore();
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
  const partner = byId(g, a.partnerId);
  const parents = (a.parentIds ?? []).map((x) => byId(g, x)).filter((x): x is Adventurer => !!x);
  const kids = (a.childIds ?? []).map((x) => byId(g, x)).filter((x): x is Adventurer => !!x);
  const years = a.endedPhase !== undefined ? Math.round(((a.endedPhase - a.joinedPhase) / (DAYS_PER_YEAR * 3)) * 10) / 10 : 0;
  const post = a.staffAt ? g.buildings.find((b) => b.id === a.staffAt) : undefined;
  return (
    <Sheet onClose={close} label={fullName(a)}>
      <Head title={fullName(a)} onClose={close}><AdvCrest a={a} size={52} /></Head>
      <div className="meta" style={{ marginTop: -6 }}>
        <span>{advSub(a)}</span><Stars n={a.talent} /><span>{rolesOf(a).map((r) => ROLE_NAME[r]).join(' + ')}</span>
        {champ && <span style={{ color: 'var(--q-wax)', gap: 4 }}><Icon n="crown" size={12} />Champion</span>}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {live ? 'Age ' + ageYears(a, phase) + ' · sworn ' + yearsLeft(a, phase) + ' more ' + (yearsLeft(a, phase) === 1 ? 'year' : 'years') + ' · ' : ''}{st.text}.
        {' '}{RACES[a.race].trait}: {lowerFirst(RACES[a.race].traitText)}{a.race === 'halfling' && a.luckUsed ? ' (used)' : ''}. {CLASSES[a.cls].blurb}
      </p>
      {a.traitIds?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {a.traitIds.map((id) => TRAIT[id] && (
            <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14 }}>
              <span className="pill" style={{ whiteSpace: 'nowrap', color: TRAIT[id].kind === 'bad' ? 'var(--q-wax)' : TRAIT[id].kind === 'good' ? 'var(--q-moss)' : 'var(--color-accent-800)' }}>{TRAIT[id].name}</span>
              <span className="muted" style={{ fontSize: 13 }}>{TRAIT[id].text}</span>
            </div>
          ))}
          {a.backstory && <p style={{ margin: '2px 0 0', fontSize: 14, fontStyle: 'italic' }}>{a.backstory}</p>}
        </div>
      )}
      {a.conviction && CONVICTION[a.conviction] && (
        <div className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <span className="label">Conviction</span>
            <div style={{ fontSize: 15 }}><strong>{CONVICTION[a.conviction].name}.</strong> <span className="muted">{CONVICTION[a.conviction].text}</span></div>
          </div>
          {a.vow && (
            <div>
              <span className="label">Vow{a.vow.done ? ' · kept' : a.state === 'active' ? '' : ' · unfulfilled'}</span>
              <div style={{ fontSize: 15 }}>{vowText(a.vow)}.</div>
              {a.vow.kind !== 'love' && a.vow.kind !== 'rescue' && a.vow.kind !== 'odyssey' && a.vow.kind !== 'free' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}><Bar value={Math.min(a.vow.progress, a.vow.target)} max={a.vow.target} color={a.vow.done ? 'var(--q-moss)' : 'var(--color-accent-500)'} label="Vow progress" height={6} /></div>
                  <span className="muted tnum" style={{ fontSize: 12 }}>{Math.min(a.vow.progress, a.vow.target)} / {a.vow.target}</span>
                </div>
              )}
              <div className="muted" style={{ fontSize: 12 }}>{a.vow.done ? 'Kept for good: ' : 'Keeping it earns ' }{VOW_REWARD_TEXT[a.vow.kind]}{a.vow.done ? '.' : ', for good. They have until their service ends.'}</div>
            </div>
          )}
        </div>
      )}
      {!live && a.state !== 'child' && (
        <div className="panel" style={{ padding: '10px 12px', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="label">In memoriam</span>
          <span>
            {a.state === 'fallen' ? 'Fell at ' + (a.fellAt ?? 'a far place') + ' after ' + years + ' years' + (a.tomb ? '. They were brought home and have a tomb.' : a.level >= 5 ? '. A witness stone marks the place.' : '.')
              : a.state === 'passed' ? 'Retired after ' + years + ' years and passed away peacefully.'
              : a.state === 'retired' ? 'Retired after ' + years + ' years' + (post ? ' and works at the ' + BUILDINGS[post.type].name : '') + '.'
              : 'Left the guild after ' + years + ' years.'}
            {' '}{a.outings} outings, level {a.level}{a.clears5 ? ', ' + a.clears5 + ' tier 5 clears' : ''}{a.liberated ? ', freed a region' : ''}.
          </span>
          {a.state === 'fallen' && !a.tomb && !!a.lostGear?.length && <span className="muted" style={{ fontSize: 12 }}>Their gear is still out there. A recovery expedition on the board can bring it home.</span>}
        </div>
      )}

      {live && (
        <div className="two-col">
          {champ
            ? <div className="panel" style={{ padding: '10px 12px', fontSize: 13 }}>Your real-life XP, practice and a quarter of the gold go to {a.first}.</div>
            : <button className="btn btn-primary inked" onClick={() => actions.setChampion(a.id)} disabled={!!a.awayOn} style={{ minHeight: 44 }}><Icon n="crown" size={15} />Make Champion</button>}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
            <span className="label">Level {a.level}{a.level < MAX_LEVEL ? ' · ' + Math.floor(a.xp) + ' / ' + xpToNext(a.level) + ' XP' : ''}</span>
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
      {live && <p className="muted" style={{ margin: '-4px 0 0', fontSize: 12 }}>
        The thin bars are practice from real life: Crisis quests train Might, Main quests Wits, Errands Finesse, Side quests Spirit, and habits {a.first}'s main attribute. Every {PRACTICE_PER_POINT} XP adds a point.
      </p>}

      {live && (
        <>
          <div className="two-col">
            <div><span className="label">Stamina {Math.round(a.stamina)}{staminaCap(a.wounds) < 100 ? ' of ' + staminaCap(a.wounds) : ''}</span><Bar value={a.stamina} color="var(--q-moss)" label="Stamina" /></div>
            <div><span className="label">Fatigue {Math.round(a.fatigue)}</span><Bar value={a.fatigue} color="var(--color-accent-500)" label="Fatigue" /></div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Stamina is energy right now: outings drain it and rest brings it back. Fatigue is the slow weariness of the work; it builds with age and outings, mends slowly, and never drops below what the years have taken (about {Math.round(fatigueFloor(a, phase))} now). Both lower what {a.first} brings to a check, stamina most: at the moment {a.first} performs at {Math.round(conditionFactor(a) * 100)}%.
          </p>
          {a.wounds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label">Wounds</span>
              {a.wounds.map((w) => {
                const problem = treatProblem(g, a, w);
                return (
                  <div key={w.id} className="panel" style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span className="pill" style={{ color: w.severity === 'major' ? 'var(--q-wax)' : 'var(--color-accent-800)' }}>{SEVERITY_NAME[w.severity]}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{w.text}<span className="muted" style={{ fontSize: 12 }}> · {SOURCE_NAME[w.source].toLowerCase()} · about {Math.max(1, Math.ceil(w.left / recoveryMult(g, w.source) / 3))} {Math.ceil(w.left / recoveryMult(g, w.source) / 3) === 1 ? 'day' : 'days'} to heal{w.treated ? ' · treated' : ''}</span></span>
                    {w.severity === 'major' && !w.treated && (
                      <button className="btn btn-secondary" disabled={!!problem} title={problem ?? undefined} onClick={() => actions.treat(a.id, w.id)} style={{ minHeight: 34, fontSize: 13 }}>
                        Treat · {treatCost(g, w)}g
                      </button>
                    )}
                  </div>
                );
              })}
              {a.wounds.some((w) => w.severity === 'major') && <span className="muted" style={{ fontSize: 12 }}>Major wounds heal slowly and can leave a scar. The Infirmary treats physical wounds and disease, the Temple magical ones: treatment halves the time and makes a scar much less likely. Healers, rest, good housing and a lively tavern all speed recovery; away from home, wounds heal at a third of the pace.</span>}
            </div>
          )}
          {!a.awayOn && (
            <div className="field"><label>At home</label>
              <Seg<Duty> name="duty" value={a.duty} onChange={(v) => actions.setDuty(a.id, v)} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 40, fontSize: 13, padding: '0 2px' }}
                options={[{ key: 'auto', label: 'Auto' }, { key: 'train', label: 'Train' }, { key: 'rest', label: 'Rest' }, { key: 'labour', label: 'Labour' }, { key: 'patrol', label: 'Patrol' }]} />
              <span className="muted" style={{ fontSize: 12 }}>
                Auto rests when stamina is under 60 or fatigue is well above what the years have taken, and trains otherwise. Labour speeds up construction (+5%), Patrol gathers a little wood and stone and adds an expedition to the board. Anyone with a minor or major wound rests.
              </span>
            </div>
          )}
        </>
      )}

      {(live || a.state === 'retired') && <Gear g={g} a={a} />}

      <div className="facts" style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--q-rule)', borderBottom: '1px solid var(--q-rule)' }}>
        {[['Rating', ratingShown(a)], ['Purse', a.purse + 'g'], ['Outings', a.outings], ['Joined', shortClock(a.joinedPhase * 3_600_000).split(',')[1]?.trim() ?? '']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0' }}>
            <span className="label" style={{ fontSize: 10 }}>{k}</span><span className="heading tnum" style={{ fontSize: 19 }}>{v}</span>
          </div>
        ))}
      </div>
      {a.scars.length > 0 && <p style={{ margin: 0, fontSize: 14 }}><strong>Scars:</strong> {a.scars.join(', ')}.</p>}
      {(partner || parents.length > 0 || kids.length > 0) && (
        <p style={{ margin: 0, fontSize: 14 }}>
          {partner && <>Partner: <strong>{partner.first}</strong>. </>}
          {parents.length > 0 && <>Child of {names(parents.map((x) => x.first))}. </>}
          {kids.length > 0 && <>{kids.length === 1 ? 'Child' : 'Children'}: {names(kids.map((x) => x.first))}.</>}
        </p>
      )}
      {a.state === 'retired' && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {a.staffAt ? 'Works at the ' + (post ? BUILDINGS[post.type].name : 'town') + '. ' : 'Posts to a building are made from the Town tab. '}
          {a.recalled ? 'Has already taken their one last job.' : 'Can be called back once for an expedition or odyssey, at a small penalty.'}
        </p>
      )}
      {a.staffAt && <button className="btn btn-secondary" onClick={() => actions.assignStaff(a.id, null)}>Stand down from their post</button>}

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
        <button className="btn btn-secondary" onClick={() => actions.confirm({
          title: 'Retire ' + a.first + ' now?', tone: 'go', confirmLabel: 'Retire', body: a.first + ' retires with their purse (' + a.purse + 'g) and joins the retirees, who can work at the town\'s buildings and be called back once for a last job.',
          onConfirm: () => actions.retire(a.id),
        })}>Retire {a.first}</button>
      )}
      {live && !a.awayOn && (
        <button className="danger-btn" onClick={() => actions.confirm({
          title: 'Let ' + a.first + ' go?', body: a.first + ' leaves the guild for good. Their purse (' + a.purse + 'g) and gear stay with the guild.', confirmLabel: 'Let them go',
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
  const avail = g.adventurers.filter((a) => (a.state === 'active' || (a.state === 'retired' && offer?.scale !== 'odd' && !a.recalled)) && !a.awayOn);
  const [party, setParty] = useState<string[]>(() => (offer ? avail.filter((a) => a.state === 'active' && canGoOut(a, phase)).sort((x, y) => rating(y) - rating(x)).slice(0, offer.minParty).map((a) => a.id) : []));
  const [stance, setStance] = useState<Stance>('steady');
  const problem = offer ? sendProblem(g, offer, party) : 'Gone';
  const calc = useMemo(() => {
    if (!offer || !party.length || !party.every((x) => byId(g, x))) return null;
    const { ctx, hidden } = ctxFor(g, offer, party, stance);
    return { ctx, hidden, ...oddsRange(ctx, hidden) };
  }, [g, offer, party, stance]);
  if (!offer) return null;
  const o = calc ? (calc.hidden ? calc.hi : calc.lo) : null;
  const lo = calc?.lo;
  const toggle = (aid: string) => setParty((p) => (p.includes(aid) ? p.filter((x) => x !== aid) : p.length >= offer.maxParty ? p : [...p, aid]));
  const rangePct = (a: number, b: number) => (calc && calc.hidden && Math.abs(a - b) >= 0.0005 ? pct(Math.min(a, b)) + '–' + pct(Math.max(a, b)) : pct(Math.max(a, b)));
  const dep = departure(g, offer);
  const members = calc?.ctx.members ?? [];
  const countered = (c: string) => members.some((m) => m.counters.includes(c as never));
  return (
    <Sheet onClose={close} label={offer.name}>
      <Head title={offer.name} onClose={close}>
        <span className="seal" style={{ width: 40, height: 40, flex: 'none' }}><Icon n={offer.scale === 'odd' ? 'scroll' : offer.scale === 'odyssey' ? 'compass' : OFFER_KIND[offer.kind].icon} size={18} /></span>
      </Head>
      <OfferMeta o={offer} g={g} />
      {offer.scale !== 'odd' && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{REGIONS[offer.region].blurb} Setting out {dep.fx.name === 'Noon' ? 'at noon' : 'in the ' + dep.fx.name.toLowerCase()}: {lowerFirst(dep.fx.text)}{g.regions[offer.region].liberated ? ' This region is free, so trips here are shorter and richer.' : ''}</p>}
      {offer.scale !== 'odd' && (
        <ol className="battle-log" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          {offer.stages.map((st, i) => <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon n={STAGE_ICON[st.kind]} size={13} /><span><strong>{STAGE_NAME[st.kind]}</strong> · {st.title}</span></li>)}
        </ol>
      )}
      {calc && calc.ctx.conditions.length > 0 && (
        <p style={{ margin: 0, fontSize: 13 }}>
          {calc.ctx.conditions.map((c, i) => c === 'unknown' ? null : (
            <span key={i} style={{ marginRight: 12, color: countered(c) ? 'var(--q-moss)' : 'var(--q-wax)' }}>{CONDITIONS[c].name}: {countered(c) ? 'countered' : 'not countered'}</span>
          ))}
          {calc.hidden > 0 && <span className="muted">+ {calc.hidden} hidden</span>}
        </p>
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
                  <span className="heading" style={{ fontSize: 16 }}>{a.first}{g.championId === a.id ? ' ♛' : ''}{a.state === 'retired' ? ' · one last job' : ''}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{advSub(a)} · {free ? 'stamina ' + Math.round(a.stamina) + ', fatigue ' + Math.round(a.fatigue) + (a.wounds.length ? ', ' + (worst(a.wounds) === 'major' ? 'badly wounded' : 'wounded') : '') : status(g, a, phase, g.t).text}</span>
                </span>
                <span className="heading tnum" style={{ fontSize: 17 }}>{ratingShown(a)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {offer.scale !== 'odd' && (
        <div className="field"><label>Stance</label>
          <Seg<Stance> name="stance" value={stance} onChange={setStance} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 40 }}
            options={(['cautious', 'steady', 'bold'] as Stance[]).map((k) => ({ key: k, label: STANCES[k].name }))} />
          <span className="muted" style={{ fontSize: 12 }}>{STANCES[stance].text}</span>
        </div>
      )}

      {o && lo && (
        <div className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">The odds{calc!.hidden > 0 ? ' · a range, because something is hidden' : ''}</span>
          <div className="tnum" style={{ fontSize: 14 }}>
            {offer.scale !== 'odd' ? <>Clean run {rangePct(lo.full, o.full)} · turn back {rangePct(lo.turnBack, o.turnBack)} · someone comes home with a major wound {rangePct(lo.anyMajor, o.anyMajor)}</> : <>Goes well {rangePct(lo.full, o.full)}</>}
          </div>
          <div className="tnum" style={{ fontSize: 14 }}>
            Loot about {lootText(lo.loot)}{lo.goldHigh > lo.goldLow ? ' (gold ' + lo.goldLow + '–' + lo.goldHigh + ')' : ''} · about {lo.xp} XP each
            {offer.scale !== 'odd' && <> · about {Math.round(o.renown) === Math.round(lo.renown) ? Math.round(lo.renown) : Math.round(o.renown) + '–' + Math.round(lo.renown)} renown (a clean run earns double)</>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {party.map((x) => (
              <div key={x} className="tnum" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0', borderTop: '1px solid var(--q-rule)' }}>
                <span>{byId(g, x)!.first}</span>
                <span>wounded {rangePct(lo.injury[x], o.injury[x])} · <span style={{ color: Math.max(o.major[x], lo.major[x]) > 0.05 ? 'var(--q-wax)' : undefined }}>major {rangePct(lo.major[x], o.major[x])}</span></span>
              </div>
            ))}
          </div>
          {offer.scale !== 'odd' && party.some((x) => worst(byId(g, x)!.wounds) === 'major') && (
            <span style={{ color: 'var(--q-wax)', fontSize: 12 }}>Someone in this party has a major wound: it takes a large share of their stamina and rating, and heals slowly away from home.</span>
          )}
          {offer.scale !== 'odd' && <span className="muted" style={{ fontSize: 12 }}>Gear is lent from the racks, and adventurers with gold buy potions and better gear themselves.</span>}
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
  const injuredBack = Object.entries(o.result.members).filter(([, m]) => m.wounds?.length || m.injury);
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
          <span>{lootText(o.result.loot)}{o.result.chest ? ' (the chest held ' + lootText(o.result.chest) + ')' : ''}{o.renown ? ', and ' + o.renown + ' renown' : ''}</span>
          <span>{Object.entries(o.result.members).filter(([, m]) => !m.died).map(([k, m]) => byId(g, k)!.first + ' +' + m.xp + ' XP').join(' · ') || 'Nobody came back.'}</span>
          {injuredBack.map(([k, m]) => <span key={k} style={{ color: 'var(--q-wax)' }}>{byId(g, k)!.first}: {m.wounds?.length ? m.wounds.map((w) => w.severity + ' wound, ' + w.text).join('; ') : m.injury ? m.injury.text + ', ' + m.injury.days + ' days' : ''}.</span>)}
          {o.potions && Object.values(o.potions).some((x) => x.length) && <span className="muted">Potions drunk: {Object.entries(o.potions).filter(([, x]) => x.length).map(([k, x]) => byId(g, k)!.first + ' ' + x.join(', ')).join(' · ')}.</span>}
          {o.offer.recover && o.done && byId(g, o.offer.recover)?.tomb && <span style={{ color: 'var(--q-moss)' }}>{byId(g, o.offer.recover)!.first} was brought home and laid to rest.</span>}
          {o.offer.scale === 'odyssey' && g.regions[o.offer.region].liberated && o.done && <span style={{ color: 'var(--q-moss)', fontWeight: 600 }}>{REGIONS[o.offer.region].name} is free. The guild has an outpost there.</span>}
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
                  <span style={{ fontSize: 12 }}>{a.traitIds.map((id) => TRAIT[id]?.name).filter(Boolean).join(' · ')}{a.conviction ? ' · ' + CONVICTION[a.conviction]?.name : ''}</span>
                  {a.vow && <span className="muted" style={{ fontSize: 12 }}>Vow: {lowerFirst(vowText(a.vow))}.</span>}
                  <span className="muted" style={{ fontSize: 12 }}>{CLASSES[a.cls].blurb} Age {ageYears(a, 0)}, sworn {a.career} years. {RACES[a.race].trait}: {lowerFirst(RACES[a.race].traitText)}.</span>
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
