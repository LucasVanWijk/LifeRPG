# Questlog

A parchment quest log for everyday life, built from the Claude Design handoff `Questlog.dc.html` (Questlog Mobile App Design).
React + Vite + TypeScript. Data lives in the browser (`localStorage`, key `questlog:v1`); there is no backend.

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
| `src/domain/` | Types, quadrants and sizes, the reward formula (Main Quests ×1.5), completion/undo/level-up logic, date helpers, sample data |
| `src/state/store.tsx` | Persisted data + UI state and all actions, shared through a React context |
| `src/screens/` | Home, Quests (desktop board, mobile 2×2 grid, opened zone, campaigns), Glossary, Adventure |
| `src/sheets/` | Quest detail / Edit quest, New Quest, New Campaign |
| `src/styles/classical.css` | The Classical design system, unchanged except that fonts are bundled locally |
| `src/styles/app.css` | Questlog's parchment tokens (`--q-*`) and component styles |

## Deep links

The first screen can be picked with query parameters, matching the frames in the design canvas:

| Frame | URL |
| --- | --- |
| 1b Quest Board | `?screen=quests` |
| 1c Zone opened | `?screen=quests&zone=main` |
| 1d Campaign Board | `?screen=quests&view=campaign` |
| 1e Quest detail / 1o Edit quest | `?screen=quests&quest=4` / `&mode=edit` |
| 1g Tomes · 1h Codex | `?screen=glossary&cat=tomes` · `&cat=codex` |
| 1i / 1j Glossary detail | `?screen=glossary&detail=companion:sophie` · `detail=codex:car` |
| 1k Tavern | `?screen=adventure` |

`?layout=mobile` or `?layout=desktop` forces a layout regardless of width.

## Notes

- Sample data is shifted so it stays relative to the day you first open the app. Clear `localStorage` to start over.
- Bounties roll forward by their own interval (daily, weekly or monthly); the prototype always used a week.
- As in the design, a campaign's completion reward is shown but not yet paid out when its last quest is done.
