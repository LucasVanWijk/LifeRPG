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
}
export const RACES: Record<RaceId, Race> = {
  human: { id: 'human', name: 'Human', plural: 'Humans', age: [16, 40], comesOfAge: 16, mods: {}, trait: 'Driven', traitText: '+15% XP from all sources', xpMult: 1.15, injuryMult: 1 },
  dwarf: { id: 'dwarf', name: 'Dwarf', plural: 'Dwarves', age: [30, 70], comesOfAge: 30, mods: { might: 1, spirit: 1, finesse: -1 }, trait: 'Stoneborn', traitText: '−25% chance of injury', xpMult: 1, injuryMult: 0.75 },
  elf: { id: 'elf', name: 'Elf', plural: 'Elves', age: [60, 200], comesOfAge: 60, mods: { finesse: 1, wits: 1, might: -1 }, trait: 'Keen-eyed', traitText: '+1 to scouting checks', xpMult: 1, injuryMult: 1 },
  halfling: { id: 'halfling', name: 'Halfling', plural: 'Halflings', age: [20, 45], comesOfAge: 20, mods: { finesse: 1, spirit: 1, might: -1 }, trait: 'Lucky', traitText: 'Once per career, a death becomes an injury', xpMult: 1, injuryMult: 1 },
};
export const RACE_IDS = Object.keys(RACES) as RaceId[];

export type Role = 'tank' | 'healer' | 'dps' | 'scout';
export const ROLE_NAME: Record<Role, string> = { tank: 'Tank', healer: 'Healer', dps: 'DPS', scout: 'Scout' };
export const ROLES: Role[] = ['tank', 'healer', 'dps', 'scout'];

export type ClassId = 'guardian' | 'cleric' | 'ranger' | 'arcanist' | 'blademaster' | 'rogue';
export interface Cls { id: ClassId; name: string; role: Role; main: Attr; weights: Record<Attr, number>; icon: IconName; blurb: string }
export const CLASSES: Record<ClassId, Cls> = {
  guardian: { id: 'guardian', name: 'Guardian', role: 'tank', main: 'might', weights: { might: 0.45, finesse: 0.1, wits: 0.1, spirit: 0.35 }, icon: 'shield', blurb: 'Holds the line, so the others are hurt less.' },
  cleric: { id: 'cleric', name: 'Cleric', role: 'healer', main: 'spirit', weights: { might: 0.1, finesse: 0.1, wits: 0.3, spirit: 0.5 }, icon: 'heart', blurb: 'Turns deaths into injuries and injuries into bruises.' },
  ranger: { id: 'ranger', name: 'Ranger', role: 'dps', main: 'finesse', weights: { might: 0.15, finesse: 0.5, wits: 0.25, spirit: 0.1 }, icon: 'feather', blurb: 'Bow and blade, best in the open.' },
  arcanist: { id: 'arcanist', name: 'Arcanist', role: 'dps', main: 'wits', weights: { might: 0.1, finesse: 0.1, wits: 0.55, spirit: 0.25 }, icon: 'sparkles', blurb: 'Spells that burn what steel cannot.' },
  blademaster: { id: 'blademaster', name: 'Blademaster', role: 'dps', main: 'might', weights: { might: 0.4, finesse: 0.4, wits: 0.1, spirit: 0.1 }, icon: 'sword', blurb: 'Two blades and no patience.' },
  rogue: { id: 'rogue', name: 'Rogue', role: 'scout', main: 'finesse', weights: { might: 0.05, finesse: 0.5, wits: 0.35, spirit: 0.1 }, icon: 'lock', blurb: 'Traps, locks and the way round.' },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/** Which attribute each kind of real-life work trains. Habits train the class's main attribute. */
export const QUAD_ATTR = { crisis: 'might', main: 'wits', errand: 'finesse', side: 'spirit' } as const satisfies Record<string, Attr>;

// ── Levels and money ─────────────────────────────────────────

export const MAX_LEVEL = 20;
export const xpToNext = (level: number) => 100 * level;
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
  { id: 'hospitaller', name: 'Hospitaller', text: '−20% chance of death; the difference becomes injuries.', icon: 'heart' },
  { id: 'builders', name: 'Builders', text: '−15% construction cost and time, once the town is built.', icon: 'hammer' },
];

// ── Guild limits until the town exists (stage 2 replaces these with buildings) ──

export const ROSTER_LIMIT = 6;
export const MAX_OUT = 2;
export const MAX_TIER = 2;
export const TAVERN_SIZE = 3;
export const TAVERN_REFRESH_DAYS = 4;
export const RECRUIT_STAY_DAYS: [number, number] = [3, 5];
export const NOTICE_FEE = 50;
export const BOARD_SIZE = 4;
export const START_GOLD = 150;
export const START_STOCK = { wood: 50, stone: 30, iron: 0, herbs: 0 };

// ── Life at home ─────────────────────────────────────────────

export const HEALTH_REGEN = 5;
export const FATIGUE_REGEN = 6;
export const REST_MULT = 1.5;
/** XP per phase on the Train duty (half the rate a Training Field gives). */
export const TRAIN_XP = 2;
export const AUTO_REST = { health: 60, fatigue: 40 };

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
export const STANCES: Record<Stance, { name: string; duration: number; fatigue: number; loot: number; death: number; injury: number; turnBackAt: number; text: string }> = {
  cautious: { name: 'Cautious', duration: 0.7, fatigue: 0.5, loot: 0.7, death: 0.4, injury: 0.8, turnBackAt: 1, text: 'Back sooner, half the fatigue, less loot. Turns back at the first failure.' },
  steady: { name: 'Steady', duration: 1, fatigue: 1, loot: 1, death: 1, injury: 1, turnBackAt: 2, text: 'Turns back at the second failure.' },
  bold: { name: 'Bold', duration: 1, fatigue: 1.2, loot: 1.4, death: 2.5, injury: 1.25, turnBackAt: 99, text: '+40% loot and a better shot at the boss chest. Never turns back.' },
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
export const HEALTH_LOSS = { strain: 8, fail: 20 };
export const FATIGUE_GAIN = { clear: 5, strain: 10, fail: 15 };
export const INJURY_CHANCE = { strain: 0.04, fail: 0.15 };
/** Chance per failed stage that the most exposed member is struck down, before stance, health and healer. */
export const DEATH_BASE = 0.06;
/** How much more often each role is the one struck. */
export const EXPOSURE: Record<Role, number> = { tank: 2.5, dps: 1, healer: 0.8, scout: 1 };
export const HEALER_SAVE = { base: 0.45, perRating: 0.01, max: 0.7 };
export const INJURY_HEALER_MULT = 0.6;
export const SCAR_CHANCE = 0.1;
export const INJURY_DAYS: [number, number] = [2, 12];

export type LootKind = 'gold' | 'materials' | 'alchemy';
export const OFFER_KIND: Record<LootKind, { name: string; icon: IconName }> = {
  gold: { name: 'Gold', icon: 'coins' }, materials: { name: 'Materials', icon: 'pickaxe' }, alchemy: { name: 'Alchemy', icon: 'flame' },
};
/** Gold per cleared stage of a gold expedition; other kinds bring a fifth. The boss chest is worth two stages. */
export const STAGE_GOLD = [5, 10, 18, 28, 40];
export const STAGE_MATERIALS = [6, 12, 20, 30, 45];
export const STAGE_HERBS = [3, 6, 10, 15, 22];
export const xpFor = (tier: number) => 10 * tier * tier;
export const BOLD_XP = 1.5;

export const ODD_JOB_MINUTES: [number, number] = [20, 40];
export const ODD_JOBS_ON_BOARD: [number, number] = [2, 3];
export const TUTORIAL_MINUTES = 10;

export type StockKey = 'wood' | 'stone' | 'iron' | 'herbs';
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

export const INJURIES = ['a broken arm', 'cracked ribs', 'a twisted ankle', 'a deep cut', 'a concussion', 'burns', 'a dislocated shoulder', 'a fever'];
export const SCARS: { text: string; attr: Attr }[] = [
  { text: 'Lost an eye', attr: 'finesse' }, { text: 'A limp', attr: 'finesse' }, { text: 'Burned hands', attr: 'might' },
  { text: 'A crooked arm', attr: 'might' }, { text: 'A ringing in one ear', attr: 'wits' }, { text: 'Nightmares', attr: 'spirit' },
];
