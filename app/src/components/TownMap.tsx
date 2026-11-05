import type { KeyboardEvent } from 'react';
import { BUILDINGS, REGIONS, SEASON_NAMES } from '../domain/guild/content';
import { mapModel } from '../domain/guild/map';
import type { MapBuilding } from '../domain/guild/map';
import { ANCHORS, SCENE } from '../domain/guild/plots';
import { hash, rng } from '../domain/guild/rng';
import type { Guild } from '../domain/guild/types';
import { BuildingArt, GardenArt, HeroesArt } from './mapArt';
import { ICON_PATHS } from './Icon';

const TINT = ['#7fb069', '#e0b84a', '#c0662b', '#9ab7d8'];
const press = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

/** Little marks of the season in the margins: flowers, nothing, leaves, snow. Deterministic. */
function decor(seed: number, season: number) {
  const r = rng(hash(seed, 'decor', season));
  return Array.from({ length: season === 1 ? 0 : 16 }, (_, i) => {
    const x = r.int(14, SCENE.w - 14), y = r.int(60, SCENE.h - 70);
    const c = [['#e58fb0', '#f2c94c'], [], ['#c0662b', '#b8860b', '#8a4b1f'], ['#fff']][season];
    return <circle key={i} cx={x} cy={y} r={season === 3 ? 1.6 : season === 2 ? 2.2 : 1.8} fill={r.pick(c)} opacity={0.5} />;
  });
}

function Slot({ b, onBuilding }: { b: MapBuilding; onBuilding: (id: string) => void }) {
  const d = BUILDINGS[b.type];
  const building = b.state === 'building';
  const label = d.name + ', level ' + b.level + (building ? ', under construction' : b.state === 'improving' ? ', being improved' : b.canRaise ? ', can be raised' : '');
  const open = () => onBuilding(b.id);
  return (
    <g transform={`translate(${b.x} ${b.y})`} role="button" tabIndex={0} aria-label={label} onClick={open} onKeyDown={press(open)} className="map-hit" style={{ cursor: 'pointer' }}>
      <g opacity={building ? 0.4 : 1}><BuildingArt type={b.type} level={b.level} staffed={b.staffed} /></g>
      {building && <rect x={-20} y={-18} width={40} height={36} fill="none" stroke="var(--q-ink)" strokeWidth={1.2} strokeDasharray="3 2" />}
      {b.state !== 'built' && <circle r={30} fill="none" stroke="var(--color-accent-600)" strokeWidth={2.4} strokeDasharray={`${b.progress * 188} 188`} transform="rotate(-90)" className="map-work" />}
      {b.type !== 'hall' && <g transform="translate(19 -20)"><circle r={7} fill="var(--q-parch)" stroke="var(--q-ink)" strokeWidth={1} /><text textAnchor="middle" y={3.2} fontSize={9} fill="var(--q-ink)" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{b.level}</text></g>}
      {b.canRaise && <path d="M-20 -14 l5 -8 l5 8 h-3 v5 h-4 v-5 z" fill="var(--q-moss)" stroke="var(--q-ink)" strokeWidth={0.7} />}
      {b.discount > 0 && <text y={34} textAnchor="middle" fontSize={8} fill="var(--q-moss)" style={{ fontWeight: 700 }}>−{Math.round(b.discount * 100)}%</text>}
      <rect x={-27} y={-30} width={54} height={60} fill="transparent" />
    </g>
  );
}

/** The town as a paper map. The list view does everything this does; this is the same town, drawn. */
export function TownMap({ g, onBuilding, onPlot }: { g: Guild; onBuilding: (id: string) => void; onPlot: (plot: number) => void }) {
  const m = mapModel(g);
  const sorted = [...m.buildings].sort((a, b) => a.y - b.y);
  const garden = m.buildings.find((b) => b.type === 'garden'), heroes = m.buildings.find((b) => b.type === 'heroes');
  const others = sorted.filter((b) => b.type !== 'garden' && b.type !== 'heroes');
  return (
    <svg viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius-md)' }} role="group"
      aria-label={'Map of ' + g.town + ' in ' + SEASON_NAMES[m.season] + ': ' + m.buildings.length + ' buildings, ' + m.open.length + ' open plots'}>
      <defs>
        <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.15  0 0 0 0.09 0" /></filter>
      </defs>
      <rect width={SCENE.w} height={SCENE.h} fill="var(--q-parch)" />
      <rect width={SCENE.w} height={SCENE.h} filter="url(#paper)" />
      <rect width={SCENE.w} height={SCENE.h} fill={TINT[m.season]} opacity={0.1} />
      <rect x={4} y={4} width={SCENE.w - 8} height={SCENE.h - 8} fill="none" stroke="var(--color-accent-600)" strokeWidth={1.4} opacity={0.6} rx={6} />
      {/* The roads */}
      <g fill="none" stroke="var(--color-accent-600)" strokeWidth={1} strokeDasharray="5 5" opacity={0.35}>
        <ellipse cx={SCENE.cx} cy={SCENE.cy} rx={82} ry={82} /><ellipse cx={SCENE.cx} cy={SCENE.cy} rx={130} ry={140} /><ellipse cx={SCENE.cx} cy={SCENE.cy} rx={172} ry={214} />
        <path d={`M${SCENE.cx} 54 V${SCENE.h - 90} M30 ${SCENE.cy} H${SCENE.w - 30}`} opacity={0.5} />
      </g>
      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>{decor(g.seed, m.season)}</g>
      <text x={SCENE.cx} y={26} textAnchor="middle" fontSize={20} fill="var(--q-ink)" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{g.town}</text>

      {m.open.map((p) => (
        <g key={p.plot} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label="Open plot: build here" onClick={() => onPlot(p.plot)} onKeyDown={press(() => onPlot(p.plot))} className="map-hit" style={{ cursor: 'pointer' }}>
          <rect x={-18} y={-15} width={36} height={30} rx={5} fill="none" stroke="var(--color-accent-700)" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.7} />
          <path d="M-5 0 H5 M0 -5 V5" stroke="var(--color-accent-700)" strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
          <rect x={-27} y={-27} width={54} height={54} fill="transparent" />
        </g>
      ))}

      {garden && (
        <g transform={`translate(${ANCHORS.garden.x} ${ANCHORS.garden.y})`} role="button" tabIndex={0} aria-label={'Garden of Valor, ' + m.stones + ' monuments'} onClick={() => onBuilding(garden.id)} onKeyDown={press(() => onBuilding(garden.id))} className="map-hit" style={{ cursor: 'pointer' }}>
          <GardenArt stones={m.stones} /><text y={27} textAnchor="middle" fontSize={8} fill="var(--q-ink)" opacity={0.7}>Valor</text><rect x={-30} y={-18} width={60} height={50} fill="transparent" />
        </g>
      )}
      {heroes && (
        <g transform={`translate(${ANCHORS.heroes.x} ${ANCHORS.heroes.y})`} role="button" tabIndex={0} aria-label="Hall of Heroes" onClick={() => onBuilding(heroes.id)} onKeyDown={press(() => onBuilding(heroes.id))} className="map-hit" style={{ cursor: 'pointer' }}>
          <HeroesArt /><text y={29} textAnchor="middle" fontSize={8} fill="var(--q-ink)" opacity={0.7}>Heroes</text><rect x={-26} y={-20} width={52} height={52} fill="transparent" />
        </g>
      )}
      {others.map((b) => <Slot key={b.id} b={b} onBuilding={onBuilding} />)}

      {/* Beyond the walls: retirees on the green, and the regions */}
      <g aria-label={m.retirees.length + ' retirees'}>
        {m.retirees.map((id, i) => (
          <g key={id} transform={`translate(${26 + i * 17} ${SCENE.h - 24})`} fill="none" stroke="var(--q-ink)" strokeWidth={1.3} strokeLinecap="round" opacity={0.8}>
            <circle cy={-7} r={3} fill={['var(--q-wax)', 'var(--q-moss)', 'oklch(0.45 0.08 255)'][hash(id) % 3]} /><path d="M0 -4 V4 M-3.5 0 H3.5 M0 4 l-2.5 4 M0 4 l2.5 4" />
          </g>
        ))}
      </g>
      <g>
        {m.outposts.map((o, i) => (
          <g key={o.region} transform={`translate(${222 + i * 32} ${SCENE.h - 26})`} opacity={o.state === 'locked' ? 0.4 : 1}>
            <title>{REGIONS[o.region].name + (o.state === 'freed' ? ' (freed)' : o.state === 'charted' ? ' (charted)' : ' (needs Cartographer level ' + o.need + ')')}</title>
            <circle r={11} fill="var(--q-parch)" stroke={o.state === 'freed' ? 'var(--color-accent-500)' : 'var(--q-ink)'} strokeWidth={o.state === 'freed' ? 2 : 1} />
            <g transform="translate(-6 -6) scale(0.5)" fill="none" stroke="var(--q-ink)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[o.state === 'freed' ? 'flag' : o.state === 'charted' ? 'compass' : 'lock'] }} />
          </g>
        ))}
      </g>
    </svg>
  );
}
