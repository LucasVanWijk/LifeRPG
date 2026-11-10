# The paper map: implementation plan

Status: **built (steps 1 to 4, and part of step 5)**; see section 11 for what differs from this plan. Goal from the design (section 14, stage 5): the town drawn as a paper map you watch grow. Tap a building to open it, tap an empty plot to build on it, tap the Guild Hall to raise it.

## 1. What exists, and the gap

- The Town tab is a list of cards (`screens/Town.tsx`). Tapping one opens `BuildingSheet` (`sheets/TownSheets.tsx`); "Build something" opens `NewBuildingSheet`. All the rules (costs, capacity, crews, staff) already live in `domain/guild/town.ts` and `engine.ts`.
- **The design said buildings already sit on plots. They don't.** `plotsFor(hall)` and `plotsUsed(g)` only count; `Building` is `{ id, type, level }` with no position. So the map needs a real plot model first. That is the one domain change.
- The Hall, Garden of Valor and Hall of Heroes take no plot (`noPlot`). They get fixed places on the map instead.

The map is a new view of existing state. It adds no game rules, so it should not change balance or any existing test.

## 2. Principles

1. **Mobile first**, one finger. No pinch or drag required to do anything; panning is optional extra.
2. **Drawn in code**, like the crests and icons: SVG, no image files, works in both themes, small.
3. **The list stays.** A Map / List switch on the Town tab. The list is the accessible, searchable fallback and the place for exact numbers. The map must never be the only way to do something.
4. **Deterministic.** Same guild gives the same map. Positions come from a pure function, not from random state, so saves, tests and screenshots are stable.
5. **Growth is visible.** A glance shows how big the guild is: buildings get bigger and busier with level, and the town fills its plots.

## 3. Data model

```ts
interface Building { id: string; type: BuildingId; level: number; plot?: number }   // plot: index into the town's plot list
interface Construction { ...; plot?: number }                                        // new buildings reserve a plot while being built
```

- **Plots** are a fixed, ordered list of positions: `PLOTS: { x: number; y: number; w: number }[]`, 40 entries (the most `plotsFor(10)` gives is 30; the rest is headroom). Which plots are *open* is `plotsFor(hall)`: the first N in the list. Raising the Hall opens the next two, which is also the moment the paper "unrolls" (see 6).
- **Assignment.** A new building takes the lowest free plot unless the player tapped a specific one. `build(g, type, plot?)` validates the plot is open and free. The Hall, Garden and Hall of Heroes use fixed named anchors (`HALL`, `GARDEN`, `HEROES`) outside the list.
- **Migration** (`upgradeGuild`): any building without a plot is given the lowest free plot in id order, once. Existing saves keep working and look sensible.
- **Demolish** frees the plot. **Construction** keeps its reservation, so the map shows scaffolding in the right place.
- `plotsUsed` stays as it is (it already counts construction). Add `plotOf(g, id)` and `freePlots(g)` helpers in `town.ts`.
- Layout is a plain array in `content.ts` (`PLOTS`), hand-tuned once: Hall at the centre, a village green ring around it, the road, then outer fields and the quarry/mine/forest towards the edges. Plot *zones* (`core | fields | wild`) let the layout nudge where each type likes to go (farms to fields, mine and quarry to wild) without forcing it: `build` prefers a plot in the type's preferred zone when the player doesn't choose one.

## 4. Rendering

New files, nothing existing is rewritten:

| File | Job |
|---|---|
| `domain/guild/map.ts` | Pure: `PLOTS`, anchors, `mapModel(g)` returns what to draw (each building with position, level, state: built / under construction / being improved, staffed, idle). Unit tested. |
| `components/TownMap.tsx` | The SVG scene. Takes `mapModel`, calls back with `onBuilding(id)`, `onPlot(i)`, `onHall()`. |
| `components/mapArt.tsx` | The drawings: one small function per building type, taking `level`. |
| `screens/Town.tsx` | Map / List switch, remembered per viewer in `localStorage` (a convenience, never needed). |

**Scene.** One `<svg viewBox="0 0 400 520">` scaled to the screen width, aged-parchment background (the app's existing parchment tokens, with a subtle paper-grain filter), ink-line drawings in two or three accent colours so it follows light and dark themes.

**Buildings** are simple flat drawings, 4 to 6 shapes each, so 22 types are cheap to make. Level shows through size and detail rather than a number: level 1 a small hut, 2 adds a second storey or chimney, 3 a banner, 4 a wall, 5 a flag and lit windows. A small level pip sits under each. Production buildings show a tiny status mark (a stack of logs when its store is full, a "zzz" if it has no workers).

**State on the map**
- *Under construction:* scaffold lines and a thin progress ring; tapping opens the building sheet with the progress.
- *Open empty plots:* a faint dashed outline with a "+" on tap-able plots; locked plots are not drawn (they appear when unlocked).
- *Staffed:* a small figure by the door (retirees at work).
- *Over capacity:* the town's four capacity bars sit as a thin strip above the map, so a shortage is seen without leaving the map.
- *Season:* a gentle tint (green, gold, rust, white) and a few leaves, flowers or snowflakes in the corners. This also shows seasonal building discounts: a "cheaper now" tag on the buildings that are.

**Beyond the walls.** Liberated regions appear as outposts on the map edge (a tent and a flag); locked regions are folded-over paper corners with the Cartographer level needed. The Garden of Valor shows its monuments as small standing stones, one per campaign.

**Touch targets.** Every building's hit area is at least 44 px square in screen terms, independent of its drawing. Overlapping hit areas are avoided by the plot spacing.

## 5. Interaction

- Tap a building: opens `BuildingSheet` (unchanged).
- Tap an open plot: opens `NewBuildingSheet` with that plot chosen and the list filtered to what fits (free plot, hall level), still showing why something is blocked.
- Tap the Hall: opens its sheet, as now.
- Long-press a building: a small menu with Raise, Staff and Pull down, so common actions are one gesture from the map.
- A building that can be raised right now shows a small up-arrow, so the map shows where money can be spent.
- Keyboard and screen reader: the SVG gets `role="img"` and a summary label; every building is also a real focusable `<button>` positioned over it (visually hidden text), and the list view remains.

## 6. Growth and motion

All cheap, none required for the map to work:
- **Unrolling.** When the Hall rises and opens plots, the new area unrolls from the edge (a short CSS clip animation), once, then is remembered as seen (`localStorage`).
- **Construction.** Scaffold appears when work starts; on completion the building "pops" in with a short scale and a dust puff.
- **Life.** Chimney smoke on staffed buildings, a flag that moves, birds, and a few small figures walking between the Tavern and the Lodge, driven by how many adventurers are at home. Everything respects `prefers-reduced-motion`.
- **Retirees on benches** (from the original dream): up to 8 small seated figures on the green, one per retiree, picked deterministically from their ids.

## 7. Build order

Each step ships and can be used on its own.

1. **Plots in the data** (small). `plot` on `Building`/`Construction`, `PLOTS` layout, `build(g, type, plot?)`, migration, `freePlots`. Tests: assignment, migration, demolish frees, construction reserves, a full town never gets two buildings on one plot.
2. **Static map** (medium). `mapModel`, `TownMap`, the art for the 22 types at level 1, Map / List switch, tap to open a building or the Hall. No animation.
3. **Build from the map** (small). Tap an open plot to build there; zone preference; the "can be raised" arrow; capacity strip.
4. **Levels, construction and seasons** (medium). Level detail in the art, scaffold and progress, season tint and "cheaper now" tags, outposts and folded regions, Garden stones.
5. **Life and polish** (small to medium). Unrolling, pop-in, smoke, walkers, retirees on benches, reduced motion, long-press menu.

Rough size: steps 1 and 3 are each about a tenth of stage 2; step 2 about a third; step 4 about a third; step 5 about a fifth. The art is the bulk of the work, and level 1 for all 22 buildings is enough to ship step 2.

## 8. Testing

- **Pure layout tests:** every plot position is inside the scene, no two plots closer than the minimum spacing, hit areas never overlap, `mapModel` is deterministic and includes everything the list does (counts match `g.buildings` plus construction).
- **Domain tests** from step 1 (assignment, migration, reservations).
- **Visual checks:** Playwright screenshots at phone and desktop widths for a new town, a half-built town, a full Hall 10 town, each season and a dark-theme pass. Compared by eye, not by pixel, since the art will keep changing.
- **Performance:** a Hall 10 town is about 40 buildings; each is a handful of SVG nodes. Budget: under 2,500 nodes, no re-render of the scene on the 15-second clock tick unless something it draws changed (memoise on `mapModel`).

## 9. Risks

- **Art takes the time.** Mitigation: ship level 1 only first, with one shared "hut" shape recoloured by building type, and replace types with real drawings one at a time.
- **Plot layout is a design decision, not a calculation.** A bad layout looks cramped at 30 buildings. Mitigation: tune with the screenshots at Hall 10 before anything else is drawn.
- **Tiny screens.** A 400-wide scene on a 320 px phone shrinks hit areas. Mitigation: the 44 px minimum is computed from the rendered scale; below it, the map falls back to the list with a note.
- **Two ways to do everything** can drift. Mitigation: both views call the same actions and `buildProblem`, and the map adds no logic.

## 10. Decisions I need from you

1. **Choose the plot, or auto-place?** My recommendation: tap an empty plot to choose, and "Build something" from the list auto-places in the preferred zone.
2. **How much life?** Smoke and a flag are cheap; walking figures and retirees on benches cost more. Recommendation: ship without them, add in step 5.
3. **Does the map replace the list, or sit beside it?** Recommendation: a switch, defaulting to the map on phones, remembered per device.
4. **Style:** a warm hand-inked parchment map (matches the app), or a bolder illustrated one? Recommendation: hand-inked, two accent colours.

## 11. As built

Done: steps 1 to 4 and the calm parts of step 5.

- **Plots** are in the data (`Building.plot`, `Construction.plot`), laid out as 36 plots in three rings (8 core, 12 fields, 16 wild) rather than 40, because 36 is the most that keeps every plot at least 50 px from its neighbours and inside the scene, and the Hall never opens more than 30. Older saves are given plots on load. The layout, spacing and placement rules are tested (`plots.test.ts`).
- **The map** (`TownMap.tsx`, `mapArt.tsx`, `domain/guild/map.ts`) draws every building with level detail (chimney, banner, fence, lit windows, flags), the Hall growing towers, the Garden's monuments as standing stones, the Hall of Heroes, scaffolding and a progress ring while a crew works, a green arrow on anything that can be raised now, a "−20%" tag on buildings that are cheaper this season, season tint and margin decoration, retirees on the green, and a row for the five regions (freed, charted or locked).
- **Interaction:** tap a building to open its sheet, tap an open plot to build there (the build list then places the building on that plot), tap the Hall to raise it. "Build something" from the list or the map places it on the zone it prefers. Every building and plot is a keyboard-focusable button with a label, and the Map / List switch is remembered on the device.
- **Motion:** chimney smoke on staffed buildings and a gentle pulse on the work ring, both off under reduced motion.

Not built, and why:
- **The unrolling animation, the pop-in on completion, and the walking figures.** They need the screen to notice what changed since it last drew, which wants a small piece of state I left out. Nothing depends on them.
- **The long-press menu.** The arrow on raisable buildings and the sheet are one tap away already, and a hidden gesture is poor on a phone.
- **A pinch-and-pan scene.** The whole map fits the screen width, so nothing needs it.
- **Distinct drawings for every building.** The 22 types share seven shapes (house, barn, tower, crops, pond, grove, rock), told apart by roof colour and the emblem on the front. Replacing a shape for one type is a change to one function in `mapArt.tsx`.

### Later change: one of each building

Several plots that could each take any building punished a wrong build: you could fill the town with the wrong things and have to pull them down. The town now has **one of every building**, each with its own fixed spot, and every building except the Guild Hall, Homes and Farms **starts at level 0** (not built). Building one raises it from 0 to 1; pulling it down returns it to level 0 on its spot.

- **Homes and Farms** are the only buildings you can have more than one of. They go on numbered slots (12 of each), and the Guild Hall opens one more of each per level: 3 at Hall 1, 12 at Hall 10. You start with 2 of each.
- **The layout** (`plots.ts`) is drawn as a walled market town on a river: the Guild Hall on the central square with the Tavern, Market and Lodge around it; the Library, Cartographer, Chapel and Garden of Valor in the quieter north; the Smithy, Armoury and Warehouse by the south gate, with the Watchtower on the wall; the Infirmary and Stillroom together on the east side; the Training Yard and Herb Garden just outside the east wall; the Forestry in the woods, the Fishery on the river, the Quarry and Mine in the hills, and the Hall of Heroes on the north road. Homes spread out from the south gate and Farms lie in the fields beyond.
- **On the map**, a building at level 0 is a faint outline on its spot with a green "+" (can be built now) or a lock and the Guild Hall level it needs. Tapping it opens a sheet with what level 1 does and a "Build to level 1" button. Open Home and Farm slots are drawn as dashed plots.
- **Without a Tavern or Lodge**, one recruit waits at a time and the roster holds 3 adventurers, so building them is an early choice rather than a given.
- **Older saves** move to the new layout once on load (`Guild.layout = 2`): Homes and Farms are renumbered onto their slots, and every other building goes to its own spot.
