// The drawings on the town map: simple ink-and-wash shapes, each a few lines, drawn in code. Level shows as size and detail.
import type { BuildingId } from '../domain/guild/content';
import { BUILDINGS } from '../domain/guild/content';
import { FARM_FIELDS, fieldsAt, HOUSES, housesAt, SPOTS } from '../domain/guild/plots';
import { ICON_PATHS } from './Icon';

const INK = 'var(--q-ink)';
const PARCH = 'var(--q-parch)';
const GOLD = 'var(--color-accent-500)';
const LIT = '#f2c94c';

type Family = 'house' | 'barn' | 'tower' | 'crops' | 'pond' | 'grove' | 'rock';
const FAMILY: Partial<Record<BuildingId, Family>> = {
  tavern: 'house', lodge: 'house', home: 'house', market: 'house', stillroom: 'house', infirmary: 'house', chapel: 'house', field: 'house', smithy: 'house',
  warehouse: 'barn', armoury: 'barn', watch: 'tower', library: 'tower', cartographer: 'tower', farm: 'crops', herbs: 'crops', fishery: 'pond', forestry: 'grove', quarry: 'rock', mine: 'rock',
};
const ROOF: Partial<Record<BuildingId, string>> = {
  tavern: 'var(--q-wax)', lodge: 'oklch(0.45 0.08 255)', home: 'var(--color-accent-600)', market: 'var(--q-wax)', stillroom: 'var(--q-moss)', infirmary: 'var(--q-moss)', chapel: 'oklch(0.5 0.1 300)',
  field: 'oklch(0.5 0.06 40)', smithy: 'oklch(0.38 0.02 60)', warehouse: 'var(--color-accent-700)', armoury: 'oklch(0.45 0.05 255)', watch: 'oklch(0.45 0.05 255)', library: 'oklch(0.45 0.08 255)', cartographer: 'oklch(0.5 0.08 195)',
};

const Emblem = ({ type, x, y, s = 0.5, color = INK }: { type: BuildingId; x: number; y: number; s?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[BUILDINGS[type].icon] }} />
);
const Smoke = ({ x, y }: { x: number; y: number }) => (
  <g className="map-smoke" aria-hidden="true">{[0, 1, 2].map((i) => <circle key={i} cx={x} cy={y} r={2 + i * 0.6} fill={INK} opacity={0.28} style={{ animationDelay: i * 0.9 + 's' }} />)}</g>
);
const Flag = ({ x, y, color = GOLD }: { x: number; y: number; color?: string }) => (
  <g><path d={`M${x} ${y} v-14`} stroke={INK} strokeWidth={1.2} /><path d={`M${x} ${y - 14} h8 l-2.5 3 l2.5 3 h-8z`} fill={color} stroke={INK} strokeWidth={0.8} /></g>
);

function House({ type, level, staffed }: Props) {
  const roof = ROOF[type] ?? 'var(--q-wax)';
  return (
    <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
      {level >= 4 && <path d="M-23 18 H23" strokeDasharray="2 2" fill="none" />}
      <rect x={-14} y={-4} width={28} height={20} fill={PARCH} />
      <path d="M-19 -4 L0 -22 L19 -4 Z" fill={roof} />
      <rect x={-3} y={8} width={6} height={8} fill={INK} opacity={0.65} />
      <Emblem type={type} x={-12} y={-1} s={0.4} />
      {level >= 2 && <rect x={8} y={-20} width={4} height={10} fill={PARCH} />}
      {level >= 3 && <Flag x={-19} y={-4} color={roof} />}
      {level >= 5 && <><rect x={5} y={1} width={6} height={6} fill={LIT} /><rect x={-11} y={9} width={5} height={5} fill={LIT} /><Flag x={19} y={-4} /></>}
      {staffed && level >= 2 && <Smoke x={10} y={-22} />}
    </g>
  );
}
function Barn({ type, level, staffed }: Props) {
  const roof = ROOF[type] ?? 'var(--color-accent-700)';
  return (
    <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
      {level >= 4 && <path d="M-26 18 H26" strokeDasharray="2 2" fill="none" />}
      <rect x={-21} y={-3} width={42} height={20} fill={PARCH} />
      <path d="M-24 -3 L-14 -17 H14 L24 -3 Z" fill={roof} />
      <rect x={-6} y={5} width={12} height={12} fill={INK} opacity={0.6} /><path d="M-6 5 L6 17 M6 5 L-6 17" opacity={0.5} />
      <Emblem type={type} x={-6} y={-14} s={0.5} color={PARCH} />
      {level >= 3 && <Flag x={21} y={-3} color={roof} />}
      {level >= 5 && <><rect x={-17} y={2} width={5} height={5} fill={LIT} /><rect x={12} y={2} width={5} height={5} fill={LIT} /></>}
      {staffed && level >= 2 && <Smoke x={15} y={-17} />}
    </g>
  );
}
function Tower({ type, level, staffed }: Props) {
  const roof = ROOF[type] ?? 'oklch(0.45 0.05 255)';
  const h = 26 + level * 2;
  return (
    <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
      <rect x={-9} y={18 - h} width={18} height={h} fill={PARCH} />
      <path d={`M-12 ${18 - h} h24 v-4 h-4 v2 h-4 v-2 h-4 v2 h-4 v-2 h-4 v2 h-4z`} fill={roof} />
      <rect x={-2.5} y={9} width={5} height={9} fill={INK} opacity={0.65} />
      <Emblem type={type} x={-6} y={18 - h + 6} s={0.5} />
      {level >= 3 && <Flag x={0} y={18 - h - 4} color={roof} />}
      {level >= 5 && <><rect x={-3} y={18 - h + 18} width={6} height={5} fill={LIT} /><path d="M-14 18 H14" strokeDasharray="2 2" fill="none" /></>}
      {staffed && <Smoke x={6} y={18 - h - 6} />}
    </g>
  );
}
function Crops({ type, level }: Props) {
  const rows = 2 + Math.min(3, level - 1);
  const colour = type === 'herbs' ? 'var(--q-moss)' : GOLD;
  return (
    <g stroke={INK} strokeWidth={1}>
      <rect x={-22} y={-14} width={44} height={30} fill={PARCH} opacity={0.8} />
      {Array.from({ length: rows }, (_, i) => {
        const y = -10 + i * (24 / rows) + 2;
        return <g key={i}><path d={`M-19 ${y} H19`} stroke={colour} strokeWidth={2.2} />{[-14, -6, 2, 10, 17].map((x) => <path key={x} d={`M${x} ${y} v-3`} strokeWidth={1} />)}</g>;
      })}
      <Emblem type={type} x={14} y={-22} s={0.45} />
      {level >= 3 && <g fill={PARCH}><rect x={-26} y={4} width={9} height={9} /><path d="M-27 4 L-21.5 -2 L-16 4" fill="var(--color-accent-600)" /></g>}
      {level >= 4 && <path d="M-24 18 H24" strokeDasharray="2 2" fill="none" />}
      {level >= 5 && <Flag x={22} y={-14} />}
    </g>
  );
}
function Pond({ type, level }: Props) {
  return (
    <g stroke={INK} strokeWidth={1}>
      <ellipse cx={0} cy={4} rx={22} ry={13} fill="oklch(0.82 0.06 235)" />
      <path d="M-8 2 q4 -3 8 0 t8 0 M-12 8 q4 -3 8 0 t8 0" fill="none" opacity={0.5} />
      <path d="M-24 -4 L-12 4" strokeWidth={2} /><Emblem type={type} x={10} y={-22} s={0.45} />
      {level >= 3 && <path d="M2 3 q5 5 10 0 z" fill={PARCH} />}
      {level >= 5 && <Flag x={-24} y={-4} />}
    </g>
  );
}
function Grove({ level }: Props) {
  const n = Math.min(6, 2 + level);
  const spots = [[-14, 4], [0, -2], [14, 4], [-7, 12], [8, 12], [0, 14]];
  return (
    <g stroke={INK} strokeWidth={1}>
      {spots.slice(0, n).sort((a, b) => a[1] - b[1]).map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}><rect x={-1.5} y={4} width={3} height={6} fill="oklch(0.4 0.05 60)" /><path d="M-9 5 L0 -12 L9 5 Z" fill="var(--q-moss)" /><path d="M-7 -1 L0 -14" opacity={0.0} /></g>
      ))}
      {level >= 3 && <g fill="oklch(0.55 0.07 60)"><rect x={16} y={12} width={10} height={4} rx={2} /><rect x={18} y={8} width={10} height={4} rx={2} /></g>}
      {level >= 5 && <Flag x={-22} y={12} />}
    </g>
  );
}
function Rock({ type, level }: Props) {
  return (
    <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
      <path d="M-22 16 L-14 -6 L-4 -14 L8 -8 L22 16 Z" fill="oklch(0.75 0.01 80)" />
      <path d="M-4 -14 L0 2 L8 -8" fill="none" opacity={0.4} />
      <path d="M-6 16 V6 a6 6 0 0 1 12 0 V16 Z" fill={INK} opacity={0.75} />
      {type === 'mine' && <path d="M-8 16 V4 M8 16 V4 M-8 4 H8" strokeWidth={2} stroke="oklch(0.5 0.07 60)" />}
      {type === 'quarry' && <g fill="oklch(0.85 0.01 80)"><rect x={12} y={10} width={8} height={6} /><rect x={-24} y={11} width={7} height={5} /></g>}
      <Emblem type={type} x={-4} y={-30} s={0.45} />
      {level >= 3 && <g><circle cx={16} cy={18} r={2.5} fill={INK} /><circle cx={24} cy={18} r={2.5} fill={INK} /><path d="M14 16 h12 l-2 -6 h-8z" fill={PARCH} /></g>}
      {level >= 5 && <Flag x={-20} y={14} />}
    </g>
  );
}

interface Props { type: BuildingId; level: number; staffed: boolean }

/** The Guild Hall grows towers as it rises. */
export function HallArt({ level, staffed }: { level: number; staffed: boolean }) {
  const towers = Math.min(4, 1 + Math.floor((level - 1) / 3) + (level >= 10 ? 1 : 0));
  return (
    <g stroke={INK} strokeWidth={1.3} strokeLinejoin="round" transform="scale(1.35)">
      {[-17, 17, -26, 26].slice(0, towers).map((x, i) => (
        <g key={i}><rect x={x - 5} y={-12 - i * 1.5} width={10} height={30 + i * 1.5} fill={PARCH} /><path d={`M${x - 7} ${-12 - i * 1.5} L${x} ${-24 - i * 1.5} L${x + 7} ${-12 - i * 1.5} Z`} fill="var(--q-wax)" /></g>
      ))}
      <rect x={-13} y={-8} width={26} height={26} fill={PARCH} />
      <path d="M-16 -8 L0 -24 L16 -8 Z" fill="var(--q-wax)" />
      <path d="M-4 18 v-9 a4 4 0 0 1 8 0 v9 z" fill={INK} opacity={0.7} />
      <Emblem type="hall" x={-5} y={-7} s={0.42} />
      {level >= 5 && <><rect x={-10} y={0} width={4} height={5} fill={LIT} /><rect x={6} y={0} width={4} height={5} fill={LIT} /></>}
      <Flag x={0} y={-24} color={level >= 10 ? LIT : GOLD} />
      {level >= 7 && <Flag x={16} y={-8} />}
      {staffed && <Smoke x={9} y={-22} />}
    </g>
  );
}
export function GardenArt({ stones }: { stones: number }) {
  const n = Math.min(12, stones);
  return (
    <g stroke={INK} strokeWidth={1}>
      <ellipse cx={0} cy={4} rx={26} ry={16} fill="var(--q-moss)" opacity={0.28} />
      {Array.from({ length: n }, (_, i) => { const row = i % 2, col = Math.floor(i / 2); return <rect key={i} x={-21 + col * 8} y={-2 + row * 10} width={5} height={8} rx={1.5} fill={PARCH} stroke={INK} />; })}
      {n === 0 && <Emblem type="garden" x={-6} y={-4} s={0.5} />}
    </g>
  );
}
export function HeroesArt() {
  return (
    <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
      <path d="M-20 -4 L0 -18 L20 -4 Z" fill={PARCH} /><rect x={-18} y={-4} width={36} height={4} fill={PARCH} />
      {[-13, 0, 13].map((x) => <rect key={x} x={x - 2.5} y={0} width={5} height={15} fill={PARCH} />)}
      <rect x={-22} y={15} width={44} height={4} fill={PARCH} />
      <Emblem type="heroes" x={-5} y={-16} s={0.4} color={GOLD} />
    </g>
  );
}

const ROOFS = ['var(--q-wax)', 'var(--color-accent-600)', 'oklch(0.45 0.08 255)', 'oklch(0.5 0.06 40)', 'var(--q-moss)'];
/** The lower town: two more houses each level, drawn around Housing's spot. */
export function HousingArt({ level }: { level: number }) {
  const o = SPOTS.home;
  return (
    <g stroke={INK} strokeWidth={1} strokeLinejoin="round">
      {HOUSES.slice(0, housesAt(level)).map((h, i) => (
        <g key={i} transform={`translate(${h.x - o.x} ${h.y - o.y})`}>
          <rect x={-8} y={-3} width={16} height={11} fill={PARCH} />
          <path d="M-10 -3 L0 -12 L10 -3 Z" fill={ROOFS[(i * 3) % ROOFS.length]} />
          <rect x={-2} y={3} width={4} height={5} fill={INK} opacity={0.6} />
          {i % 3 === 0 && <rect x={4} y={-12} width={3} height={6} fill={PARCH} />}
          {level >= 6 && i % 2 === 1 && <rect x={3} y={0} width={3} height={3} fill={LIT} />}
        </g>
      ))}
    </g>
  );
}
/** The fields: one more each level, around the farmhouse at Farms' spot. */
export function FarmsArt({ level, winter }: { level: number; winter: boolean }) {
  const o = SPOTS.farm;
  return (
    <g stroke={INK} strokeWidth={0.8}>
      {FARM_FIELDS.slice(0, fieldsAt(level)).map((f, i) => (
        <g key={i} transform={`translate(${f.x - o.x} ${f.y - o.y})`}>
          <rect width={f.w} height={f.h} rx={2} fill={winter ? '#e9eef2' : i % 2 ? '#d9cf8f' : '#c9d39a'} />
          {Array.from({ length: Math.floor(f.h / 6) }, (_, k) => <path key={k} d={`M3 ${4 + k * 6} H${f.w - 3}`} stroke={i % 2 ? GOLD : 'var(--q-moss)'} strokeWidth={1.4} opacity={winter ? 0.25 : 0.8} />)}
        </g>
      ))}
      <Barn type="farm" level={Math.min(5, Math.ceil(level / 2))} staffed={false} />
    </g>
  );
}

/** One building of any type. */
export function BuildingArt({ type, level, staffed }: Props) {
  if (type === 'hall') return <HallArt level={level} staffed={staffed} />;
  const f = FAMILY[type] ?? 'house';
  const p = { type, level, staffed };
  const scale = f === 'house' || f === 'barn' ? 0.88 + level * 0.04 : 1;
  const Art = { house: House, barn: Barn, tower: Tower, crops: Crops, pond: Pond, grove: Grove, rock: Rock }[f];
  return <g transform={`scale(${scale})`}><Art {...p} /></g>;
}
