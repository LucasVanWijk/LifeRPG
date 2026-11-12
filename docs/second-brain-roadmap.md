# Second-brain roadmap

The guild game is the reward layer. This roadmap is about the other half: making Questlog a place you trust with your life and reach for first. It comes from a critical review of the app as a user (November 2026). Each idea keeps its letter and number from that review so decisions can refer back to it.

Status: **built** (November 2026), sections 1 to 10. The Google parts (Drive auto-sync, Calendar sync) are written against Google's API documentation and covered by unit tests with a faked network; they still need a live check with a real client ID. **High priority was:** Home order (K1) and Google Calendar sync (H1).

Notes on how it was built, where it differs from the plan above:

- **Settings** is the existing Profile sheet (the wrench on Home): Home layout, Drive sync and Calendar sync live there.
- **Merge** stamps items in one place (`stamp` in `src/domain/merge.ts`, called by the store's `commit`), so no action has to remember to set `updated`. New ids are at least the current time, so two offline devices never hand out the same id.
- **Google events** are kept in a local cache, not in the log (so they don't end up in the Drive file); only events made in Questlog carry a link to their Google copy. Google's repeating events arrive expanded, one event per occurrence.
- **Plan your day** counts everything on Today's list (due and picked) towards the "too full" warning of more than 6 points.
- **Dated lines in notes** end in `@2026-12-01`.

## Order of work

1. **Home order** (K1, high priority). Small, and changes every visit.
2. **Per-item merge** (section 2, first part). Everything after this keeps `updated` times right from the start.
3. **Automatic Drive sync** (section 2).
4. **Google Calendar sync** (H1, high priority). Reuses the Google sign-in from Drive.
5. **Notes replace the Codex** (C1) with **clickable links** (L2), then **share target** (B2, which saves into notes), **shortcuts** (B3) and **voice** (B4).
6. **Quests:** times (E3), pick today (E5), repeating (E1), someday (E8), stale (E11). Then **calendar day and week views** (H3, which uses quest times) and **preparation quests** (H4).
7. **Companions:** more details (G2), groups (G5), keep in touch (G1).
8. **Habits with amounts** (F2) and **log tomes** (C6).

## 1. Home order (K1, high priority)

**Goal:** opening the app shows what to do today, not banners and the game.

- On a phone, **Today's Quests comes first**, above the fold. Then Habits, Up next, the week, and (once G1 exists) Keep in touch.
- **The guild becomes a one-line strip** (crest, Champion, level, gold, "next back in…"), tapping through to the Guild tab. The full card goes.
- **Notices collapse into one slim line** (backup due, Safari warning, weekly review ready) that expands on tap, instead of three tall cards.
- **Sections can be reordered and hidden** in Settings (Today, Habits, Up next, Week, Keep in touch, Guild strip). The order is stored with your data, so it syncs between devices.
- Quick-add stays at the top, but as a single compact line.

## 2. Automatic Drive sync (A1)

**Goal:** your log is on every device you use, kept up to date without pressing Save and Load.

**Decision:** keep Google Drive for now. A small encrypted sync server can replace it later (see the end of this section); the merge below works for both.

### Per-item merge (needed first)

Today the whole log is one blob, and loading a copy replaces everything. Automatic sync would then lose whatever changed on the other device. So:

- Every item (quest, habit, campaign, companion, tome, note, event) gets an `updated` time.
- Deleting leaves a small tombstone (`{ id, deletedAt }`) for 60 days, so a deletion on one device wins over an older copy on another.
- Two copies merge item by item: the newer `updated` wins. Quests merge per field (title, due, status, steps), so editing a quest's due date on the phone and its notes on the laptop keeps both.
- Habit check-ins merge as sets (a check-in on either device counts).
- The guild merges as a whole, newest wins: it is a simulation that can't be split field by field. The ledger of real-life payments is merged by key, so XP is never paid twice.

This also gives E11 (stale quests) its "last touched" date.

### How Drive sync works

- Once connected, the app **loads and merges** the Drive copy when it opens, and **saves** a few seconds after each change and when it goes to the background.
- **The sign-in limit:** Google's sign-in in the browser lasts an hour and can only be renewed through a popup, which browsers only allow after a tap. So when it has expired, a small "Sync paused · tap to resume" line appears on Home; one tap renews it for the next hour. Changes made meanwhile are kept and sent on the next sync.
- The status is always visible in Settings: last synced, and from which device.
- The manual backup file stays as an extra copy.

### Later: own sync server

When there is a server, the recommended setup is a small relay (for example Cloudflare Workers with KV storage) with end-to-end encryption: devices are paired by scanning a QR code, everything is encrypted before it leaves the device, there's no sign-in to expire, and the server can't read anything. Losing every device and the recovery code would mean the data is gone for good.

| | Drive (now) | Own relay, encrypted (later) |
|---|---|---|
| Who can read it | You and Google | Only you |
| Automatic | While signed in; one tap an hour | Always |
| Account | Google | None (QR pairing) |
| Runs on | Nothing of yours | A free serverless account you own |

## 3. Google Calendar sync (H1, high priority)

**Goal:** one calendar. Your Google events show in Questlog, and events made in Questlog land in Google.

- Uses the same Google sign-in as Drive, with access to calendar events added (and the same one-tap-an-hour limit).
- **Choose calendars:** pick which Google calendars to show, and which one new Questlog events go to.
- **Both ways:** creating, editing or deleting an event in either place changes it in the other. Changes are fetched incrementally (only what changed since the last sync), on open and every few minutes while open.
- **Repeating events:** Google's repeat rules are richer than Questlog's. Questlog shows every occurrence, and you can edit a single occurrence; changing the whole series opens it in Google Calendar.
- **Conflicts:** the most recently changed version wins.
- **Range:** from 30 days back to a year ahead.
- Imported `.ics` events stay as they are. Quest deadlines and birthdays stay in Questlog only (sending them to Google is H5, not decided).
- **Setup note:** calendar access is a sensitive permission. For personal use the Google project can stay in testing mode with you as a test user; a public release would need Google's verification.

## 4. Notes replace the Codex (C1) with clickable links (L2)

**Goal:** a place for anything that isn't a task: ideas, meeting notes, recipes, how the boiler works, the wifi password.

- The Glossary keeps three tabs: **Companions**, **Tomes**, **Notes** (the Codex tab goes).
- A note has a title, a body, an optional icon, a pin, and created and updated times.
- The body is plain text with a little formatting: headings (`#`), lists (`-`), checkboxes (`[ ]`), and bold. Typing stays plain text, so nothing is lost if the format changes later.
- **Dates in notes:** a note can carry dated lines (as Codex fields could), and they keep showing on the calendar and Home week as Glossary dates.
- Search covers note titles and bodies.
- **Migration:** each Codex entry becomes a note. Its subtitle becomes the first line, and each field becomes a `Label: value` line; dated fields become dated lines. The Glossary quick-add that went to the "Reminders" Codex entry makes a note instead.

### Clickable links everywhere (L2)

- Web addresses become links in notes, quest notes, companion notes, tome items and event notes.
- Phone numbers and email addresses become call and mail links; an event's location opens in maps.
- Links open in a new tab and never while you're editing the text.

## 5. Capture from anywhere

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

## 6. Quests

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

- An open quest untouched for 30 days, with no due date ahead, counts as stale. "Touched" means any edit, step ticked or note added (the `updated` time from section 2).
- The weekly review lists stale quests with four buttons: **Today**, **Schedule**, **Someday**, **Drop**.

## 7. Calendar views and preparation

### Day and week views with hours (H3)

- Besides the month grid, a **week** view (seven columns) and a **day** view, both with an hour grid from morning to night and all-day items in a strip at the top.
- Timed events, Google events and quests with a time (E3) sit in their slots; overlapping items share the width.
- **Time blocking:** drag a quest onto a slot to give it that date and time; drag an event to move it (and, for Google events, in Google too).
- On a phone the day view is the default; the week view scrolls sideways.

### Preparation quests from events (H4)

- An event's sheet has **"Add a quest for this"**. The quest is due the day before by default (or the same day for evening events), linked to the event, and carries the people from the event.
- The event shows its linked quests and whether they're done; the quest shows which event it's for.
- Moving the event offers to move its quests by the same amount.

## 8. Companions

### More details (G2)

- Optional fields: phone, email, address, birth year (to show age), partner, children, how you met, likes, dislikes, sizes, and gift ideas.
- Partner and children can link to other companions. Gift ideas can link to a tome.
- Any extra label and value can be added too, as the Codex allowed.
- Phone, email and address are links (call, mail, open in maps), from L2.

### Groups (G5)

- A companion can belong to groups (Family, Colleagues, Football team). The list can be filtered by group.
- In quest quick-add, `#family` adds everyone in the group, as `#sophie` adds one person.

### Keep in touch (G1)

- Each companion can have a rhythm: every week, two weeks, month, three months, or none.
- **Last contact** is worked out from dated notes, finished quests with them and past events with them, or set with a **"Talked today"** button that adds a dated note.
- A **Keep in touch** section on Home lists the people you're overdue with, oldest first, with "Talked today", "Plan something" (makes a quest with them) and "Later" (a week).

## 9. Habits with amounts (F2)

- A habit can have a daily amount and a unit: 8 glasses of water, 10,000 steps, 20 pages.
- Checking in adds to today's count (+1, or a step you set, or type a number). The habit is done for the day when the count reaches the amount; streaks and weekly targets count done days.
- Home shows a small progress bar instead of a tick. Rewards are paid once, when the day's amount is reached.

## 10. Reading and watching log (C6)

- A tome can be a **log**. Its items get an optional rating (1–5 stars), a date finished, and a line of review.
- Ticking an item sets its date. A log tome shows a count for this year ("14 books in 2026") and can be sorted by date or rating.

## Declined

- **B5. Smarter quick-add** (times, repeats, "remind me"): not needed.
- **B6. Photos and files**: not needed. As a result, shared images (B2) aren't saved.

## Not decided yet

From the same review, still open for a yes or no:

- **A2.** Ask the browser to keep the data (`navigator.storage.persist()`).
- **A3.** Version history: daily snapshots for 30 days.
- **A4.** Trash bin for deleted items, 30 days.
- **A5.** Export to Markdown, CSV and `.ics`.
- **A6.** Encryption with a passphrase (part of the later sync server).
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
- **G3.** More dates per companion (anniversaries, memorial days).
- **G4.** Gift prompts before birthdays.
- **G6.** Import contacts from vCard.
- **H2.** Subscribe to `.ics` links.
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
- **K2.** A softer game mode (no deaths while you're away, or auto-holiday).
- **K3.** Rewards for reviews, notes and keeping in touch; less gain from splitting tasks.
- **K4.** Plain-language names option.
- **K5.** First-run setup with starter habits, tomes and people.
- **K6.** Import from Todoist, TickTick, Google Tasks or CSV.
- **L1.** Dark mode.
- **L3.** Swipe gestures and haptics.
- **L4.** Wider desktop layout.
- **L5.** Archive for finished quests as data grows.
- **L6.** Sharing a list or campaign with someone (needs a server and accounts).
