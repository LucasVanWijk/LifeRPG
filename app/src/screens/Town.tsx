import { BUILDING_IDS, BUILDINGS, hallRank, MAX_HALL, STOCK_NAME } from '../domain/guild/content';
import type { StockKey } from '../domain/guild/content';
import { bld, buildProblem, capacity, CAP_KEYS, capLabel, costOf, costText, countOf, crews, hallLevel, production, slotCount, staffOf, staffSlots, storageCap, surplus } from '../domain/guild/town';
import type { Building, Guild as GuildT } from '../domain/guild/types';
import { Icon } from '../components/Icon';
import { Bar } from '../components/guildParts';
import { useState } from 'react';
import { Seg } from '../components/common';
import { TownMap } from '../components/TownMap';
import { useStore } from '../state/store';
import { Section } from './Guild';

const CAP_HINT: Record<string, string> = {
  food: 'Everyone in town eats: workers, retirees, children and adventurers.',
  housing: 'Workers, retirees and children need a home.',
  happiness: 'Surplus brings better recruits (every 5 adds one more at the Tavern).',
  order: 'Surplus lets the board offer more (every 5 adds an expedition).',
};

const VIEW_KEY = 'questlog:townview';
type View = 'map' | 'list';
const loadView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'map'; } catch { return 'map'; } };

export function Town({ g }: { g: GuildT }) {
  const { setUi } = useStore();
  const [view, setViewState] = useState<View>(loadView);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };
  const hall = bld(g, 'hall')!;
  const level = hallLevel(g);
  const cap = capacity(g);
  const made = production(g);
  const room = storageCap(g);
  const upgrading = g.construction.find((c) => c.type === 'hall');
  const nextHall = level < MAX_HALL ? costOf(g, 'hall', level + 1) : null;
  const buildings = g.buildings.filter((b) => b.type !== 'hall').sort((a, b) => BUILDINGS[a.type].name.localeCompare(BUILDINGS[b.type].name) || b.level - a.level);
  const map = view === 'map';
  return (
    <>
      <Seg<View> name="town-view" value={view} onChange={setView} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }} optStyle={{ justifyContent: 'center', minHeight: 38, fontSize: 14 }}
        options={[{ key: 'map', label: 'Map' }, { key: 'list', label: 'List' }]} />
      {map && (
        <section className="panel" style={{ padding: 6 }}>
          <TownMap g={g} onBuilding={(id) => setUi({ buildSheet: id })} onPlot={(type, plot) => setUi({ buildSheet: 'type:' + type, buildPlot: plot })} />
          <p className="muted" style={{ margin: '6px 8px 4px', fontSize: 12 }}>Every building has its own place in town. Faded ones are still at level 0: tap one to build it, or a built one to raise it. A green arrow or plus means you can afford it now; a lock means the Guild Hall must rise first. Homes and Farms go on the dashed plots.</p>
        </section>
      )}
      {!map && <button className="panel-framed" onClick={() => setUi({ buildSheet: hall.id })} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
        <span className="seal heading tnum" style={{ width: 54, height: 54, fontSize: 26, flex: 'none' }}>{level}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="kicker">{hallRank(level)} rank · {crews(g)} {crews(g) === 1 ? 'crew' : 'crews'}</span>
          <span className="heading" style={{ display: 'block', fontSize: 24, lineHeight: 1.1 }}>Guild Hall</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {upgrading ? 'Being raised to level ' + upgrading.level + ' (' + Math.ceil(upgrading.left) + ' more phases)'
              : nextHall ? 'Next: ' + costText(nextHall) + ' · ' + nextHall.renown + ' renown (you have ' + g.renown + ')' : 'The highest level.'}
          </span>
        </span>
        <Icon n="chevron-right" size={18} />
      </button>}

      <Section title="The town" sub={'Homes ' + countOf(g, 'home') + ' of ' + slotCount(g) + ' · Farms ' + countOf(g, 'farm') + ' of ' + slotCount(g)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', paddingTop: 4 }}>
          {CAP_KEYS.map((k) => {
            const c = cap[k], s = surplus(c);
            return (
              <div key={k} title={CAP_HINT[k]} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span className="label">{capLabel(k)}</span>
                  <span className="tnum" style={{ color: s < 0 ? 'var(--q-wax)' : undefined }}>{c.demand} / {c.supply}</span>
                </span>
                <Bar value={c.demand} max={Math.max(1, c.supply)} color={s < 0 ? 'var(--q-wax)' : 'var(--q-moss)'} label={capLabel(k)} height={7} />
              </div>
            );
          })}
        </div>
        {CAP_KEYS.some((k) => surplus(cap[k]) < 0) && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--q-wax)' }}>
            Over capacity: {CAP_KEYS.filter((k) => surplus(cap[k]) < 0).map(capLabel).join(', ').toLowerCase()}. Nothing gets worse, but you can’t build anything else that adds to it. Homes and Farms can always be built.
          </p>
        )}
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Demand against supply. {cap.workers} workers, {cap.residents - cap.workers} retirees and children.</div>
      </Section>

      <Section title="Stores" sub={'Each holds up to ' + room}>
        {(['wood', 'stone', 'iron', 'herbs'] as StockKey[]).map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--q-rule)' }}>
            <span style={{ width: 54, fontSize: 14 }}>{STOCK_NAME[k]}</span>
            <div style={{ flex: 1 }}><Bar value={g.stock[k]} max={room} color="var(--color-accent-500)" label={STOCK_NAME[k]} height={6} /></div>
            <span className="tnum" style={{ width: 96, textAlign: 'right', fontSize: 13 }}>{g.stock[k]}{made[k] ? <span className="muted"> +{made[k]}/ph</span> : null}</span>
          </div>
        ))}
        {g.stock.wood >= room && <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>Production stops when a store is full: raise the Warehouse.</p>}
      </Section>

      {g.construction.length > 0 && (
        <Section title="Under construction" sub={g.construction.length + ' of ' + crews(g) + ' crews'}>
          {g.construction.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
              <Icon n={BUILDINGS[c.type].icon} size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="heading" style={{ fontSize: 17 }}>{BUILDINGS[c.type].name} · level {c.level}</div>
                <Bar value={c.total - c.left} max={c.total} color="var(--color-accent-500)" label="Progress" height={5} />
              </div>
              <span className="muted tnum" style={{ fontSize: 12 }}>{Math.ceil(c.left)} phases</span>
            </div>
          ))}
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>Adventurers set to Labour at home speed work up (+5% each).</p>
        </Section>
      )}

      {map && <button className="dashed-btn" onClick={() => setUi({ buildSheet: 'new', buildPlot: null })} style={{ gap: 8, minHeight: 48, fontSize: 17 }}><Icon n="plus" size={17} />Build something</button>}
      {!map && <Section title="Buildings" sub={buildings.length + ' built'}>
        {buildings.map((b) => <BuildingRow key={b.id} g={g} b={b} />)}
        {BUILDING_IDS.filter((t) => t !== 'home' && t !== 'farm' && !g.buildings.some((b) => b.type === t) && !g.construction.some((c) => c.type === t && !c.target)).map((t) => (
          <button key={t} className="agenda-row" onClick={() => setUi({ buildSheet: 'type:' + t, buildPlot: null })} style={{ gap: 12, padding: '10px 2px', opacity: 0.75 }}>
            <span className="seal" style={{ width: 34, height: 34, flex: 'none', opacity: 0.6 }}><Icon n={BUILDINGS[t].icon} size={16} /></span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="heading" style={{ fontSize: 17 }}>{BUILDINGS[t].name} <span className="muted tnum" style={{ fontSize: 13 }}>· level 0</span></span>
              <span className="muted" style={{ fontSize: 12 }}>{level < BUILDINGS[t].hall ? 'Needs Guild Hall level ' + BUILDINGS[t].hall : buildProblem(g, t) ? 'Not built yet' : 'Can be built now'}</span>
            </span>
            <Icon n="chevron-right" size={16} />
          </button>
        ))}
        <button className="dashed-btn" onClick={() => setUi({ buildSheet: 'new', buildPlot: null })} style={{ gap: 8, minHeight: 48, marginTop: 10, fontSize: 17 }}>
          <Icon n="plus" size={17} />Build something
        </button>
      </Section>}
    </>
  );
}

function BuildingRow({ g, b }: { g: GuildT; b: Building }) {
  const { setUi } = useStore();
  const d = BUILDINGS[b.type];
  const up = g.construction.find((c) => c.target === b.id);
  const staff = staffOf(g, b).length, slots = staffSlots(b);
  const free = !buildProblem(g, b.type, b);
  const value = d.values[b.level - 1];
  return (
    <button className="agenda-row" onClick={() => setUi({ buildSheet: b.id })} style={{ gap: 12, padding: '10px 2px' }}>
      <span className="seal" style={{ width: 34, height: 34, flex: 'none' }}><Icon n={d.icon} size={16} /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="heading" style={{ fontSize: 17 }}>{d.name} <span className="muted tnum" style={{ fontSize: 13 }}>· level {b.level}</span></span>
        <span className="muted" style={{ fontSize: 12 }}>
          {value !== undefined ? value + ' ' + d.unit : d.blurb}
          {slots > 0 ? ' · staff ' + staff + '/' + slots : ''}{up ? ' · improving' : free && b.level < 5 ? ' · can be raised' : ''}
        </span>
      </span>
      <Icon n="chevron-right" size={16} />
    </button>
  );
}
