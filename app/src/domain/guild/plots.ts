// Where things can be built: a fixed, ordered list of plots on the town map. Raising the Guild Hall opens the next ones.
import type { BuildingId } from './content';

export const SCENE = { w: 400, h: 560, cx: 200, cy: 270 };
export type Zone = 'core' | 'fields' | 'wild';
export interface Plot { x: number; y: number; zone: Zone }

const ring = (n: number, rx: number, ry: number, zone: Zone, start: number): Plot[] =>
  Array.from({ length: n }, (_, i) => {
    const a = start + (i / n) * Math.PI * 2;
    return { x: Math.round(SCENE.cx + rx * Math.cos(a)), y: Math.round(SCENE.cy + ry * Math.sin(a)), zone };
  });

/** 36 plots in three rings round the Guild Hall: the village, the fields, and the wild edge. */
export const PLOTS: Plot[] = [
  ...ring(8, 82, 82, 'core', -Math.PI / 2),
  ...ring(12, 130, 140, 'fields', -Math.PI / 2 + 0.26),
  ...ring(16, 172, 214, 'wild', -Math.PI / 2 + 0.4),
];
/** The Hall, the Garden of Valor and the Hall of Heroes take no plot, so they have places of their own. */
export const ANCHORS = { hall: { x: SCENE.cx, y: SCENE.cy }, garden: { x: 46, y: 44 }, heroes: { x: 354, y: 44 } } as const;

/** Where each kind of building likes to go, if the player doesn't choose. */
export const PREFERRED: Partial<Record<BuildingId, Zone>> = {
  farm: 'fields', herbs: 'fields', fishery: 'fields', home: 'core', tavern: 'core', lodge: 'core', market: 'core', chapel: 'core', infirmary: 'core', library: 'core', stillroom: 'core',
  forestry: 'wild', quarry: 'wild', mine: 'wild', warehouse: 'wild', smithy: 'wild', watch: 'wild', field: 'wild', armoury: 'core', cartographer: 'fields',
};
