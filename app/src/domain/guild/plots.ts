// The town map: one of every building, each where it would naturally stand. Housing is the lower town outside
// the south gate and Farms the fields beyond it; both fill in as they rise.
import type { BuildingId } from './content';

export const SCENE = { w: 400, h: 700 };
export type Point = { x: number; y: number };
export type Area = { x: number; y: number; w: number; h: number };
const p = (x: number, y: number): Point => ({ x, y });

/** Where each building stands. For Housing and Farms this is where their level and label sit. */
export const SPOTS: Record<BuildingId, Point> = {
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
  // The lower town and the fields
  home: p(200, 543), farm: p(78, 664),
};

/** The houses of the lower town, in the order they go up: two more each Housing level. */
export const HOUSES: Point[] = [
  p(184, 505), p(216, 505), p(184, 526), p(216, 526), p(160, 526), p(240, 526), p(184, 564), p(216, 564), p(160, 564), p(240, 564),
  p(136, 526), p(264, 526), p(136, 564), p(264, 564), p(184, 586), p(216, 586), p(112, 526), p(288, 526), p(112, 564), p(288, 564),
];
export const housesAt = (level: number) => Math.min(HOUSES.length, 2 * level);
/** The fields, in the order they are ploughed: one more each Farms level. The farmhouse stands by the river. */
export const FARM_FIELDS: Area[] = [
  { x: 156, y: 604, w: 40, h: 26 }, { x: 204, y: 604, w: 40, h: 26 }, { x: 156, y: 636, w: 40, h: 26 }, { x: 204, y: 636, w: 40, h: 26 },
  { x: 108, y: 604, w: 40, h: 26 }, { x: 252, y: 604, w: 40, h: 26 }, { x: 108, y: 636, w: 40, h: 26 }, { x: 252, y: 636, w: 40, h: 26 },
  { x: 156, y: 668, w: 40, h: 26 }, { x: 204, y: 668, w: 40, h: 26 }, { x: 300, y: 604, w: 40, h: 26 },
];
export const fieldsAt = (level: number) => Math.min(FARM_FIELDS.length, level + 1);
/** What a tap on Housing or Farms covers, around the whole quarter. */
export const AREAS: Partial<Record<BuildingId, Area>> = {
  home: { x: 100, y: 494, w: 200, h: 104 },
  farm: { x: 56, y: 600, w: 308, h: 96 },
};

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
  'M104 545 L296 545',
];
export const PLAZA = { x: 200, y: 300, r: 48 };
export const TREES: Point[] = [p(18, 30), p(44, 28), p(76, 36), p(100, 56), p(20, 64), p(96, 96), p(22, 110), p(84, 132), p(40, 150), p(16, 168), p(104, 22), p(62, 160)];
export const HILLS: { x: number; y: number; s: number }[] = [{ x: 252, y: 54, s: 1 }, { x: 330, y: 44, s: 1.3 }, { x: 386, y: 70, s: 0.9 }, { x: 320, y: 128, s: 0.8 }, { x: 384, y: 160, s: 0.8 }];
export const FIELDS: { x: number; y: number; w: number; h: number }[] = [
  { x: 350, y: 212, w: 46, h: 60 }, { x: 350, y: 420, w: 46, h: 50 },
];
