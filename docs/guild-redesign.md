# Guild Redesign

Status: design draft, nothing built yet.
Replaces: the single Hero (level, title, skill points) and the idle Expedition game (fishing, mining, smithing, dungeons).
Keeps: the Quest board, Habits, Campaigns, Calendar, Glossary, Drive sync.

Inspiration: *Dungeons & Dynasties* (bretticus82.itch.io), mainly its Cozy Mode: a guild that outlasts its delvers, sworn careers, delve conditions and counters, staff, memorials and a self-writing chronicle. We deliberately leave out its leagues, transfer market, wages, upkeep and hidden stats.

---

## 1. Pillars

1. **The guild is permanent; adventurers are candles.** They level fast, burn bright and die or retire. What lasts is the town, the buildings and the legacy halls.
2. **Real life fuels the game, it never punishes you for it.** Completing real quests levels your Selected adventurer and funds the guild. Being away for weeks costs you growth, never what you've already built. The worst that happens is adventurers retiring.
3. **Gold is progression, never upkeep.** There are no wages, maintenance or gold drains. Gold is spent only on things you choose.
4. **Choices, stakes, stories.** Who to send, how boldly, and with what. The odds are always visible. Every expedition comes back with a written report.
5. **Mobile first.** Sessions run from 2 minutes to an hour. Desktop gets its own layout later, as the current app does.

## 2. Core loop

```
Real life                      Guild                                 Town
─────────                      ─────                                 ────
Complete quest/habit ──► Selected adventurer: XP + 25% gold
                       └► Guild treasury: 75% gold ───────────► Build & upgrade buildings
                                                                 │
Tavern ──► recruits ──► Roster ──► Expedition board ──► Party out (phases pass)
                                                        │
                       Report ◄── gold, items, herbs, wood/stone/iron, renown
                       Injury / death (insurance) / fatigue
                       Aging ──► retirement ──► lives in town, staffs a building ──► passes away ──► memorial
```

## 3. Time

The game clock follows real time and keeps running while the app is closed. Morning, Noon and Evening are labels inside the game; they don't match the real time of day.

| Unit | Length | Real time |
|---|---|---|
| Phase | Morning · Noon · Evening | **1 hour** |
| Day | 3 phases | 3 hours (8 game days per real day) |
| Season | 16 days (Spring, Summer, Autumn, Winter) | 2 days |
| Year | 4 seasons = 64 days | 8 days |
| Career | 5–25 years | about 6 weeks to 6.5 months |

- `PHASE_MS = 3_600_000`. All production, travel, recovery and construction is counted in phases.
- **Catch-up is uncapped.** On opening the app the engine plays every phase since the last tick, in order: expeditions resolve, buildings produce until storage is full, adventurers age and retire. A long absence fills the warehouse and moves careers on, and that's all.
- The header shows `Day 12 · Noon · Summer · Year 3`.

## 4. Adventurers

### 4.1 States

| State | Meaning |
|---|---|
| **Recruit** | Waiting at the Tavern. Hiring costs gold. Recruits who aren't hired leave after a few days. |
| **Active** | On the roster. Can go on expeditions, train, rest, and be Selected. |
| **Selected** | Exactly one Active adventurer. Receives the XP and 25% of the gold from real-life quests, habits and campaigns. You can switch freely and at any time, except to or from someone who is away on an expedition. A Selected adventurer can go on expeditions and can die there; that's intended. |
| **Away** | On an expedition. A sub-state of Active. |
| **Injured** | At home and unable to go out for N days. Recovery is faster with an Infirmary. |
| **Retired** | Career over. Lives in town permanently: uses 1 Housing and 1 Food. Can staff a building. |
| **Fallen** | Died on an expedition. Pays insurance, leaves a Witness Stone, and stays in the chronicle. |
| **Passed** | A retiree who died of old age. Frees their home and gets a memorial. |

If the Selected adventurer dies or retires, real-life XP is **banked** in the Guild Ledger and handed to whoever you Select next. Real effort is never thrown away. Gold that would have gone to them goes 100% to the guild until a new adventurer is Selected.

### 4.2 Races

Race sets the recruit age range, the age at which their prime ends (which drives career length) and one racial trait.

| Race | Recruit age | Prime ends | Lifespan after retiring | Racial trait |
|---|---|---|---|---|
| Human | 16–40 | 45 | 10–20 years | **Driven:** +15% XP from all sources |
| Dwarf | 30–70 | 95 | 20–40 years | **Stoneborn:** −25% injury chance; counters *Cold* |
| Elf | 60–200 | 225 | 40–80 years | **Keen-eyed:** counters *Darkness*; +1 scouting |
| Halfling | 20–45 | 60 | 15–25 years | **Lucky:** once per career, a death roll becomes an injury |

Career length in years = `clamp(primeEnd − ageAtHire + jitter(−2..+2), 5, 25)`. Older recruits come in higher level but retire sooner. Each adventurer gets a fixed retirement year at hiring, shown on their card ("Sworn 7 more years").

### 4.3 Classes and roles

| Role | Classes (start) | What it covers |
|---|---|---|
| Tank | Guardian | Holds the line in combat. Reduces injury to the others. |
| Healer | Cleric | Turns deaths into injuries and injuries into fatigue. |
| DPS | Ranger, Arcanist, Blademaster | Clears combat stages and bosses. Each counters different conditions. |
| Scout | Rogue | Traps, locks and hazards. Finds bonus loot. Spots retreats early. |

Class counters (stage 3): Ranger: *Open ground*, *Beasts*. Arcanist: *Cursed*, *Undead*. Blademaster: *Narrow*, *Swarm*. Rogue: *Traps*, *Locked*. Guardian: *Ambush*. Cleric: *Plague*, *Undead*.

### 4.4 Numbers on an adventurer

Kept small on purpose:

- **Level** 1–20. `xpToNext(L) = 100 × L` (level 20 is reached at 19,000 XP).
- **Four attributes:** Might, Finesse, Wits, Spirit (1–20). Each class weights them into a **Role score**, plus level and gear.
- **Health** (0–100): drops on failed stages and recovers at home each phase. Low Health raises the death chance.
- **Fatigue** (0–100): rises during expeditions and recovers at home. Above 70 gives a penalty to every check.
- **Purse:** their own gold (see 4.5).
- **Gear:** a weapon, armour, a trinket and up to 2 potions.
- **Retire year**, **age**, **race**, **class**, the **expeditions** they've been on, **notable deeds** (lines for the chronicle).

Deferred: traits, convictions, vows, flaws, backstories, bonds between adventurers, morale. The data model leaves room for them (`traitIds: string[]`, `stakes?`).

### 4.5 Gold for adventurers

- **Real life:** quest, habit and campaign gold is split **25% to the Selected adventurer's purse and 75% to the guild**. XP goes 100% to the Selected adventurer.
- **Expeditions:** loot gold is split the same way, with the 25% divided equally among the party.
- **Spending the purse (automatic):** before each expedition, adventurers buy their own upgrades and potions from the Merchant House or Blacksmith, if those are better than what they carry and they can afford them. You can override this per adventurer.
- **On retirement:** the remaining purse goes to the guild as a **pension**, paying for the food and shelter they'll have for the rest of their life.
- **On death:** the purse goes to the guild, plus **insurance**: `25 + 15 × level` gold.

## 5. Real-life link

| Real action | Effect |
|---|---|
| Complete a quest | `reward(q)` as today: XP to Selected, gold split 25/75 |
| Check in a habit | `habitReward(h)` as today, split the same way |
| Complete a campaign | Campaign XP and gold, split the same way |
| Undo any of these | Taken back from whoever received it: stored on the reward as `recipientId`. Their purse stops at 0. If they're gone, it's taken from the guild treasury, stopping at 0. Levels are never lost. |

The current numbers stay: quests pay 20–105 XP and gold = XP / 3. Doing about 5 real quests a day gives the Selected adventurer about 250 XP and the guild about 60 gold per real day, before expedition income.

Removed: Hero XP, level, title and skill points. The Hero record shrinks to a profile: `name`, `portrait`, `reviewedWeek`.

## 6. Expeditions

### 6.1 The board

Each game day the Expedition board offers 4–6 expeditions (more as the Guild Hall levels up). Each has:

- **Name and region.** Regions are unlocked by the Cartographer.
- **Kind**, which sets the main reward: *Gold*, *Items* (gear), *Alchemy* (herbs and reagents), *Materials* (wood, stone, iron).
- **Tier** 1–5: danger and reward scale.
- **Duration** in phases: Tier 1 is 2–4 phases, Tier 5 is 12–24 phases. This includes travel there and back.
- **Party size:** minimum and maximum, 1–6.
- **Required roles:** harder expeditions need a full party, for example "needs Tank + Healer".
- **Conditions:** 0–3 of *Darkness, Flooded, Cold, Cursed, Undead, Beasts, Swarm, Narrow, Open ground, Traps, Locked, Ambush, Plague*. Each condition adds a penalty unless someone in the party counters it, through class, race or gear.
- **Expires in** N days.

Concurrent expeditions = `1 + Guild Hall level`.

### 6.2 Sending

1. Pick the party. Checks for required roles and size are shown inline.
2. Pick the **stance**:
   - **Cautious:** retreats at the first bad stage, −30% loot, about ×0.4 death risk.
   - **Steady:** the default.
   - **Bold:** pushes through, +40% loot and a bonus chance at the boss chest, about ×2.5 death risk.
3. The **odds panel** (visible odds) shows:
   - full-success chance and the expected loot range
   - injury and death chance **per adventurer**, for this expedition
   - a career outlook: "At this pace, about 1 in N don't make it to retirement"
4. Confirm. Gear and potions are bought from purses, the party leaves, and the timer starts.

The odds come from a Monte Carlo run of the same resolver: 500 seeded simulations, computed when the party or stance changes. It's pure TypeScript and fast enough on a phone.

### 6.3 Resolution

An expedition is a list of **stages**, generated from its tier and conditions: 3 at tier 1, up to 7 at tier 5, the last usually a boss or vault.

| Stage kind | Check uses |
|---|---|
| Combat | Tank + DPS role scores, Healer softens the result |
| Hazard | Scout + condition counters |
| Trap / Lock | Scout |
| Endurance | Everyone's Fatigue and Health |
| Boss | Combat at +2 difficulty; the treasure roll on success |
| Rest | Recover a little; a chance at a small event (deferred) |

Each stage: `roll d20 + partyScore(stage) − difficulty(tier, conditions not countered)` gives:

- **Clear** (≥ 10): loot for the stage, small fatigue.
- **Strain** (5–9): loot, more fatigue, a chance of injury.
- **Fail** (< 5): no loot, Health loss, a chance of injury, and a death roll for the most exposed member. The Tank takes the hit first if there is one. The Healer converts the outcome one step down. On Cautious, the party retreats.

The death roll is scaled by stance, Health, Chapel blessing, potions and Halfling luck. The resolver is seeded (the same `rng` pattern as today's engine), so catch-up and tests can be repeated.

**Lifetime death targets** (validated by a balance test that simulates whole careers):

- Careful play (Cautious or Steady, matching tiers, healer brought along): **about 20%** of adventurers die before retiring. That's roughly 0.3–0.5% per expedition.
- Reckless play (Bold, tiers above the party, no healer): **up to about 75%**.

### 6.4 Return

- Loot goes in: gold split 25/75, items to the Armoury, herbs and materials to the Warehouse (up to storage limits; overflow is sold at half value automatically).
- **XP** per member: `20 × tier × stagesCleared / stages`, ×1.5 on Bold.
- **Renown** for the guild: `tier × 2` on a full clear. Renown never decreases.
- **The report** lands in the Chronicle: one line per stage, written from templates ("Rosco drove the Worg back while Saral kept Tobin standing."). Deaths and injuries are listed first.

### 6.5 Between expeditions

At home, each phase: Health +5 (+8 with an Infirmary), Fatigue −6. Injuries count down in days. The **Training Field** gives idle Active adventurers passive XP each phase.

## 7. The town

### 7.1 Two kinds of resources

**Stock resources** are gained and spent, held in the Warehouse up to its limits:

| Resource | From | Spent on |
|---|---|---|
| Gold | Real-life quests (75%), expeditions, selling | Building, hiring, buying gear |
| Wood | Forestry, Materials expeditions | Building |
| Stone | Quarry, Materials expeditions | Building |
| Iron | Mine, Materials expeditions | Building, Blacksmith gear |
| Herbs | Herb garden, Alchemy expeditions | Potions at the Stillroom |

**Capacity resources** are supply against demand. They're never spent and never decay. You can only build something if every capacity stays at supply ≥ demand afterwards:

| Capacity | Supplied by | Demanded by |
|---|---|---|
| **Food** | Farms (+6 each), Fishery | 1 per person, adventurer and retiree |
| **People** (housing / workers) | Homes (+4 each) | Workers each building needs, and 1 per retiree |
| **Happiness** | Tavern, Chapel, Gardens | Industrial buildings (Quarry −1, Mine −1). A surplus improves recruit quality at the Tavern. |
| **Order** | Watch House | 1 per 10 people. A surplus unlocks higher expedition tiers and more expedition board slots. |

Adventurers live in the **Adventurers' Lodge**, which sets the roster limit, and don't use People. They do use Food.

Since capacity never decays and seasons don't change it (see 7.4), there's no shortage that can hurt you while you're away.

### 7.2 Buildings

Each building has levels 1–3. Building one costs gold + materials + time, uses one **build crew** (you start with 1; Guild Hall levels 2 and 4 add one each), and needs its workers.

| Building | Effect | Workers |
|---|---|---|
| **Guild Hall** | Core building. Its level gates building tiers, concurrent expeditions and board size. Needs renown to upgrade. | 0 |
| **Tavern** | Recruits appear (2/4/6 at a time, refreshed every 4 days). +1 Happiness. | 1 |
| **Adventurers' Lodge** | Roster limit 4 / 8 / 12. | 1 |
| **Home** | +4 People. Can be built many times. | 0 |
| **Farm** | +6 Food. Can be built many times. | 2 |
| **Fishery** | +4 Food, no season penalty. | 1 |
| **Forestry** | +4 Wood per phase (12 per day). | 2 |
| **Quarry** | +3 Stone per phase. −1 Happiness. | 3 |
| **Mine** | +2 Iron per phase. −1 Happiness. | 3 |
| **Herb Garden** | +2 Herbs per phase. | 1 |
| **Warehouse** | Storage limits for stock resources (start 200, +300 per level). | 1 |
| **Merchant House** | Buy and sell gear, sell surplus materials. Stock rotates each season. | 1 |
| **Blacksmith** | Forges gear from iron, and better gear at higher levels. | 2 |
| **Stillroom** | Brews potions from herbs (heal, cure, ward against death). | 1 |
| **Infirmary** | Faster recovery from injuries and Health loss. | 1 |
| **Chapel** | +2 Happiness. A blessing lowers expedition death chance by 15/25/35%. | 1 |
| **Training Field** | Passive XP for idle Active adventurers. | 1 |
| **Library** | +10/20/30% XP from expeditions. Reveals hidden conditions on the board. | 1 |
| **Cartographer** | Unlocks new regions, each with its own expeditions and conditions. | 1 |
| **Watch House** | +5 Order. | 2 |
| **Hall of Heroes** | Plaques for legends and the fallen, each giving a small permanent bonus (see 8). | 0 |
| **Gardens** | +2 Happiness. | 1 |

**Staff slots:** most buildings from level 2 have 1 slot (2 at level 3) for a **named retiree**. The bonus depends on the retiree's class and level, with a stronger effect when the class matches: a Cleric in the Infirmary or Chapel, a Guardian or Blademaster at the Training Field, a Rogue with the Cartographer, an Arcanist in the Library or Stillroom, a Ranger at the Forestry or Fishery. Example: Training Field XP +`2 × level`%, doubled when the class matches.

### 7.3 Starting town and first costs (to tune)

You start with a Guild Hall (level 1), a Tavern (level 1), an Adventurers' Lodge (level 1), 2 Homes, 2 Farms, 150 gold, 50 wood and 30 stone.

| Build | Gold | Wood | Stone | Iron | Time |
|---|---|---|---|---|---|
| Home | 60 | 30 | 10 | – | 6 phases |
| Farm | 80 | 40 | – | – | 6 phases |
| Forestry | 100 | 20 | 20 | – | 9 phases |
| Quarry | 120 | 50 | – | – | 9 phases |
| Mine | 200 | 60 | 60 | – | 12 phases |
| Infirmary / Chapel / Training Field (level 1) | 250 | 80 | 80 | 10 | 18 phases |
| Guild Hall level 2 | 600 | 150 | 150 | 30 | 36 phases, needs 30 renown |

Each level after the first costs about ×2.2 of the one before.

### 7.4 Seasons

Seasons change **building costs only**. They never change production or capacity, so they can't cause a shortage while you're away.

| Season | Cheaper | Dearer |
|---|---|---|
| Spring | Farms, Gardens −20% | – |
| Summer | Quarry, Forestry −15% | Infirmary +15% |
| Autumn | Warehouse, Homes −15% | Farms +20% |
| Winter | Mine, Blacksmith −20% | Farms, Gardens +40% |

The build screen shows "cheaper next season" hints. Later, some expedition conditions can follow the season, such as *Cold* in Winter.

## 8. Legacy

- **Retirement:** "Tobin Quickthorn hangs up the shield after 14 years." They move into a Home, can be assigned to a staff slot, and their purse becomes a pension for the guild.
- **Old age:** retirees pass away peacefully after their race's lifespan (see 4.2). They get a memorial entry and free their Home and staff slot.
- **The fallen:** insurance gold, a **Witness Stone** in the Hall of Heroes, and a chronicle entry with the stage where they fell.
- **Hall of Heroes:** each Legend (retired at level 15 or above, or with 3+ tier-5 clears) gives +1% to one guild stat tied to their class. Each Fallen gives +0.5% of a "never again" bonus, for example lower death chance on that region's expeditions. Both bonuses have caps.
- **Dynasties:** a retiree or fallen adventurer who reached level 10+ has a chance, years later, that a relative turns up at the Tavern with the same surname and +1 star potential ("Pip Quickthorn, Tobin's grandchild").
- **Chronicle:** the existing Chronicle sheet becomes the guild's history, combining real-life entries (quest, habit, campaign, now with the adventurer who earned them) with game entries (expedition reports, hires, deaths, retirements, buildings finished, seasons).

## 9. Being away

- Production runs until storage is full. Overflow is sold at half value.
- Expeditions already out resolve. New ones are **never** sent automatically.
- Adventurers at home recover and train, then age and retire on schedule.
- Recruits come and go at the Tavern.
- Nothing decays: no capacity loss, no gold drain, no buildings falling apart.

After three weeks away (about 168 game days, or 2.6 years) you come back to a full warehouse, a few retirements, new faces at the Tavern and a "While you were away" summary.

## 10. Data model (sketch)

```ts
// Data.version 3: hero → profile, expedition → guild
interface Data {
  version: 3;
  profile: { name: string; portrait?: string; reviewedWeek?: string };
  quests: Quest[]; habits: Habit[]; camps: Record<string, Campaign>;
  companions: Companion[]; tomes: Tome[]; codex: CodexEntry[]; events: CalEvent[];
  guild: Guild;
}

interface Guild {
  founded: number;            // epoch ms of phase 0
  lastTick: number;           // epoch ms, last phase processed
  seed: number;
  gold: number; renown: number;
  stock: Record<StockKey, number>;          // wood, stone, iron, herbs
  buildings: Building[];
  construction: Construction[];             // one per crew
  adventurers: Adventurer[];                // every state, including retired/fallen/passed
  selectedId: string | null;
  bankedXp: number;                         // real-life XP waiting for the next Selected
  recruits: { adventurer: Adventurer; leavesPhase: number; fee: number }[];
  board: ExpeditionOffer[];
  expeditions: ExpeditionRun[];             // out now
  armoury: Item[];
  chronicle: GuildEntry[];
}

type AdvState = 'active' | 'retired' | 'fallen' | 'passed';
interface Adventurer {
  id: string; name: string; race: RaceId; cls: ClassId;
  bornPhase: number; retirePhase: number; passPhase?: number;
  level: number; xp: number;
  attrs: { might: number; finesse: number; wits: number; spirit: number };
  health: number; fatigue: number; injuredUntil?: number;
  purse: number; gear: { weapon?: string; armour?: string; trinket?: string; potions: string[] };
  autoBuy: boolean; luckUsed?: boolean;
  state: AdvState; awayOn?: string; staffAt?: string;
  expeditions: number; deeds: string[];
  traitIds: string[];                       // deferred, empty for now
  lineage?: string;                         // the ancestor's id, for dynasties
}

interface ExpeditionOffer {
  id: string; name: string; region: RegionId; kind: 'gold' | 'items' | 'alchemy' | 'materials';
  tier: 1 | 2 | 3 | 4 | 5; phases: number; minParty: number; maxParty: number;
  needs: Role[]; conditions: ConditionId[]; stages: Stage[]; expiresPhase: number;
}
interface ExpeditionRun { offerId: string; party: string[]; stance: 'cautious' | 'steady' | 'bold'; leftPhase: number; returnPhase: number; seed: number }
```

Rewards from real life store `recipientId` so undo knows whom to charge.

## 11. Engine

- `domain/guild/` replaces `domain/expedition/`. The pattern stays the same: pure functions over plain data, seeded dice, unit tests.
- `advance(guild, now)` steps **phase by phase** from `lastTick`: construction, production (up to the cap), recovery and training, expedition returns (resolved with the seed stored on the run), aging, retirement and passing, Tavern refresh, board refresh. It returns the new state and a summary for "While you were away".
- `resolve(run, party, rng)` is the expedition resolver, shared by real runs and the Monte Carlo odds preview.
- `content.ts` holds every number (races, classes, buildings, costs, stage tables, conditions), so balancing means editing one file.
- **Balance tests** simulate full careers under a careful policy and a reckless policy and assert the death share falls in about 15–25% and 60–80% respectively. They also check that a fresh town can afford its first Forestry within the first real day of normal real-life play.
- **Migration v2 → v3:** drop `hero.xp/level/next/gold/points` and `expedition`, and keep the profile fields. Gold doesn't carry over. Start a new guild with 3 free starting recruits, one of each role except Scout, and pick one as Selected.

## 12. Mobile UI

The bottom tab **Adventure** becomes **Guild**, with a top segmented control:

1. **Town:** a header with the clock and gold, then stock and capacity bars (supply against demand), building cards (level, workers, staff slot, Upgrade with its cost in the current season) and construction progress.
2. **Roster:** cards for Selected, Active, Away and Injured adventurers (a star marks the Selected one, and tapping a card selects them), plus a Retired section with staff assignments. Tapping opens an adventurer sheet with stats, gear, purse, career bar ("Sworn 7 more years") and deeds.
3. **Expeditions:** the board, then the party picker, stance and odds panel, then Send. Parties that are out show countdowns. Returned reports are unread until opened.
4. **Tavern:** recruits to hire.
5. **Legacy:** Hall of Heroes (legends, fallen, passed) and the guild Chronicle.

Home screen: a small card with the Selected adventurer's portrait, level bar and "next back: Rosco's party in 2 phases". The quest-complete toast reads: `+40 XP to Tobin · +10g purse · +30g guild`.

## 13. Build stages

1. **Guild core.** Time engine (phases, catch-up), races and classes (data only), Tavern and hiring, roster, Selected with the 25/75 split, banked XP and undo, a simple expedition board with the resolver, stance, odds and report, injury, death and insurance, aging and retirement, migration v3, removal of the old Expedition and Hero. Delivered as a Guild tab with Roster, Expeditions and Tavern.
2. **Town.** Stock and capacity resources, buildings and construction with crews, Warehouse limits, production, seasons changing costs, the Town tab.
3. **Depth.** Conditions and counters, gear (Merchant House, Blacksmith, armoury), purse auto-buy, Stillroom potions, Infirmary, Chapel, Training Field, Library.
4. **Legacy.** Staff slots for retirees, old-age passing, Hall of Heroes bonuses, dynasties, Cartographer regions, the guild Chronicle and "While you were away".
5. **Later.** Traits, convictions and vows, backstories, bonds and synergies, random events, seasonal conditions, the desktop layout.

## 14. Deferred decisions

- Exact text for traits, backstories and events.
- Final balance numbers; everything in sections 6–7 is a starting point for the balance tests.
- Art: town illustration and adventurer portraits, drawn in code like the current SVG icons.
- Whether a guild crest or name is chosen at founding (yes, probably, at the same point as the existing welcome screen).
