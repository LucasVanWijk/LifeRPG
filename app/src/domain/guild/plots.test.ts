import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, BUILDINGS, hallFor, levelCap, PHASE_MS } from './content';
import { advance, build, demolish, found, upgrade, upgradeGuild } from './engine';
import { mapModel } from './map';
import { AREAS, FARM_FIELDS, fieldsAt, HOUSES, housesAt, SCENE, SPOTS } from './plots';
import { bld, buildProblem, capacity, costOf } from './town';
import type { Guild } from './types';

const NOW = Date.UTC(2026, 10, 5, 12);
const fresh = (): Guild => {
  const g = found({ name: 'T', town: 'T', charter: 'builders', crestSeed: 1, seed: 42 }, NOW);
  return { ...g, gold: 99999, renown: 999, stock: { wood: 99999, stone: 99999, iron: 99999, herbs: 99999 } };
};
const must = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { if (!r.ok) throw new Error((r as unknown as { reason: string }).reason); return r as Extract<T, { ok: true }>; };
const inside = (x: number, y: number, a: { x: number; y: number; w: number; h: number }) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h;

describe('the town layout', () => {
  it('has one spot for every building', () => {
    for (const t of ['hall', ...BUILDING_IDS] as const) expect(SPOTS[t], t).toBeDefined();
  });

  it('keeps every spot inside the scene and clear of its neighbours', () => {
    const spots = Object.entries(SPOTS);
    for (const [, s] of spots) { expect(s.x).toBeGreaterThanOrEqual(24); expect(s.x).toBeLessThanOrEqual(SCENE.w - 24); expect(s.y).toBeGreaterThanOrEqual(30); expect(s.y).toBeLessThanOrEqual(SCENE.h - 18); }
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const [a, p] = spots[i], [b, q] = spots[j];
      expect(Math.hypot(p.x - q.x, p.y - q.y), a + ' and ' + b).toBeGreaterThanOrEqual(a === 'hall' || b === 'hall' ? 62 : 48);
    }
  });

  it('keeps the lower town and the fields clear of other buildings, and inside the scene', () => {
    const others = Object.entries(SPOTS).filter(([t]) => t !== 'home' && t !== 'farm');
    for (const [t, s] of others) for (const a of Object.values(AREAS)) expect(inside(s.x, s.y, a!), t).toBe(false);
    for (const h of HOUSES) expect(inside(h.x, h.y, AREAS.home!)).toBe(true);
    for (const f of FARM_FIELDS) { expect(f.x + f.w).toBeLessThanOrEqual(SCENE.w); expect(f.y + f.h).toBeLessThanOrEqual(SCENE.h); }
  });

  it('draws more houses and fields as Housing and Farms rise', () => {
    expect([1, 5, 10].map(housesAt)).toEqual([2, 10, 20]);
    expect([1, 5, 10].map(fieldsAt)).toEqual([2, 6, 11]);
  });
});

describe('one of each building', () => {
  it('starts with the Hall, Housing and Farms; everything else is at level 0', () => {
    const g = fresh();
    expect(g.buildings.map((b) => b.type).sort()).toEqual(['farm', 'hall', 'home']);
    const m = mapModel(g);
    const empty = m.buildings.filter((b) => b.state === 'empty');
    expect(empty).toHaveLength(BUILDING_IDS.length - 2);
    expect(empty.every((b) => b.level === 0)).toBe(true);
    expect(m.buildings).toHaveLength(BUILDING_IDS.length + 1);
  });

  it('builds a building on its own spot, and never a second one', () => {
    let g = fresh();
    g = must(build(g, 'tavern')).guild;
    expect(build(g, 'tavern').ok).toBe(false);
    g = advance(g, NOW + 40 * PHASE_MS).guild;
    const t = mapModel(g).buildings.filter((b) => b.type === 'tavern');
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ state: 'built', level: 1, x: SPOTS.tavern.x, y: SPOTS.tavern.y });
    expect(buildProblem(g, 'tavern')).toBe('Already built');
    expect(buildProblem(g, 'home')).toBe('Already built');
  });

  it('shows locked buildings with the Hall level they need', () => {
    const smithy = mapModel(fresh()).buildings.find((b) => b.type === 'smithy')!;
    expect(smithy).toMatchObject({ state: 'empty', locked: BUILDINGS.smithy.hall });
  });

  it('puts a building pulled down back to level 0 on its spot, but never Housing or Farms', () => {
    let g = fresh();
    g = advance(must(build(g, 'forestry')).guild, NOW + 40 * PHASE_MS).guild;
    g = must(demolish(g, bld(g, 'forestry')!.id)).guild;
    expect(mapModel(g).buildings.find((b) => b.type === 'forestry')).toMatchObject({ state: 'empty', level: 0, id: 'type:forestry' });
    expect(demolish(g, bld(g, 'home')!.id).ok).toBe(false);
    expect(demolish(g, bld(g, 'farm')!.id).ok).toBe(false);
  });
});

describe('Housing and Farms', () => {
  it('have ten levels, one per Guild Hall level; the rest have five, one per two Hall levels', () => {
    expect(BUILDINGS.home.values).toHaveLength(10);
    expect(BUILDINGS.farm.values).toHaveLength(10);
    expect([1, 2, 5, 10].map((h) => levelCap('home', h))).toEqual([1, 2, 5, 10]);
    expect([1, 2, 5, 10].map((h) => levelCap('tavern', h))).toEqual([1, 1, 3, 5]);
    expect(hallFor('home', 4)).toBe(4);
    expect(hallFor('tavern', 3)).toBe(5);
  });

  it('give more at every level and cost less steeply than other buildings', () => {
    for (const t of ['home', 'farm'] as const) for (let i = 1; i < 10; i++) expect(BUILDINGS[t].values[i]).toBeGreaterThan(BUILDINGS[t].values[i - 1]);
    const g = fresh();
    expect(costOf(g, 'home', 5).gold / costOf(g, 'home', 1).gold).toBeLessThan(costOf(g, 'tavern', 5).gold / costOf(g, 'tavern', 1).gold);
  });

  it('rise with the Hall', () => {
    let g = fresh();
    const home = bld(g, 'home')!;
    expect(buildProblem(g, 'home', home)).toMatch(/Guild Hall level 2/);
    g = { ...g, buildings: g.buildings.map((b) => (b.type === 'hall' ? { ...b, level: 2 } : b)) };
    g = must(upgrade(g, home.id)).guild;
    g = advance(g, NOW + 40 * PHASE_MS).guild;
    expect(bld(g, 'home')!.level).toBe(2);
    expect(capacity(g).housing.supply).toBe(BUILDINGS.home.values[1]);
  });
});

describe('the map model', () => {
  it('draws everything once, deterministically', () => {
    let g = fresh();
    g = must(build(g, 'forestry')).guild;
    const m = mapModel(g);
    const ids = m.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(m.buildings.filter((b) => b.type === 'forestry')).toHaveLength(1);
    expect(m.buildings.find((b) => b.type === 'forestry')!.state).toBe('building');
    expect(JSON.stringify(mapModel(g))).toBe(JSON.stringify(m));
  });

  it('reports improvement progress', () => {
    let g = fresh();
    const home = bld(g, 'home')!;
    g = { ...g, construction: [{ id: 'c', type: 'home', target: home.id, level: 2, left: 6, total: 12 }] };
    const t = mapModel(g).buildings.find((b) => b.id === home.id)!;
    expect(t.state).toBe('improving');
    expect(t.progress).toBeCloseTo(0.5);
  });

  it('lists outposts by region and their state', () => {
    const g = fresh();
    g.regions.mire.liberated = true;
    const o = mapModel(g).outposts;
    expect(o).toHaveLength(5);
    expect(o[0]).toMatchObject({ region: 'mire', state: 'freed' });
    expect(o[1].state).toBe('locked');
  });
});

describe('older saves', () => {
  it('merge their Homes into one Housing and their Farms into one Farms, giving at least as much', () => {
    const g = fresh();
    const hall = g.buildings.find((b) => b.type === 'hall')!;
    g.buildings = [hall,
      { id: 'h1', type: 'home', level: 2 }, { id: 'h2', type: 'home', level: 2 }, { id: 'h3', type: 'home', level: 1 }, // 6 + 6 + 4 = 16 housing
      { id: 'f1', type: 'farm', level: 1 }, { id: 'f2', type: 'farm', level: 1 }, // 12 food
      { id: 'zt', type: 'tavern', level: 2 },
    ];
    (g.buildings[1] as { plot?: number }).plot = 4;
    g.construction = [{ id: 'c1', type: 'home', target: null, level: 1, left: 3, total: 6 }, { id: 'c2', type: 'tavern', target: 'zt', level: 3, left: 3, total: 6 }];
    delete g.layout;
    const up = upgradeGuild(g);
    expect(up.layout).toBe(3);
    expect(up.buildings.filter((b) => b.type === 'home')).toEqual([{ id: 'h1', type: 'home', level: 2 }]);
    expect(up.buildings.filter((b) => b.type === 'farm')).toEqual([{ id: 'f1', type: 'farm', level: 1 }]);
    expect(capacity(up).housing.supply).toBeGreaterThanOrEqual(16);
    expect(up.construction.map((c) => c.id)).toEqual(['c2']);
    expect(mapModel(up).buildings.filter((b) => b.type === 'tavern')).toHaveLength(1);
  });
});
