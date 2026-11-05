import type { ReactNode } from 'react';
import { BUILDINGS, BUILDING_IDS, CLASSES, FORGE_IRON, GRADES, hallRank, MAX_BUILDING_LEVEL, MAX_HALL, POTION_KINDS, POTIONS, REGION_ORDER, REGIONS, SELL_PRICE, SLOT_NAME, SLOTS, STOCK_NAME, TIER_HALL, workersFor, crewsFor, plotsFor, buildingCap, SINGLE } from '../domain/guild/content';
import type { Slot, StockKey } from '../domain/guild/content';
import { fullName } from '../domain/guild/adventurer';
import { brewCost, POTION_CAP, reforgeCost, sellLeft, sellLimit, soldThisWeek, salvagePct } from '../domain/guild/engine';
import { buildProblem, costNextSeason, costOf, costText, hallLevel, levelOf, staffMult, staffNote, staffOf, staffSlots, value } from '../domain/guild/town';
import type { Guild } from '../domain/guild/types';
import { Icon } from '../components/Icon';
import { Empty, Sheet } from '../components/common';
import { ItemLine } from '../screens/Legacy';
import { useStore } from '../state/store';
import { Head } from './GuildSheets';

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '1px solid var(--q-rule)', fontSize: 14 }}>
    <span className="label" style={{ paddingTop: 2, flex: 'none', maxWidth: '40%' }}>{label}</span><span style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>{children}</span>
  </div>
);

/** Everything the next Guild Hall level changes, in words. */
function hallUnlocks(next: number): string[] {
  const out: string[] = [];
  const tier = TIER_HALL.indexOf(next);
  if (tier > 0) out.push('Tier ' + (tier + 1) + ' expeditions');
  if (crewsFor(next) > crewsFor(next - 1)) out.push('a ' + (crewsFor(next)) + 'th crew'.replace('2th', '2nd').replace('3th', '3rd'));
  if (buildingCap(next) > buildingCap(next - 1)) out.push('buildings up to level ' + buildingCap(next));
  if (next === 3) out.push('odysseys');
  out.push('2 more plots (' + plotsFor(next) + ')');
  if (Math.floor(next / 2) > Math.floor((next - 1) / 2)) out.push('one more expedition out at a time');
  out.push('+10% gold from real life');
  const d = Object.values(BUILDINGS).filter((b) => b.hall === next).map((b) => b.name);
  if (d.length) out.push('can build: ' + d.join(', '));
  return out;
}

export function BuildingSheet({ id }: { id: string }) {
  const { data, setUi, actions } = useStore();
  const g = data.guild!;
  const b = g.buildings.find((x) => x.id === id);
  const close = () => setUi({ buildSheet: null });
  if (!b) return null;
  const d = BUILDINGS[b.type];
  const isHall = b.type === 'hall';
  const nextLevel = b.level + 1;
  const maxed = isHall ? b.level >= MAX_HALL : b.level >= MAX_BUILDING_LEVEL;
  const problem = maxed ? null : isHall ? buildProblem(g, 'hall') : buildProblem(g, b.type, b);
  const cost = maxed ? null : costOf(g, b.type, nextLevel);
  const nextSeason = maxed || isHall ? null : costNextSeason(g, b.type, nextLevel);
  const cheaper = cost && nextSeason && nextSeason.gold < cost.gold * 0.95;
  const slots = staffSlots(b), staff = staffOf(g, b);
  const retirees = g.adventurers.filter((a) => a.state === 'retired' && a.staffAt !== b.id);
  const up = g.construction.find((c) => c.target === b.id);
  return (
    <Sheet onClose={close} label={d.name}>
      <Head title={d.name + ' · level ' + b.level} onClose={close}><span className="seal" style={{ width: 44, height: 44, flex: 'none' }}><Icon n={d.icon} size={19} /></span></Head>
      <p className="muted" style={{ margin: '-4px 0 0', fontSize: 14 }}>{d.blurb}</p>

      {isHall ? (
        <>
          <Row label="Rank">{hallRank(b.level)}</Row>
          <Row label="Crews">{crewsFor(b.level)} · each builds one project at a time</Row>
          <Row label="Plots">{plotsFor(b.level)}</Row>
          <Row label="Buildings can reach level">{buildingCap(b.level)}</Row>
          <Row label="Tiers open">{TIER_HALL.filter((h) => h <= b.level).length}</Row>
          {!maxed && <Row label={'Level ' + nextLevel + ' brings'}>{hallUnlocks(nextLevel).join(' · ')}</Row>}
        </>
      ) : (
        <>
          {d.values.length > 0 && <Row label="Now">{d.values[b.level - 1]} {d.unit}{maxed ? '' : ' → ' + d.values[b.level] + ' at level ' + nextLevel}</Row>}
          {d.workers > 0 && <Row label="Workers">{workersFor(d, b.level)}{maxed ? '' : ' → ' + workersFor(d, nextLevel)}</Row>}
          {d.happy && <Row label="Happiness">{d.happy[b.level - 1] > 0 ? '+' : ''}{d.happy[b.level - 1]}</Row>}
        </>
      )}

      {up ? <p style={{ margin: 0, fontSize: 14 }}>Being raised to level {up.level}: {Math.ceil(up.left)} phases to go.</p>
        : maxed ? <p className="muted" style={{ margin: 0, fontSize: 14 }}>Already at its highest level.</p>
        : (
          <div className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label">Raise to level {nextLevel}</span>
            <span className="tnum" style={{ fontSize: 15 }}>{costText(cost!)} · {cost!.phases} phases{isHall ? ' · ' + cost!.renown + ' renown' : ''}</span>
            {cheaper && <span className="muted" style={{ fontSize: 12 }}>Cheaper next season: {costText(nextSeason!)}.</span>}
            {problem && <span style={{ fontSize: 13, color: 'var(--q-wax)' }}>{problem}</span>}
            <button className="btn btn-primary inked" disabled={!!problem} onClick={() => actions.upgrade(b.id)} style={{ minHeight: 44 }}>Raise to level {nextLevel}</button>
          </div>
        )}

      {slots > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={{ fontSize: 20 }}>Staff · {staff.length} of {slots}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            A retiree here adds 1% per level to what the building does, twice that for {staffNote(b.type) || 'a matching class'}{staff.length ? ' (now ×' + staffMult(g, b.type).toFixed(2) + ')' : ''}.
          </p>
          {staff.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 15 }}>{fullName(a)} <span className="muted">· level {a.level} {CLASSES[a.cls].name}</span></span>
              <button className="btn btn-secondary" onClick={() => actions.assignStaff(a.id, null)} style={{ minHeight: 36 }}>Stand down</button>
            </div>
          ))}
          {staff.length < slots && retirees.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 15 }}>{fullName(a)} <span className="muted">· level {a.level} {CLASSES[a.cls].name}{d.staffClass?.includes(a.cls) ? ' · suits it' : ''}</span></span>
              <button className="btn btn-secondary" onClick={() => actions.assignStaff(a.id, b.id)} style={{ minHeight: 36 }}>Post here</button>
            </div>
          ))}
          {staff.length < slots && !retirees.length && <Empty>No retirees free. Adventurers who retire can work here.</Empty>}
        </div>
      )}

      {b.type === 'armoury' && <Armoury g={g} />}
      {b.type === 'market' && <Market g={g} />}
      {b.type === 'smithy' && <Smithy g={g} />}
      {b.type === 'stillroom' && <Stillroom g={g} />}
      {b.type === 'cartographer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3 style={{ fontSize: 20 }}>Regions</h3>
          {REGION_ORDER.map((r, i) => (
            <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0', borderTop: '1px solid var(--q-rule)', opacity: i <= b.level ? 1 : 0.5 }}>
              <span>{REGIONS[r].name}</span>
              <span className="muted">{g.regions[r].liberated ? 'freed' : i <= b.level ? 'charted' : 'level ' + i}</span>
            </div>
          ))}
        </div>
      )}

      {!isHall && !d.noPlot && !up && (
        <button className="danger-btn" onClick={() => actions.confirm({
          title: 'Pull down the ' + d.name + '?', body: 'Its plot and workers are freed, and half the wood, stone and iron it cost comes back. No gold does.', confirmLabel: 'Pull it down',
          onConfirm: () => actions.demolish(b.id),
        })}>Pull it down</button>
      )}
    </Sheet>
  );
}

function Armoury({ g }: { g: Guild }) {
  const { actions } = useStore();
  const racks = value(g, 'armoury');
  const smith = levelOf(g, 'smithy') > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: 20 }}>On the racks · {g.armoury.length} of {racks}</h3>
      <p className="muted" style={{ margin: '2px 0 4px', fontSize: 12 }}>Adventurers borrow the best for free before each outing and hand it back when they retire. When the racks are full, the weakest unlocked piece is melted down.</p>
      {g.armoury.map((i) => (
        <ItemLine key={i.id} i={i} right={
          <span style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-icon btn-ghost" aria-label={i.locked ? 'Unlock' : 'Lock'} aria-pressed={!!i.locked} onClick={() => actions.lockItem(i.id)} style={{ width: 34, height: 34, color: i.locked ? 'var(--q-wax)' : undefined }}><Icon n="lock" size={15} /></button>
            {smith && i.wear < 99 && <button className="btn btn-ghost inked" onClick={() => actions.reforge(i.id)} style={{ minHeight: 34, padding: '0 8px' }} title="Restore wear">Mend {reforgeCost(i)}</button>}
            <button className="btn btn-ghost inked" onClick={() => actions.salvage(i.id)} disabled={i.locked} style={{ minHeight: 34, padding: '0 8px' }}>Melt</button>
          </span>
        } />
      ))}
      {!g.armoury.length && <Empty>Empty. Gear comes from Gear expeditions, the Merchant House and the Blacksmith.</Empty>}
    </div>
  );
}

function Market({ g }: { g: Guild }) {
  const { actions } = useStore();
  const left = sellLeft(g);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ fontSize: 20 }}>Selling</h3>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>This week the house will buy {left} more gold’s worth ({soldThisWeek(g)} of {sellLimit(g)} used). A game week is 8 days, one real day.</p>
      {(['wood', 'stone', 'iron', 'herbs'] as StockKey[]).map((k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--q-rule)', fontSize: 14 }}>
          <span style={{ flex: 1 }}>{STOCK_NAME[k]} <span className="muted tnum">{g.stock[k]} · {SELL_PRICE[k]}g each</span></span>
          <button className="btn btn-secondary" disabled={!g.stock[k] || left <= 0} onClick={() => actions.sell({ kind: 'stock', key: k, n: 25 })} style={{ minHeight: 34 }}>Sell 25</button>
          <button className="btn btn-secondary" disabled={!g.stock[k] || left <= 0} onClick={() => actions.sell({ kind: 'stock', key: k, n: g.stock[k] })} style={{ minHeight: 34 }}>All</button>
        </div>
      ))}
      <h3 style={{ fontSize: 20, marginTop: 8 }}>For sale this season</h3>
      {g.market.stock.map((i) => (
        <ItemLine key={i.id} i={i} right={<button className="btn btn-primary inked" disabled={g.gold < i.price} onClick={() => actions.buyMarket(i.id)} style={{ minHeight: 36 }}>{i.price}g</button>} />
      ))}
      {!g.market.stock.length && <Empty>The stalls are being set up. New stock arrives each season.</Empty>}
      <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Adventurers with gold in their purse buy better gear here themselves before an expedition. Pieces on the racks can be sold from the Armoury.</p>
    </div>
  );
}

function Smithy({ g }: { g: Guild }) {
  const { actions } = useStore();
  const top = levelOf(g, 'smithy') - 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ fontSize: 20 }}>Forge</h3>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Melting gear returns {Math.round(salvagePct(g) * 100)}% of its iron. Iron on hand: {g.stock.iron}.</p>
      {SLOTS.map((s: Slot) => (
        <div key={s} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '6px 0', borderTop: '1px solid var(--q-rule)' }}>
          <span style={{ width: 64, fontSize: 14 }}>{SLOT_NAME[s]}</span>
          {GRADES.map((name, grade) => (
            <button key={name} className="btn btn-secondary" disabled={grade > top || g.stock.iron < FORGE_IRON[grade]} onClick={() => actions.forge(s, grade)} style={{ minHeight: 34, padding: '0 8px', fontSize: 12 }}>{name} · {FORGE_IRON[grade]}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Stillroom({ g }: { g: Guild }) {
  const { actions } = useStore();
  const lvl = levelOf(g, 'stillroom');
  const count = (k: string) => g.potions.filter((p) => p.kind === k).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ fontSize: 20 }}>Potions · {g.potions.length} of {POTION_CAP}</h3>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Adventurers buy up to two from here with their own purse before an expedition. Potions spoil after a game year (8 real days). Herbs on hand: {g.stock.herbs}.</p>
      {POTION_KINDS.map((k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--q-rule)' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="heading" style={{ fontSize: 16 }}>{POTIONS[k].name}</span> <span className="muted tnum" style={{ fontSize: 12 }}>· {count(k)} on the shelf · {POTIONS[k].price}g each</span>
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>{POTIONS[k].text}{POTIONS[k].level > lvl ? ' Needs a level ' + POTIONS[k].level + ' Stillroom.' : ''}</span>
          </span>
          <button className="btn btn-secondary" disabled={POTIONS[k].level > lvl || g.stock.herbs < brewCost(g, k)} onClick={() => actions.brew(k)} style={{ minHeight: 36 }}>Brew · {brewCost(g, k)}</button>
        </div>
      ))}
    </div>
  );
}

export function NewBuildingSheet() {
  const { data, setUi, actions } = useStore();
  const g = data.guild!;
  const close = () => setUi({ buildSheet: null });
  const list = BUILDING_IDS.filter((t) => !(SINGLE.has(t) && (g.buildings.some((b) => b.type === t) || g.construction.some((c) => c.type === t))))
    .sort((a, b) => BUILDINGS[a].hall - BUILDINGS[b].hall || BUILDINGS[a].name.localeCompare(BUILDINGS[b].name));
  return (
    <Sheet onClose={close} label="Build something">
      <Head title="Build something" onClose={close} />
      <p className="muted" style={{ margin: '-4px 0 0', fontSize: 13 }}>Guild Hall level {hallLevel(g)}. Costs shown are for this season.</p>
      {list.map((t) => {
        const d = BUILDINGS[t], c = costOf(g, t, 1), problem = buildProblem(g, t);
        return (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--q-rule)' }}>
            <span className="seal" style={{ width: 34, height: 34, flex: 'none' }}><Icon n={d.icon} size={16} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="heading" style={{ fontSize: 17 }}>{d.name}</span>
              <span className="muted" style={{ display: 'block', fontSize: 12 }}>{d.blurb}</span>
              <span className="tnum" style={{ display: 'block', fontSize: 12 }}>{costText(c)} · {c.phases} phases{d.workers ? ' · ' + d.workers + ' workers' : ''}</span>
              {problem && <span style={{ fontSize: 12, color: 'var(--q-wax)' }}>{problem}</span>}
            </span>
            <button className="btn btn-primary inked" disabled={!!problem} onClick={() => actions.build(t)} style={{ minHeight: 40 }}>Build</button>
          </div>
        );
      })}
    </Sheet>
  );
}
