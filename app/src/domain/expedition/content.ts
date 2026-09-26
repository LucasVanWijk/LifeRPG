// Everything Expeditions is made of, in one place so balancing means editing numbers here.
import type { IconName } from '../../components/Icon';

export type Skill = 'attack' | 'strength' | 'defence' | 'hitpoints' | 'mining' | 'smithing' | 'fishing' | 'cooking';

export const SKILLS: { key: Skill; name: string; icon: IconName; blurb: string }[] = [
  { key: 'attack', name: 'Attack', icon: 'sword', blurb: 'Adds to your to-hit roll.' },
  { key: 'strength', name: 'Strength', icon: 'dumbbell', blurb: 'Adds to your damage.' },
  { key: 'defence', name: 'Defence', icon: 'shield', blurb: 'Raises your armour class.' },
  { key: 'hitpoints', name: 'Hitpoints', icon: 'heart', blurb: 'Raises your maximum HP.' },
  { key: 'fishing', name: 'Fishing', icon: 'fish', blurb: 'Catch fish with bait.' },
  { key: 'cooking', name: 'Cooking', icon: 'flame', blurb: 'Cook fish over firewood into food.' },
  { key: 'mining', name: 'Mining', icon: 'pickaxe', blurb: 'Mine ore by lamplight.' },
  { key: 'smithing', name: 'Smithing', icon: 'hammer', blurb: 'Forge ore and coal into gear.' },
];
export const SKILL_NAME = Object.fromEntries(SKILLS.map((s) => [s.key, s.name])) as Record<Skill, string>;

export const MAX_LEVEL = 25;
/** Total skill XP needed to reach a level: going from L to L+1 costs 50 × L. */
export const xpForLevel = (level: number) => 25 * level * (level - 1);
/** Practice XP an activity gives per action or combat round. */
export const PRACTICE_XP = 0.2;
/** Activities catch up at most this long while you are away. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const ROUND_MS = 3000;
export const HP_REGEN_MS = 10000;

// ── Items ────────────────────────────────────────────────────

export type ItemKind = 'supply' | 'fish' | 'food' | 'ore' | 'weapon' | 'armour' | 'trophy';
export interface Item {
  name: string;
  kind: ItemKind;
  /** HP restored when eaten (food). */
  heals?: number;
  /** Weapons: damage die sides, flat damage bonus and to-hit bonus. */
  die?: number; dmg?: number; acc?: number;
  /** Armour: added to armour class. */
  ac?: number;
}

export const ITEMS: Record<string, Item> = {
  bait: { name: 'Bait', kind: 'supply' },
  lamp_oil: { name: 'Lamp oil', kind: 'supply' },
  firewood: { name: 'Firewood', kind: 'supply' },
  coal: { name: 'Coal', kind: 'supply' },
  torch: { name: 'Torch', kind: 'supply' },

  raw_shrimp: { name: 'Raw shrimp', kind: 'fish' },
  raw_trout: { name: 'Raw trout', kind: 'fish' },
  raw_salmon: { name: 'Raw salmon', kind: 'fish' },
  raw_lobster: { name: 'Raw lobster', kind: 'fish' },
  raw_swordfish: { name: 'Raw swordfish', kind: 'fish' },

  bread: { name: 'Bread', kind: 'food', heals: 2 },
  shrimp: { name: 'Cooked shrimp', kind: 'food', heals: 3 },
  trout: { name: 'Cooked trout', kind: 'food', heals: 6 },
  salmon: { name: 'Cooked salmon', kind: 'food', heals: 9 },
  lobster: { name: 'Cooked lobster', kind: 'food', heals: 12 },
  swordfish: { name: 'Cooked swordfish', kind: 'food', heals: 16 },

  copper_ore: { name: 'Copper ore', kind: 'ore' },
  iron_ore: { name: 'Iron ore', kind: 'ore' },
  mithril_ore: { name: 'Mithril ore', kind: 'ore' },
  adamant_ore: { name: 'Adamant ore', kind: 'ore' },

  wooden_sword: { name: 'Wooden sword', kind: 'weapon', die: 4, dmg: 1, acc: 0 },
  bronze_sword: { name: 'Bronze sword', kind: 'weapon', die: 6, dmg: 0, acc: 1 },
  iron_sword: { name: 'Iron sword', kind: 'weapon', die: 8, dmg: 0, acc: 2 },
  mithril_sword: { name: 'Mithril sword', kind: 'weapon', die: 10, dmg: 0, acc: 3 },
  adamant_sword: { name: 'Adamant sword', kind: 'weapon', die: 12, dmg: 0, acc: 4 },

  leather_armour: { name: 'Leather armour', kind: 'armour', ac: 1 },
  bronze_armour: { name: 'Bronze armour', kind: 'armour', ac: 2 },
  iron_armour: { name: 'Iron armour', kind: 'armour', ac: 3 },
  mithril_armour: { name: 'Mithril armour', kind: 'armour', ac: 4 },
  adamant_armour: { name: 'Adamant armour', kind: 'armour', ac: 5 },

  goblin_ear: { name: 'Goblin chief’s ear', kind: 'trophy' },
  bandit_badge: { name: 'Bandit captain’s badge', kind: 'trophy' },
  bone_crown: { name: 'Crown of bones', kind: 'trophy' },
  dragon_scale: { name: 'Dragon scale', kind: 'trophy' },
};
/** Fighting bare-handed. */
export const FISTS: Item = { name: 'Fists', kind: 'weapon', die: 3, dmg: 0, acc: 0 };

// ── Gathering and crafting ───────────────────────────────────

/** A skill action: `use` is consumed per action (supplies and ingredients), `out` is produced. */
export interface Recipe { id: string; skill: Skill; level: number; time: number; use: Record<string, number>; out: string; outN: number }

const fish = (id: string, level: number): Recipe[] => [
  { id: 'fish_' + id, skill: 'fishing', level, time: 6000, use: { bait: 1 }, out: 'raw_' + id, outN: 1 },
  { id: 'cook_' + id, skill: 'cooking', level, time: 4000, use: { ['raw_' + id]: 1, firewood: 1 }, out: id, outN: 1 },
];
const ore = (id: string, level: number): Recipe => ({ id: 'mine_' + id, skill: 'mining', level, time: 6000, use: { lamp_oil: 1 }, out: id + '_ore', outN: 1 });
const smith = (metal: string, swordLevel: number, armourLevel: number, oreN: [number, number]): Recipe[] => [
  { id: 'smith_' + metal + '_sword', skill: 'smithing', level: swordLevel, time: 8000, use: { [metal === 'bronze' ? 'copper_ore' : metal + '_ore']: oreN[0], coal: 1 }, out: metal + '_sword', outN: 1 },
  { id: 'smith_' + metal + '_armour', skill: 'smithing', level: armourLevel, time: 10000, use: { [metal === 'bronze' ? 'copper_ore' : metal + '_ore']: oreN[1], coal: 2 }, out: metal + '_armour', outN: 1 },
];

export const RECIPES: Recipe[] = [
  ...fish('shrimp', 1), ...fish('trout', 5), ...fish('salmon', 10), ...fish('lobster', 15), ...fish('swordfish', 20),
  ore('copper', 1), ore('iron', 8), ore('mithril', 15), ore('adamant', 20),
  ...smith('bronze', 1, 3, [3, 5]), ...smith('iron', 8, 10, [3, 5]), ...smith('mithril', 15, 17, [4, 6]), ...smith('adamant', 20, 22, [5, 8]),
];
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r])) as Record<string, Recipe>;

// ── Shop (quest gold only flows in; nothing here pays gold back) ─────────

export interface ShopItem { id: string; name: string; price: number; gives: Record<string, number>; note: string }
export const SHOP: ShopItem[] = [
  { id: 'bait', name: 'Bait ×200', price: 5, gives: { bait: 200 }, note: 'Fishing uses 1 per catch' },
  { id: 'lamp_oil', name: 'Lamp oil ×200', price: 5, gives: { lamp_oil: 200 }, note: 'Mining uses 1 per ore' },
  { id: 'firewood', name: 'Firewood ×100', price: 5, gives: { firewood: 100 }, note: 'Cooking uses 1 per fish' },
  { id: 'coal', name: 'Coal ×50', price: 5, gives: { coal: 50 }, note: 'Smithing uses 1–2 per piece' },
  { id: 'torch', name: 'Torches ×5', price: 10, gives: { torch: 5 }, note: 'One per dungeon run' },
  { id: 'bread', name: 'Bread ×10', price: 8, gives: { bread: 10 }, note: 'Heals 2 HP in a dungeon' },
  { id: 'wooden_sword', name: 'Wooden sword', price: 15, gives: { wooden_sword: 1 }, note: 'd4 + 1 damage' },
  { id: 'leather_armour', name: 'Leather armour', price: 15, gives: { leather_armour: 1 }, note: '+1 armour class' },
];

// ── Dungeons ─────────────────────────────────────────────────

export interface Drop { item: string; chance: number; n: number }
export interface Monster { name: string; hp: number; ac: number; toHit: number; die: number; dmg: number; drops: Drop[] }
export interface Dungeon { id: string; name: string; blurb: string; suggested: string; rooms: Monster[]; chest: Drop[] }

export const DUNGEONS: Dungeon[] = [
  {
    id: 'goblin_cellar', name: 'Goblin Cellar', blurb: 'Rats and goblins under the old mill.', suggested: 'Any level, with food',
    rooms: [
      { name: 'Rat', hp: 5, ac: 8, toHit: 1, die: 3, dmg: 0, drops: [{ item: 'raw_shrimp', chance: 0.5, n: 1 }] },
      { name: 'Goblin', hp: 9, ac: 10, toHit: 2, die: 4, dmg: 0, drops: [{ item: 'copper_ore', chance: 0.6, n: 2 }] },
      { name: 'Goblin chief', hp: 14, ac: 11, toHit: 3, die: 4, dmg: 1, drops: [{ item: 'copper_ore', chance: 1, n: 4 }, { item: 'bronze_sword', chance: 0.05, n: 1 }] },
    ],
    chest: [{ item: 'raw_trout', chance: 1, n: 3 }, { item: 'goblin_ear', chance: 0.1, n: 1 }],
  },
  {
    id: 'bandit_hideout', name: 'Bandit Hideout', blurb: 'A cave full of cutpurses on the forest road.', suggested: 'Combat skills around 8',
    rooms: [
      { name: 'Cutpurse', hp: 14, ac: 12, toHit: 4, die: 6, dmg: 0, drops: [{ item: 'iron_ore', chance: 0.5, n: 2 }] },
      { name: 'Bandit', hp: 20, ac: 13, toHit: 5, die: 8, dmg: 0, drops: [{ item: 'raw_salmon', chance: 0.5, n: 2 }] },
      { name: 'Bandit captain', hp: 30, ac: 14, toHit: 6, die: 8, dmg: 2, drops: [{ item: 'iron_ore', chance: 1, n: 5 }, { item: 'iron_sword', chance: 0.08, n: 1 }] },
    ],
    chest: [{ item: 'iron_ore', chance: 1, n: 6 }, { item: 'bandit_badge', chance: 0.1, n: 1 }],
  },
  {
    id: 'crypt_of_bones', name: 'Crypt of Bones', blurb: 'The dead do not rest beneath the chapel.', suggested: 'Combat skills around 14',
    rooms: [
      { name: 'Skeleton', hp: 24, ac: 14, toHit: 5, die: 8, dmg: 1, drops: [{ item: 'mithril_ore', chance: 0.4, n: 1 }] },
      { name: 'Ghoul', hp: 30, ac: 13, toHit: 6, die: 8, dmg: 2, drops: [{ item: 'raw_lobster', chance: 0.5, n: 2 }] },
      { name: 'Wight', hp: 34, ac: 15, toHit: 6, die: 10, dmg: 2, drops: [{ item: 'mithril_ore', chance: 0.6, n: 2 }] },
      { name: 'Bone lord', hp: 46, ac: 16, toHit: 7, die: 10, dmg: 3, drops: [{ item: 'mithril_ore', chance: 1, n: 5 }, { item: 'mithril_armour', chance: 0.06, n: 1 }] },
    ],
    chest: [{ item: 'mithril_ore', chance: 1, n: 6 }, { item: 'bone_crown', chance: 0.1, n: 1 }],
  },
  {
    id: 'dragons_lair', name: 'Dragon’s Lair', blurb: 'Smoke rises from the mountain. Bring your best.', suggested: 'Combat skills around 20',
    rooms: [
      { name: 'Kobold', hp: 30, ac: 14, toHit: 7, die: 6, dmg: 2, drops: [{ item: 'adamant_ore', chance: 0.3, n: 1 }] },
      { name: 'Drake', hp: 44, ac: 16, toHit: 8, die: 10, dmg: 3, drops: [{ item: 'raw_swordfish', chance: 0.5, n: 2 }] },
      { name: 'Wyvern', hp: 50, ac: 17, toHit: 8, die: 10, dmg: 3, drops: [{ item: 'adamant_ore', chance: 0.6, n: 2 }] },
      { name: 'Red dragon', hp: 85, ac: 18, toHit: 10, die: 12, dmg: 4, drops: [{ item: 'adamant_ore', chance: 1, n: 8 }, { item: 'adamant_sword', chance: 0.05, n: 1 }] },
    ],
    chest: [{ item: 'adamant_ore', chance: 1, n: 6 }, { item: 'dragon_scale', chance: 0.15, n: 1 }],
  },
];
export const DUNGEON = Object.fromEntries(DUNGEONS.map((d) => [d.id, d])) as Record<string, Dungeon>;
