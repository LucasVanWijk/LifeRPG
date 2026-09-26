# Questlog

A parchment quest log for everyday life, built from the Claude Design handoff `Questlog.dc.html` (Questlog Mobile App Design).
React + Vite + TypeScript, installable as a PWA that works offline. Data lives in the browser (`localStorage`, key `questlog:v2`); there is no backend. A new log starts empty at level 1 and asks for your name.

**Back up your log.** Everything is stored in one browser. Use Profile → Export backup now and then, and Restore backup on a new device.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # domain logic (rewards, completion, levelling, dates)
npm run build      # typecheck + production build into dist/
```

## Layout

The app switches between the mobile layout (bottom tab bar, bottom sheets) and the desktop layout (sidebar, side panel) at 900px width.

| Path | What it holds |
| --- | --- |
| `src/domain/` | Types, quadrants and sizes, the reward formulas (Main Quests ×1.5), quest/habit/campaign payout logic, streaks, date helpers, the design's sample data (used by tests only) |
| `src/domain/migrate.ts` | Upgrades saved data and imported backups to the current format |
| `src/domain/quickadd.ts` | The quick-add shorthand parser |
| `src/domain/expedition/` | Expeditions content tables and the idle/combat engine |
| `src/state/store.tsx` | Persisted data + UI state and all actions, shared through a React context |
| `src/screens/` | Home, Quests (desktop board, mobile 2×2 grid, opened zone, campaigns), Glossary, Adventure |
| `src/sheets/` | Quest detail, and one form for New Quest / Edit quest (with steps), New/Edit Campaign, Profile (name, portrait, backup, install), Welcome |
| `src/pwa.ts`, `public/sw.js`, `public/manifest.webmanifest` | Service worker registration, install prompt, offline caching |
| `src/styles/classical.css` | The Classical design system, unchanged except that fonts are bundled locally |
| `src/styles/app.css` | Questlog's parchment tokens (`--q-*`) and component styles |

## Deep links

The first screen can be picked with query parameters, matching the frames in the design canvas:

| Frame | URL |
| --- | --- |
| 1b Quest Board | `?screen=quests` |
| 1c Zone opened | `?screen=quests&zone=main` |
| 1d Campaign Board | `?screen=quests&view=campaign` |
| Habits | `?screen=quests&view=habits` |
| 1e Quest detail / 1o Edit quest | `?screen=quests&quest=<id>` / `&mode=edit` |
| 1g Tomes · 1h Codex | `?screen=glossary&cat=tomes` · `&cat=codex` |
| 1i / 1j Glossary detail | `?screen=glossary&detail=companion:<id>` · `detail=codex:<id>` |
| 1k Tavern | `?screen=adventure` |

`?layout=mobile` or `?layout=desktop` forces a layout regardless of width.

## Notes

- To start over, clear the site's `localStorage`.
- **Quests and habits are separate.** Quests are one-off tasks on the board, optionally with a checklist of steps; ticking the last step offers to complete the quest. Habits repeat daily, or weekly with a target of 1–7 days a week; they are checked in on Home and pay half a quest of the same size. A streak counts periods in a row that met the target.
- **Home** shows Today's Quests, Up next (open Main Quests that aren't due today), habits, the week, and a reminder when the last backup is more than 14 days old. History (from the character card) lists everything completed by week.
- **Quick add:** the bar on Home and the Quest Board pins a quest from one line, e.g. `Paint walls !main @study fri ~L #Sophie`. `!c/!m/!e/!s` (or `!crisis`…) sets the zone, `@word` a campaign (any word of its name), `~S/~M/~L` the size, `#name` a companion (repeat for more), and `today`, `tomorrow`, `mon`–`sun`, `3 oct`, `+3d`, `+2w` or `2026-10-03` the due date. Everything else is the title.
- **Companions on quests:** a quest can involve several companions; they show on its card, and each companion's page lists their quests.
- **Expeditions** (Adventure tab) is a small idle game in the spirit of Melvor Idle, and replaces the Tavern. Quest gold buys supplies and starter gear in the shop, and gold only flows one way: nothing in Expeditions earns gold. Every XP point from quests and habits also adds a skill point, which trains Attack, Strength, Defence, Hitpoints, Fishing, Cooking, Mining and Smithing (going from level L to L+1 costs 50 × L); doing an activity adds a little practice XP too. Fishing, mining, cooking and smithing use a supply per action and run until it runs out. Dungeons use a torch per run and fight D&D-style: a d20 plus bonuses against armour class, then damage dice, eating food automatically. Activities keep running while the app is closed, for up to 8 hours. All numbers live in `src/domain/expedition/content.ts`.
- **Undo:** completing a quest, checking in a habit or deleting a quest shows an Undo button on the message for five seconds.
- **Campaign rewards** are paid when the campaign's last quest is done, and the seal shows on Home. Reopening or adding a quest the same day takes the reward back; after that the seal is kept.
- **Undoing** a completion takes its XP and gold back but never removes a level.
- **Offline:** the service worker only runs in production builds (`npm run build && npm run preview`) and needs HTTPS or localhost. To install on a phone, host `dist/` on any static HTTPS host.
