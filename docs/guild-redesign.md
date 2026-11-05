# Guild Redesign

Status: design draft, revision 2. **Stage 1 (guild core) is built**; see section 15 for what stands in for the town until stage 2.
Replaces: the single Hero (level, title, skill points) and the idle Expedition game (fishing, mining, smithing, dungeons).
Keeps: the Quest board, Habits, Campaigns, Weekly review, Calendar, Glossary, Drive sync.

Inspiration: *Dungeons & Dynasties* (bretticus82.itch.io), mainly its Cozy Mode: a guild that outlasts its delvers, sworn careers, delve conditions and counters, staff, memorials and a self-writing chronicle. We deliberately leave out its leagues, transfer market, wages, upkeep and hidden stats.

---

## 1. Pillars

1. **The guild is permanent; adventurers are candles.** They level fast, burn bright and die or retire within weeks to months. What lasts is the town, the Garden of Valor and the Hall of Heroes.
2. **Real life fuels the game, it never punishes you for it.** Completing real quests levels your Champion and funds the guild. Being away costs you growth, never what you've already built. The worst that happens is adventurers retiring.
3. **Gold is progression, never upkeep.** There are no wages, maintenance or gold drains. Gold is spent only on things you choose.
4. **Choices, stakes, stories.** Who to send, where, how boldly, and with what. The odds are always visible and exact. Every expedition comes back with a written report.
5. **Each adventurer is a chapter of your life.** Their memorial remembers what *you* did in real life while they carried your banner.
6. **Mobile first.** Sessions run from 2 minutes to an hour. Desktop gets its own layout later, as the current app does.

## 2. Core loop

```
Real life                        Guild                                      Town
─────────                        ─────                                      ────
Quest / habit / campaign ──► Champion (or the campaign's Standard-bearer): XP, attributes, 25% gold
                           └► Guild treasury: 75% gold × Guild Hall bonus ──► Build & upgrade (5 levels; Guild Hall 10)
Campaign complete ─────────► Monument in the Garden of Valor
Habit streak milestone ────► Heirloom trinket

Tavern ──► recruits ──► Roster ──► Odd Jobs · Expeditions · Odysseys ──► Report
                                   │
                         gold, items, herbs, wood/stone/iron, renown, region liberation
                         injury / scars / death (insurance) / wear on gear
                         aging ──► retirement ──► lives in town, staffs a building, may pair up and raise children
                                                 ──► passes away ──► memorial with their life chapter
```

## 3. Time

The game clock follows real time and keeps running while the app is closed. Morning, Noon and Evening are labels inside the game; they don't match the real time of day.

| Unit | Length | Real time |
|---|---|---|
| Phase | Morning · Noon · Evening | **1 hour** |
| Day | 3 phases | 3 hours (8 game days per real day) |
| Week | 8 days | 1 day |
| Season | 2 weeks = 16 days (Spring, Summer, Autumn, Winter) | 2 days |
| Year | 4 seasons = 64 days | 8 days |
| Career | **3–15 years** | 24–120 days (about 3.5 weeks to 4 months) |
| Era | 10 years | 80 days |

- `PHASE_MS = 3_600_000`. Production, recovery, construction and duties tick once per phase. Expedition stages, returns and odd jobs happen at exact timestamps (see 13).
- **Catch-up is uncapped.** On opening the app the engine plays everything since the last tick, in time order.
- **Holiday mode:** pause guild time whenever you like. Nothing advances, expeditions out included. Real-life rewards still credit the Champion.
- The header shows `Day 12 · Noon · Summer · Year 3`.

### 3.1 Phases have a light effect

The phase when a party sets out:

| Phase | Effect |
|---|---|
| Morning | −10% duration |
| Noon | none |
| Evening | +10% loot, and the expedition gains *Darkness* |

The board shows what sending now would mean. Each phase comes round every 3 hours, so this never forces you to be online at a set time. Odd jobs aren't affected.

## 4. Adventurers

### 4.1 States

| State | Meaning |
|---|---|
| **Recruit** | Waiting at the Tavern, with a hiring fee. Recruits who aren't hired leave after 3–5 days. |
| **Active** | On the roster. Can go out, take a duty at home (4.7), be Champion or a Standard-bearer. |
| **Champion** | Exactly one Active adventurer. Receives the XP, attribute growth and 25% of the gold from real-life quests, habits and campaigns. Switch freely at any time, except to or from someone who is away. The Champion can go out and can die there. |
| **Standard-bearer** | Optional, one per real-life campaign. That campaign's quests and its completion reward go to them instead of the Champion. If they're gone, the Champion receives them. |
| **Away** | Out on an odd job, expedition or odyssey. A sub-state of Active. |
| **Injured** | Home and unable to go out for N days. Faster with an Infirmary. |
| **Retired** | Career over. Lives in town permanently. Can staff a building, pair up, raise children, and be recalled once (4.9). |
| **Fallen** | Died while out. Pays insurance, leaves a Witness Stone, gets a recovery expedition (6.6). |
| **Passed** | A retiree who died of old age. Frees their home and gets a memorial. |

If the Champion dies or retires, real-life XP is **banked** in the Guild Ledger and handed to whoever you make Champion next. Gold that would have gone to them goes 100% to the guild until then. Real effort is never thrown away.

### 4.2 Races

| Race | Recruit age | Comes of age | Lifespan after retiring | Racial trait |
|---|---|---|---|---|
| Human | 16–40 | 16 | 10–20 years | **Driven:** +15% XP from all sources |
| Dwarf | 30–70 | 30 | 20–40 years | **Stoneborn:** −25% injury chance; counters *Cold* |
| Elf | 60–200 | 60 | 40–80 years | **Keen-eyed:** counters *Darkness*; +1 to Scout checks |
| Halfling | 20–45 | 20 | 15–25 years | **Lucky:** once per career, a death becomes an injury |

**Career length** works the same for every race: the youngest recruits serve about 15 years and the oldest about 3.

```
career = clamp(round(3 + 12 × (maxAge − age) / (maxAge − minAge)) + jitter(−1..+1), 3, 15)
```

Older recruits come in at a higher level but retire sooner. The retirement year is fixed when they're hired and shown on their card ("Sworn 7 more years").

Races differ in how long they live **after** retiring. A long-lived Elf staffs a building for a real year or more, but takes up a home for as long. Their children also come of age much later.

### 4.3 Classes and roles

| Role | Classes (start) | What it covers | Counters |
|---|---|---|---|
| Tank | Guardian | Holds the line in combat. Reduces injury to the others. | Ambush |
| Healer | Cleric | Turns deaths into injuries and injuries into fatigue. | Plague, Undead |
| DPS | Ranger | Ranged combat | Open ground, Beasts |
| DPS | Arcanist | Magic | Cursed, Undead |
| DPS | Blademaster | Melee | Narrow, Swarm |
| Scout | Rogue | Traps, locks and hazards. Finds bonus loot. | Traps, Locked |

Later classes that cover two roles: Paladin (Tank + Healer), Druid (Healer + DPS), Bard (support).

### 4.4 Numbers on an adventurer

- **Level** 1–20. `xpToNext(L) = 100 × L`, so level 20 is reached at 19,000 XP.
- **Talent** ★1–5, visible. Each level-up gives `1 + floor(talent / 2)` attribute points, spread by class weights.
- **Four attributes:** Might, Finesse, Wits, Spirit (1–20). Each class weights them into a **Role score**, plus level and gear.
- **Health** (0–100) and **Fatigue** (0–100). They recover at home. Low Health raises death risk. Fatigue above 70 gives a penalty to every check.
- **Purse**, **gear** (weapon, armour, trinket, up to 2 potions), **scars** (4.8), **partner**, **parents**, **children**.
- **Chapter**: what you did in real life while they were Champion or Standard-bearer (section 9.1).
- **Deeds**: chronicle lines.
- Deferred: traits, convictions, vows, flaws, backstories, morale. The data model leaves room for them.

**Which levels suit which tier:** T1 levels 1–4, T2 levels 5–8, T3 levels 9–12, T4 levels 13–16, T5 levels 17–20.

**Hiring fee:** `15 + 10 × level + 15 × (talent − 1)` gold. Children born in town join for free.

### 4.5 Real life shapes who they become

Real-life rewards add **attribute practice** to the Champion or the campaign's Standard-bearer. Every 150 XP from one source adds +1 to its attribute, up to 20.

| Source | Attribute |
|---|---|
| Crisis quests (urgent and important) | Might |
| Main quests (important) | Wits |
| Errands (urgent) | Finesse |
| Side quests | Spirit |
| Habits | The class's main attribute (practising their craft) |

### 4.6 Gold for adventurers

- **Real life:** gold × the Guild Hall bonus (8.3), then split **25% to the Champion's or Standard-bearer's purse and 75% to the guild**. XP goes 100% to the adventurer.
- **Expeditions:** loot gold is split the same way, with the 25% divided equally among the party.
- **Spending the purse (automatic, can be overridden):** before each expedition they buy potions, and better gear if it's affordable and better than what the armoury offers.
- **On retirement:** the remaining purse goes to the guild as a **pension**, paying for the food and shelter they'll have for the rest of their life. Their signature item becomes an **heirloom** (section 10).
- **On death:** the purse goes to the guild, plus **insurance** of `50% of their hiring fee + 5 × level`. This always stays below what a replacement of the same level and talent costs, so letting adventurers die is never profitable.

### 4.7 Duties at home

Every Active adventurer at home has one duty. By default it's Rest when Health is below 60 or Fatigue above 40, and Train otherwise.

| Duty | Effect per phase |
|---|---|
| Train | XP. The Training Field adds benches and a bonus; without one, Train gives half. |
| Rest | ×1.5 recovery |
| Labour | +5% construction speed each (up to +50%) |
| Patrol | Gathers a little wood and stone, and adds +1 offer to the board while anyone patrols. Never gold. |

Injured adventurers always Rest.

### 4.8 Injuries and scars

- Injuries keep an adventurer home for 2–12 days.
- 10% of injuries leave a **lasting scar**, for example "Lost an eye: −1 Finesse" or "Burned hands". A scar lowers one attribute and adds a story tag. This gives adventurers character before traits are written.

### 4.9 Retirees

- They live in town, using 1 Housing and 1 Food.
- **Staff slot:** from building level 2 (1 slot), with a second at level 4. The bonus depends on their class and level, and is stronger when the class matches the building: a Cleric in the Infirmary or Chapel, a Guardian or Blademaster at the Training Field, a Rogue with the Cartographer, an Arcanist in the Library or Stillroom, a Ranger at the Forestry or Fishery. Example: Training Field XP +`2 × level`%, doubled when the class matches.
- **One Last Job:** each retiree can be recalled once, for one expedition or odyssey, with −2 to every attribute. If they die, they count as Fallen, with no insurance.
- **Old age:** they pass away after their race's lifespan and get a memorial.

### 4.10 Couples and children

- Two adventurers who've been out together 6 or more times have about a 15% chance each season to **pair up** (it appears in the news). Not everyone does.
- A couple sent together gets +1 on every check. If one falls, the other carries a story tag.
- A **retired couple** has about a 20% chance per year of a child, up to 3. Children live in town (1 Housing, 1 Food).
- When they **come of age** (by race, 4.2) they arrive at the Tavern for free, with the family name. Their talent is at least their better parent's talent minus 1, with a chance of +1. They can be given a parent's heirloom. A child of mixed race takes one parent's race at random.
- A rare **kin arrives** event covers legends who had no children.

### 4.11 Roles: making sure you can find them

Every Tavern refresh includes at least one Tank or Healer. A **Recruitment notice** (`30 + 10 × Guild Hall level` gold) guarantees a recruit of the class you choose (and race, if you choose one) at the next refresh.

## 5. Real-life link

| Real action | Effect |
|---|---|
| Complete a quest | `reward(q)` as today. XP and attribute practice go to the Champion or Standard-bearer. Gold × the Hall bonus, split 25/75. |
| Check in a habit | `habitReward(h)` as today, the same way |
| Complete a campaign | Campaign XP and gold the same way, plus a **monument** in the Garden of Valor and renown (S 5 · M 10 · L 20) |
| Reach a habit streak of 7 · 30 · 100 (daily) or 4 · 12 · 40 (weekly) | An **heirloom trinket** named after the habit (Rare · Epic · Legendary), once per habit per milestone, never taken away |
| Undo any of these | Taken back from whoever received it (stored as `recipientId`), stopping at 0. If they're gone, it's taken from the guild treasury. Levels, attributes and heirlooms are never lost. |

At the current quest values (20–105 XP, gold = XP / 3), about 5 real quests a day give the Champion about 250 XP and the guild about 55 gold before the Hall bonus. The Champion can reach level 20 in about 2.5 months of real life alone. That's well within a long career, which is the point of being Champion.

Removed: Hero XP, level, title and skill points. The Hero record shrinks to a profile: `name`, `portrait`, `reviewedWeek`.

## 6. Going out

### 6.1 Three scales

| Scale | Duration (real) | Party | Risk | Typical reward |
|---|---|---|---|---|
| **Odd Job** ("rats in the cellar") | 20–40 minutes | 1–2 | No death; a small chance of injury | A little gold, materials, 5–15 XP |
| **Expedition** (tiers 1–5) | 2–24 phases | 1–6 | As in 6.4 | The kind's main reward (6.2) |
| **Odyssey** | 2–6 days (16–48 game days, 4–6 legs) | 4–6, needs Tank + Healer | High | Large rewards, a lot of renown, the regional lair boss and liberation (11) |

- 2–3 odd jobs are on the board at a time, refreshed each phase. They don't use expedition slots.
- The **first ever odd job** is a 10-minute tutorial with no risk, so your first session ends with a result.
- Odysseys open at Guild Hall 3. Between legs the party rests (+20 Health, −30 Fatigue). On Cautious or Steady they can turn back between legs and keep what they've found so far. The report arrives leg by leg.

### 6.2 The board

Each game day the board offers 4 expeditions, plus 1 per 5 surplus Order and +1 while anyone is on Patrol, up to 8. Each offer has:

- **Name and region.** Regions are unlocked by the Cartographer.
- **Kind**, which sets the main reward: *Gold*, *Items*, *Alchemy* (herbs), *Materials* (wood, stone, iron).
- **Tier** 1–5. Tiers unlock with the Guild Hall: T2 at level 2, T3 at 4, T4 at 6, T5 at 8.
- **Duration**, **party size**, **required roles**.
- **Conditions:** 0–3 of *Darkness, Flooded, Cold, Cursed, Undead, Beasts, Swarm, Narrow, Open ground, Traps, Locked, Ambush, Plague*. Each one gives a penalty unless someone counters it through class, race or gear. Some are shown as **"?"** until the Library reveals them.
- **Expires in** N days.

Expeditions and odysseys that can be out at once: `1 + floor(Guild Hall level / 2)`.

### 6.3 Sending

1. Pick the party. Required roles and size are checked inline.
2. Pick the stance:

| Stance | Duration | Fatigue | Loot | Death risk | Behaviour |
|---|---|---|---|---|---|
| **Cautious** | −30% | ×0.5 | −30% | ×0.4 | Turns back at the first Fail |
| **Steady** | – | – | – | ×1 | Turns back at the second Fail |
| **Bold** | – | ×1.2 | +40%, a chance at the boss chest | ×2.5 | Never turns back |

3. The **odds panel** shows full-success chance, the expected loot range, and injury and death chance **per adventurer**. Unknown "?" conditions turn these into ranges ("death 0.6–1.4%"). It also shows a career outlook: "At this pace, about 1 in 3 don't reach retirement."
4. Confirm. Purses buy what they need, and the party leaves.

Sending is always your decision. Nothing ever goes out automatically.

### 6.4 Resolution

The whole outcome is **decided at departure**: seeded, from a snapshot of the party (13.2). It's **revealed stage by stage** at each stage's timestamp, so you can check in and see "stage 3 of 5 cleared". The odds panel describes exactly this resolver. Real-life XP gained while they're out doesn't change an outcome already decided.

There are 3 stages at tier 1, up to 7 at tier 5. The last one is usually a boss or vault.

| Stage kind | Check uses |
|---|---|
| Combat | Tank + DPS role scores, Healer softens the result |
| Hazard | Scout + condition counters |
| Trap / Lock | Scout |
| Endurance | Everyone's Fatigue and Health |
| Boss | Combat at +2 difficulty; the treasure roll on success |
| Rest | Recover a little |

Each stage: `d20 + partyScore(stage) − difficulty(tier, conditions not countered)`:

- **Clear** (≥ 10): loot for the stage, small fatigue.
- **Strain** (5–9): loot, more fatigue, a chance of injury.
- **Fail** (< 5): no loot, Health loss, a chance of injury, and one member is **struck**. Who is struck depends on exposure: a Tank 2.5× as often as anyone else, and the wounded more often than the healthy. A strike can kill. A Healer in the party saves 45–70% of those deaths (the adventurer is injured instead), Halfling luck saves one per career, and the Hospitaller charter saves 20%.

The death roll is scaled by stance, Health, Chapel blessing, potions, Halfling luck and the guild's Witness Stones.

**Lifetime targets**, validated by a balance test that simulates whole careers:

| Play style | Retire | Die |
|---|---|---|
| Careful: Cautious or Steady, the right tier, a healer along | **about 2/3** | about 1/3 |
| Risky: Bold, a tier above them, no healer | **about 1/3** | about 2/3 |

With careers of 24–120 real days and roughly 1–2 outings a day, that's roughly 0.4–0.8% death per expedition when careful and 1–2.5% when risky.

Measured with the stage 1 numbers (400 simulated careers each): careful play loses **34%**. Taking **any one** risk every time (going Bold, leaving the healer at home, or going a tier above) loses **56–67%**. Stacking two risks loses **over 90%**, and Cautious play loses about 9%. So "risky" means one habitual risk; stacking them is reckless. The balance test (`domain/guild/engine.test.ts`) keeps careful play at 20–45% and Bold play at 50–82%.

### 6.5 Return

- **Loot:**
  - Gold is split 25/75.
  - Items go to the Armoury.
  - Herbs and materials go to the Warehouse. Anything over storage is left behind, and the report says so.
- **XP** per member:
  - Odd job: 5–15.
  - Expedition: `10 × tier² × stagesCleared / stages` (tier 1 = 10, tier 5 = 250, so higher tiers pay more per hour). ×1.5 on Bold. The Library and Martial charter add more.
  - Odyssey: the sum of its legs × 1.5.
- **Renown**, which never decreases:
  - Expedition full clear: its tier.
  - Odyssey: `10 × tier`.
  - Liberating a region: 100.
- **The report** goes to the Chronicle. Deaths and injuries come first.
- **Gear wears** (section 10).

### 6.6 When someone falls

- Insurance and their purse go to the guild.
- A **Witness Stone** is placed in the Hall of Heroes. From level 5 up, it gives −0.5% death chance in that region, up to −10% per region.
- A **recovery expedition** appears at the same place and tier, and expires after 1 season. Success brings them home: the Witness Stone becomes a **Tomb** (double bonus), and their gear returns to the Armoury.

### 6.7 Between outings

At home, each phase: Health +5 (more with an Infirmary), Fatigue −6, plus their duty (4.7). Injuries count down in days.

## 7. Resources

### 7.1 Stock resources (gained and spent; Warehouse limits)

| Resource | From | Spent on |
|---|---|---|
| Gold | Real life (75% × Hall bonus), expeditions, selling | Building, hiring, notices, buying gear |
| Wood | Forestry, Patrol, Materials expeditions | Building |
| Stone | Quarry, Patrol, Materials expeditions | Building |
| Iron | Mine, Materials expeditions, salvage | Building, Blacksmith, reforging |
| Herbs | Herb Garden, Alchemy expeditions | Potions |

**Production stops when storage is full.** Nothing is sold automatically. The **Merchant House** buys materials and items up to a **weekly limit** (1 game week = 1 real day), so selling is always your choice and never becomes passive income.

### 7.2 Capacity resources (supply against demand; never spent, never decay)

| Capacity | Supplied by | Demanded by | A surplus gives |
|---|---|---|---|
| **Food** | Farms, Fishery | 1 per resident in use (workers, retirees, children) and 1 per adventurer | – |
| **Housing** | Homes | Each building's workers, and each retiree and child | – |
| **Happiness** | Guild Hall (+2), Tavern, Chapel, Garden of Valor | Quarry and Mine (1 each) | Better recruits: +1 recruit and higher talent per 5 surplus |
| **Order** | Guild Hall (+2), Watch House | 1 per 10 residents | +1 board offer per 5 surplus, and better Merchant stock |

**The build rule:**
- A building can be built or upgraded only if no capacity is over once it's done.
- **Homes and Farms are the exception: they can always be built.**
- Retirees and children can push a capacity over on their own, even while you're away. When that happens nothing gets worse. You just can't build other things or hire until you've fixed it, and Homes and Farms always can fix it. The town can never lock itself.

## 8. Town

### 8.1 Building rules

- **Levels:** every building has **5 levels**, and the **Guild Hall has 10**. A building's level can't be higher than `ceil(Guild Hall level / 2)`, so level 5 needs Guild Hall 9.
- **Cost:** gold + materials + time. Each level costs ×2 the one before, so level 5 costs 16× level 1. A year of play won't max out every building; choosing is the game.
- **Build crews:** 1, and one more at Guild Hall 3, 6 and 9.
- **Plots:** every building takes a plot, except the Garden of Valor and Hall of Heroes. You get 12 plots at Guild Hall 1, +2 per level after. Plots already exist here so the future paper map (14) needs no conversion of saves.
- **Demolish:** frees the plot and its workers, refunds 50% of materials and no gold.
- Seasons change costs (8.4).

### 8.2 Buildings

The level values in the table are for levels 1 / 2 / 3 / 4 / 5. Workers rise by 1 at levels 3 and 5.

| Building | Effect by level | Workers |
|---|---|---|
| **Guild Hall** | 10 levels; see 8.3 | 0 |
| **Tavern** | Recruits 2/3/4/5/6, refreshed every 4 days. Happiness +1/1/2/2/3. | 1 |
| **Adventurers' Lodge** | Roster limit 4/6/8/10/12 | 1 |
| **Home** (build many) | Housing +4/6/8/10/12. Always buildable. | 0 |
| **Farm** (build many) | Food +6/9/12/15/18. Always buildable. | 0 |
| **Fishery** | Food +4/6/8/10/12 | 1 |
| **Forestry** | Wood 4/6/8/10/12 per phase (12–36 per game day) | 2 |
| **Quarry** | Stone 3/4/6/8/10 per phase. −1 Happiness. | 3 |
| **Mine** | Iron 2/3/4/5/6 per phase. −1 Happiness. | 3 |
| **Herb Garden** | Herbs 2/3/4/5/6 per phase | 1 |
| **Warehouse** | Storage 200/750/1,750/3,500/6,000 of each stock resource | 1 |
| **Armoury** | Racks 10/20/30/45/60 items | 1 |
| **Merchant House** | Weekly sell limit 100/200/350/550/800 gold. Stock up to Common/Uncommon/Rare/Epic/Legendary. | 1 |
| **Blacksmith** | Forges gear from iron, up to Uncommon … Legendary. Salvage gives 50–100% iron. Can reforge (restore wear for iron). | 2 |
| **Stillroom** | Brews potions from herbs: heal → cure → ward against death | 1 |
| **Infirmary** | Recovery from injury and Health loss +30/60/90/120/150% | 1 |
| **Chapel** | Blessing: −10/15/20/25/30% death chance. Happiness +2/3/4/5/6. | 1 |
| **Training Field** | Benches 2/3/4/5/6. Train XP ×1/1.25/1.5/1.75/2. | 1 |
| **Library** | Expedition XP +5/10/15/20/25%. Reveals "?" conditions (1/2/3/all/all). | 1 |
| **Cartographer** | Unlocks regions 1–5 (11) | 1 |
| **Watch House** | Order +5/8/12/16/20 | 2 |
| **Garden of Valor** | Holds every campaign monument; +1 Happiness per monument, up to 5/10/15/20/25. You start with it. | 0 |
| **Hall of Heroes** | Legends, Witness Stones and Tombs, the Heirloom shelf; bonus caps rise by level. You start with it. | 0 |

### 8.3 The Guild Hall (10 levels, about 1 year)

The Guild Hall sets the pace of the whole game. It's designed so that level 10 takes about **a year of active play**, fast at first and slower later: `targetDay(L) ≈ 365 × ((L − 1) / 9)²`.

| Level | Target day of play | Rank | Gold | Wood | Stone | Iron | Renown | Unlocks |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | Copper | – | – | – | – | – | 1 expedition out, tier 1, building level 1 |
| 2 | ~4 | Copper | 150 | 80 | 40 | – | 50 | Tier 2, 2 out |
| 3 | ~18 | Bronze | 500 | 200 | 150 | 20 | 250 | Building level 2, +1 crew, Odysseys |
| 4 | ~40 | Bronze | 850 | 400 | 300 | 60 | 600 | Tier 3, 3 out |
| 5 | ~72 | Iron | 1,500 | 700 | 600 | 120 | 1,000 | Building level 3 |
| 6 | ~113 | Iron | 2,100 | 1,100 | 1,000 | 200 | 1,700 | Tier 4, 4 out, +1 crew |
| 7 | ~162 | Silver | 3,600 | 1,600 | 1,500 | 320 | 2,400 | Building level 4 |
| 8 | ~220 | Silver | 4,500 | 2,200 | 2,100 | 480 | 3,300 | Tier 5, 5 out |
| 9 | ~288 | Gold | 7,000 | 3,000 | 2,900 | 700 | 4,300 | Building level 5, +1 crew |
| 10 | ~365 | Adamant | 9,500 | 4,000 | 4,000 | 1,000 | 5,500 | 6 out |

- **Real-life bonus:** gold from real life × `1 + 0.1 × (level − 1)`, up to ×1.9 at level 10. Real life stays relevant as costs grow.
- **Rank** (Copper → Adamant) is the guild's title and comes from the Hall's level.
- All the numbers in this section are starting values. A **pacing test** (13.4) simulates a typical player and tunes them to hit the target days.

### 8.4 Seasons

Seasons change **building costs only**. They never change production or capacity.

| Season | Cheaper | More expensive |
|---|---|---|
| Spring | Farms, Herb Garden −20% | – |
| Summer | Quarry, Forestry −15% | Infirmary +15% |
| Autumn | Warehouse, Homes −15% | Farms +20% |
| Winter | Mine, Blacksmith −20% | Farms, Herb Garden +40% |

The build screen shows "cheaper next season" hints.

### 8.5 Founding

At the welcome screen you:
- name the guild and the town
- get a generated crest
- choose a **Charter**, a permanent focus:

| Charter | Bonus |
|---|---|
| Mercantile | +15% expedition gold, +50% weekly sell limit |
| Martial | +15% XP from expeditions |
| Hospitaller | −20% death chance (the difference becomes injuries) |
| Builders | −15% construction cost and time |

You start with a Guild Hall, Tavern and Adventurers' Lodge (each at level 1), 2 Homes, 2 Farms, the Garden of Valor and the Hall of Heroes, 150 gold, 50 wood and 30 stone. You also start with 3 free recruits (a Tank, a Healer and a DPS), pick your Champion, and the tutorial odd job is waiting on the board.

## 9. Legacy

### 9.1 Life chapters

For each adventurer, the time they were Champion or Standard-bearer is recorded:
- dates
- counts of quests, habit check-ins and campaigns
- a list of up to 20 notable quests: Main quests and size-L quests, with titles stored at the time, so deleting a quest later doesn't erase the memory
- the monuments raised in their time

On retirement or death it becomes their **memorial**: *"Tobin Quickthorn, Guardian, 14 years. In Tobin's years: 143 quests, 312 habit check-ins, the kitchen renovation, the half marathon."*

This data is **recorded from stage 1**, even though the memorial screen arrives later, so early adventurers aren't left without a chapter.

### 9.2 Garden of Valor

Every completed real campaign raises a monument: a plaque (S), a statue (M) or an obelisk (L). Each carries the campaign's seal and icon, its completion date, and the name of the adventurer who carried it. The Garden is one place for all of them, however many campaigns you finish.

### 9.3 Hall of Heroes

- **Legends:** retired at level 15 or higher, or with 3+ tier-5 clears or a region liberated. Each gives +1% to a guild stat tied to their class, up to +15% per stat.
- **Witness Stones and Tombs** (6.6).
- **The Heirloom shelf** (10).
- **Guild Records:** longest career, highest level, most outings, deadliest place, most gold brought home, longest-lived retiree, largest family.

### 9.4 Eras

Every 10 game years (about 80 real days) the Chronicle closes an era named after its most renowned adventurer ("The Age of Tobin"). The era summary lists who joined, who fell, what was built, and what you did in real life during it.

### 9.5 Chronicle

The existing Chronicle sheet becomes the guild's history, combining real-life entries (now with the adventurer who earned them) and game entries: reports, hires, couples, births, deaths, retirements, buildings finished, liberations, seasons and eras.

## 10. Items and the Armoury

The rules that keep the inventory from growing without limit:

| Rule | Detail |
|---|---|
| **Grades** | Common, Uncommon, Rare, Epic, Legendary, plus **Heirloom** |
| **Wear** | Each expedition, or each odyssey leg, costs 1 wear. Odd jobs don't. Durability by grade: Common 8 · Uncommon 12 · Rare 20 · Epic 30 · Legendary 50 · Heirloom never wears. |
| **Broken** | At 0 the item breaks and is **salvaged into iron** automatically (more with a Blacksmith). The report says so. |
| **Reforging** (optional) | The Blacksmith restores wear for iron. It's never required, so it isn't upkeep. |
| **Rack limit** | The Armoury holds 10–60 items. When new loot doesn't fit, the weakest unlocked item is salvaged. You can **lock** items to protect them. |
| **Potions** | Spoil after 1 game year (8 real days) |
| **Selling** | Through the Merchant House, within the weekly limit |
| **Ownership** | Guild Armoury gear is lent out for free and comes back on retirement. Gear bought from a purse belongs to the adventurer and wears out as normal. A fallen adventurer's gear is lost until the recovery expedition brings it home. |
| **Heirlooms** | A retiree's signature item and habit-streak trinkets go to the Heirloom shelf in the Hall of Heroes. They never wear and don't use racks. Anyone can wear one; a descendant gets an extra bonus. |

## 11. The realm

- **Regions:** the home region (Hearthlands, T1–2) plus 5 unlocked by Cartographer levels 1–5. Each region has its own condition mix and tier range:

| Region | Typical conditions | Tiers |
|---|---|---|
| Mirewood | Flooded, Beasts | T1–3 |
| Frostpeak | Cold, Narrow | T2–4 |
| Duskhollow | Darkness, Undead | T3–5 |
| Sunscar Wastes | Open ground, Swarm | T3–5 |
| Blighted Fen | Plague, Cursed | T4–5 |

- **Lair boss:** each region ends in an odyssey against its lair boss. **Liberating** it gives:
  - a permanent regional bonus, for example −15% duration and +10% loot there
  - an **Outpost** (+1 expedition out, a staff slot for a retiree)
  - 100 renown
  - a monument in the Garden of Valor
- **Long arc:** a year of play is about Guild Hall 10 plus liberating the realm. Afterwards the game goes on: higher-level regional lairs, records, eras and dynasties.

## 12. Being away

- Production runs until storage is full, then stops.
- Outings already out resolve. Nothing new is ever sent automatically.
- Adventurers at home follow their duties, then age and retire on schedule. Retirees pass away, children grow up.
- Recruits come and go.
- Nothing decays: no capacity loss, no gold drain, no buildings falling apart. Gear only wears when it's used.
- Holiday mode stops all of this until you turn it off.

On return you get a **"While you were away"** summary: who came back, who fell, who retired, what was built and how full storage is.

## 13. Engineering

### 13.1 Data model (sketch)

```ts
// Data.version 3: hero → profile, expedition → guild
interface Data {
  version: 3;
  profile: { name: string; portrait?: string; reviewedWeek?: string };
  quests: Quest[]; habits: Habit[]; camps: Record<string, Campaign & { bearerId?: string }>;
  companions: Companion[]; tomes: Tome[]; codex: CodexEntry[]; events: CalEvent[];
  guild: Guild;
}

interface Guild {
  name: string; town: string; charter: CharterId; crestSeed: number; seed: number;
  founded: number;            // epoch ms of phase 0
  lastTick: number;           // epoch ms processed up to
  holiday?: { since: number } // paused
  pausedMs: number;           // total time spent in holiday mode, taken off the clock
  gold: number; renown: number; bankedXp: number;
  stock: Record<StockKey, number>;
  soldThisWeek: { week: number; gold: number };
  buildings: Building[];      // { id, type, level, plot, staffIds[] }
  construction: Construction[];
  adventurers: Adventurer[];  // every state, including retired/fallen/passed
  championId: string | null;
  recruits: Recruit[]; notice?: { cls: ClassId; race?: RaceId };
  board: Offer[];             // odd jobs, expeditions, odysseys, recovery
  outings: Outing[];          // decided at departure, revealed over time
  armoury: Item[]; heirlooms: Item[];
  regions: Record<RegionId, { unlocked: boolean; liberated: boolean; stones: number }>;
  monuments: Monument[];      // { campId, name, seal, icon, size, date, bearerId }
  chronicle: GuildEntry[];    // structured: { t, kind, ref ids, params }, rendered at display
  records: GuildRecords;
}

type AdvState = 'active' | 'retired' | 'fallen' | 'passed' | 'child';
interface Adventurer {
  id: string; name: string; family: string; race: RaceId; cls: ClassId;
  bornPhase: number; retirePhase: number; passPhase?: number;
  level: number; xp: number; talent: 1 | 2 | 3 | 4 | 5;
  attrs: { might: number; finesse: number; wits: number; spirit: number };
  practice: Record<Attr, number>;           // real-life XP towards the next attribute point
  health: number; fatigue: number; injuredUntil?: number; scars: string[];
  purse: number; autoBuy: boolean;
  gear: { weapon?: string; armour?: string; trinket?: string; potions: string[] };
  duty: 'train' | 'rest' | 'labour' | 'patrol';
  state: AdvState; awayOn?: string; staffAt?: string; recalled?: boolean; luckUsed?: boolean;
  partnerId?: string; parentIds?: string[]; childIds?: string[];
  outings: number; sharedOutings: Record<string, number>;
  chapter: Chapter;                         // section 9.1
  traitIds: string[];                       // deferred
}
```

Real-life rewards store `recipientId` so undo knows whom to charge.

### 13.2 Engine

- `domain/guild/` replaces `domain/expedition/`. The pattern stays: pure functions over plain data, seeded dice, unit tests.
- `advance(guild, now)` plays an **event queue in time order**:
  - per-phase ticks: production, recovery, duties, construction, aging, retirement, couples, births, board and Tavern refresh
  - timestamped events: stage reveals, returns, odd jobs

  It returns the new state and a summary for "While you were away".
- **Decided at departure** (6.4): `resolve(snapshot, offer, stance, rng)` runs once when the party leaves. The result is stored on the outing and revealed over time.
- **Exact odds:** the same resolver, worked out over its outcome tree. If a rule ever makes the tree too large, use ≥10,000 simulations with a fixed seed so the numbers don't jitter.
- **Seeds** come from `(guild.seed, phase index, entity id)`. Outcomes never depend on when or how often you open the app.
- **Chronicle** entries are structured and rendered at display time. Saves live in localStorage (about 5 MB), so text isn't stored repeatedly.
- `content.ts` holds every number, so balancing means editing one file.

### 13.3 Developer tools

A hidden **time-skip** panel (advance N phases, days or years) for testing and balancing.

### 13.4 Balance and pacing tests

- **Death share** over whole careers: careful play 25–40%, risky play 55–75%.
- **Pacing:** a simulated typical player (5 quests and 3 habits a day, 3 check-ins a day, sensible build order) reaches each Guild Hall level within ±20% of its target day.
- **Real-life share of gold:** at least 50% of guild gold through Guild Hall 6.
- **No lock:** from random town states, Homes and Farms can always restore building.
- **Storage fits:** every Guild Hall level's cost fits in the Warehouse you can have at the level before it.

### 13.5 Migration v2 → v3

- Drop `hero.xp/level/next/gold/points` and `expedition`. Keep the profile.
- Gold doesn't carry over.
- Old Chronicle entries are shown as "before the guild".
- Founding runs on first open (8.5).

## 14. Mobile UI

The bottom tab **Adventure** becomes **Guild**, with a top segmented control:

1. **Town:**
   - Header: clock, gold, rank.
   - Stock bars and capacity bars (supply against demand).
   - Building cards: level, workers, staff slot, Upgrade with its cost this season.
   - Construction progress and plots used.
2. **Roster:**
   - Cards for the Champion (marked with a star; tap a card to make them Champion), Standard-bearers, Active, Away and Injured adventurers.
   - A Retired section with staff slots.
   - Tapping opens the adventurer sheet: stats, talent, gear, purse, career bar ("Sworn 7 more years"), duty, scars, partner and family, chapter so far.
3. **Board:** odd jobs, expeditions and odysseys. Tap one for the party picker, stance and odds, then Send. Parties out show live stage progress. New reports are unread until opened.
4. **Tavern:** recruits, the recruitment notice.
5. **Legacy:** Hall of Heroes, Garden of Valor, Records, Chronicle and eras.

**Home screen:** a small card with the Champion's crest or portrait, level bar and "next back: Rosco's party in 2 phases". The quest-complete toast reads `+40 XP · +1 Wits practice to Tobin · +10g purse · +30g guild`. Campaign sheets get a **Standard-bearer** picker.

**Later (stage 5): the paper map.** The town drawn as a growing paper map: each built building appears on its plot, and tapping one (the Guild Hall, for example) opens it to upgrade. In time, a living scene with retirees on benches.

## 15. Build stages

1. **Guild core (built):**
   - Time engine (event queue, phases, uncapped catch-up, "While you were away"), the time-skip tool.
   - Founding: names, generated crest, charter.
   - Races, classes, talent, attributes.
   - Tavern, hiring and the recruitment notice; the roster.
   - The Champion and Standard-bearers, the 25/75 split, banked XP, undo, attribute practice.
   - Duties: Train and Rest.
   - The board with odd jobs (including the tutorial) and tiers 1–2.
   - Outcomes decided at departure, revealed stage by stage; exact odds; stances; reports.
   - Injury, scars, death and insurance; aging and retirement.
   - Recording life chapters.
   - Migration v3 and removal of the old Expedition and Hero.
   - Until the town exists, fixed values stand in for buildings: a roster of 6, 2 expeditions out at once, tiers 1–2, 3 recruits at the tavern every 4 days, and a 50g recruitment notice. Wood, stone, iron and herbs are collected and kept for stage 2.
2. **Town:**
   - Stock and capacity resources and the build rule.
   - Buildings with 5 levels, the Guild Hall with 10 and its real-life bonus and ranks.
   - Plots, crews, demolishing, Warehouse limits, production.
   - Seasons changing costs; Merchant House with the weekly sell limit.
   - Duties: Labour and Patrol; the Town tab.
   - Pacing test.
3. **Depth:**
   - Conditions and counters, phase effects, "?" conditions and the Library.
   - Gear grades, wear, racks, salvage, locking; the Armoury, Blacksmith and reforging; purse auto-buy.
   - Stillroom potions, the Infirmary, Chapel and Training Field.
   - Tiers 3–5, recovery expeditions.
   - Death-share balance test.
4. **Legacy and realm:**
   - The memorial screen, Hall of Heroes, Garden of Valor, heirlooms (streak and signature), Records, eras.
   - Staff slots, old age, One Last Job, couples and children, kin.
   - The Cartographer and regions, odysseys, lair bosses and liberation, outposts.
   - Holiday mode, generated portraits.
5. **Later:**
   - The paper map you watch grow, and the living town scene.
   - Traits, convictions and vows, backstories, events, two-role classes.
   - The desktop layout.

## 16. Open questions

- **Weekly review reward:** finishing the existing weekly review (the card on Home you mark done) could give the guild a "Patron's Grant", such as gold and renown. Waiting for your decision.
- Exact text for traits, backstories and events.
- Final balance numbers. Everything here is a starting point for the tests in 13.4.
- Art style for crests, portraits and the paper map. Everything is drawn in code like the current SVG icons.
