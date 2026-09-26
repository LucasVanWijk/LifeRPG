import { useState } from 'react';
import type { ItemKind, Recipe, Skill } from '../../domain/expedition/content';
import { DUNGEONS, ITEMS, MAX_LEVEL, RECIPES, SHOP, SKILLS, xpForLevel } from '../../domain/expedition/content';
import { affordable, armourClass, damageBonus, level, maxHp, toHitBonus, weaponOf, xpToNext } from '../../domain/expedition/engine';
import { Icon } from '../../components/Icon';
import { useStore } from '../../state/store';
import { Bar } from '../Adventure';

const GATHER: Skill[] = ['fishing', 'cooking', 'mining', 'smithing'];
const uses = (r: Recipe) => Object.entries(r.use).map(([k, n]) => n + ' ' + ITEMS[k].name.toLowerCase()).join(' + ');

export function SkillsTab() {
  const { data, actions } = useStore();
  const e = data.expedition;
  const [open, setOpen] = useState<Skill | null>('fishing');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Train spends skill points on a level. Doing an activity also adds a little practice.
      </p>
      {SKILLS.map((s) => {
        const lvl = level(e, s.key), xp = e.skills[s.key];
        const floor = xpForLevel(lvl), need = xpToNext(e, s.key);
        const cost = Math.min(data.hero.points, Math.ceil(need));
        const gather = GATHER.includes(s.key), isOpen = open === s.key;
        return (
          <section key={s.key} className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--color-accent-700)' }}><Icon n={s.icon} size={20} /></span>
              <button className="skill-name" onClick={() => gather && setOpen(isOpen ? null : s.key)} aria-expanded={gather ? isOpen : undefined} disabled={!gather}>
                <span className="heading" style={{ fontSize: 18 }}>{s.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>{s.blurb}</span>
              </button>
              <span className="heading tnum" style={{ fontSize: 22, minWidth: 28, textAlign: 'right' }}>{lvl}</span>
              <button className="btn btn-primary inked" onClick={() => actions.expTrain(s.key)} disabled={!cost || lvl >= MAX_LEVEL} style={{ minHeight: 38, minWidth: 92, fontSize: 13 }}
                title={lvl >= MAX_LEVEL ? 'Highest level' : Math.ceil(need) + ' points to level ' + (lvl + 1)}>
                {lvl >= MAX_LEVEL ? 'Max' : 'Train · ' + (cost || Math.ceil(need))}
              </button>
            </div>
            {lvl < MAX_LEVEL && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><Bar value={xp - floor} max={xpForLevel(lvl + 1) - floor} color="var(--color-accent-500)" label={s.name + ' progress'} /></div>
                <span className="muted tnum" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{Math.ceil(need)} to go</span>
              </div>
            )}
            {gather && isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {RECIPES.filter((r) => r.skill === s.key).map((r) => {
                  const locked = lvl < r.level, can = affordable(e, r), running = e.activity?.kind === 'recipe' && e.activity.id === r.id;
                  return (
                    <div key={r.id} className="recipe-row" style={{ opacity: locked ? 0.55 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="heading" style={{ fontSize: 16 }}>{ITEMS[r.out].name}{ITEMS[r.out].heals ? ' · heals ' + ITEMS[r.out].heals : ''}</div>
                        <div className="muted tnum" style={{ fontSize: 12 }}>
                          {locked ? 'Level ' + r.level + ' · ' : ''}{r.time / 1000} s · uses {uses(r)} · enough for {can}
                        </div>
                      </div>
                      {running
                        ? <button className="btn btn-secondary" onClick={actions.expStop} style={{ minHeight: 36, fontSize: 13 }}>Stop</button>
                        : <button className="btn btn-primary inked" onClick={() => actions.expStart('recipe', r.id)} disabled={locked || !can} style={{ minHeight: 36, fontSize: 13 }}>Start</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function DungeonsTab() {
  const { data, actions } = useStore();
  const e = data.expedition;
  const w = weaponOf(e);
  const torches = e.bank.torch ?? 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel tnum" style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 13 }}>
        <span><strong>HP</strong> {maxHp(e)}</span>
        <span><strong>AC</strong> {armourClass(e)}</span>
        <span><strong>To hit</strong> d20 + {toHitBonus(e)}</span>
        <span><strong>Damage</strong> d{w.die} + {damageBonus(e)}</span>
        <span><strong>Torches</strong> {torches}</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Each run uses a torch. You fight room by room and eat your best food whenever the next hit could be dangerous, then go back in while torches last. Losing a fight costs nothing but the torch.
      </p>
      {DUNGEONS.map((d) => {
        const running = e.activity?.kind === 'dungeon' && e.activity.id === d.id;
        return (
          <section key={d.id} className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--q-wax)' }}><Icon n="skull" size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="heading" style={{ fontSize: 19 }}>{d.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{d.blurb} {d.suggested}.</div>
              </div>
              {running
                ? <button className="btn btn-secondary" onClick={actions.expStop} style={{ minHeight: 38 }}>Leave</button>
                : <button className="btn btn-primary inked" onClick={() => actions.expStart('dungeon', d.id)} disabled={!torches} style={{ minHeight: 38 }}>Enter</button>}
            </div>
            <div className="muted tnum" style={{ fontSize: 12 }}>
              {d.rooms.map((m) => m.name + ' (' + m.hp + ' HP, AC ' + m.ac + ')').join(' → ')}
            </div>
            {(e.clears[d.id] ?? 0) > 0 && <div className="tnum" style={{ fontSize: 12, color: 'var(--q-moss)' }}>Cleared {e.clears[d.id]}×</div>}
          </section>
        );
      })}
    </div>
  );
}

export function ShopTab() {
  const { data, actions } = useStore();
  const gold = data.hero.gold;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>Paid for with quest gold. Nothing in Expeditions earns gold back.</p>
      {SHOP.map((s) => (
        <div key={s.id} className="recipe-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="heading" style={{ fontSize: 17 }}>{s.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s.note}</div>
          </div>
          <span className="tnum" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'var(--color-accent-700)' }}><Icon n="coins" size={14} />{s.price}</span>
          <button className="btn btn-primary inked" onClick={() => actions.expBuy(s.id)} disabled={gold < s.price} style={{ minHeight: 38 }}>Buy</button>
        </div>
      ))}
    </div>
  );
}

const KIND_LABEL: [ItemKind, string][] = [['weapon', 'Weapons'], ['armour', 'Armour'], ['food', 'Food'], ['fish', 'Raw fish'], ['ore', 'Ore'], ['supply', 'Supplies'], ['trophy', 'Trophies']];

export function BankTab() {
  const { data, actions } = useStore();
  const e = data.expedition;
  const items = Object.entries(e.bank).filter(([, n]) => n > 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="two-col">
        {(['weapon', 'armour'] as const).map((slot) => {
          const id = e.equipment[slot];
          return (
            <div key={slot} className="panel" style={{ padding: '10px 12px' }}>
              <div className="label">{slot === 'weapon' ? 'Weapon' : 'Armour'}</div>
              <div className="heading" style={{ fontSize: 17 }}>{id ? ITEMS[id].name : slot === 'weapon' ? 'Fists' : 'None'}</div>
              <div className="muted tnum" style={{ fontSize: 12 }}>
                {slot === 'weapon' ? 'd' + weaponOf(e).die + ((weaponOf(e).dmg ?? 0) ? ' + ' + weaponOf(e).dmg : '') + ' · +' + (weaponOf(e).acc ?? 0) + ' to hit' : '+' + (id ? ITEMS[id].ac : 0) + ' AC'}
              </div>
            </div>
          );
        })}
      </div>
      {!items.length && <p className="muted" style={{ margin: 0, fontStyle: 'italic', fontSize: 14 }}>Your bank is empty. Buy supplies in the shop to get started.</p>}
      {KIND_LABEL.map(([kind, label]) => {
        const rows = items.filter(([id]) => ITEMS[id]?.kind === kind);
        if (!rows.length) return null;
        return (
          <div key={kind}>
            <div className="label" style={{ paddingBottom: 2 }}>{label}</div>
            {rows.map(([id, n]) => {
              const it = ITEMS[id], gear = kind === 'weapon' || kind === 'armour';
              const equipped = e.equipment[kind as 'weapon' | 'armour'] === id;
              return (
                <div key={id} className="recipe-row">
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {it.name}
                    <span className="muted" style={{ fontSize: 12 }}>
                      {it.heals ? ' · heals ' + it.heals : ''}{it.die ? ' · d' + it.die + (it.dmg ? ' + ' + it.dmg : '') + ', +' + it.acc + ' to hit' : ''}{it.ac ? ' · +' + it.ac + ' AC' : ''}
                    </span>
                  </span>
                  <span className="heading tnum" style={{ fontSize: 16 }}>{n}</span>
                  {gear && (equipped
                    ? <span className="muted" style={{ fontSize: 12, minWidth: 70, textAlign: 'right' }}>Equipped</span>
                    : <button className="btn btn-secondary" onClick={() => actions.expEquip(id)} style={{ minHeight: 34, minWidth: 70, fontSize: 13 }}>Equip</button>)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
