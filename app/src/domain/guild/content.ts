// Everything the guild is made of, in one place so balancing means editing numbers here.
// See docs/guild-redesign.md for the reasoning behind them.
import type { IconName } from '../../components/Icon';

// ── Time ─────────────────────────────────────────────────────

/** One phase (Morning, Noon or Evening) is one real hour. */
export const PHASE_MS = 3_600_000;
export const PHASES_PER_DAY = 3;
export const DAYS_PER_WEEK = 8;
export const DAYS_PER_SEASON = 16;
export const DAYS_PER_YEAR = 64;
export const PHASES_PER_YEAR = PHASES_PER_DAY * DAYS_PER_YEAR;
export const PHASE_NAMES = ['Morning', 'Noon', 'Evening'] as const;
export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
/** Shorter catch-ups than this don't get a "While you were away" summary. */
export const AWAY_SUMMARY_MS = 45 * 60_000;

// ── Attributes, races, classes ───────────────────────────────

export type Attr = 'might' | 'finesse' | 'wits' | 'spirit';
export const ATTRS: Attr[] = ['might', 'finesse', 'wits', 'spirit'];
export const ATTR_NAME: Record<Attr, string> = { might: 'Might', finesse: 'Finesse', wits: 'Wits', spirit: 'Spirit' };
export const ATTR_MAX = 20;
/** Real-life XP from one source that adds +1 to its attribute. */
export const PRACTICE_PER_POINT = 150;

export type RaceId = 'human' | 'dwarf' | 'elf' | 'halfling';
export interface Race {
  id: RaceId; name: string; plural: string;
  /** Recruit age range in years; the youngest serve about 15 years, the oldest about 3. */
  age: [number, number];
  comesOfAge: number;
  mods: Partial<Record<Attr, number>>;
  trait: string; traitText: string;
  xpMult: number; injuryMult: number;
  /** Years they live after retiring. */
  lifespan: [number, number];
}
export const RACES: Record<RaceId, Race> = {
  human: { id: 'human', name: 'Human', plural: 'Humans', age: [16, 40], comesOfAge: 16, mods: {}, trait: 'Driven', traitText: '+15% XP from all sources', xpMult: 1.15, injuryMult: 1, lifespan: [10, 20] },
  dwarf: { id: 'dwarf', name: 'Dwarf', plural: 'Dwarves', age: [30, 70], comesOfAge: 30, mods: { might: 1, spirit: 1, finesse: -1 }, trait: 'Stoneborn', traitText: '−25% chance of wounds; counters Cold', xpMult: 1, injuryMult: 0.75, lifespan: [20, 40] },
  elf: { id: 'elf', name: 'Elf', plural: 'Elves', age: [60, 200], comesOfAge: 60, mods: { finesse: 1, wits: 1, might: -1 }, trait: 'Keen-eyed', traitText: '+1 to scouting checks; counters Darkness', xpMult: 1, injuryMult: 1, lifespan: [40, 80] },
  halfling: { id: 'halfling', name: 'Halfling', plural: 'Halflings', age: [20, 45], comesOfAge: 20, mods: { finesse: 1, spirit: 1, might: -1 }, trait: 'Lucky', traitText: 'Major wounds are four times rarer', xpMult: 1, injuryMult: 1, lifespan: [15, 25] },
};
export const RACE_IDS = Object.keys(RACES) as RaceId[];

export type Role = 'tank' | 'healer' | 'dps' | 'scout';
export const ROLE_NAME: Record<Role, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS', scout: 'Scout' };
export const ROLES: Role[] = ['tank', 'healer', 'dps', 'scout'];
/** What a dual-role class gives up in rating for being two things. */
export const DUAL_ROLE_PENALTY = 0.8;

export type ClassId = 'guardian' | 'cleric' | 'ranger' | 'arcanist' | 'blademaster' | 'rogue' | 'paladin' | 'druid' | 'bard';
export interface Cls { id: ClassId; name: string; role: Role; /** Two-role classes fill a second role at a small cost to rating. */ second?: Role; main: Attr; weights: Record<Attr, number>; icon: IconName; blurb: string }
export const CLASSES: Record<ClassId, Cls> = {
  guardian: { id: 'guardian', name: 'Guardian', role: 'tank', main: 'might', weights: { might: 0.45, finesse: 0.1, wits: 0.1, spirit: 0.35 }, icon: 'shield', blurb: 'Holds the line, so the others are hurt less.' },
  cleric: { id: 'cleric', name: 'Cleric', role: 'healer', main: 'spirit', weights: { might: 0.1, finesse: 0.1, wits: 0.3, spirit: 0.5 }, icon: 'heart', blurb: 'Turns wounds into lesser wounds, and heals the rest faster.' },
  ranger: { id: 'ranger', name: 'Ranger', role: 'dps', main: 'finesse', weights: { might: 0.15, finesse: 0.5, wits: 0.25, spirit: 0.1 }, icon: 'feather', blurb: 'Bow and blade, best in the open.' },
  arcanist: { id: 'arcanist', name: 'Arcanist', role: 'dps', main: 'wits', weights: { might: 0.1, finesse: 0.1, wits: 0.55, spirit: 0.25 }, icon: 'sparkles', blurb: 'Spells that burn what steel cannot.' },
  blademaster: { id: 'blademaster', name: 'Blademaster', role: 'dps', main: 'might', weights: { might: 0.4, finesse: 0.4, wits: 0.1, spirit: 0.1 }, icon: 'sword', blurb: 'Two blades and no patience.' },
  paladin: { id: 'paladin', name: 'Paladin', role: 'tank', second: 'healer', main: 'spirit', weights: { might: 0.3, finesse: 0.05, wits: 0.1, spirit: 0.55 }, icon: 'shield', blurb: 'Shield and prayer: holds the line and mends it too.' },
  druid: { id: 'druid', name: 'Druid', role: 'healer', second: 'dps', main: 'wits', weights: { might: 0.1, finesse: 0.15, wits: 0.4, spirit: 0.35 }, icon: 'tree', blurb: 'Heals with one hand and burns with the other.' },
  bard: { id: 'bard', name: 'Bard', role: 'healer', second: 'scout', main: 'finesse', weights: { might: 0.05, finesse: 0.35, wits: 0.3, spirit: 0.3 }, icon: 'music', blurb: 'Keeps spirits up and ears open, and knows a way round.' },
  rogue: { id: 'rogue', name: 'Rogue', role: 'scout', main: 'finesse', weights: { might: 0.05, finesse: 0.5, wits: 0.35, spirit: 0.1 }, icon: 'lock', blurb: 'Traps, locks and the way round.' },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/** Which attribute each kind of real-life work trains. Habits train the class's main attribute. */
export const QUAD_ATTR = { crisis: 'might', main: 'wits', errand: 'finesse', side: 'spirit' } as const satisfies Record<string, Attr>;

// ── Levels and money ─────────────────────────────────────────

export const MAX_LEVEL = 30;
/** XP from one level to the next: 80 per level, so level 20 takes 15,200 XP and level 30 takes 34,800. */
export const xpToNext = (level: number) => 80 * level;
/** Talent ★1–5: attribute points per level-up. */
export const pointsPerLevel = (talent: number) => 1 + Math.floor(talent / 2);
export const hireFee = (level: number, talent: number) => 15 + 10 * level + 15 * (talent - 1);
/** Always below what a replacement of the same level and talent costs. */
export const insurance = (level: number, talent: number) => Math.floor(hireFee(level, talent) / 2) + 5 * level;
/** Share of real-life and expedition gold that goes to the adventurer's purse. */
export const PURSE_SHARE = 0.25;

export type CharterId = 'mercantile' | 'martial' | 'hospitaller' | 'builders';
export const CHARTERS: { id: CharterId; name: string; text: string; icon: IconName }[] = [
  { id: 'mercantile', name: 'Mercantile', text: '+15% gold from expeditions, and a larger weekly sell limit once there is a market.', icon: 'coins' },
  { id: 'martial', name: 'Martial', text: '+15% XP from expeditions and odd jobs.', icon: 'sword' },
  { id: 'hospitaller', name: 'Hospitaller', text: '−20% chance of wounds, and a healer’s touch comes a little easier.', icon: 'heart' },
  { id: 'builders', name: 'Builders', text: '−15% construction cost and time, once the town is built.', icon: 'hammer' },
];

// ── Guild limits that don't come from a building ──

export const TAVERN_REFRESH_DAYS = 4;
export const RECRUIT_STAY_DAYS: [number, number] = [3, 5];
export const NOTICE_FEE = 50;
export const BOARD_SIZE = 4;
export const START_GOLD = 150;
export const START_STOCK = { wood: 50, stone: 30, iron: 0, herbs: 0 };

// ── Life at home ─────────────────────────────────────────────

export const REST_MULT = 1.5;
/** XP per phase on the Train duty: half of this without a Training Field, up to ×2 with a level 5 one. */
export const TRAIN_XP = 4;
/** Rest when stamina is below this, or when fatigue is this far above what the years have taken. */
export const AUTO_REST = { stamina: 60, fatigue: 25 };

// ── Going out ────────────────────────────────────────────────

export type StageKind = 'combat' | 'hazard' | 'trap' | 'endurance' | 'boss' | 'rest';
export const STAGE_ICON: Record<StageKind, IconName> = { combat: 'sword', hazard: 'mountain', trap: 'lock', endurance: 'clock', boss: 'skull', rest: 'flame' };
export const STAGE_NAME: Record<StageKind, string> = { combat: 'Fight', hazard: 'Hazard', trap: 'Trap', endurance: 'Endurance', boss: 'Boss', rest: 'Rest' };
export const stageCount = (tier: number) => 2 + tier;
/** What a typical party at the middle of a tier's level band brings to a check. */
export const difficulty = (tier: number) => 5.6 * tier + 0.25;
export const BOSS_EXTRA = 2;
/** Levels that suit each tier. */
export const tierLevels = (tier: number): [number, number] => [4 * tier - 3, 4 * tier];
export const tierPhases = (tier: number): [number, number] => [[2, 4], [4, 8], [6, 12], [9, 18], [12, 24]][tier - 1] as [number, number];

export type Stance = 'cautious' | 'steady' | 'bold';
export const STANCES: Record<Stance, { name: string; duration: number; fatigue: number; loot: number; injury: number; turnBackAt: number; text: string }> = {
  cautious: { name: 'Cautious', duration: 0.7, fatigue: 0.5, loot: 0.7, injury: 0.7, turnBackAt: 1, text: 'Back sooner, half the strain, fewer wounds, less loot. Turns back at the first failure.' },
  steady: { name: 'Steady', duration: 1, fatigue: 1, loot: 1, injury: 1, turnBackAt: 2, text: 'Turns back at the second failure.' },
  bold: { name: 'Bold', duration: 1, fatigue: 1.2, loot: 1.4, injury: 1.5, turnBackAt: 99, text: '+40% loot and a better shot at the boss chest, but more and worse wounds. Never turns back.' },
};

/** A stage check is d20 + party score − difficulty: Clear at 10 or more, Strain at 5–9, Fail below. */
export const CLEAR_AT = 10;
export const STRAIN_AT = 5;
export const SIZE_BONUS = 0.5;
export const MISSING_ROLE: Partial<Record<StageKind, { role: Role; penalty: number }>> = {
  combat: { role: 'tank', penalty: 2 }, boss: { role: 'tank', penalty: 2 }, hazard: { role: 'scout', penalty: 2 }, trap: { role: 'scout', penalty: 3 },
};
export const ROLE_WEIGHT: Record<Exclude<StageKind, 'rest'>, Record<Role, number>> = {
  combat: { tank: 1.2, dps: 1.2, healer: 0.6, scout: 0.6 },
  boss: { tank: 1.2, dps: 1.3, healer: 0.7, scout: 0.5 },
  hazard: { tank: 0.7, dps: 0.7, healer: 0.7, scout: 1.5 },
  trap: { tank: 0.4, dps: 0.4, healer: 0.4, scout: 2 },
  endurance: { tank: 1, dps: 1, healer: 1, scout: 1 },
};
/** Stamina drain, fatigue gain and the wound rules are in wounds.ts. */

export type LootKind = 'gold' | 'materials' | 'alchemy' | 'items';
export const OFFER_KIND: Record<LootKind, { name: string; icon: IconName }> = {
  gold: { name: 'Gold', icon: 'coins' }, materials: { name: 'Materials', icon: 'pickaxe' }, alchemy: { name: 'Alchemy', icon: 'flame' }, items: { name: 'Gear', icon: 'shield' },
};
/** Gold per cleared stage of a gold expedition; other kinds bring a fifth. The boss chest is worth two stages. */
export const STAGE_GOLD = [5, 10, 18, 28, 40];
export const STAGE_MATERIALS = [6, 12, 20, 30, 45];
export const STAGE_HERBS = [3, 6, 10, 15, 22];
export const xpFor = (tier: number) => 10 * tier * tier;
export const BOLD_XP = 1.5;
export const ODYSSEY_XP = 1.5;

export const ODD_JOB_MINUTES: [number, number] = [20, 40];
export const ODD_JOBS_ON_BOARD: [number, number] = [2, 3];
export const TUTORIAL_MINUTES = 10;

export type StockKey = 'wood' | 'stone' | 'iron' | 'herbs';
export const STOCK_KEYS: StockKey[] = ['wood', 'stone', 'iron', 'herbs'];
export const STOCK_NAME: Record<StockKey, string> = { wood: 'Wood', stone: 'Stone', iron: 'Iron', herbs: 'Herbs' };

// ── Words ────────────────────────────────────────────────────

export const NAMES: Record<RaceId, { first: string[]; family: string[] }> = {
  human: {
    first: ['Aldric', 'Bryn', 'Cora', 'Dain', 'Edda', 'Fenn', 'Gisla', 'Halden', 'Isolde', 'Jory', 'Kestrel', 'Lio', 'Maren', 'Nell', 'Osric', 'Petra', 'Quinn', 'Rowan', 'Sela', 'Tamsin', 'Ulric', 'Vera', 'Wren', 'Yorick', 'Ada', 'Bram', 'Elin', 'Hugo', 'Ivo', 'Mira'],
    family: ['Ashdown', 'Blackwood', 'Corran', 'Dunmere', 'Everly', 'Fairweather', 'Greaves', 'Holloway', 'Ironside', 'Kettering', 'Larkin', 'Marsh', 'Northgate', 'Oakes', 'Pennick', 'Redfern', 'Stroud', 'Thorne', 'Underhill', 'Vance', 'Whitlock', 'Yarrow'],
  },
  dwarf: {
    first: ['Agna', 'Bardrik', 'Brunna', 'Dolgar', 'Edrik', 'Finna', 'Gorm', 'Hilde', 'Ingvar', 'Kragga', 'Mordek', 'Nalda', 'Orrin', 'Rurik', 'Sigrun', 'Torva', 'Ulfa', 'Vigdis', 'Yorna', 'Haldor'],
    family: ['Anvilborn', 'Coalbeard', 'Deepdelver', 'Flintfist', 'Granitehand', 'Hammersong', 'Ironvein', 'Oreheart', 'Stonebrow', 'Underforge', 'Copperjaw', 'Embermantle'],
  },
  elf: {
    first: ['Aeren', 'Caelan', 'Celith', 'Elowen', 'Ellara', 'Faelar', 'Ferion', 'Ilyra', 'Ithrin', 'Lysander', 'Maelis', 'Naeris', 'Orivel', 'Sylaen', 'Thalanor', 'Vaeris', 'Yllia', 'Aster', 'Rhosyn', 'Tirael'],
    family: ['Dawnwhisper', 'Evenleaf', 'Moonbrook', 'Silverbough', 'Starwatch', 'Thornveil', 'Willowmere', 'Windsong', 'Brightwater', 'Duskmantle', 'Mistvale', 'Larkspur'],
  },
  halfling: {
    first: ['Bramble', 'Clover', 'Dilly', 'Elbert', 'Figgy', 'Hob', 'Lark', 'Nib', 'Poppy', 'Rufus', 'Sorrel', 'Tansy', 'Wilco', 'Basil', 'Dandy', 'Hazel', 'Milo', 'Perry', 'Quince', 'Tilly'],
    family: ['Applebrook', 'Barleycorn', 'Bramblefoot', 'Copperkettle', 'Goodbarrel', 'Honeydew', 'Mossbottom', 'Puddlefoot', 'Thistledown', 'Underbough', 'Warmhearth', 'Butterbuck'],
  },
};

export const GUILD_NAMES = ['The Lantern Company', 'The Grey Banner', 'The Hollow Oak', 'The Iron Kettle', 'The Ember Hand', 'The Wandering Star', 'The Silver Stag', 'The Oathbound'];
export const TOWN_NAMES = ['Millbrook', 'Ashford', 'Wrenwick', 'Stonehollow', 'Brackenridge', 'Fernmoor', 'Kettleby', 'Lowmere'];

export const OFFER_WORDS = {
  adj: ['Sunken', 'Hollow', 'Old', 'Whispering', 'Mossy', 'Broken', 'Drowned', 'Burnt', 'Silent', 'Crooked', 'Forgotten', 'Weeping'],
  gold: ['Barrow', 'Toll House', 'Chapel', "Smugglers' Cave", 'Counting House', 'Crypt', 'Manor'],
  materials: ['Quarry', 'Timber Camp', 'Mine', 'Sawmill', 'Ironworks', 'Stoneyard'],
  alchemy: ['Grotto', 'Herb Garden', 'Glade', 'Fen', 'Apothecary', 'Mushroom Caves'],
};

export const STAGE_TITLES: Record<StageKind, string[]> = {
  combat: ['A pack of wolves', 'Bandits on the road', 'Giant rats', 'A goblin warband', 'Skeletons in the dark', 'A nest of spiders', 'Deserters'],
  hazard: ['A collapsed passage', 'A flooded crossing', 'A rotten rope bridge', 'A sheer drop', 'Bad air'],
  trap: ['A trapped corridor', 'A locked vault door', 'A pit under the flagstones', 'A warded chest'],
  endurance: ['The long climb', 'A forced march', 'Two nights without fire', 'The maze of tunnels'],
  boss: ['The pack leader', 'The bandit chief', 'The rat queen', 'An ogre', 'The barrow wight', 'A troll under the bridge'],
  rest: ['A quiet campsite', 'An abandoned shrine', 'A hunter’s lean-to'],
};

export const ODD_JOBS = [
  'Rats in the baker’s cellar', 'Rats in the brewer’s cellar', 'Wolves near the miller’s farm', 'A lost goat on the hill',
  'Escort a cart to the next village', 'Clear the old well', 'Guard the night market', 'Chase off a drunk ogre', 'Fetch herbs for the midwife',
  'Find a ring in the river', 'Mend the bridge before the fair', 'Catch a thief at the inn',
];
export const TUTORIAL_JOB = 'Rats in the guild’s own cellar';

export const SCARS: { text: string; attr: Attr }[] = [
  { text: 'Lost an eye', attr: 'finesse' }, { text: 'A limp', attr: 'finesse' }, { text: 'Burned hands', attr: 'might' },
  { text: 'A crooked arm', attr: 'might' }, { text: 'A ringing in one ear', attr: 'wits' }, { text: 'Nightmares', attr: 'spirit' },
];

// ── Conditions and regions ───────────────────────────────────

export type ConditionId = 'darkness' | 'flooded' | 'cold' | 'cursed' | 'undead' | 'beasts' | 'swarm' | 'narrow' | 'open' | 'traps' | 'locked' | 'ambush' | 'plague';
/** Stands in for a condition the party can't see yet when working out odds: nobody counters it. */
export type CondOrUnknown = ConditionId | 'unknown';
export const CONDITIONS: Record<ConditionId, { name: string; icon: IconName; text: string; trinket: string }> = {
  darkness: { name: 'Darkness', icon: 'moon', text: 'Pitch dark, and archers can’t see.', trinket: 'Sunstone Lantern' },
  flooded: { name: 'Flooded', icon: 'fish', text: 'Water to the knees slows everyone.', trinket: 'Fisher’s Charm' },
  cold: { name: 'Cold', icon: 'mountain', text: 'Bitter cold saps strength.', trinket: 'Ember Amulet' },
  cursed: { name: 'Cursed', icon: 'skull', text: 'An old curse hangs over the place.', trinket: 'Warding Ring' },
  undead: { name: 'Undead', icon: 'skull', text: 'The dead do not rest here.', trinket: 'Saint’s Medal' },
  beasts: { name: 'Beasts', icon: 'feather', text: 'Wild things hunt in the dark.', trinket: 'Hunter’s Whistle' },
  swarm: { name: 'Swarm', icon: 'alert', text: 'Too many to fight one at a time.', trinket: 'Smoke Pouch' },
  narrow: { name: 'Narrow', icon: 'lock', text: 'Tight tunnels, no room to swing.', trinket: 'Caver’s Charm' },
  open: { name: 'Open ground', icon: 'sun', text: 'Nowhere to hide from anything.', trinket: 'Shepherd’s Crook' },
  traps: { name: 'Traps', icon: 'alert', text: 'The way is rigged.', trinket: 'Tinker’s Pick' },
  locked: { name: 'Locked', icon: 'lock', text: 'Every door is barred.', trinket: 'Skeleton Key' },
  ambush: { name: 'Ambush', icon: 'sword', text: 'Something is waiting for them.', trinket: 'Lookout’s Horn' },
  plague: { name: 'Plague', icon: 'heart', text: 'Sickness in the air.', trinket: 'Herbalist’s Charm' },
};
export const COND_IDS = Object.keys(CONDITIONS) as ConditionId[];
/** Penalty to every check for each condition nobody in the party counters. */
export const COND_PENALTY = 1.2;
export const CLASS_COUNTERS: Record<ClassId, ConditionId[]> = {
  paladin: ['undead', 'ambush'], druid: ['beasts', 'flooded'], bard: ['locked', 'cursed'],
  guardian: ['ambush'], cleric: ['plague', 'undead'], ranger: ['open', 'beasts'], arcanist: ['cursed', 'undead'], blademaster: ['narrow', 'swarm'], rogue: ['traps', 'locked'],
};
export const RACE_COUNTERS: Partial<Record<RaceId, ConditionId[]>> = { dwarf: ['cold'], elf: ['darkness'] };

export type RegionId = 'hearth' | 'mire' | 'frost' | 'dusk' | 'sun' | 'fen';
export interface Region { id: RegionId; name: string; blurb: string; icon: IconName; conds: ConditionId[]; tiers: [number, number]; lair: { name: string; boss: string; tier: number } | null }
export const REGIONS: Record<RegionId, Region> = {
  hearth: { id: 'hearth', name: 'The Hearthlands', blurb: 'Farms, forest roads and the odd cellar full of rats.', icon: 'home', conds: ['beasts', 'open', 'ambush', 'narrow'], tiers: [1, 2], lair: null },
  mire: { id: 'mire', name: 'Mirewood', blurb: 'A drowned forest where the paths move.', icon: 'tree', conds: ['flooded', 'beasts', 'plague'], tiers: [1, 3], lair: { name: 'The Hag’s Hollow', boss: 'The Mire Hag', tier: 3 } },
  frost: { id: 'frost', name: 'Frostpeak', blurb: 'Passes and ice caves under a white sky.', icon: 'mountain', conds: ['cold', 'narrow', 'ambush'], tiers: [2, 4], lair: { name: 'The Rimeheart', boss: 'The Frost Wyrm', tier: 4 } },
  dusk: { id: 'dusk', name: 'Duskhollow', blurb: 'Where the sun never quite arrives.', icon: 'moon', conds: ['darkness', 'undead', 'cursed'], tiers: [3, 5], lair: { name: 'The Lightless Court', boss: 'The Pale King', tier: 5 } },
  sun: { id: 'sun', name: 'Sunscar Wastes', blurb: 'Salt flats and dust, and things that live under them.', icon: 'sun', conds: ['open', 'swarm', 'beasts'], tiers: [3, 5], lair: { name: 'The Glass Throne', boss: 'The Sand Tyrant', tier: 5 } },
  fen: { id: 'fen', name: 'The Blighted Fen', blurb: 'Rot, fever and worse.', icon: 'flame', conds: ['plague', 'cursed', 'undead'], tiers: [4, 5], lair: { name: 'The Rotting Heart', boss: 'The Blight Mother', tier: 5 } },
};
export const REGION_ORDER: RegionId[] = ['hearth', 'mire', 'frost', 'dusk', 'sun', 'fen'];
/** Liberating a region: expeditions there are shorter and richer, and the guild gets an outpost. */
export const LIBERATED = { duration: 0.85, loot: 1.1, renown: 200 };
/**
 * Renown from going out. Every expedition and odyssey earns its worth (tier² for an expedition, 10 × tier for an odyssey)
 * times the share of its checks the party passed, at least 1 if they passed any; a flawless run (every stage, no failure)
 * earns as much again on top.
 */
export const RENOWN = { share: 1, flawless: 1, odyssey: 10 };
/** Saves before renown came from every outing counted it in half-size units; they are doubled once on load. */
export const RENOWN_UNIT = 2;

export const PHASE_EFFECT = [
  { name: 'Morning', text: 'Travel is 10% faster.', duration: 0.9, loot: 1, dark: false },
  { name: 'Noon', text: 'No effect.', duration: 1, loot: 1, dark: false },
  { name: 'Evening', text: '+10% loot, but it will be dark.', duration: 1, loot: 1.1, dark: true },
] as const;

export const ODYSSEY = { legs: [4, 6] as [number, number], phases: [48, 144] as [number, number], party: [4, 6] as [number, number], hall: 3, expires: 96 };
export const RECOVERY_EXPIRES = 48;

// ── Gear and potions ─────────────────────────────────────────

export const GRADES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;
export const GRADE_DURABILITY = [8, 12, 20, 30, 50];
export const GRADE_RATING = [0.5, 1, 1.5, 2.5, 4];
export const GRADE_VALUE = [20, 50, 120, 300, 800];
export const FORGE_IRON = [10, 25, 60, 150, 400];
export type Slot = 'weapon' | 'armour' | 'trinket';
export const SLOTS: Slot[] = ['weapon', 'armour', 'trinket'];
export const SLOT_NAME: Record<Slot, string> = { weapon: 'Weapon', armour: 'Armour', trinket: 'Trinket' };
export const SLOT_RATING: Record<Slot, number> = { weapon: 1, armour: 0.7, trinket: 0.4 };
export const SLOT_ICON: Record<Slot, IconName> = { weapon: 'sword', armour: 'shield', trinket: 'star' };
/** Armour also lowers the chance of injury, by this much per grade step. */
export const ARMOUR_INJURY = 0.04;
export const GEAR_NAMES: Record<Slot, string[]> = {
  weapon: ['Sword', 'Axe', 'Spear', 'Mace', 'Dagger', 'Bow', 'Staff'],
  armour: ['Jerkin', 'Mail', 'Cuirass', 'Robe', 'Brigandine', 'Buckler'],
  trinket: ['Charm', 'Ring', 'Amulet', 'Token', 'Pendant'],
};
export const GRADE_WORD = [['Plain', 'Worn', 'Simple'], ['Sturdy', 'Fine', 'Tempered'], ['Keen', 'Gilded', 'Runed'], ['Masterwork', 'Storied', 'Starforged'], ['Mythic', 'Dragonbone', 'Heavensent']];
export const SALVAGE_IRON = [3, 8, 20, 50, 130];
export const SPOIL_PHASES = 192;

export type PotionKind = 'heal' | 'cure' | 'ward';
export const POTIONS: Record<PotionKind, { name: string; herbs: number; price: number; level: number; text: string }> = {
  heal: { name: 'Healing draught', herbs: 3, price: 10, level: 1, text: 'Drunk before leaving: +40 stamina.' },
  cure: { name: 'Cure-all', herbs: 5, price: 15, level: 2, text: 'Halves the healing time of wounds taken on the outing.' },
  ward: { name: 'Ward against wounds', herbs: 10, price: 30, level: 3, text: 'Makes major wounds on the outing four times rarer.' },
};
export const POTION_KINDS = Object.keys(POTIONS) as PotionKind[];
export const MARKET_SIZE = 6;
export const SELL_PRICE: Record<StockKey, number> = { wood: 1, stone: 1, iron: 2, herbs: 2 };
export const POTIONS_PER_ADVENTURER = 2;

// ── The town ─────────────────────────────────────────────────

export type BuildingId = 'hall' | 'tavern' | 'lodge' | 'home' | 'farm' | 'fishery' | 'forestry' | 'quarry' | 'mine' | 'herbs' | 'warehouse' | 'armoury' | 'market' | 'smithy' | 'stillroom' | 'infirmary' | 'chapel' | 'field' | 'library' | 'cartographer' | 'watch' | 'garden' | 'heroes';
export interface BuildingDef {
  id: BuildingId; name: string; icon: IconName; blurb: string;
  /** Cost and time of level 1; each level after costs ×2 and takes ×1.6, unless `grow` says otherwise. */
  base: { gold: number; wood?: number; stone?: number; iron?: number; phases: number };
  /** Hall level needed before it can be built. */
  hall: number;
  workers: number;
  /** Effect by level (5 levels, or 10 for Housing and Farms); what it means is in `unit`. */
  values: number[];
  unit: string;
  /** Always buildable, however full the town is. */
  free?: boolean;
  /** Can't be pulled down. */
  permanent?: boolean;
  /** How cost and build time grow per level (default ×2 and ×1.6). */
  grow?: { cost: number; time: number };
  /** Happiness it gives (+) or costs (−), by level. */
  happy?: number[];
  /** Retirees of these classes do twice as well here. */
  staffClass?: ClassId[];
  staffable?: boolean;
}
const B = (d: BuildingDef) => d;
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  hall: B({ id: 'hall', name: 'Guild Hall', icon: 'crown', blurb: 'The heart of the guild. Its level unlocks everything else.', base: { gold: 0, phases: 0 }, hall: 1, workers: 0, values: [], unit: '', permanent: true }),
  tavern: B({ id: 'tavern', name: 'Tavern', icon: 'beer', blurb: 'Where new adventurers turn up.', base: { gold: 80, wood: 30, stone: 10, phases: 12 }, hall: 1, workers: 1, values: [2, 3, 4, 5, 6], unit: 'recruits at a time', happy: [1, 1, 2, 2, 3], staffable: true }),
  lodge: B({ id: 'lodge', name: 'Adventurers’ Lodge', icon: 'users', blurb: 'Beds for the roster.', base: { gold: 120, wood: 40, stone: 20, phases: 12 }, hall: 1, workers: 1, values: [4, 6, 8, 10, 12], unit: 'adventurers on the roster' }),
  home: B({ id: 'home', name: 'Housing', icon: 'home', blurb: 'Houses for the people who keep the guild running, and for retirees. Each level adds a street.', base: { gold: 50, wood: 30, stone: 10, phases: 6 }, hall: 1, workers: 0, values: [10, 18, 28, 38, 52, 66, 84, 102, 122, 144], unit: 'housing', free: true, permanent: true, grow: { cost: 1.5, time: 1.25 } }),
  farm: B({ id: 'farm', name: 'Farms', icon: 'tree', blurb: 'The fields that feed everyone in town. Each level ploughs more of them.', base: { gold: 60, wood: 40, phases: 6 }, hall: 1, workers: 0, values: [12, 22, 36, 50, 68, 88, 112, 138, 168, 200], unit: 'food', free: true, permanent: true, grow: { cost: 1.5, time: 1.25 } }),
  fishery: B({ id: 'fishery', name: 'Fishery', icon: 'fish', blurb: 'A little food from the river; needs only one hand.', base: { gold: 100, wood: 40, stone: 10, phases: 9 }, hall: 2, workers: 1, values: [4, 6, 8, 10, 12], unit: 'food', staffClass: ['ranger'], staffable: true }),
  forestry: B({ id: 'forestry', name: 'Forestry', icon: 'tree', blurb: 'Timber for building.', base: { gold: 100, wood: 20, stone: 20, phases: 9 }, hall: 1, workers: 2, values: [4, 6, 8, 10, 12], unit: 'wood per phase', staffClass: ['ranger'], staffable: true }),
  quarry: B({ id: 'quarry', name: 'Quarry', icon: 'pickaxe', blurb: 'Stone for building. Noisy and unloved.', base: { gold: 120, wood: 50, phases: 9 }, hall: 1, workers: 3, values: [3, 4, 6, 8, 10], unit: 'stone per phase', happy: [-1, -1, -1, -1, -1], staffClass: ['guardian', 'blademaster'], staffable: true }),
  mine: B({ id: 'mine', name: 'Mine', icon: 'hammer', blurb: 'Iron for smiths and master builders.', base: { gold: 200, wood: 60, stone: 60, phases: 12 }, hall: 2, workers: 3, values: [2, 3, 4, 5, 6], unit: 'iron per phase', happy: [-1, -1, -1, -1, -1], staffClass: ['guardian', 'blademaster'], staffable: true }),
  herbs: B({ id: 'herbs', name: 'Herb Garden', icon: 'flame', blurb: 'Herbs for the Stillroom.', base: { gold: 90, wood: 30, stone: 10, phases: 9 }, hall: 2, workers: 1, values: [2, 3, 4, 5, 6], unit: 'herbs per phase', staffClass: ['cleric', 'arcanist'], staffable: true }),
  warehouse: B({ id: 'warehouse', name: 'Warehouse', icon: 'backpack', blurb: 'Wood, stone, iron and herbs all stop when it is full.', base: { gold: 150, wood: 60, stone: 40, phases: 12 }, hall: 2, workers: 1, values: [200, 750, 1750, 3500, 6000], unit: 'of each material', staffable: true }),
  armoury: B({ id: 'armoury', name: 'Armoury', icon: 'shield', blurb: 'Racks for the guild’s gear.', base: { gold: 150, wood: 40, stone: 60, phases: 12 }, hall: 2, workers: 1, values: [10, 20, 30, 45, 60], unit: 'racks', staffable: true }),
  market: B({ id: 'market', name: 'Merchant House', icon: 'store', blurb: 'Buy gear, and sell what the warehouse can’t hold, up to a weekly limit.', base: { gold: 200, wood: 60, stone: 40, phases: 12 }, hall: 2, workers: 1, values: [100, 200, 350, 550, 800], unit: 'gold of sales a week', staffable: true }),
  smithy: B({ id: 'smithy', name: 'Blacksmith', icon: 'hammer', blurb: 'Forges, reforges and salvages gear.', base: { gold: 250, wood: 60, stone: 80, iron: 10, phases: 15 }, hall: 3, workers: 2, values: [1, 2, 3, 4, 5], unit: 'best grade it can forge', staffClass: ['blademaster', 'guardian'], staffable: true }),
  stillroom: B({ id: 'stillroom', name: 'Stillroom', icon: 'sparkles', blurb: 'Brews potions from herbs.', base: { gold: 200, wood: 50, stone: 40, phases: 12 }, hall: 3, workers: 1, values: [1, 2, 3, 4, 5], unit: 'potion level', staffClass: ['cleric', 'arcanist'], staffable: true }),
  infirmary: B({ id: 'infirmary', name: 'Infirmary', icon: 'heart', blurb: 'Physical wounds and disease mend faster, and major ones can be treated.', base: { gold: 250, wood: 80, stone: 80, iron: 10, phases: 18 }, hall: 2, workers: 1, values: [30, 60, 90, 120, 150], unit: '% faster recovery', staffClass: ['cleric'], staffable: true }),
  chapel: B({ id: 'chapel', name: 'Temple', icon: 'star', blurb: 'A temple of healing: magical wounds mend faster and major ones can be treated.', base: { gold: 250, wood: 80, stone: 80, iron: 10, phases: 18 }, hall: 2, workers: 1, values: [10, 15, 20, 25, 30], unit: '% faster healing of magical wounds', happy: [2, 3, 4, 5, 6], staffClass: ['cleric'], staffable: true }),
  field: B({ id: 'field', name: 'Training Field', icon: 'dumbbell', blurb: 'Adventurers at home train twice as well.', base: { gold: 250, wood: 80, stone: 80, iron: 10, phases: 18 }, hall: 2, workers: 1, values: [2, 3, 4, 5, 6], unit: 'training benches', staffClass: ['guardian', 'blademaster'], staffable: true }),
  library: B({ id: 'library', name: 'Library', icon: 'book-open', blurb: 'Lessons from past expeditions, and a look at what lies ahead.', base: { gold: 300, wood: 80, stone: 80, iron: 10, phases: 18 }, hall: 3, workers: 1, values: [5, 10, 15, 20, 25], unit: '% more XP from outings', staffClass: ['arcanist'], staffable: true }),
  cartographer: B({ id: 'cartographer', name: 'Cartographer', icon: 'map', blurb: 'Opens new regions, each with its own dangers.', base: { gold: 300, wood: 60, stone: 60, phases: 18 }, hall: 3, workers: 1, values: [1, 2, 3, 4, 5], unit: 'regions beyond the Hearthlands', staffClass: ['rogue', 'ranger'], staffable: true }),
  watch: B({ id: 'watch', name: 'Watch House', icon: 'shield', blurb: 'Keeps order, so the board can offer more.', base: { gold: 200, wood: 80, stone: 60, iron: 10, phases: 12 }, hall: 2, workers: 2, values: [5, 8, 12, 16, 20], unit: 'order', staffClass: ['guardian'], staffable: true }),
  garden: B({ id: 'garden', name: 'Garden of Valor', icon: 'flag', blurb: 'A monument for every campaign you finish; each brings a little happiness.', base: { gold: 200, wood: 60, stone: 60, phases: 12 }, hall: 1, workers: 0, values: [5, 10, 15, 20, 25], unit: 'monuments that bring happiness', permanent: true }),
  heroes: B({ id: 'heroes', name: 'Hall of Heroes', icon: 'trophy', blurb: 'Where legends and the fallen are remembered. Their deeds still help the guild.', base: { gold: 200, wood: 60, stone: 60, phases: 12 }, hall: 1, workers: 0, values: [3, 6, 9, 12, 15], unit: '% cap on each legend bonus', permanent: true }),
};
export const BUILDING_IDS = (Object.keys(BUILDINGS) as BuildingId[]).filter((b) => b !== 'hall');
export const MAX_BUILDING_LEVEL = 5;
export const MAX_HALL = 10;
/** The highest level most buildings can reach at this Hall level (Housing and Farms, with ten levels, go one per Hall level). */
export const buildingCap = (hall: number) => Math.ceil(hall / 2);
export const maxLevel = (t: BuildingId) => BUILDINGS[t].values.length;
/** The highest level a building can reach at this Hall level: half the Hall's for five-level buildings, the Hall's own for ten-level ones. */
export const levelCap = (t: BuildingId, hall: number) => Math.min(maxLevel(t), Math.ceil((hall * maxLevel(t)) / MAX_HALL));
/** The Hall level a building needs before it can reach `level`. */
export const hallFor = (t: BuildingId, level: number) => Math.floor(((level - 1) * MAX_HALL) / maxLevel(t)) + 1;
export const workersFor = (b: BuildingDef, level: number) => (b.workers ? b.workers + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0) : 0);

export interface HallStep { gold: number; wood: number; stone: number; iron: number; renown: number; phases: number }
/** Index = the level it takes the Hall to. */
export const HALL_STEPS: (HallStep | null)[] = [null, null,
  { gold: 150, wood: 80, stone: 40, iron: 0, renown: 20, phases: 12 },
  { gold: 700, wood: 200, stone: 150, iron: 20, renown: 120, phases: 36 },
  { gold: 1500, wood: 450, stone: 350, iron: 80, renown: 360, phases: 60 },
  { gold: 4200, wood: 700, stone: 650, iron: 150, renown: 800, phases: 96 },
  { gold: 5000, wood: 1250, stone: 1150, iron: 250, renown: 1500, phases: 140 },
  { gold: 10000, wood: 1700, stone: 1600, iron: 400, renown: 2800, phases: 190 },
  { gold: 15000, wood: 2500, stone: 2400, iron: 600, renown: 4200, phases: 250 },
  { gold: 19500, wood: 3500, stone: 3400, iron: 900, renown: 5800, phases: 320 },
  { gold: 25000, wood: 4800, stone: 4800, iron: 1400, renown: 8000, phases: 380 },
];
export const RANKS = ['Copper', 'Copper', 'Bronze', 'Bronze', 'Iron', 'Iron', 'Silver', 'Silver', 'Gold', 'Adamant'];
export const hallRank = (level: number) => RANKS[level - 1];
/** Hall level needed for each expedition tier. */
export const TIER_HALL = [1, 2, 4, 6, 8];
export const maxTierFor = (hall: number) => TIER_HALL.filter((h) => h <= hall).length;
export const crewsFor = (hall: number) => 1 + (hall >= 3 ? 1 : 0) + (hall >= 6 ? 1 : 0) + (hall >= 9 ? 1 : 0);
/** Expeditions and odysseys out at once. */
export const maxOutFor = (hall: number, outposts: number) => 1 + Math.floor(hall / 2) + outposts;
/** Gold from real life grows with the Hall: ×1.0 at level 1, ×2.35 at level 10. */
export const realGoldMult = (hall: number) => 1 + 0.15 * (hall - 1);
/** What a new guild starts with besides the Hall. Every other building starts at level 0. */
export const STARTING_BUILDINGS: BuildingId[] = ['home', 'farm'];

export const SEASON_COST: Record<number, Partial<Record<BuildingId, number>>> = {
  0: { farm: 0.8, herbs: 0.8 },
  1: { quarry: 0.85, forestry: 0.85, infirmary: 1.15 },
  2: { warehouse: 0.85, home: 0.85, farm: 1.2 },
  3: { mine: 0.8, smithy: 0.8, farm: 1.4, herbs: 1.4 },
};
export const WORK_CREW_BONUS = 0.05;
export const WORK_CREW_MAX = 0.5;
export const PATROL_YIELD = { wood: 1, stone: 1 };
export const WEEK_DAYS = DAYS_PER_WEEK;
export const OUTPOST_SLOTS = 1;

// ── Legacy ───────────────────────────────────────────────────

/** Routine chronicle lines (returns, wounds, broken gear, seasons) are kept this long, then dropped so the save stays small.
 * Everything else (hires, retirements, buildings, legends, births…) is kept for good; eras count only those. */
export const ROUTINE_ENTRIES: ReadonlySet<string> = new Set(['back', 'hurt', 'broke', 'season']);
export const ROUTINE_KEEP_YEARS = 4;

export const COUPLE_SHARED = 6;
export const COUPLE_CHANCE = 0.15;
export const CHILD_CHANCE = 0.2;
export const MAX_CHILDREN = 3;
export const KIN_CHANCE = 0.05;
export const ERA_YEARS = 10;
export const LEGEND_LEVEL = 15;
export const LEGEND_CAP_PER_LEVEL = 3;
export const STONE_LEVEL = 5;
export const STONE_BONUS = 0.005;
export const STONE_MAX = 0.1;
export const STREAK_MILESTONES = { daily: [7, 30, 100], weekly: [4, 12, 40] };
export const LAST_JOB_PENALTY = 2;
/** What each class's legends add to the guild, per legend. */
export const LEGEND_STAT: Record<ClassId, { name: string; text: string }> = {
  paladin: { name: 'valor', text: 'fewer wounds' },
  druid: { name: 'growth', text: 'faster recovery' },
  bard: { name: 'renown', text: 'more gold from outings' },
  guardian: { name: 'safety', text: 'fewer injuries' },
  cleric: { name: 'recovery', text: 'faster recovery' },
  ranger: { name: 'loot', text: 'more materials and herbs' },
  arcanist: { name: 'learning', text: 'more XP from outings' },
  blademaster: { name: 'speed', text: 'shorter expeditions' },
  rogue: { name: 'fortune', text: 'more gold from outings' },
};
export const MONUMENT = { S: { name: 'Plaque', renown: 10 }, M: { name: 'Statue', renown: 20 }, L: { name: 'Obelisk', renown: 40 } };
