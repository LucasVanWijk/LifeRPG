// What the town map draws, worked out from the guild alone: no dice, nothing stored.
// Every building is always on the map, at level 0 until it is built.
import type { BuildingId, RegionId } from './content';
import { BUILDINGS, BUILDING_IDS, REGION_ORDER, SEASON_COST } from './content';
import { SPOTS } from './plots';
import { buildProblem, levelOf, seasonIndex, staffOf } from './town';
import type { Guild } from './types';

export interface MapBuilding {
  /** A building's id, a construction's id, or `type:<id>` for a building not built yet. */
  id: string;
  type: BuildingId;
  /** 0 for a building not built yet. */
  level: number;
  x: number; y: number;
  state: 'empty' | 'built' | 'building' | 'improving';
  /** 0 to 1 while a crew is at work. */
  progress: number;
  staffed: boolean;
  /** Built: can be raised now. Empty: can be built now. */
  canRaise: boolean;
  /** Empty and waiting on the Guild Hall: the Hall level it needs, else 0. */
  locked: number;
  /** How much cheaper it is to build this season, as a fraction (0.2 is 20% off), or 0. */
  discount: number;
}
export interface MapOutpost { region: RegionId; state: 'freed' | 'charted' | 'locked'; need: number }
export interface MapModel {
  buildings: MapBuilding[];
  stones: number;
  retirees: string[];
  season: number;
  outposts: MapOutpost[];
}

export function mapModel(g: Guild): MapModel {
  const season = seasonIndex(g.t);
  const discount = (t: BuildingId) => { const d = SEASON_COST[season][t]; return d && d < 1 ? Math.round((1 - d) * 100) / 100 : 0; };
  const hall = levelOf(g, 'hall');
  const out: MapBuilding[] = [];

  for (const b of g.buildings) {
    const pos = SPOTS[b.type];
    const up = g.construction.find((c) => c.target === b.id);
    out.push({
      id: b.id, type: b.type, level: b.level, x: pos.x, y: pos.y,
      state: up ? 'improving' : 'built', progress: up ? 1 - up.left / up.total : 1,
      staffed: staffOf(g, b).length > 0, canRaise: !up && !buildProblem(g, b.type, b), locked: 0, discount: discount(b.type),
    });
  }
  for (const c of g.construction) {
    if (c.target) continue;
    const pos = SPOTS[c.type];
    out.push({ id: c.id, type: c.type, level: 1, x: pos.x, y: pos.y, state: 'building', progress: 1 - c.left / c.total, staffed: false, canRaise: false, locked: 0, discount: 0 });
  }
  // Level 0: every building not built and not being built.
  for (const t of BUILDING_IDS) {
    if (g.buildings.some((b) => b.type === t) || g.construction.some((c) => c.type === t && !c.target)) continue;
    const d = BUILDINGS[t];
    out.push({
      id: 'type:' + t, type: t, level: 0, x: SPOTS[t].x, y: SPOTS[t].y, state: 'empty', progress: 0, staffed: false,
      canRaise: !buildProblem(g, t), locked: hall < d.hall ? d.hall : 0, discount: discount(t),
    });
  }
  const cart = levelOf(g, 'cartographer');
  return {
    buildings: out,
    stones: g.monuments.length,
    // Retirees, in a stable order, as many as the green can hold.
    retirees: g.adventurers.filter((a) => a.state === 'retired').map((a) => a.id).sort().slice(0, 8),
    season,
    outposts: REGION_ORDER.slice(1).map((r, i) => ({ region: r, state: g.regions[r].liberated ? 'freed' as const : i < cart ? 'charted' as const : 'locked' as const, need: i + 1 })),
  };
}
