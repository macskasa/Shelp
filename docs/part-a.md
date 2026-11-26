# Part A – Data in and out · Stephen

You keep the collection data correct and safe: the BGG import, the game details panel, and backup/restore.
Read `README.md` and `docs/CONTEXT.md` first.

**You own:** `js/io/**`, `js/game/**`, `tests/io*.test.mjs`, `tests/game*.test.mjs`, `tests/fixtures/bgg-*`.
**You provide:** `provide('openGame', fn)` in `js/game/index.js` → `init()`. Every other part opens games through it.
**Screen:** `data` (route `#/data`, title "Data", order 40). Keep the id.

## Stories

### A3 + A5 + B1 – Game details panel (`js/game/`) – do this first, everyone uses it

`openGame(id)` opens a panel (a `<dialog class="panel">` or a bottom sheet on phones) for one game.

Shows: title, BGG name with a link to `https://boardgamegeek.com/boardgame/<bggId>` (or a BGG search link when `bggId` is null), type, players, play time, age, notes, and the location in words (`describeLocation`) with a **Show on map** button (`showOnMap(id)`).

- **A3 Box size.** Show the size with `formatDims`. Edit it as three number inputs; the order doesn't matter, the store sorts. Also edit `sizeSource`. Link to `https://boardgamegeek.com/boardgame/<bggId>/versions` so Adam can look up the edition's size. When the size is missing, say so clearly.
- **B1 Categories.** Four toggles (Party, Co-op, Popular, Duo), several at once, each in its category colour (`CATEGORIES`, `var(--cat-…)`).
- **A5 Inside another box.** For any game: "Stored inside: [choose a game | not inside]". Choosing a host calls `store.setInside(id, hostId)`. Taking it out calls `store.moveToCupboard(id, 'Taken out of the <host> box')`. For a host, list the games stored inside it, each tappable (`openGame`).
- Edit notes. Save each change straight away through `store.updateGame`, catch errors and show them with `toast(msg, { error: true })`.
- The panel updates if the game changes while it is open (`store:changed`).

Acceptance:
- Ethiq's size can be corrected to 22.6 × 14.6 × 5.6 and the catalog/map see it at once.
- Lairs: Box Zero shows "Inside the Lairs box (Bottom shelf · stack B4 · …)"; Lairs lists Box Zero inside.
- Keyboard: Esc closes; focus returns to where it was.

### A1 – Import my BGG collection export (`js/io/`)

Adam exports his collection on BGG as CSV and picks the file here. A real sample with the exact header is in `tests/fixtures/bgg-sample.csv`. Columns you need: `objectid`, `objectname`, `own`, `itemtype` (`standalone` / `expansion`), `minplayers`, `maxplayers`, `minplaytime`, `maxplaytime`, `bggrecagerange`.

- Write your own small CSV parser (quoted fields, `""` escapes, commas and newlines inside quotes, UTF-8, optional BOM). No packages.
- Only rows with `own = 1` count.
- **Match** a row to a game by `bggId`. Rows that match update only these fields: `bggName`, `type`, `players`, `time`, `age` (only if the game's age is empty), `inBgg = true`. Never touch `title`, `dims`, `categories`, `notes` or the plan.
- **New in BGG** (no game has that `bggId`): list them for Adam to confirm, with a checkbox each. The real export has 8 of these today (Carcassonne, Dune: Imperium, Tokaido, a few expansions…). Confirmed ones are added with `store.addGame` (title = BGG name, `inBgg: true`, Duo ticked when `maxplayers` is 2). They start **unplaced**, and Bruce's cupboard screen lists them. Unticked ones are remembered in `meta.bggIgnored` (list of ids) so the next import doesn't ask again. Offer "show ignored" to undo.
- **Missing from BGG** (games with `inBgg: true` whose id isn't in the file): list them and let Adam choose per game: *keep* (sets `inBgg: false`) or *delete* (`store.removeGame`). Never delete anything without that choice.
- Show a summary before applying: "12 updated · 3 new · 1 missing". Apply everything in one `store.batch()`. Save `meta.lastImport` (ISO time).
- Parsing and matching are plain functions in their own module, tested in Node with the fixture.

Acceptance: importing the fixture twice changes nothing the second time; titles stay Hungarian; nothing is deleted without a choice.

### E2 – Backup, restore and plan import (`js/io/`)

- **Download backup**: `store.exportData()` as `shelp-backup-YYYY-MM-DD.json`.
- **Restore / import**: pick a `.json` file → `store.validate(obj)`. If there are problems, list them (first 20) and stop. Otherwise show what will happen: a full file replaces *everything* (show game and stack counts); a plan-only file replaces only the plan. Apply after confirmation with `store.importData(obj)`.
- **Reset to the original data** (`store.resetToSeed()`), behind a confirmation, with a hint to download a backup first.
- Show `meta.lastImport` and when the last backup was downloaded (keep that in `meta.lastBackup`).

Acceptance: backup → `localStorage.clear()` → restore gives back the same data; a plan file Tony makes in chat (`{ "app": "shelp", "schema": 1, "plan": {…} }`) imports.

## What you get ready made

The store with every read/write you need, validation, `toast`, `h()`, `formatDims`, `describeLocation`, category colours, and a fallback panel that shows how `openGame` is wired. See CONTEXT section 5.

## Not yours (don't build)

The catalog list and the "size missing" filter (Peter), the map and moving games between stacks (Bruce), adding games by hand (A4, next release), CSV export to the spreadsheet (E3, next release).
