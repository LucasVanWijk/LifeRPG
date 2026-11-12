# Second-brain roadmap

The guild game is the reward layer. This roadmap is about the other half: making Questlog a place you trust with your life and reach for first. It comes from a critical review of the app as a user (November 2026). Each idea keeps its letter and number from that review so decisions can refer back to it.

Status: **planned**, nothing here is built yet. Section 1 still needs one decision (how to sync).

## 1. Automatic, private sync (A1)

**Goal:** your log is on every device you use, kept up to date without pressing anything, and nobody but you can read it.

### What every option needs first: per-item merge

Today the whole log is one blob, and loading a copy replaces everything. Automatic sync between a phone and a laptop would then lose whatever was changed on the other device. So before any sync:

- Every item (quest, habit, campaign, companion, tome, note, event) gets an `updated` time.
- Deleting leaves a small tombstone (`{ id, deletedAt }`) for 60 days, so a deletion on one device wins over an older copy on another.
- Two copies merge item by item: the newer `updated` wins. Quests merge per field (title, due, status, steps), so editing a quest's due date on the phone and its notes on the laptop keeps both.
- Habit check-ins merge as sets (a check-in on either device counts).
- The guild merges as a whole, newest wins: it is a simulation that can't be split field by field. The ledger of real-life payments is merged by key, so XP is never paid twice.

This also gives E11 (stale quests) its "last touched" date.

### Where the data goes: the options

| | Drive, encrypted | Own small relay, encrypted (recommended) | Local-first library (Evolu, Jazz) | Synced folder |
|---|---|---|---|---|
| Who can read it | Only you | Only you | Only you | Only you |
| Truly automatic | No: Google's browser sign-in lasts an hour and can only be renewed with a popup, so a phone would keep asking you to sign in | Yes | Yes | Desktop only |
| Works on iPhone and Android | Yes | Yes | Yes | No (no folder access in mobile browsers) |
| Needs an account | Google | None: devices are paired with a QR code | Their own (passkey or phrase) | None |
| What has to run | Nothing | A tiny serverless function on a free tier (for example Cloudflare Workers with KV storage) that you own | Their hosted relay, or one you host | Nothing |
| Cost of building | Small | Medium | Large: the whole storage layer moves into their database | Small |
| Main risk | Sign-in friction makes "automatic" a lie | You keep a free account alive; lose every device and the recovery key and the data is gone | A young dependency at the heart of the app | Phones left out |

**Recommendation: own small relay, end-to-end encrypted.**

- On the first device the app makes a random secret key and shows it once as a recovery code (print it or keep it in a password manager).
- A second device joins by scanning a QR code shown on the first, which holds the key and the sync address.
- Everything is encrypted in the browser (AES-GCM, WebCrypto) before it leaves. The relay stores encrypted items and their versions and can't read any of them.
- Sync runs on every change (debounced), on opening the app, and when the network comes back. No sign-in, no popups.
- Drive and the manual backup file stay as optional extra copies.

What it needs from you: a free Cloudflare account to deploy the relay to. The relay is about a hundred lines and lives in this repo with deploy steps.

## 2. Notes replace the Codex (C1)

**Goal:** a place for anything that isn't a task: ideas, meeting notes, recipes, how the boiler works, the wifi password.

- The Glossary keeps three tabs: **Companions**, **Tomes**, **Notes** (the Codex tab goes).
- A note has a title, a body, an optional icon, a pin, and created and updated times.
- The body is plain text with a little formatting: headings (`#`), lists (`-`), checkboxes (`[ ]`), bold, and links that become clickable. Typing stays plain text, so nothing is lost if the format changes later.
- **Dates in notes:** a note can carry dated lines (as Codex fields could), and they keep showing on the calendar and Home week as Glossary dates.
- Search covers note titles and bodies.
- **Migration:** each Codex entry becomes a note. Its subtitle becomes the first line, and each field becomes a `Label: value` line; dated fields become dated lines. The Glossary quick-add that went to the "Reminders" Codex entry makes a note instead.

## 3. Capture from anywhere

### Share to the app (B2)

- The installed app registers as a share target. Text and links shared from another app open Questlog with a "Save to Glossary" sheet.
- The default is a new note (title from the page title or first line, body with the text and link). It can also go to a tome as an item, or onto a companion as a note.
- **Limits:** works on Android and desktop Chrome or Edge with the app installed. iPhone Safari doesn't support share targets; an iOS Shortcut that opens the app with the text is the workaround, documented rather than built in. Shared images and files aren't kept, since attachments (B6) were declined.

### Home-screen shortcuts (B3)

- Long-press the app icon: **New quest**, **Check in a habit**, **New note**.
- Android and desktop Chrome or Edge support these; iPhone doesn't show them.

### Voice capture (B4)

- A microphone button on the quest quick-add and the Glossary quick-add, using the browser's speech recognition. The words fill the box and go through the usual quick-add parsing.
- Only shown where the browser supports it (Chrome, Edge, Safari). Note for privacy: Chrome sends the audio to Google to transcribe; the app says so the first time.

## 4. Quests

### Times on quests (E3)

- A quest's due date can carry an optional time. It shows on Today, the week strip and the calendar, sorted by time.
- Set in the quest sheet. Quick-add doesn't learn to read times (B5 was declined).

### Pick today (E5)

- A quest can be **picked for today** without changing its due date. Today's Quests shows what is due and what you picked.
- The first time you open the app each day, a short "Plan your day" card offers: anything picked yesterday and not done, Crisis quests, and Main Quests, to choose from.
- A soft warning when the day looks too full (S = 1, M = 2, L = 3 points; more than 6 picked gets a warning, never a block).
- Picks expire at the end of the day; unfinished ones are offered again the next morning.

### Repeating quests (E1)

- For life admin that repeats less often than a habit: rent, the car service, insurance, the water filter.
- A quest can repeat every N days, weeks, months or years, counted either from its due date ("rent on the 1st") or from when you finished it ("clean the oven 3 months after I last did").
- Finishing it pays as usual and creates the next one with the next due date, carrying its steps (unticked) and notes.
- Habits stay for routines with streaks; repeating quests have no streak.

### Someday (E8)

- A Someday list for things you might do but not now. Someday quests don't show on the board, don't count as open, and never become overdue.
- Move a quest there from its sheet; bring it back the same way. The weekly review shows how many there are and offers a few to bring back.

### Stale quests (E11)

- An open quest untouched for 30 days, with no due date ahead, counts as stale. "Touched" means any edit, step ticked or note added (the `updated` time from section 1).
- The weekly review lists stale quests with four buttons: **Today**, **Schedule**, **Someday**, **Drop**.

## 5. Habits with amounts (F2)

- A habit can have a daily amount and a unit: 8 glasses of water, 10,000 steps, 20 pages.
- Checking in adds to today's count (+1, or a step you set, or type a number). The habit is done for the day when the count reaches the amount; streaks and weekly targets count done days.
- Home shows a small progress bar instead of a tick. Rewards are paid once, when the day's amount is reached.

## 6. Reading and watching log (C6)

- A tome can be a **log**. Its items get an optional rating (1–5 stars), a date finished, and a line of review.
- Ticking an item sets its date. A log tome shows a count for this year ("14 books in 2026") and can be sorted by date or rating.

## Order of work

1. **Per-item merge** (section 1, first part). Everything after this keeps `updated` times right from the start.
2. **Sync** (section 1), once the option is chosen.
3. **Notes replace the Codex** (2), then **share target** (B2, which saves into notes), **shortcuts** (B3) and **voice** (B4).
4. **Quests:** times (E3), pick today (E5), repeating (E1), someday (E8), stale (E11).
5. **Habits with amounts** (F2) and **log tomes** (C6).

## Declined

- **B5. Smarter quick-add** (times, repeats, "remind me"): not needed.
- **B6. Photos and files**: not needed. As a result, shared images (B2) aren't saved.

## Not decided yet

From the same review, still open for a yes or no:

- **A2.** Ask the browser to keep the data (`navigator.storage.persist()`).
- **A3.** Version history: daily snapshots for 30 days.
- **A4.** Trash bin for deleted items, 30 days.
- **A5.** Export to Markdown, CSV and `.ics`.
- **A6.** Encryption with a passphrase (part of the recommended sync option).
- **B1.** One inbox for anything, sorted later.
- **C2.** Links between everything (`[[Sophie]]`) with backlinks.
- **C3.** A daily page: a few lines, mood and energy, filled with the day's quests, habits and events.
- **C4.** Tags across quests, notes, events and Glossary.
- **C5.** Resurfacing: "on this day a year ago" and old notes.
- **C7.** Templates for checklists and campaigns.
- **D1.** One search across everything.
- **D2.** Command bar and keyboard shortcuts on desktop.
- **D3.** Saved views.
- **D4.** A searchable logbook of everything completed.
- **E2.** Reminders and notifications (needs a small push service).
- **E4.** Hide a quest until a start date.
- **E6.** "Waiting on someone" status with a nudge.
- **E7.** A next step per campaign, and ordered steps.
- **E9.** Context and energy tags, and "what can I do now?".
- **E10.** Manual order and bulk edit.
- **E12.** Focus timer on a quest.
- **F1.** More habit schedules: weekdays, times a month, every N days.
- **F3.** Quitting habits ("days since").
- **F4.** Pause a habit without losing the streak.
- **F5.** Habit history: year heatmap, monthly rate, notes per check-in.
- **F6.** Habit order by time of day, and archiving.
- **G1.** Keep-in-touch reminders per companion.
- **G2.** More details per companion (phone, address, family, sizes, birth year).
- **G3.** More dates per companion (anniversaries, memorial days).
- **G4.** Gift prompts before birthdays.
- **G5.** Companion groups.
- **G6.** Import contacts from vCard.
- **H1.** Google Calendar two-way sync.
- **H2.** Subscribe to `.ics` links.
- **H3.** Day and week views with hours, and time blocking.
- **H4.** Preparation quests from events.
- **H5.** Export deadlines and birthdays to your phone's calendar.
- **I1.** Documents and expiry dates.
- **I2.** Subscriptions and bills, with totals and renewal quests.
- **I3.** A simple money log and budget.
- **I4.** Health log: medication, visits, numbers over time.
- **I5.** Home and car maintenance history.
- **I6.** Shopping list with aisles and staples.
- **I7.** Meal planner and recipes.
- **I8.** Trip template.
- **J1.** Life areas and monthly balance.
- **J2.** A guided weekly review.
- **J3.** Monthly, quarterly and yearly reviews with goals.
- **J4.** Statistics.
- **J5.** Year in review.
- **J6.** Mood against habits.
- **K1.** Home order: Today first, guild card smaller, reorderable sections.
- **K2.** A softer game mode (no deaths while you're away, or auto-holiday).
- **K3.** Rewards for reviews, notes and keeping in touch; less gain from splitting tasks.
- **K4.** Plain-language names option.
- **K5.** First-run setup with starter habits, tomes and people.
- **K6.** Import from Todoist, TickTick, Google Tasks or CSV.
- **L1.** Dark mode.
- **L2.** Clickable links (part of Notes for note bodies).
- **L3.** Swipe gestures and haptics.
- **L4.** Wider desktop layout.
- **L5.** Archive for finished quests as data grows.
- **L6.** Sharing a list or campaign with someone (needs a server and accounts).
