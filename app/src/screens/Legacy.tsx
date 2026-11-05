import { useState, type ReactNode } from 'react';
import { CLASSES, GRADES, LEGEND_STAT, MONUMENT, REGION_ORDER, REGIONS, SLOT_NAME, STONE_BONUS, STONE_MAX } from '../domain/guild/content';
import type { IconName } from '../components/Icon';
import { fullName, phaseAt, ratingShown } from '../domain/guild/adventurer';
import { records } from '../domain/guild/legacy';
import { entryText } from '../domain/guild/text';
import { isLegend, legendBonus, legendCap, levelOf } from '../domain/guild/town';
import type { Guild as GuildT, Item } from '../domain/guild/types';
import { Icon } from '../components/Icon';
import { Empty } from '../components/common';
import { AdvRow } from '../components/guildParts';
import { shortClock } from '../domain/guild/adventurer';
import { useStore } from '../state/store';
import { Section } from './Guild';

export function ItemLine({ i, right }: { i: Item; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--q-rule)' }}>
      <span style={{ color: 'var(--color-accent-700)' }}><Icon n={i.slot === 'weapon' ? 'sword' : i.slot === 'armour' ? 'shield' : 'star'} size={16} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="heading" style={{ fontSize: 16 }}>{i.name}</span>
        <span className="muted" style={{ display: 'block', fontSize: 12 }}>
          {SLOT_NAME[i.slot]} · {GRADES[i.grade]}{i.heirloom ? ' · heirloom' : ' · ' + i.wear + ' outings left'}{i.counters ? ' · counters ' + i.counters : ''}{i.note ? ' · ' + i.note : ''}
        </span>
      </span>
      {right}
    </div>
  );
}

export function Legacy({ g, now }: { g: GuildT; now: number }) {
  const { setUi } = useStore();
  const phase = phaseAt(now);
  const [shown, setShown] = useState(40);
  const legends = g.adventurers.filter(isLegend);
  const remembered = g.adventurers.filter((a) => ['retired', 'passed', 'fallen'].includes(a.state) && !isLegend(a)).reverse();
  const rec = records(g);
  const heroes = levelOf(g, 'heroes');
  const stones = REGION_ORDER.filter((r) => g.regions[r].stones > 0);
  const stats = Object.entries(LEGEND_STAT) as [keyof typeof CLASSES, { name: string; text: string }][];
  const list = [...g.chronicle].reverse();
  const open = (id: string) => setUi({ advSheet: id });
  const row = (a: (typeof g.adventurers)[number]) => <AdvRow key={a.id} g={g} a={a} phase={phase} now={now} onClick={() => open(a.id)} right={<span className="muted" style={{ fontSize: 12 }}>{a.state === 'fallen' ? (a.tomb ? 'Tomb' : 'Stone') : ''}</span>} />;
  return (
    <>
      <Section title="Hall of Heroes" sub={'bonuses up to +' + Math.round(legendCap(g) * 100) + '% (level ' + heroes + ')'}>
        {legends.length === 0 && <Empty>No legends yet. An adventurer who retires at level 15, clears three tier 5 expeditions or frees a region is remembered here, and their class adds a small bonus to the whole guild.</Empty>}
        {legends.map(row)}
        {legends.length > 0 && (
          <div className="muted tnum" style={{ fontSize: 12, paddingTop: 8, display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
            {stats.filter(([c]) => legendBonus(g, c) > 0).map(([c, s]) => <span key={c}>{s.name} +{Math.round(legendBonus(g, c) * 100)}%</span>)}
          </div>
        )}
        {stones.length > 0 && (
          <div style={{ paddingTop: 10 }}>
            <span className="label">Witness stones</span>
            {stones.map((r) => (
              <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
                <span>{REGIONS[r].name}</span>
                <span className="tnum muted">{g.regions[r].stones} · −{(Math.min(STONE_MAX, STONE_BONUS * g.regions[r].stones) * 100).toFixed(1)}% death</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Heirlooms" sub={g.heirlooms.length + ' kept'}>
        {g.heirlooms.map((i) => <ItemLine key={i.id} i={i} />)}
        {!g.heirlooms.length && <Empty>Retiring adventurers leave their best piece here, and a habit streak of 7, 30 or 100 days (4, 12, 40 weeks) forges one named for the habit. They never wear out. Open an adventurer to put one on.</Empty>}
      </Section>

      <Section title="Garden of Valor" sub={g.monuments.length + ' monuments'}>
        {g.monuments.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
            <span className="seal" style={{ width: 32, height: 32, flex: 'none' }}><Icon n={(m.icon as IconName) ?? 'flag'} size={15} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="heading ellipsis" style={{ display: 'block', fontSize: 16 }}>{m.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{MONUMENT[m.size].name} · {m.seal}{m.date ? ' · ' + m.date : ''}</span>
            </span>
          </div>
        ))}
        {!g.monuments.length && <Empty>Finish a real-life campaign and a monument rises here, with its seal. Freeing a region raises an obelisk too. Each one brings the town a little happiness.</Empty>}
      </Section>

      {remembered.length > 0 && (
        <Section title="In memoriam" sub={remembered.length + ' remembered'}>
          {remembered.slice(0, shown).map(row)}
          {remembered.length > shown && <button className="btn btn-ghost inked" onClick={() => setShown(shown + 40)} style={{ alignSelf: 'flex-start' }}>Show more</button>}
        </Section>
      )}

      <Section title="Records">
        {[
          ['Longest career', rec.longestCareer && fullName(rec.longestCareer.who) + ' · ' + rec.longestCareer.years + ' years'],
          ['Highest level', rec.highestLevel && fullName(rec.highestLevel) + ' · level ' + rec.highestLevel.level + ' (rating ' + ratingShown(rec.highestLevel) + ')'],
          ['Most outings', rec.mostOutings && rec.mostOutings.outings > 0 ? fullName(rec.mostOutings) + ' · ' + rec.mostOutings.outings : null],
          ['Deadliest place', rec.deadliest && rec.deadliest.place + ' · ' + rec.deadliest.deaths + (rec.deadliest.deaths === 1 ? ' death' : ' deaths')],
          ['Biggest haul', rec.bestHaul && rec.bestHaul.gold + 'g from ' + rec.bestHaul.name],
          ['Longest lived', rec.longestLived && fullName(rec.longestLived.who) + ' · ' + rec.longestLived.years + ' years'],
          ['Largest family', rec.largestFamily && fullName(rec.largestFamily.who) + ' · ' + rec.largestFamily.children + (rec.largestFamily.children === 1 ? ' child' : ' children')],
        ].filter((r): r is [string, string] => !!r[1]).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '1px solid var(--q-rule)', fontSize: 14 }}>
            <span className="label" style={{ paddingTop: 2 }}>{k}</span><span style={{ textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </Section>

      <Section title="Eras" sub="Each lasts ten game years, 80 real days">
        {g.eras.map((e) => (
          <div key={e.n} style={{ padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
            <div className="heading" style={{ fontSize: 18 }}>The Age of {e.name}</div>
            <div className="muted" style={{ fontSize: 13 }}>{e.joined} joined · {e.fell} fell · {e.retired} retired · {e.built} buildings · {e.quests} quests and {e.habits} habit check-ins in real life.</div>
          </div>
        ))}
        {!g.eras.length && <Empty>The first era closes at the end of Year 10, named for the guild’s most renowned adventurer.</Empty>}
      </Section>

      <Section title="Chronicle" sub={g.chronicle.length + ' entries'}>
        {list.slice(0, 60).map((e, i) => {
          const t = entryText(g, e);
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--q-rule)' }}>
              <span style={{ color: t.tone === 'bad' ? 'var(--q-wax)' : t.tone === 'good' ? 'var(--q-moss)' : 'var(--color-accent-700)', paddingTop: 2 }}><Icon n={t.icon} size={15} /></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{t.text}</span>
              <span className="muted tnum" style={{ fontSize: 11, whiteSpace: 'nowrap', paddingTop: 2 }}>{shortClock(e.at)}</span>
            </div>
          );
        })}
      </Section>
    </>
  );
}
