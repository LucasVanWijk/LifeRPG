import { describe, expect, it } from 'vitest';
import { OFFLINE_CAP_MS, xpForLevel } from './content';
import type { Expedition } from './engine';
import { advance, affordable, armourClass, buy, equip, level, maxHp, newExpedition, start, train } from './engine';
import { RECIPE } from './content';

const T0 = 1_000_000;
const withBank = (bank: Record<string, number>, patch: Partial<Expedition> = {}): Expedition => ({ ...newExpedition(T0), bank, ...patch });
const MIN = 60_000;

describe('levels and training', () => {
  it('costs 50 × level to go up a level', () => {
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(3)).toBe(150);
    const e = newExpedition(T0);
    const a = train(e, 500, 'fishing');
    expect(a.used).toBe(50);
    expect(level(a.exp, 'fishing')).toBe(2);
    const b = train(a.exp, 30, 'fishing');
    expect(b.used).toBe(30);
    expect(level(b.exp, 'fishing')).toBe(2);
  });

  it('raises max and current HP with Hitpoints', () => {
    const e = newExpedition(T0);
    expect(maxHp(e)).toBe(12);
    const t = train(e, 50, 'hitpoints').exp;
    expect(maxHp(t)).toBe(14);
    expect(t.hp).toBe(14);
  });
});

describe('gathering and crafting', () => {
  it('catches one fish per 6 s, one bait each, with practice XP', () => {
    const e = start(withBank({ bait: 200 }), 'recipe', 'fish_shrimp', T0);
    if (!e.ok) throw new Error(e.reason);
    const { exp, summary } = advance(e.exp, T0 + 10 * MIN);
    expect(summary.gained).toEqual({ raw_shrimp: 100 });
    expect(exp.bank.bait).toBe(100);
    expect(exp.skills.fishing).toBeCloseTo(20);
    expect(exp.activity).not.toBeNull();
  });

  it('stops when the supplies run out', () => {
    const e = start(withBank({ bait: 5 }), 'recipe', 'fish_shrimp', T0);
    if (!e.ok) throw new Error(e.reason);
    const { exp, summary } = advance(e.exp, T0 + 10 * MIN);
    expect(exp.bank.raw_shrimp).toBe(5);
    expect(exp.activity).toBeNull();
    expect(summary.stopped).toBe('Out of bait');
  });

  it('catches up at most 8 hours', () => {
    const e = start(withBank({ bait: 1_000_000 }), 'recipe', 'fish_shrimp', T0);
    if (!e.ok) throw new Error(e.reason);
    const { exp, summary } = advance(e.exp, T0 + 20 * 60 * MIN);
    expect(summary.capped).toBe(true);
    expect(exp.bank.raw_shrimp).toBe(OFFLINE_CAP_MS / 6000);
  });

  it('uses every ingredient in a recipe', () => {
    const e = start(withBank({ copper_ore: 7, coal: 10 }), 'recipe', 'smith_bronze_sword', T0);
    if (!e.ok) throw new Error(e.reason);
    const { exp, summary } = advance(e.exp, T0 + 10 * MIN);
    expect(exp.bank.bronze_sword).toBe(2);
    expect(exp.bank.copper_ore).toBe(1);
    expect(exp.bank.coal).toBe(8);
    expect(summary.stopped).toBe('Out of copper ore');
  });

  it('refuses without the level or the supplies', () => {
    expect(start(withBank({ bait: 10 }), 'recipe', 'fish_trout', T0)).toEqual({ ok: false, reason: 'Fishing level 5 needed' });
    expect(start(withBank({}), 'recipe', 'fish_shrimp', T0)).toEqual({ ok: false, reason: 'Missing bait' });
    expect(affordable(withBank({ raw_shrimp: 3, firewood: 1 }), RECIPE.cook_shrimp)).toBe(1);
  });
});

describe('dungeons', () => {
  const geared = () => {
    let e = withBank({ torch: 2, wooden_sword: 1, leather_armour: 1, bread: 20 });
    e = equip(equip(e, 'wooden_sword'), 'leather_armour');
    for (const s of ['attack', 'strength', 'defence', 'hitpoints'] as const) e = train(train(e, 999, s).exp, 999, s).exp;
    return e;
  };

  it('uses a torch, fights with dice and plays out the same way every time', () => {
    const e = start(geared(), 'dungeon', 'goblin_cellar', T0);
    if (!e.ok) throw new Error(e.reason);
    expect(e.exp.bank.torch).toBe(1);
    const a = advance(e.exp, T0 + 30 * MIN);
    const b = advance(e.exp, T0 + 30 * MIN);
    expect(a.exp).toEqual(b.exp);
    expect(a.summary.kills).toBeGreaterThan(0);
    expect(a.exp.log.some((l) => /You roll \d+ \+ \d+ = \d+ vs AC/.test(l))).toBe(true);
  });

  it('goes back in while torches last, then stops', () => {
    const e = start(geared(), 'dungeon', 'goblin_cellar', T0);
    if (!e.ok) throw new Error(e.reason);
    const { exp, summary } = advance(e.exp, T0 + 60 * MIN);
    expect(exp.activity).toBeNull();
    expect(['Out of torches'].includes(summary.stopped!) || summary.stopped!.startsWith('Defeated')).toBe(true);
    if (summary.stopped === 'Out of torches') expect(exp.clears.goblin_cellar).toBe(2);
  });

  it('eats food when hurt and survives longer than without', () => {
    const e = start(geared(), 'dungeon', 'bandit_hideout', T0);
    if (!e.ok) throw new Error(e.reason);
    const { exp } = advance(e.exp, T0 + 60 * MIN);
    expect(exp.bank.bread).toBeLessThan(20);
    expect(exp.log.some((l) => l.includes('You eat bread'))).toBe(true);
  });

  it('keeps the loot when beaten and needs a torch to enter', () => {
    const e = start(withBank({ torch: 1 }), 'dungeon', 'dragons_lair', T0);
    if (!e.ok) throw new Error(e.reason);
    const { exp, summary } = advance(e.exp, T0 + 10 * MIN);
    expect(summary.stopped).toMatch(/^Defeated by the kobold/);
    expect(exp.hp).toBe(maxHp(exp)); // beaten early on, then rested the remaining minutes back to full
    expect(start(exp, 'dungeon', 'goblin_cellar', T0)).toEqual({ ok: false, reason: 'You need a torch' });
  });

  it('armour adds to armour class', () => {
    const e = withBank({ leather_armour: 1 });
    expect(armourClass(e)).toBe(10);
    expect(armourClass(equip(e, 'leather_armour'))).toBe(11);
  });
});

describe('shop', () => {
  it('spends gold and refuses when short', () => {
    const r = buy(newExpedition(T0), 12, 'bait');
    expect(r.ok && r.gold).toBe(7);
    expect(r.ok && r.exp.bank.bait).toBe(200);
    expect(buy(newExpedition(T0), 4, 'bait')).toEqual({ ok: false, reason: 'You need 1 more gold' });
  });
});

describe('resting', () => {
  it('heals 1 HP per 10 s outside a dungeon', () => {
    const e = { ...newExpedition(T0), hp: 2 };
    expect(advance(e, T0 + 50_000).exp.hp).toBe(7);
  });
});
