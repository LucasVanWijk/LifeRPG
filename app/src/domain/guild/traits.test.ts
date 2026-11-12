import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES, COND_IDS } from './content';
import { hasRole, makeAdventurer, rolesOf } from './adventurer';
import { ctxFor, found, setChampion } from './engine';
import { makeExpedition } from './board';
import { odds } from './resolve';
import { backstory, pickTraits, TRAITS, TRAIT, traitFx } from './traits';
import { rngFor } from './rng';

describe('traits', () => {
  it('has at least 75 distinct traits, each with an effect, text and a story', () => {
    expect(TRAITS.length).toBeGreaterThanOrEqual(75);
    expect(new Set(TRAITS.map((x) => x.id)).size).toBe(TRAITS.length);
    expect(new Set(TRAITS.map((x) => x.name)).size).toBe(TRAITS.length);
    for (const x of TRAITS) {
      expect(x.text.length).toBeGreaterThan(5);
      expect(x.story.length).toBeGreaterThan(5);
      expect(Object.keys(x.fx).length).toBeGreaterThan(0);
      for (const c of x.fx.cnt ?? []) expect(COND_IDS).toContain(c);
    }
  });

  it('mixes good, bad and quirky traits', () => {
    for (const kind of ['good', 'bad', 'quirk'] as const) expect(TRAITS.filter((x) => x.kind === kind).length).toBeGreaterThanOrEqual(15);
  });

  it('gives every adventurer two traits from different families, and a backstory that fits', () => {
    for (let i = 0; i < 400; i++) {
      const a = makeAdventurer(rngFor(1, i), 'a' + i, 0);
      expect(a.traitIds).toHaveLength(2);
      const [x, y] = a.traitIds.map((id) => TRAIT[id]);
      expect(x.id).not.toBe(y.id);
      expect(x.group).not.toBe(y.group);
      expect(a.backstory).toContain(x.story);
      expect(a.backstory).toContain(y.story);
      expect(a.backstory).not.toMatch(/\b(he|she|his|her)\b/i);
    }
  });

  it('is deterministic', () => {
    expect(pickTraits(rngFor(5, 1))).toEqual(pickTraits(rngFor(5, 1)));
    expect(backstory(rngFor(5, 2), 'elf', ['brave', 'lazy'])).toBe(backstory(rngFor(5, 2), 'elf', ['brave', 'lazy']));
  });

  it('adds up what traits do', () => {
    const fx = traitFx(['brave', 'reckless', 'caveborn']);
    expect(fx.c).toBe(1);
    expect(fx.d).toBeCloseTo(0.12);
    expect(fx.cnt).toEqual(['darkness', 'narrow']);
  });

  it('change the odds: a Steady trait lowers death, Reckless raises it', () => {
    const g0 = found({ name: 'T', town: 'T', charter: 'martial', crestSeed: 1, seed: 7 }, 0);
    const g = setChampion(g0, g0.adventurers[0].id);
    if (!g.ok) throw new Error(g.reason);
    const offer = { ...makeExpedition(rngFor(3, 'x'), 'o', 0, { maxTier: 3, regions: ['hearth'] }), tier: 3, conditions: [] };
    const party = g.guild.adventurers.map((a) => a.id);
    const death = (ids: string[]) => {
      const guild = structuredClone(g.guild);
      for (const a of guild.adventurers) a.traitIds = ids;
      const { ctx } = ctxFor(guild, offer, party, 'steady');
      ctx.members = ctx.members.map((m) => ({ ...m, rating: m.rating - 6 }));
      const o = odds(ctx);
      return party.reduce((n, id) => n + o.major[id], 0);
    };
    expect(death(['steady'])).toBeLessThan(death([]));
    expect(death(['reckless'])).toBeGreaterThan(death([]));
  });
});

describe('two-role classes', () => {
  it('Paladins, Druids and Bards fill two roles; the old classes still fill one', () => {
    expect(rolesOf({ cls: 'paladin' })).toEqual(['tank', 'healer']);
    expect(rolesOf({ cls: 'druid' })).toEqual(['healer', 'dps']);
    expect(rolesOf({ cls: 'bard' })).toEqual(['healer', 'scout']);
    expect(rolesOf({ cls: 'guardian' })).toEqual(['tank']);
    expect(CLASS_IDS).toHaveLength(9);
    expect(hasRole({ cls: 'paladin' }, 'healer')).toBe(true);
  });

  it('a lone Paladin satisfies an expedition that needs a Tank and a Healer', () => {
    const g0 = found({ name: 'T', town: 'T', charter: 'martial', crestSeed: 1, seed: 7 }, 0);
    const pal = makeAdventurer(rngFor(1, 1), 'pal', 0, { cls: 'paladin', level: 6 });
    const g = { ...g0, adventurers: [...g0.adventurers, pal] };
    const base = makeExpedition(rngFor(3, 'x'), 'o', 0, { maxTier: 2, regions: ['hearth'] });
    const offer = { ...base, needs: ['tank', 'healer'] as ('tank' | 'healer')[], minParty: 1 };
    const ctx = ctxFor(g, offer, ['pal'], 'steady').ctx;
    expect(ctx.members[0].roles).toEqual(['tank', 'healer']);
  });

  it('are slightly weaker than a specialist of the same level', () => {
    const r = (cls: 'guardian' | 'paladin') => makeAdventurer(rngFor(9, 9), 'x', 0, { cls, level: 8, race: 'human' });
    expect(CLASSES.paladin.second).toBe('healer');
    expect(r('paladin').level).toBe(r('guardian').level);
  });
});
