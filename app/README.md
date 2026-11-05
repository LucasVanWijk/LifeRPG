# Questlog

A parchment quest log for everyday life, built from the Claude Design handoff `Questlog.dc.html` (Questlog Mobile App Design).
React + Vite + TypeScript, installable as a PWA that works offline. Data lives in the browser (`localStorage`, key `questlog:v2`); there is no backend. A new log starts empty at level 1 and asks for your name.

**Back up your log.** Everything is stored in one browser. Use Profile → Export backup now and then, and Restore backup on a new device.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # domain logic (rewards, calendar, .ics import, the guild); runs in UTC
npm run build      # typecheck + production build into dist/
```

## Google Drive sync (optional)

Profile → Google Drive saves the whole log to `questlog-backup.json` in your own Drive and loads it back, only when you press a button. The browser talks to Google directly with the `drive.file` scope (the app sees only files it created); there is no server. Set it up once:

1. In Google Cloud Console create a project, enable the **Google Drive API**, configure the OAuth consent screen (External, add yourself as a test user, scope `.../auth/drive.file`).
2. Create an **OAuth client ID** of type *Web application* with the authorised JavaScript origins `https://lucasvanwijk.github.io` and `http://localhost:5173`.
3. Locally put `VITE_GOOGLE_CLIENT_ID=<client id>` in `app/.env.local` (git-ignored). For the live site add a repository secret named `GOOGLE_CLIENT_ID` (Settings → Secrets and variables → Actions); the deploy workflow passes it to the build.

Without a client ID the Drive section is hidden. The ID is public by nature (it ships in the built JavaScript); the secret only keeps it out of the source.

## Layout

The app switches between the mobile layout (bottom tab bar, bottom sheets) and the desktop layout (sidebar, side panel) at 900px width.

| Path | What it holds |
| --- | --- |
| `src/domain/` | Types, quadrants and sizes, the reward formulas (Main Quests ×1.5), quest/habit/campaign payout logic, streaks, date helpers, the design's sample data (used by tests only) |
| `src/domain/migrate.ts` | Upgrades saved data and imported backups to the current format |
| `src/domain/quickadd.ts` | The quick-add shorthand parser |
| `src/domain/calendar.ts`, `src/domain/ics.ts` | Calendar items (repeats, deadlines, Glossary dates) and the .ics importer |
| `src/domain/guild/` | The guild: content tables, the engine (time, outings, real-life payments), the resolver and exact odds |
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
| Guild | `?screen=guild` · `&gtab=board` / `tavern` / `chronicle` |

`?layout=mobile` or `?layout=desktop` forces a layout regardless of width.

## Notes

- To start over, clear the site's `localStorage`.
- **Quests and habits are separate.** Quests are one-off tasks on the board, optionally with a checklist of steps; ticking the last step offers to complete the quest. Habits repeat daily, or weekly with a target of 1–7 days a week; they are checked in on Home and pay half a quest of the same size. A streak counts periods in a row that met the target.
- **Home** shows Today's Quests, Up next (open Main Quests that aren't due today), habits, the week, and a reminder when the last backup is more than 14 days old. History (from the Champion card) lists everything completed by week. The wrench in the corner opens Settings and backup.
- **Quick add:** the bar on Home and the Quest Board pins a quest from one line, e.g. `Paint walls !main @study fri ~L #Sophie`. `!c/!m/!e/!s` (or `!crisis`…) sets the zone, `@word` a campaign (any word of its name), `~S/~M/~L` the size, `#name` a companion (repeat for more), and `today`, `tomorrow`, `mon`–`sun`, `3 oct`, `+3d`, `+2w` or `2026-10-03` the due date. Everything else is the title.
- **Companions on quests:** a quest can involve several companions; they show on its card, and each companion's page lists their quests.
- **The guild** (Guild tab) replaces the old Hero and Expeditions; the full design is in [`docs/guild-redesign.md`](../docs/guild-redesign.md). You found a guild, pick a Champion, and real-life quests, habits and campaigns pay the Champion (or a campaign's Standard-bearer) XP and attribute practice and 25% of the gold, and the guild 75%. Adventurers are hired at the Tavern, go on odd jobs and expeditions you send them on, and get injured, scarred, die or retire after a 3–15 year career. One phase (Morning, Noon, Evening) is one real hour, so a game year is 8 real days. Every outing is decided when the party leaves and revealed stage by stage; the odds shown before sending are exact. The clock keeps running while the app is closed, and a summary shows what happened. Add `?dev` to the address for a time-skip in Settings. All numbers live in `src/domain/guild/content.ts`. The Town tab builds and raises 22 buildings (food, housing, happiness and order must keep up), the Legacy tab holds the Hall of Heroes, Garden of Valor, records and eras, and Settings has holiday mode. Adventurers have two traits each (75 exist, all in `src/domain/guild/traits.ts`) a generated backstory, a conviction and a vow (all in `src/domain/guild/vows.ts`); Paladins, Druids and Bards fill two roles.
- **Calendar** (its own tab): the whole month, with your events plus quest deadlines, birthdays and dated Glossary notes filled in automatically. Each kind has a fixed colour and marker shape (event ● blue, quest deadline ■ red, birthday ▲ pink, Glossary date ◆ green). Events can be all-day, timed or span several days, repeat daily/weekly/monthly/yearly (every N, optional end date), and have a location, notes and companions. Changes to a repeating event apply to the whole series. There are no reminders. **Import** reads an `.ics` file once (e.g. Google Calendar → Settings → Import & export → Export); re-importing the same file skips events already imported. Repeat rules Questlog can't express (e.g. several weekdays) are imported as simpler repeats and counted.
- **Weekly review:** from Sunday, Home offers a review of the week (done quests, habit results, overdue quests to reschedule, the next 7 days); it is also in History.
- **Overdue quests** can be moved to tomorrow, next week or no date from Home or the quest sheet. **Duplicate** in Edit quest copies a quest with its steps unticked.
- **Keeping data:** the app asks the browser to keep its storage permanently and shows the result in Settings. On iPhone, Safari clears data from sites you haven't opened in 7 days unless Questlog is added to the Home Screen; the app warns about this.
- **Undo:** completing a quest, checking in a habit or deleting a quest shows an Undo button on the message for five seconds.
- **Campaign rewards** are paid when the campaign's last quest is done, and the seal shows on Home. Reopening or adding a quest the same day takes the reward back; after that the seal is kept.
- **Undoing** a completion takes its XP and gold back but never removes a level.
- **Offline:** the service worker only runs in production builds (`npm run build && npm run preview`) and needs HTTPS or localhost. To install on a phone, host `dist/` on any static HTTPS host.
