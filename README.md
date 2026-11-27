# Shelp

**Where is each board game on the shelves?** Shelp is a personal web app for Adam's board game collection. It shows a to-scale drawing of the IKEA BOAXEL shelves with every box on it, finds any game, keeps box sizes and categories, imports the BoardGameGeek collection export, and works offline on a phone.

- **Live app:** https://macskasa.github.io/Shelp/
- **Status:** the MVP is done. Phase A (Tony) moved the data to schema 2: games on games, bridges, which side is up, pizza games, the board, and undo. Phase B moved the three parts onto it, and the old v1 code is gone. **Phase C is moving games by hand:** saved versions, compare, Delete game, placing mode and the board strip are in; new and moved stacks are next (Bruce, `docs/part-b3.md`). Game families (B2) and free space (D3) are being built. What works and what isn't built yet: [Releases and stories](#releases-and-stories).

## Contents

- [Run it locally](#run-it-locally)
- [Target devices](#target-devices)
- [How it's built](#how-its-built)
- [Releases and stories](#releases-and-stories)
- [Team](#team)
- [How we work](#how-we-work)
- [Repository layout](#repository-layout)

## Run it locally

```sh
python3 -m http.server 8000   # in the repo root, then open http://localhost:8000/?nosw
node --test --test-reporter=dot   # run all tests quietly (Node 20+); GitHub also runs them on every push
```

There is no build step and nothing to install. Your data lives in the browser's localStorage. To start fresh, run `localStorage.clear()` in the browser console and reload.

## Target devices

- **Samsung Galaxy S22 Ultra and S24 Ultra**: the app is installed from Chrome to the home screen. Screen width 384 CSS px (412 px at a smaller screen zoom). Both phones have an S Pen.
- **Computer**: desktop Chrome, mouse and keyboard.

It works on other screens too (down to 360 px), but these are the ones it is tuned and tested for. Details are in [docs/CONTEXT.md](docs/CONTEXT.md#target-devices).

## How it's built

- **Plain JavaScript ES modules, SVG and CSS.** No framework, no npm packages, no CDNs. GitHub Pages serves the files as they are.
- **Data:** `data/seed.json` holds the 204 games and the shelf plan "v5 – brackets" worked out in the planning chat. It is in schema 2 (boxes with positions; a box can rest on the floor, on one box, or across two), and on first start the app copies it into localStorage. After that all changes stay in the browser, and every change can be undone. Backups are the same JSON format.
- **Shelves are hard-coded** in `js/core/shelves.js`: three 200 cm wall shelves (units 60 | 80 | 60, 8 cm overhang at the wall end, BOAXEL brackets under the top two levels), the 80 cm unit under the stairs with three heights, and the narrow 8 cm shelf. There is no settings screen.
- **BGG integration is offline:** Adam exports his collection as CSV on BoardGameGeek and imports the file. (Browsers can't call BGG directly. A live refresh would need a small server, story E4.)
- **Offline:** a service worker caches the app, so it works without internet once it has been opened, and it can be added to the home screen.
- **Big re-plans stay in chat.** The full automatic re-planning search (story D5) is heavy, so Tony runs it in Python in chat and Adam imports the resulting plan file.

The data model, the shared modules and all conventions are in [docs/CONTEXT.md](docs/CONTEXT.md).

## Releases and stories

Status on 2026-11-27: ✅ in the app · 🚧 partly built · ⬜ not built yet.

**Bug or missing feature?** If something marked ✅ misbehaves, it's a bug: please raise an issue. If it's 🚧 or ⬜, or it's listed under [Not built yet](#not-built-yet), it's a feature that's still missing. Raise an issue anyway if you want it sooner or differently.

Size: S ≈ 1–2 points, M ≈ 3–5, L ≈ 8, XL ≈ 13.

### MVP (40 points): all done

| ID | Story | Size | Owner | Status |
|---|---|---|---|---|
| A1 | Import my BGG collection export | M5 | Stephen | ✅ |
| A2 | Start with today's catalog and plan (seed data) | S2 | Tony | ✅ |
| A3 | Box sizes: edit, "size missing", link to BGG versions | S2 | Stephen (panel) · Peter (filter) | ✅ |
| A5 | Expansions stored inside the base box | S2 | Stephen | ✅ (search by title or BGG name, #62) |
| A6 | Searchable catalog list | S3 | Peter | ✅ |
| B1 | Categories with several tags and colours | S2 | Stephen (editing) · Tony (colours) | ✅ |
| C1 | Built-in shelf model | M3 | Tony (numbers) · Bruce (geometry) | ✅ |
| C2 | To-scale front view | M5 | Bruce | ✅ (plus the back row, #47) |
| C3 | Stack details | S2 | Bruce | ✅ |
| C4 | Where's my game? | S2 | Peter | ✅ |
| C5 | Special placements and objects (castle, bonsai, KLASK, standing cards, 2 deep) | M5 | Bruce | ✅ |
| C6 | Cupboard list, move between cupboard and a stack | S2 | Bruce | ✅ |
| E1 | Works offline on my phone | M3 | Peter | ✅ |
| E2 | Backup, restore and plan import | S2 | Stephen | ✅ |

### Next

| ID | Story | Size | Owner | Status |
|---|---|---|---|---|
| A4 | Add games that aren't in my BGG list | S1 | Stephen | ✅ (and Delete game, #50) |
| B2 | Game families (Azul, 7 Wonders, Mars…) | S2 | Tony (schema) · Stephen | 🚧 family editing, the rule and suggestions ([part-a5](docs/part-a5.md)); the map highlight and a catalog filter later |
| D1 | Move a game (drag on desktop, pick a spot on phone) | L8 | Bruce | 🚧 moving works from lists and by tapping the drawing; stacks and drag and drop come next (see below) |
| D2 | Rule checker (1 cm overhang rule, heights, brackets, 2 deep only in easy spots…) | M5 | Stephen | ✅ (Data screen; behind every move) |
| D3 | Free space at a glance | S2 | Tony (logic) · Peter (screen) | 🚧 the Free space screen ([part-c4](docs/part-c4.md)) |
| D4 | Suggest a spot for a new game | L8 | Stephen (logic) · Bruce (screen) | 🚧 placing mode shows three suggestions on existing stacks; new-stack suggestions come with Bruce's stacks |
| D6 | Undo and saved versions | M5 | Tony · Peter | ✅ (undo/redo, save, restore, compare) |
| E3 | Export to spreadsheet (CSV) | S1 | Stephen | ✅ |

**D1 today:**
- ✅ **Pick up** (in stack details and on the Cupboard screen) opens a sheet: **Move**, **Turn** (only the orientations allowed, drawn to scale), **To the board**, **To the cupboard…** and **Put inside a box…** (the game panel). It says first what happens to the boxes on top.
- ✅ **Move** (in that sheet, the game panel and "Where's my game?") opens **Put on a stack…**: you choose the stack, the spot (on the shelf, on top of a box, across two boxes, or under one) and which way up. Rule problems are shown first. Every move closes the panels and shows a toast with Undo.
- ✅ **Placing mode** (`#/map?pick=<id>`, from Move): tap a stack on the drawing, or one of three suggested spots, to open the spot sheet with the stack as it would be. Cancel, Esc and Back leave it.
- ✅ **The board strip** on the Shelves screen: "Board (n)" and a chip per game; a chip opens the pick-up sheet.
- ⬜ Bruce's next PRs, in order: new, moved and removed stacks, and renumbering → drag and drop on desktop (after Adam has tried moving on his phone).

### Later

| ID | Story | Size | Status |
|---|---|---|---|
| D5 | Automatic full re-plan | XL13 | stays in chat by design: Tony plans, you import the plan file |
| D7 | Moving checklist between two plans | M3 | ⬜ (on top of compare) |
| E4 | Optional live BGG refresh (needs a small server) | L8 | ⬜ |

### Not built yet

- **New stacks in empty space, moving and removing stacks, renumbering, drag and drop** (D1, above).
- **Being on top counts as easier to reach** (#48): parked for later.
- Game families (B2) and free space at a glance (D3), in progress; the moving checklist (D7), live BGG refresh (E4).

The full story texts are in the "App user stories" tab of the planning workbook and, for the MVP, in the part briefs.

## Team

Each developer is a separate Claude chat with this repo attached. They don't see each other's chats. Everything shared lives in this repo.

| Who | Role | Brief | Folders |
|---|---|---|---|
| **Adam** | Product owner. Merges PRs. | – | – |
| **Tony** | Lead and code reviewer. Owns the shared core, data and docs. | – | `js/core/`, `js/app.js`, `index.html`, `css/base.css`, `data/`, `docs/` |
| **Stephen** | Part A – data in and out: BGG import, game panel, backup and restore. Round 2: rule checker, CSV export, add a game. Phase B: rules, export and pizza on schema 2. Phase C: bracket rule per box, Move, suggest a spot (D4), game families (B2) | [part-a](docs/part-a.md), [a2](docs/part-a2.md), [a3](docs/part-a3.md), [a4](docs/part-a4.md), [a5](docs/part-a5.md) | `js/io/`, `js/game/`, `js/rules/` |
| **Bruce** | Part B – shelf map: model, drawing, stack details, special placements, cupboard. Phase B: the map and the picker on schema 2. Phase C: moving by hand (pick up, placing mode, the board strip, stacks, drag and drop) | [part-b](docs/part-b.md), [b2](docs/part-b2.md), [b3](docs/part-b3.md) | `js/map/` |
| **Peter** | Part C – catalog, search, app frame, offline. Phase B: search wording, the board, Undo. Phase C: saved versions (D6), compare, Move, free space (D3) | [part-c](docs/part-c.md), [c2](docs/part-c2.md), [c3](docs/part-c3.md), [c4](docs/part-c4.md) | `js/catalog/`, `js/shell/`, `js/versions/`, `js/space/`, `sw.js`, `manifest.webmanifest`, `icons/` |

The three parts only meet through the contracts in `js/core/contracts.js` (`openGame`, `showOnMap`, `showStack`, `go`) and the store. Placeholders exist for each, so every part can start today and be merged in any order.

## How we work

1. Each developer works on a branch named after them (`stephen/…`, `bruce/…`, `peter/…`) and changes **only their own folders**.
2. They open a PR into `main` with the template, and Adam passes the PR number to Tony.
3. Tony reviews: contracts kept, data handled through the store, works on a phone, tests pass. Adam merges.
4. Tests run automatically on GitHub for every push (the "Tests" check on each PR).
5. Changes to shared files (`js/core/`, `index.html`, `css/base.css`, the data format) go through Tony. Developers ask in their PR under **Requests for Tony**.
6. When the shared context changes, Tony notes it under **Changes** in `docs/CONTEXT.md`, and developers read just that diff.
7. Each phase can start in a fresh chat. The opening messages are in [docs/kickoff.md](docs/kickoff.md), and the lead's handover is [docs/LEAD.md](docs/LEAD.md).

## Repository layout

```
index.html               app page (Tony)
manifest.webmanifest     PWA manifest (Peter)
sw.js                    service worker (Peter, to be added)
css/base.css             colours, basics, light/dark (Tony)
data/seed.json           204 games + plan v5 (Tony)
icons/                   app icons (Peter)
js/app.js                entry point: loads data, starts the parts (Tony)
js/core/                 store, bus, contracts, shelves, categories, format, dom, schema, geometry, plan2, space (Tony)
js/shell/                router, navigation, service worker registration (Peter)
js/catalog/              catalog list, search, where's my game (Peter)
js/versions/             saved versions and compare (Peter)
js/space/                free space at a glance (Peter)
js/map/                  shelf model, drawing, stack details, cupboard (Bruce)
js/io/                   BGG import, backup, restore, plan import (Stephen)
js/game/                 game details panel (Stephen)
tests/                   node:test files and fixtures
docs/CONTEXT.md          shared context – read first
docs/part-*.md           one brief per developer
docs/reference/          the v5 drawing from the planning chat
```

## Data and privacy

This repository is public, so the game list and shelf plan are visible to anyone. Nothing else personal is stored. The BGG sample in `tests/fixtures/` has every private column blanked.

## License

GPL-3.0, see [LICENSE](LICENSE).
