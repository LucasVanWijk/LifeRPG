import type { Attr, CharterId, ClassId, LootKind, RaceId, Role, StageKind, Stance, StockKey } from './content';

/** Times are game time: milliseconds since the guild was founded (holiday mode will later take time off it). */
export type GameMs = number;

export type AdvState = 'active' | 'retired' | 'fallen' | 'left';
export type Duty = 'auto' | 'train' | 'rest';

/** What you did in real life while this adventurer carried your banner (shown on their memorial). */
export interface Chapter {
  from?: GameMs;
  quests: number;
  habits: number;
  campaigns: string[];
  /** Main quests and size-L quests, with their titles as they were. */
  notable: { t: string; d: string }[];
}

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
  health: number;
  fatigue: number;
  injury: { text: string; until: number } | null;
  scars: string[];
  purse: number;
  duty: Duty;
  state: AdvState;
  awayOn: string | null;
  endedPhase?: number;
  /** Where they fell. */
  fellAt?: string;
  luckUsed?: boolean;
  outings: number;
  chapter: Chapter;
  /** Deferred: traits are written in a later stage. */
  traitIds: string[];
}

export interface Recruit { adv: Adventurer; leaves: number; fee: number }

export interface StagePlan { kind: StageKind; title: string }

export interface Offer {
  id: string;
  scale: 'odd' | 'expedition';
  name: string;
  kind: LootKind;
  tier: number;
  /** Expeditions last whole phases; odd jobs minutes. */
  phases?: number;
  minutes?: number;
  minParty: number;
  maxParty: number;
  needs: Role[];
  stages: StagePlan[];
  /** Phase at which the offer leaves the board. */
  expires: number;
  /** Odd jobs: XP and pay for a clean job. */
  xp?: number;
  pay?: Loot;
  tutorial?: boolean;
}

export type Outcome = 'clear' | 'strain' | 'fail';
export type Loot = { gold: number } & Partial<Record<StockKey, number>>;

export interface StageResult {
  outcome: Outcome;
  died?: string;
  /** Struck down but saved: by the healer, or by halfling luck. */
  saved?: { id: string; by: 'healer' | 'luck' | 'charter' };
  injured: string[];
  loot: Loot;
}

export interface MemberResult { health: number; fatigue: number; injury?: { text: string; days: number }; scar?: string; died: boolean; xp: number }

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
}

export type EntryKind = 'found' | 'hire' | 'leave' | 'back' | 'fell' | 'hurt' | 'scar' | 'retire' | 'level' | 'champion' | 'notice' | 'year';
/** A structured chronicle line, rendered as text when shown. */
export interface Entry { at: GameMs; k: EntryKind; a?: string; o?: string; t?: string; v?: number }

/** One real-life payment, kept so undo can reverse exactly what was paid. */
export interface LedgerEntry {
  key: string;
  /** The adventurer paid, or null when it was banked for the next Champion. */
  to: string | null;
  xp: number;
  purse: number;
  guild: number;
  attr: Attr;
  /** XP added to the attribute's practice, and attribute points it produced. */
  practice: number;
  points: number;
  kind: 'quest' | 'habit' | 'campaign';
  title: string;
  date: string;
  notable: boolean;
}

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
  gold: number;
  renown: number;
  bankedXp: number;
  stock: Record<StockKey, number>;
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
}
