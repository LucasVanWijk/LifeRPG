import { describe, expect, it } from 'vitest';
import { BUILDINGS, PHASE_MS } from './content';
import { advance, build, demolish, found, setChampion, upgradeGuild } from './engine';
import { mapModel } from './map';
import { ANCHORS, PLOTS, SCENE } from './plots';
import { freePlots, openPlots, plotsUsed } from './town';
import type { Guild } from './types';

const NOW = Date.UTC(2026, 10, 5, 12);
const fresh = (): Guild => {
  const g = found({ name: 'T', town: 'T', charter: 'builders', crestSeed: 1, seed: 42 }, NOW);
  return { ...g, gold: 99999, renown: 999, stock: { wood: 99999, stone: 99999, iron: 99999, herbs: 99999 } };
};
void setChampion;
const must = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { if (!r.ok) throw new Error((r as unknown as { reason: string }).reason); return r as Extract<T, { ok: true }>; };

describe('the plot layout', () => {
  it('has 36 plots inside the scene, none too close, none on the Hall, Garden or Hall of Heroes', () => {
    expect(PLOTS).toHaveLength(36);
    for (const p of PLOTS) { expect(p.x).toBeGreaterThan(20); expect(p.x).toBeLessThan(SCENE.w - 20); expect(p.y).toBeGreaterThan(20); expect(p.y).toBeLessThan(SCENE.h - 60); }
    for (let i = 0; i < PLOTS.length; i++) for (let j = i + 1; j < PLOTS.length; j++) expect(Math.hypot(PLOTS[i].x - PLOTS[j].x, PLOTS[i].y - PLOTS[j].y), i + ',' + j).toBeGreaterThanOrEqual(44);
    for (const p of PLOTS) for (const a of Object.values(ANCHORS)) expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeGreaterThanOrEqual(46);
  });
  it('opens as many as the Guild Hall allows, and never fewer than the most it can hold', () => {
    expect(openPlots(fresh())).toHaveLength(12);
    expect(PLOTS.length).toBeGreaterThanOrEqual(30);
  });
});

describe('plots for buildings', () => {
  it('gives every starting building its own plot', () => {
    const g = fresh();
    const plots = g.buildings.filter((b) => !BUILDINGS[b.type].noPlot).map((b) => b.plot);
    expect(plots.every((p) => p !== undefined)).toBe(true);
    expect(new Set(plots).size).toBe(plots.length);
    expect(plotsUsed(g)).toBe(plots.length);
    expect(g.buildings.filter((b) => BUILDINGS[b.type].noPlot).every((b) => b.plot === undefined)).toBe(true);
  });

  it('puts a new building where it prefers, or where the player chooses', () => {
    let g = fresh();
    const auto = must(build(g, 'farm')).guild;
    expect(PLOTS[auto.construction[0].plot!].zone).toBe('fields');
    const chosen = freePlots(g)[3];
    g = must(build(g, 'forestry', chosen)).guild;
    expect(g.construction[0].plot).toBe(chosen);
    expect(build(g, 'quarry', chosen).ok).toBe(false);
    expect(build(g, 'quarry', 35).ok).toBe(false);
  });

  it('keeps the plot while it is built, and frees it when pulled down', () => {
    let g = fresh();
    g = must(build(g, 'forestry')).guild;
    const plot = g.construction[0].plot!;
    expect(freePlots(g)).not.toContain(plot);
    g = advance(g, NOW + 40 * PHASE_MS).guild;
    const b = g.buildings.find((x) => x.type === 'forestry')!;
    expect(b.plot).toBe(plot);
    g = must(demolish(g, b.id)).guild;
    expect(freePlots(g)).toContain(plot);
  });

  it('never puts two buildings on one plot, even in a full town', () => {
    let g = fresh();
    g.buildings = g.buildings.map((b) => (b.type === 'hall' ? { ...b, level: 10 } : b));
    for (let i = 0; i < 36; i++) { const r = build(g, i % 2 ? 'home' : 'farm'); if (!r.ok) break; g = { ...r.guild, construction: [] , buildings: [...r.guild.buildings, { id: 'n' + i, type: i % 2 ? 'home' as const : 'farm' as const, level: 1, plot: r.guild.construction[0].plot }] }; }
    const used = g.buildings.filter((b) => b.plot !== undefined).map((b) => b.plot);
    expect(new Set(used).size).toBe(used.length);
    expect(used.length).toBeGreaterThan(20);
  });

  it('places buildings saved without a plot', () => {
    const g = fresh();
    for (const b of g.buildings) delete b.plot;
    const up = upgradeGuild(g);
    const plots = up.buildings.filter((b) => !BUILDINGS[b.type].noPlot).map((b) => b.plot);
    expect(plots.every((p) => p !== undefined)).toBe(true);
    expect(new Set(plots).size).toBe(plots.length);
  });
});

describe('the map model', () => {
  it('shows every building and every project, is deterministic, and leaves the rest as open plots', () => {
    let g = fresh();
    g = must(build(g, 'forestry')).guild;
    const m = mapModel(g);
    expect(m.buildings).toHaveLength(g.buildings.length + 1);
    expect(m.buildings.filter((b) => b.state === 'building')).toHaveLength(1);
    expect(m.open.length).toBe(freePlots(g).length);
    expect(JSON.stringify(mapModel(g))).toBe(JSON.stringify(m));
    const ids = m.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws buildings saved without a plot, and reports improvement progress', () => {
    let g = fresh();
    for (const b of g.buildings) delete b.plot;
    expect(mapModel(g).buildings).toHaveLength(g.buildings.length);
    const tavern = g.buildings.find((b) => b.type === 'tavern')!;
    g = { ...g, construction: [{ id: 'c', type: 'tavern', target: tavern.id, level: 2, left: 6, total: 12 }] };
    const t = mapModel(g).buildings.find((b) => b.id === tavern.id)!;
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
