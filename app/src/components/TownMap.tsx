import type { KeyboardEvent } from 'react';
import { BUILDINGS, REGIONS, SEASON_NAMES } from '../domain/guild/content';
import type { BuildingId } from '../domain/guild/content';
import { mapModel } from '../domain/guild/map';
import type { MapBuilding, MapSlot } from '../domain/guild/map';
import type { Multi } from '../domain/guild/plots';
import { FIELDS, HILLS, PLAZA, RIVER, ROADS, SCENE, TREES, WALLS } from '../domain/guild/plots';
import { hash, rng } from '../domain/guild/rng';
import type { Guild } from '../domain/guild/types';
import { BuildingArt, GardenArt, HeroesArt } from './mapArt';
import { ICON_PATHS } from './Icon';

const TINT = ['#7fb069', '#e0b84a', '#c0662b', '#9ab7d8'];
const INK = 'var(--q-ink)';
const press = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
/** The map is bigger than the scene so a strip at the foot can show the regions. */
const H = SCENE.h + 30;

const SHORT: Partial<Record<BuildingId, string>> = {
  lodge: 'Lodge', warehouse: 'Warehouse', market: 'Market', smithy: 'Smithy', stillroom: 'Stillroom', infirmary: 'Infirmary', field: 'Training', library: 'Library',
  cartographer: 'Maps', watch: 'Watch', garden: 'Valor', heroes: 'Heroes', herbs: 'Herbs', fishery: 'Fishery', forestry: 'Forestry', quarry: 'Quarry', mine: 'Mine', tavern: 'Tavern', chapel: 'Chapel', armoury: 'Armoury',
};

/** Little marks of the season: flowers, nothing, leaves, snow. Deterministic. */
function decor(seed: number, season: number) {
  const r = rng(hash(seed, 'decor', season));
  const colours = [['#e58fb0', '#f2c94c', '#fff'], [], ['#c0662b', '#b8860b', '#8a4b1f'], ['#fff']][season];
  return Array.from({ length: season === 1 ? 0 : season === 3 ? 60 : 26 }, (_, i) => (
    <circle key={i} cx={r.int(6, SCENE.w - 6)} cy={r.int(10, SCENE.h - 10)} r={season === 3 ? 1.3 : 1.8} fill={r.pick(colours)} opacity={season === 3 ? 0.75 : 0.55} />
  ));
}

/** The land: fields, river, hills, forest, roads, the square and the walls. */
function Land({ season }: { season: number }) {
  const winter = season === 3;
  return (
    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
      {FIELDS.map((f, i) => (
        <g key={i}>
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={4} fill={winter ? '#e9eef2' : i % 2 ? '#d9cf8f' : '#c9d39a'} opacity={0.55} />
          {Array.from({ length: Math.floor(f.h / 9) }, (_, k) => <path key={k} d={`M${f.x + 4} ${f.y + 6 + k * 9} H${f.x + f.w - 4}`} stroke="#9b8a4a" strokeWidth={0.6} opacity={0.35} />)}
        </g>
      ))}
      <path d={RIVER} fill="none" stroke="oklch(0.78 0.06 235)" strokeWidth={16} strokeLinecap="round" opacity={winter ? 0.6 : 0.9} />
      <path d={RIVER} fill="none" stroke="oklch(0.88 0.04 235)" strokeWidth={5} strokeLinecap="round" strokeDasharray="14 10" opacity={0.8} />
      {HILLS.map((h, i) => (
        <g key={i} transform={`translate(${h.x} ${h.y}) scale(${h.s})`}>
          <path d="M-30 18 L-4 -26 L24 18 Z" fill="oklch(0.78 0.015 80)" stroke={INK} strokeWidth={0.9} opacity={0.85} />
          <path d="M-12 -12 L-4 -26 L5 -12 L0 -9 L-5 -13 Z" fill={winter ? '#fff' : 'oklch(0.9 0.01 80)'} opacity={0.9} />
        </g>
      ))}
      {TREES.map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y})`}>
          <rect x={-1.5} y={4} width={3} height={6} fill="oklch(0.4 0.05 60)" />
          <path d="M-9 6 L0 -12 L9 6 Z" fill={winter ? '#dfe7e2' : season === 2 ? '#b8862f' : 'var(--q-moss)'} stroke={INK} strokeWidth={0.8} opacity={0.85} />
        </g>
      ))}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {ROADS.map((d, i) => <path key={i} d={d} stroke="oklch(0.83 0.04 75)" strokeWidth={8} />)}
        {ROADS.map((d, i) => <path key={'e' + i} d={d} stroke="oklch(0.62 0.05 70)" strokeWidth={0.8} strokeDasharray="3 5" opacity={0.6} />)}
      </g>
      <circle cx={PLAZA.x} cy={PLAZA.y} r={PLAZA.r} fill="oklch(0.88 0.02 80)" stroke="oklch(0.62 0.03 70)" strokeWidth={1} />
      <circle cx={PLAZA.x} cy={PLAZA.y} r={PLAZA.r - 6} fill="none" stroke="oklch(0.7 0.02 70)" strokeWidth={0.6} strokeDasharray="2 3" />
      {WALLS.map((w, i) => (
        <g key={i}>
          <polyline points={w.map(([x, y]) => x + ',' + y).join(' ')} fill="none" stroke="oklch(0.62 0.02 70)" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={w.map(([x, y]) => x + ',' + y).join(' ')} fill="none" stroke="oklch(0.78 0.015 75)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {w.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={5} fill="oklch(0.78 0.015 75)" stroke={INK} strokeWidth={0.9} />)}
        </g>
      ))}
    </g>
  );
}

function Spot({ b, onOpen }: { b: MapBuilding; onOpen: (id: string) => void }) {
  const d = BUILDINGS[b.type];
  const empty = b.state === 'empty', building = b.state === 'building';
  const label = d.name + (empty ? (b.locked ? ', level 0, needs Guild Hall level ' + b.locked : b.canRaise ? ', level 0, can be built now' : ', level 0, not built') : ', level ' + b.level + (building ? ', under construction' : b.state === 'improving' ? ', being improved' : b.canRaise ? ', can be raised' : ''));
  const open = () => onOpen(b.id);
  const art = b.type === 'garden' ? <GardenArt stones={0} /> : b.type === 'heroes' ? <HeroesArt /> : <BuildingArt type={b.type} level={Math.max(1, b.level)} staffed={b.staffed} />;
  return (
    <g transform={`translate(${b.x} ${b.y})`} role="button" tabIndex={0} aria-label={label} onClick={open} onKeyDown={press(open)} className="map-hit" style={{ cursor: 'pointer' }}>
      {empty && <rect x={-21} y={-17} width={42} height={34} rx={4} fill="var(--q-parch)" fillOpacity={0.5} stroke="var(--color-accent-700)" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />}
      <g opacity={empty ? (b.locked ? 0.14 : 0.24) : building ? 0.4 : 1}>{art}</g>
      {building && <rect x={-20} y={-18} width={40} height={36} fill="none" stroke={INK} strokeWidth={1.2} strokeDasharray="3 2" />}
      {(building || b.state === 'improving') && <circle r={30} fill="none" stroke="var(--color-accent-600)" strokeWidth={2.4} strokeDasharray={`${b.progress * 188} 188`} transform="rotate(-90)" className="map-work" />}
      {empty && b.locked > 0 && (
        <g transform="translate(-6 -10)"><g transform="scale(0.5)" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS.lock }} /></g>
      )}
      {empty && !b.locked && b.canRaise && <g><circle cy={-2} r={8} fill="var(--q-moss)" stroke={INK} strokeWidth={0.8} /><path d="M-4 -2 H4 M0 -6 V2" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" /></g>}
      {empty && <text y={27} textAnchor="middle" fontSize={8} fill={INK} opacity={0.75}>{SHORT[b.type] ?? d.name}{b.locked ? ' · Hall ' + b.locked : ''}</text>}
      {!empty && b.type !== 'hall' && (
        <g transform="translate(19 -20)"><circle r={7} fill="var(--q-parch)" stroke={INK} strokeWidth={1} /><text textAnchor="middle" y={3.2} fontSize={9} fill={INK} style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{b.level}</text></g>
      )}
      {!empty && b.canRaise && <path d="M-20 -14 l5 -8 l5 8 h-3 v5 h-4 v-5 z" fill="var(--q-moss)" stroke={INK} strokeWidth={0.7} />}
      {b.discount > 0 && !b.locked && <text y={empty ? 36 : 30} textAnchor="middle" fontSize={7.5} fill="var(--q-moss)" style={{ fontWeight: 700 }}>−{Math.round(b.discount * 100)}%</text>}
      <rect x={-24} y={-26} width={48} height={52} fill="transparent" />
    </g>
  );
}

function OpenSlot({ s, onPlot }: { s: MapSlot; onPlot: (t: Multi, plot: number) => void }) {
  const go = () => onPlot(s.type, s.plot);
  return (
    <g transform={`translate(${s.x} ${s.y})`} role="button" tabIndex={0} aria-label={'Empty plot for a ' + (s.type === 'home' ? 'Home' : 'Farm') + (s.canBuild ? ': build one here' : '')} onClick={go} onKeyDown={press(go)} className="map-hit" style={{ cursor: 'pointer' }}>
      <rect x={-17} y={-13} width={34} height={26} rx={4} fill="none" stroke="var(--color-accent-700)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
      <path d="M-4 -1 H4 M0 -5 V3" stroke="var(--color-accent-700)" strokeWidth={1.5} strokeLinecap="round" opacity={0.65} />
      <text y={22} textAnchor="middle" fontSize={7} fill={INK} opacity={0.55}>{s.type === 'home' ? 'Home' : 'Farm'}</text>
      <rect x={-24} y={-24} width={48} height={48} fill="transparent" />
    </g>
  );
}

/** The town as a paper map: each building where it would naturally stand. The list view does everything this does. */
export function TownMap({ g, onBuilding, onPlot }: { g: Guild; onBuilding: (id: string) => void; onPlot: (type: Multi, plot: number) => void }) {
  const m = mapModel(g);
  const sorted = [...m.buildings].sort((a, b) => a.y - b.y);
  const built = m.buildings.filter((b) => b.state !== 'empty').length;
  const garden = m.buildings.find((b) => b.type === 'garden' && b.state !== 'empty');
  return (
    <svg viewBox={`0 0 ${SCENE.w} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius-md)' }} role="group"
      aria-label={'Map of ' + g.town + ' in ' + SEASON_NAMES[m.season] + ': ' + built + ' buildings standing, ' + m.buildings.filter((b) => b.state === 'empty').length + ' not yet built'}>
      <defs>
        <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.15  0 0 0 0.09 0" /></filter>
      </defs>
      <rect width={SCENE.w} height={H} fill="var(--q-parch)" />
      <rect width={SCENE.w} height={H} filter="url(#paper)" />
      <rect width={SCENE.w} height={SCENE.h} fill={TINT[m.season]} opacity={0.12} />
      <Land season={m.season} />
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>{decor(g.seed, m.season)}</g>
      <g aria-hidden="true">
        <rect x={SCENE.w / 2 - 70} y={8} width={140} height={24} rx={4} fill="var(--q-parch)" stroke="var(--color-accent-600)" strokeWidth={1} />
        <text x={SCENE.w / 2} y={26} textAnchor="middle" fontSize={16} fill={INK} style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{g.town}</text>
      </g>

      {m.open.map((s) => <OpenSlot key={s.type + s.plot} s={s} onPlot={onPlot} />)}
      {sorted.map((b) => <Spot key={b.id} b={b} onOpen={onBuilding} />)}
      {garden && m.stones > 0 && <g transform={`translate(${garden.x} ${garden.y})`} style={{ pointerEvents: 'none' }}><GardenArt stones={m.stones} /></g>}

      {/* Retirees on the benches south of the square */}
      <g aria-label={m.retirees.length + ' retirees on the square'}>
        {m.retirees.slice(0, 6).map((id, i) => (
          <g key={id} transform={`translate(${165 + i * 14} 341)`} fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.85}>
            <circle cy={-7} r={2.6} fill={['var(--q-wax)', 'var(--q-moss)', 'oklch(0.45 0.08 255)'][hash(id) % 3]} /><path d="M0 -4.5 V3 M-3 -1 H3 M0 3 l-2 3.5 M0 3 l2 3.5" />
          </g>
        ))}
      </g>

      {/* The regions beyond the map */}
      <g>
        <path d={`M0 ${SCENE.h} H${SCENE.w}`} stroke="var(--color-accent-600)" strokeWidth={1} opacity={0.6} />
        <text x={14} y={SCENE.h + 19} fontSize={9} fill={INK} opacity={0.7}>Beyond the walls</text>
        {m.outposts.map((o, i) => (
          <g key={o.region} transform={`translate(${200 + i * 38} ${SCENE.h + 15})`} opacity={o.state === 'locked' ? 0.4 : 1}>
            <title>{REGIONS[o.region].name + (o.state === 'freed' ? ' (freed)' : o.state === 'charted' ? ' (charted)' : ' (needs Cartographer level ' + o.need + ')')}</title>
            <circle r={10} fill="var(--q-parch)" stroke={o.state === 'freed' ? 'var(--color-accent-500)' : INK} strokeWidth={o.state === 'freed' ? 2 : 1} />
            <g transform="translate(-6 -6) scale(0.5)" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[o.state === 'freed' ? 'flag' : o.state === 'charted' ? 'compass' : 'lock'] }} />
          </g>
        ))}
      </g>
    </svg>
  );
}
