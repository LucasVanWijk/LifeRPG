import type { Vow } from './vows';
import type { Attr, BuildingId, CharterId, ClassId, ConditionId, LootKind, PotionKind, RaceId, RegionId, Role, Slot, StageKind, Stance, StockKey } from './content';

/** Times are game time: milliseconds since the guild was founded (holiday mode takes its time off the clock). */
export type GameMs = number;

export type AdvState = 'active' | 'retired' | 'fallen' | 'left' | 'passed' | 'child';
export type Duty = 'auto' | 'train' | 'rest' | 'labour' | 'patrol';

/** What you did in real life while this adventurer carried your banner (shown on their memorial). */
export interface Chapter {
  from?: GameMs;
  quests: number;
  habits: number;
  campaigns: string[];
  /** Main quests and size-L quests, with their titles as they were. */
  notable: { t: string; d: string }[];
}

/** A piece of gear. Grades 0–4 are Common to Legendary; heirlooms never wear. */
export interface Item {
  id: string;
  name: string;
  slot: Slot;
  grade: number;
  /** Outings left before it breaks. */
  wear: number;
  /** 'guild' for the armoury's gear, or the adventurer who bought it. */
  owner: string;
  locked?: boolean;
  counters?: ConditionId;
  heirloom?: boolean;
  /** Who it came from, for heirlooms. */
  from?: string;
  /** What it is for, for heirlooms from habits. */
  note?: string;
}
export type ItemDraft = Omit<Item, 'id' | 'owner'>;

export interface Potion { id: string; kind: PotionKind; made: number }

export interface Adventurer {
  id: string;
  first: string;
  family: string;
  race: RaceId;
  cls: ClassId;
  bornPhase: number;
  joinedPhase: number;
  /** Years of service sworn when hired. */
  career: number;
  retirePhase: number;
  level: number;
  /** XP into the current level. */
  xp: number;
  talent: number;
  attrs: Record<Attr, number>;
  /** Real-life XP towards the next point in each attribute. */
  practice: Record<Attr, number>;
  /** Energy right now (0–100): outings drain it, rest restores it. It sets how well they perform, and wounds lower the most it can reach. */
  stamina: number;
  /** Weariness of the work, 0–100: it builds with outings and age, mends slowly, and never drops below what the years have taken. */
  fatigue: number;
  /** What is hurting them. */
  wounds: Wound[];
  /** Only on saves from before wounds: becomes a minor wound when the guild loads. */
  injury?: { text: string; until: number } | null;
  scars: string[];
  purse: number;
  duty: Duty;
  state: AdvState;
  awayOn: string | null;
  endedPhase?: number;
  /** Where they fell. */
  fellAt?: string;
  fellRegion?: RegionId;
  luckUsed?: boolean;
  outings: number;
  chapter: Chapter;
  traitIds: string[];
  /** A few sentences of where they came from. */
  backstory?: string;
  /** What they believe, and the one thing they mean to do. */
  conviction?: string;
  vow?: Vow;
  gear: Partial<Record<Slot, Item>>;
  autoBuy: boolean;
  /** Retirees: the building they work in. */
  staffAt: string | null;
  /** Retirees: when they pass away. */
  passPhase?: number;
  /** Retirees: their One Last Job has been used. */
  recalled?: boolean;
  /** Out on their One Last Job. */
  lastJob?: boolean;
  partnerId?: string | null;
  parentIds?: string[];
  childIds?: string[];
  /** Outings together, by adventurer id. */
  shared: Record<string, number>;
  /** Their gear, lost where they fell until a recovery brings it home. */
  lostGear?: Item[];
  tomb?: boolean;
  clears5: number;
  liberated: number;
  /** Children: when they come of age. */
  adultPhase?: number;
  /** A relative has already turned up at the Tavern because of them. */
  kinSent?: boolean;
}

export interface Recruit { adv: Adventurer; leaves: number; fee: number }

export interface StagePlan { kind: StageKind; title: string }

export interface Offer {
  id: string;
  scale: 'odd' | 'expedition' | 'odyssey';
  name: string;
  kind: LootKind;
  tier: number;
  region: RegionId;
  /** Expeditions last whole phases; odd jobs minutes. */
  phases?: number;
  minutes?: number;
  minParty: number;
  maxParty: number;
  needs: Role[];
  conditions: { id: ConditionId; hidden: boolean }[];
  stages: StagePlan[];
  /** Phase at which the offer leaves the board. */
  expires: number;
  /** Odd jobs: XP and pay for a clean job. */
  xp?: number;
  pay?: Loot;
  tutorial?: boolean;
  /** Recovery expeditions: the fallen adventurer they are bringing home. */
  recover?: string;
}

export type WoundSource = 'physical' | 'disease' | 'magical';
export type Severity = 'trivial' | 'minor' | 'major';
/** A wound heals by `left` phases of rest at the normal pace; recovery bonuses and rest make it go faster. */
export interface Wound { id: string; source: WoundSource; severity: Severity; text: string; left: number; total: number; treated?: boolean }
/** A wound as it is handed out at the end of an outing. */
export interface NewWound { source: WoundSource; severity: Severity; text: string; phases: number }

export type Outcome = 'clear' | 'strain' | 'fail';
export type Loot = { gold: number; items?: ItemDraft[] } & Partial<Record<StockKey, number>>;

export interface StageResult {
  outcome: Outcome;
  died?: string;
  /** Struck down but saved (outings before wounds only). */
  saved?: { id: string; by: 'healer' | 'luck' | 'charter' | 'ward' };
  injured: string[];
  /** Who was wounded at this stage, how badly and by what. */
  hurt?: { id: string; severity: Severity; source: WoundSource }[];
  loot: Loot;
}

export interface MemberResult { stamina: number; fatigue: number; wounds?: NewWound[]; /** Outings before wounds. */ health?: number; injury?: { text: string; days: number }; scar?: string; died: boolean; xp: number }

export interface OutingResult {
  stages: StageResult[];
  turnedBack: boolean;
  chest: Loot | null;
  loot: Loot;
  members: Record<string, MemberResult>;
}

export interface Outing {
  id: string;
  offer: Offer;
  party: string[];
  stance: Stance;
  departAt: GameMs;
  /** When each stage that was played ends; shorter than the offer's stages if they turned back. */
  stageAt: GameMs[];
  returnAt: GameMs;
  result: OutingResult;
  /** Deaths applied so far (they happen at their stage's time). */
  applied: number;
  done: boolean;
  read: boolean;
  /** Potions each member drank before leaving. */
  potions: Record<string, PotionKind[]>;
  /** Which phase of the day they left in (0–2). */
  phase: number;
  /** Renown it earned, once back. */
  renown?: number;
}

export type EntryKind =
  | 'found' | 'hire' | 'leave' | 'back' | 'fell' | 'hurt' | 'scar' | 'retire' | 'level' | 'champion' | 'notice' | 'year'
  | 'built' | 'upgraded' | 'hall' | 'demolish' | 'broke' | 'forged' | 'pair' | 'birth' | 'adult' | 'pass' | 'kin' | 'era' | 'liberated'
  | 'monument' | 'heirloom' | 'tomb' | 'legend' | 'region' | 'season' | 'vowkept' | 'vowbroken';
/** A structured chronicle line, rendered as text when shown. */
export interface Entry { at: GameMs; k: EntryKind; a?: string; o?: string; t?: string; v?: number; b?: string }

/** One real-life payment, kept so undo can reverse exactly what was paid. */
export interface LedgerEntry {
  key: string;
  at: GameMs;
  /** The adventurer paid, or null when it was banked for the next Champion. */
  to: string | null;
  xp: number;
  purse: number;
  guild: number;
  attr: Attr;
  /** XP added to the attribute's practice, and attribute points it produced. */
  practice: number;
  points: number;
  renown: number;
  kind: 'quest' | 'habit' | 'campaign';
  title: string;
  date: string;
  notable: boolean;
}

/** One of each type, on its own spot on the map (see plots.ts). */
export interface Building { id: string; type: BuildingId; level: number }
export interface Construction { id: string; type: BuildingId; /** The building being upgraded, or null for a new one. */ target: string | null; level: number; left: number; total: number; }

export interface Monument { id: string; camp: string; name: string; seal: string; icon: string; size: 'S' | 'M' | 'L'; date: string; bearer: string | null; at: GameMs }
export interface Era { n: number; name: string; hero: string | null; from: number; to: number; joined: number; fell: number; retired: number; built: number; quests: number; habits: number }

export interface Guild {
  name: string;
  town: string;
  charter: CharterId;
  crestSeed: number;
  seed: number;
  /** Epoch ms of game time 0. */
  founded: number;
  /** Game time processed up to. */
  t: GameMs;
  /** Holiday mode: since when the clock has been stopped (epoch ms). */
  holiday: number | null;
  gold: number;
  renown: number;
  bankedXp: number;
  stock: Record<StockKey, number>;
  buildings: Building[];
  construction: Construction[];
  adventurers: Adventurer[];
  championId: string | null;
  recruits: Recruit[];
  notice: { cls: ClassId } | null;
  nextTavernDay: number;
  board: Offer[];
  outings: Outing[];
  chronicle: Entry[];
  ledger: LedgerEntry[];
  tutorialDone: boolean;
  counter: number;
  armoury: Item[];
  heirlooms: Item[];
  potions: Potion[];
  market: { season: number; stock: (Item & { price: number })[] };
  sold: { week: number; gold: number };
  regions: Record<RegionId, { liberated: boolean; stones: number }>;
  monuments: Monument[];
  eras: Era[];
  /** Habit milestones already rewarded with an heirloom, by habit id. */
  streaks: Record<string, number[]>;
  /** Most gold brought home by one outing, for the records. */
  bestHaul: { gold: number; name: string };
  /** The last day's visitors, and what they have paid in all. */
  visitors?: import('./visitors').VisitDay;
  visitorTotals?: { people: number; gold: number };
  /** Which town layout the save is on (3: one of every building, Housing and Farms included). */
  layout?: number;
  /** The size of a point of renown the save counts in (see RENOWN_UNIT); older saves are 1. */
  renownUnit?: number;
}
