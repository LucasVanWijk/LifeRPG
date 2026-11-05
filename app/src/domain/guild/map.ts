// What the town map draws, worked out from the guild alone: no dice, nothing stored.
import type { BuildingId, RegionId } from './content';
import { BUILDINGS, REGION_ORDER, SEASON_COST } from './content';
import { ANCHORS, PLOTS } from './plots';
import { buildProblem, freePlots, levelOf, seasonIndex, staffOf } from './town';
import type { Guild } from './types';

export interface MapBuilding {
  id: string; type: BuildingId; level: number; x: number; y: number;
  state: 'built' | 'building' | 'improving';
  /** 0 to 1 while a crew is at work. */
  progress: number;
  staffed: boolean;
  canRaise: boolean;
  /** How much cheaper it is to build this season, as a fraction (0.2 is 20% off), or 0. */
  discount: number;
  /** Plots only: the index. */
  plot?: number;
}
export interface MapOutpost { region: RegionId; state: 'freed' | 'charted' | 'locked'; need: number }
export interface MapModel {
  buildings: MapBuilding[];
  open: { plot: number; x: number; y: number }[];
  stones: number;
  retirees: string[];
  season: number;
  outposts: MapOutpost[];
}

export function mapModel(g: Guild): MapModel {
  const season = seasonIndex(g.t);
  const free = freePlots(g);
  // Buildings saved without a plot sit on the lowest free ones, so nothing is ever missing from the map.
  const spare = [...free];
  const out: MapBuilding[] = [];
  const base = (b: { type: BuildingId }) => { const d = SEASON_COST[season][b.type]; return d && d < 1 ? Math.round((1 - d) * 100) / 100 : 0; };
  for (const b of g.buildings) {
    const def = BUILDINGS[b.type];
    const at = b.type === 'hall' ? ANCHORS.hall : b.type === 'garden' ? ANCHORS.garden : b.type === 'heroes' ? ANCHORS.heroes : null;
    const plot = def.noPlot ? undefined : b.plot ?? spare.shift();
    const pos = at ?? (plot !== undefined ? PLOTS[plot] : undefined);
    if (!pos) continue;
    const up = g.construction.find((c) => c.target === b.id);
    out.push({
      id: b.id, type: b.type, level: b.level, x: pos.x, y: pos.y, plot,
      state: up ? 'improving' : 'built', progress: up ? 1 - up.left / up.total : 1,
      staffed: staffOf(g, b).length > 0, canRaise: !up && !buildProblem(g, b.type, b), discount: base(b),
    });
  }
  for (const c of g.construction) {
    if (c.target || c.plot === undefined || !PLOTS[c.plot]) continue;
    out.push({ id: c.id, type: c.type, level: c.level, x: PLOTS[c.plot].x, y: PLOTS[c.plot].y, plot: c.plot, state: 'building', progress: 1 - c.left / c.total, staffed: false, canRaise: false, discount: 0 });
  }
  const used = new Set(out.map((b) => b.plot).filter((n): n is number => n !== undefined));
  const cart = levelOf(g, 'cartographer');
  return {
    buildings: out,
    open: free.filter((i) => !used.has(i)).map((i) => ({ plot: i, x: PLOTS[i].x, y: PLOTS[i].y })),
    stones: g.monuments.length,
    // Retirees, in a stable order, as many as the green can hold.
    retirees: g.adventurers.filter((a) => a.state === 'retired').map((a) => a.id).sort().slice(0, 8),
    season,
    outposts: REGION_ORDER.slice(1).map((r, i) => ({ region: r, state: g.regions[r].liberated ? 'freed' as const : i < cart ? 'charted' as const : 'locked' as const, need: i + 1 })),
  };
}
