import { useEffect, useRef, useState } from 'react';
import { DUNGEON, ITEMS, RECIPE, ROUND_MS, SKILLS } from '../domain/expedition/content';
import type { Expedition, Summary } from '../domain/expedition/engine';
import { affordable, foodCount, maxHp } from '../domain/expedition/engine';
import { Icon } from '../components/Icon';
import { CloseBtn, ScreenHead, Seg, Sheet } from '../components/common';
import { useStore } from '../state/store';
import { BankTab, DungeonsTab, ShopTab, SkillsTab } from './expedition/tabs';

type Tab = 'skills' | 'dungeons' | 'shop' | 'bank';

export const duration = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
};

/** Expeditions: a small idle game fuelled by quest gold and skill points. */
export function Adventure() {
  const { data, actions, showToast } = useStore();
  const [tab, setTab] = useState<Tab>('skills');
  const [away, setAway] = useState<Summary | null>(null);
  const opened = useRef(false);

  // Catch up once on opening (and show what happened), then tick every second while on screen.
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      const s = actions.expAdvance();
      if (s.elapsed > 60_000 && (Object.keys(s.gained).length || s.stopped)) setAway(s);
    }
    const t = window.setInterval(() => {
      const s = actions.expAdvance();
      if (s.stopped) showToast('Activity stopped', s.stopped);
    }, 1000);
    return () => window.clearInterval(t);
  }, [actions, showToast]);

  const e = data.expedition;
  return (
    <div className="screen screen-narrow" style={{ gap: 16 }}>
      <ScreenHead kicker="Spend what you've earned" title="Expeditions">
        <span style={{ display: 'flex', gap: 8 }}>
          <span className="stat-pill" title="Gold from quests; spend it in the shop" aria-label={data.hero.gold + ' gold'}><Icon n="coins" size={16} /><span className="heading tnum">{data.hero.gold}</span></span>
          <span className="stat-pill" title="Skill points: every XP from quests and habits adds one" aria-label={data.hero.points + ' skill points'}><Icon n="zap" size={16} /><span className="heading tnum">{data.hero.points}</span></span>
        </span>
      </ScreenHead>
      <p className="muted" style={{ margin: '-8px 0 0', fontSize: 13 }}>
        Quest gold buys supplies and gear; every XP you earn in real life is a skill point to train with. Activities keep running while you're away, for up to 8 hours or until supplies run out.
      </p>

      <ActivityCard e={e} />

      <Seg<Tab> name="exp-tab" value={tab} onChange={setTab} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }} optStyle={{ justifyContent: 'center', minHeight: 42, fontSize: 14 }}
        options={[{ key: 'skills', label: 'Skills' }, { key: 'dungeons', label: 'Dungeons' }, { key: 'shop', label: 'Shop' }, { key: 'bank', label: 'Bank' }]} />
      {tab === 'skills' && <SkillsTab />}
      {tab === 'dungeons' && <DungeonsTab />}
      {tab === 'shop' && <ShopTab />}
      {tab === 'bank' && <BankTab />}

      {away && <AwaySheet s={away} onClose={() => setAway(null)} />}
    </div>
  );
}

export function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="hp-bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemax={max}>
      <div style={{ width: pct + '%', background: color }} />
    </div>
  );
}

function ActivityCard({ e }: { e: Expedition }) {
  const { actions } = useStore();
  const a = e.activity;
  const hpMax = maxHp(e);

  if (!a) {
    return (
      <section className="panel-framed" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="seal" style={{ width: 34, height: 34 }}><Icon n="compass" size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="heading" style={{ fontSize: 20 }}>Resting in town</div>
            <div className="muted" style={{ fontSize: 13 }}>Pick an activity under Skills, or a dungeon.</div>
          </div>
          <span className="muted tnum" style={{ fontSize: 13 }}>HP {e.hp}/{hpMax}</span>
        </div>
        <Bar value={e.hp} max={hpMax} color="var(--q-moss)" label="Your HP" />
        {e.log.length > 0 && (
          <ol className="battle-log" aria-label="Last battle">
            {e.log.slice(-3).map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        )}
      </section>
    );
  }

  if (a.kind === 'recipe') {
    const r = RECIPE[a.id];
    const skill = SKILLS.find((s) => s.key === r.skill)!;
    const left = affordable(e, r);
    const supply = Object.keys(r.use).map((k) => (e.bank[k] ?? 0) + ' ' + ITEMS[k].name.toLowerCase()).join(' · ');
    return (
      <section className="panel-framed" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="seal" style={{ width: 34, height: 34 }}><Icon n={skill.icon} size={16} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="heading" style={{ fontSize: 20 }}>{skill.name} · {ITEMS[r.out].name}</div>
            <div className="muted tnum" style={{ fontSize: 13 }}>{supply} left · about {duration(left * r.time)}</div>
          </div>
          <button className="btn btn-secondary" onClick={actions.expStop} style={{ minHeight: 40 }}>Stop</button>
        </div>
        <Bar value={a.progress} max={r.time} color="var(--color-accent-500)" label="Current action" />
        <div className="muted tnum" style={{ fontSize: 12 }}>You have {e.bank[r.out] ?? 0} {ITEMS[r.out].name.toLowerCase()}.</div>
      </section>
    );
  }

  const d = DUNGEON[a.id];
  const m = d.rooms[a.room ?? 0];
  return (
    <section className="panel-framed" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="seal" style={{ width: 34, height: 34 }}><Icon n="skull" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="heading" style={{ fontSize: 20 }}>{d.name}</div>
          <div className="muted tnum" style={{ fontSize: 13 }}>Room {(a.room ?? 0) + 1} of {d.rooms.length} · {foodCount(e)} food · {e.bank.torch ?? 0} torches left</div>
        </div>
        <button className="btn btn-secondary" onClick={actions.expStop} style={{ minHeight: 40 }}>Leave</button>
      </div>
      <div className="fight">
        <div>
          <div className="fight-name"><span>You</span><span className="tnum">{e.hp}/{hpMax}</span></div>
          <Bar value={e.hp} max={hpMax} color="var(--q-moss)" label="Your HP" />
        </div>
        <div>
          <div className="fight-name"><span>{m.name}</span><span className="tnum">{Math.max(0, a.monsterHp ?? 0)}/{m.hp}</span></div>
          <Bar value={a.monsterHp ?? 0} max={m.hp} color="var(--q-wax)" label={m.name + ' HP'} />
        </div>
      </div>
      <Bar value={a.progress} max={ROUND_MS} color="var(--color-accent-400)" label="Next round" />
      <ol className="battle-log" aria-label="Battle log">
        {e.log.slice(-6).map((l, i) => <li key={e.log.length - 6 + i}>{l}</li>)}
      </ol>
    </section>
  );
}

function AwaySheet({ s, onClose }: { s: Summary; onClose: () => void }) {
  const list = (bag: Record<string, number>) => Object.entries(bag).filter(([, n]) => n > 0).map(([k, n]) => n + '× ' + ITEMS[k].name.toLowerCase());
  const gained = list(s.gained), used = list(s.used);
  return (
    <Sheet onClose={onClose} label="While you were away">
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}>
        <h3 style={{ fontSize: 26 }}>While you were away</h3>
        <span style={{ marginLeft: 'auto' }}><CloseBtn onClick={onClose} /></span>
      </div>
      <p className="muted tnum" style={{ margin: '-6px 0 0', fontSize: 14 }}>
        Away for {s.capped ? 'more than 8 hours; the first 8 counted' : duration(s.elapsed)}.
      </p>
      {s.kills > 0 && <p style={{ margin: 0 }}>Defeated {s.kills} {s.kills === 1 ? 'monster' : 'monsters'}{s.clears ? ' and cleared ' + s.clears + (s.clears === 1 ? ' dungeon' : ' dungeons') : ''}.</p>}
      {gained.length > 0 && <div><div className="label">Gained</div><p style={{ margin: '4px 0 0' }}>{gained.join(', ')}</p></div>}
      {used.length > 0 && <div><div className="label">Used</div><p style={{ margin: '4px 0 0' }}>{used.join(', ')}</p></div>}
      {s.stopped && <p style={{ margin: 0, color: 'var(--q-wax)' }}>Stopped: {s.stopped}.</p>}
      <button className="btn btn-primary inked" onClick={onClose} style={{ minHeight: 46 }}>Onward</button>
    </Sheet>
  );
}
