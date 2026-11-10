import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, BUILDINGS, PHASE_MS } from './content';
import { advance, build, demolish, found, upgradeGuild } from './engine';
import { mapModel } from './map';
import { FARM_SLOTS, HOME_SLOTS, SCENE, slotsFor, SPOTS } from './plots';
import { buildProblem, countOf, freePlots, slotCount } from './town';
import type { Guild } from './types';

const NOW = Date.UTC(2026, 10, 5, 12);
const fresh = (): Guild => {
  const g = found({ name: 'T', town: 'T', charter: 'builders', crestSeed: 1, seed: 42 }, NOW);
  return { ...g, gold: 99999, renown: 999, stock: { wood: 99999, stone: 99999, iron: 99999, herbs: 99999 } };
};
const must = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { if (!r.ok) throw new Error((r as unknown as { reason: string }).reason); return r as Extract<T, { ok: true }>; };
const allSpots = () => [...Object.entries(SPOTS).map(([k, v]) => [k, v] as const), ...HOME_SLOTS.map((v, i) => ['home' + i, v] as const), ...FARM_SLOTS.map((v, i) => ['farm' + i, v] as const)];

describe('the town layout', () => {
  it('has one spot for every building except Homes and Farms, and twelve slots for each of those', () => {
    for (const t of BUILDING_IDS) if (t !== 'home' && t !== 'farm') expect(SPOTS[t as keyof typeof SPOTS], t).toBeDefined();
    expect(SPOTS.hall).toBeDefined();
    expect(HOME_SLOTS).toHaveLength(12);
    expect(FARM_SLOTS).toHaveLength(12);
  });

  it('keeps every spot inside the scene and clear of its neighbours', () => {
    const spots = allSpots();
    for (const [, s] of spots) { expect(s.x).toBeGreaterThanOrEqual(24); expect(s.x).toBeLessThanOrEqual(SCENE.w - 24); expect(s.y).toBeGreaterThanOrEqual(30); expect(s.y).toBeLessThanOrEqual(SCENE.h - 18); }
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const [a, p] = spots[i], [b, q] = spots[j];
      expect(Math.hypot(p.x - q.x, p.y - q.y), a + ' and ' + b).toBeGreaterThanOrEqual(a === 'hall' || b === 'hall' ? 62 : 48);
    }
  });

  it('opens one more Home and Farm slot per Guild Hall level, up to twelve', () => {
    expect([1, 2, 5, 10].map(slotsFor)).toEqual([3, 4, 7, 12]);
  });
});

describe('one of each building', () => {
  it('starts with only the Hall, two Homes and two Farms; everything else is at level 0', () => {
    const g = fresh();
    expect(g.buildings.map((b) => b.type).sort()).toEqual(['farm', 'farm', 'hall', 'home', 'home']);
    const m = mapModel(g);
    const empty = m.buildings.filter((b) => b.state === 'empty');
    expect(empty).toHaveLength(BUILDING_IDS.length - 2);
    expect(empty.every((b) => b.level === 0)).toBe(true);
    expect(m.buildings.filter((b) => b.type === 'tavern')).toHaveLength(1);
  });

  it('builds a one-of-a-kind building on its own spot, and never a second one', () => {
    let g = fresh();
    g = must(build(g, 'tavern')).guild;
    expect(build(g, 'tavern').ok).toBe(false);
    g = advance(g, NOW + 40 * PHASE_MS).guild;
    const t = mapModel(g).buildings.filter((b) => b.type === 'tavern');
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ state: 'built', level: 1, x: SPOTS.tavern.x, y: SPOTS.tavern.y });
    expect(buildProblem(g, 'tavern')).toBe('Already built');
  });

  it('shows locked buildings with the Hall level they need', () => {
    const smithy = mapModel(fresh()).buildings.find((b) => b.type === 'smithy')!;
    expect(smithy).toMatchObject({ state: 'empty', locked: BUILDINGS.smithy.hall });
  });

  it('puts a building pulled down back to level 0 on its spot', () => {
    let g = fresh();
    g = advance(must(build(g, 'forestry')).guild, NOW + 40 * PHASE_MS).guild;
    const f = g.buildings.find((b) => b.type === 'forestry')!;
    g = must(demolish(g, f.id)).guild;
    expect(mapModel(g).buildings.find((b) => b.type === 'forestry')).toMatchObject({ state: 'empty', level: 0, id: 'type:forestry' });
  });
});

describe('Homes and Farms', () => {
  it('take the nearest free slot, or the one chosen', () => {
    let g = fresh();
    expect(freePlots(g, 'home')).toEqual([2]);
    const auto = must(build(g, 'home')).guild;
    expect(auto.construction[0].plot).toBe(2);
    g = { ...g, buildings: g.buildings.map((b) => (b.type === 'hall' ? { ...b, level: 4 } : b)) };
    g = must(build(g, 'farm', 4)).guild;
    expect(g.construction[0].plot).toBe(4);
    expect(build(g, 'farm', 4).ok).toBe(false);
    expect(build(g, 'farm', 11).ok).toBe(false);
  });

  it('stop at the slots the Hall has opened', () => {
    let g = fresh();
    g = must(build(g, 'home')).guild;
    g = { ...g, construction: [] , buildings: [...g.buildings, { id: 'h3', type: 'home', level: 1, plot: 2 }] };
    expect(countOf(g, 'home')).toBe(slotCount(g));
    expect(buildProblem(g, 'home')).toMatch(/No free plot/);
  });

  it('keep their slot while being built and free it when pulled down', () => {
    let g = fresh();
    g = must(build(g, 'farm')).guild;
    const plot = g.construction[0].plot!;
    expect(freePlots(g, 'farm')).not.toContain(plot);
    g = advance(g, NOW + 40 * PHASE_MS).guild;
    const b = g.buildings.find((x) => x.type === 'farm' && x.plot === plot)!;
    g = must(demolish(g, b.id)).guild;
    expect(freePlots(g, 'farm')).toContain(plot);
  });
});

describe('the map model', () => {
  it('draws everything once, deterministically, and lists the empty Home and Farm slots', () => {
    let g = fresh();
    g = must(build(g, 'forestry')).guild;
    const m = mapModel(g);
    const ids = m.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(m.buildings.filter((b) => b.type === 'forestry')).toHaveLength(1);
    expect(m.buildings.find((b) => b.type === 'forestry')!.state).toBe('building');
    expect(m.open.map((s) => s.type + s.plot).sort()).toEqual(['farm2', 'home2']);
    expect(JSON.stringify(mapModel(g))).toBe(JSON.stringify(m));
  });

  it('reports improvement progress', () => {
    let g = fresh();
    const home = g.buildings.find((b) => b.type === 'home')!;
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
  it('move to the new layout: Homes and Farms renumbered, other buildings on their own spot', () => {
    const g = fresh();
    g.buildings.push({ id: 'zt', type: 'tavern', level: 2, plot: 7 }, { id: 'zh', type: 'home', level: 1, plot: 9 });
    for (const b of g.buildings) if (b.type === 'home') b.plot = 9;
    delete g.layout;
    const up = upgradeGuild(g);
    expect(up.layout).toBe(2);
    expect(up.buildings.find((b) => b.type === 'tavern')!.plot).toBeUndefined();
    expect(up.buildings.filter((b) => b.type === 'home').map((b) => b.plot).sort()).toEqual([0, 1, 2]);
    expect(mapModel(up).buildings.filter((b) => b.type === 'tavern')).toHaveLength(1);
  });
});
