// The town map. Every building has one fixed spot where it would naturally stand; only Homes and Farms
// come in numbers, on slots of their own. The Guild Hall opens more of those slots as it rises.
import type { BuildingId } from './content';

export const SCENE = { w: 400, h: 700 };
export type Point = { x: number; y: number };
const p = (x: number, y: number): Point => ({ x, y });

/** Where each one-of-a-kind building stands. */
export const SPOTS: Record<Exclude<BuildingId, 'home' | 'farm'>, Point> = {
  // The square, inside the walls
  hall: p(200, 300), tavern: p(130, 318), market: p(258, 362), lodge: p(135, 255),
  // The scholars' row and the chapel close, to the north
  library: p(200, 212), cartographer: p(258, 214), chapel: p(305, 255), garden: p(140, 200),
  // The healers' lane, to the east
  infirmary: p(300, 308), stillroom: p(312, 368),
  // The smiths' quarter and the stores, to the south-west and by the gate
  smithy: p(140, 378), armoury: p(120, 432), warehouse: p(290, 428), watch: p(255, 488),
  // Outside the walls: the forest, the river, the hills, the training ground and the herb beds
  forestry: p(58, 88), fishery: p(158, 122), quarry: p(288, 72), mine: p(355, 118), heroes: p(222, 128), field: p(376, 300), herbs: p(376, 382),
};
/** Homes: three inside the walls, then the suburb outside the south gate, nearest first. */
export const HOME_SLOTS: Point[] = [
  p(256, 268), p(172, 428), p(230, 424), p(145, 512), p(292, 528), p(250, 558), p(150, 568), p(98, 494), p(332, 480), p(96, 548), p(348, 532), p(246, 612),
];
/** Farms: the fields beyond the suburb, nearest the road first. */
export const FARM_SLOTS: Point[] = [
  p(302, 622), p(122, 626), p(362, 590), p(62, 612), p(240, 670), p(180, 666), p(368, 440), p(302, 680), p(362, 652), p(122, 682), p(62, 672), p(368, 240),
];
export type Multi = 'home' | 'farm';
export const isMulti = (t: BuildingId): t is Multi => t === 'home' || t === 'farm';
export const slotList = (t: Multi) => (t === 'home' ? HOME_SLOTS : FARM_SLOTS);
/** Home and Farm slots open at each Guild Hall level: 3 at level 1, one more per level, 12 at level 10. */
export const slotsFor = (hall: number) => Math.min(HOME_SLOTS.length, 2 + hall);

// ── The land itself, drawn behind the buildings ──────────────

export const RIVER = 'M118 0 C150 40 165 80 128 140 S80 200 70 250 S50 340 62 420 S40 520 26 600 S8 670 4 700';
/** The town wall, in three runs with gates between them (south, east and north). */
export const WALLS: [number, number][][] = [
  [[232, 476], [312, 456], [340, 398], [341, 348]],
  [[342, 322], [342, 300], [334, 212], [292, 168], [218, 161]],
  [[196, 161], [112, 176], [88, 262], [86, 384], [100, 462], [168, 476]],
];
export const ROADS = [
  'M200 700 L200 476 L200 346',
  'M200 254 L207 161 L222 150 L262 104 L288 86',
  'M246 330 L342 335 L376 318',
  'M342 338 L376 368',
  'M207 161 L170 140 L158 128',
  'M200 476 L150 512 M200 476 L292 528',
];
export const PLAZA = { x: 200, y: 300, r: 48 };
export const TREES: Point[] = [p(18, 30), p(44, 28), p(76, 36), p(100, 56), p(20, 64), p(96, 96), p(22, 110), p(84, 132), p(40, 150), p(16, 168), p(104, 22), p(62, 160)];
export const HILLS: { x: number; y: number; s: number }[] = [{ x: 252, y: 54, s: 1 }, { x: 330, y: 44, s: 1.3 }, { x: 386, y: 70, s: 0.9 }, { x: 320, y: 128, s: 0.8 }, { x: 384, y: 160, s: 0.8 }];
export const FIELDS: { x: number; y: number; w: number; h: number }[] = [
  { x: 30, y: 590, w: 90, h: 50 }, { x: 140, y: 640, w: 110, h: 54 }, { x: 270, y: 596, w: 80, h: 54 }, { x: 330, y: 630, w: 66, h: 60 }, { x: 350, y: 212, w: 46, h: 60 }, { x: 350, y: 420, w: 46, h: 50 },
];
