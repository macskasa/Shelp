# Shelp

**Where is each board game on the shelves?** Shelp is a personal web app for Adam's board game collection. It shows a to-scale drawing of the IKEA BOAXEL shelves with every box on it, finds any game, keeps box sizes and categories, imports the BoardGameGeek collection export, and works offline on a phone.

- **Live app:** https://macskasa.github.io/Shelp/
- **Status:** starter kit ready, MVP being built by three developers in parallel (see [Team](#team)).

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
python3 -m http.server 8000   # in the repo root, then open http://localhost:8000
node --test                   # run all tests (Node 20+)
```

There is no build step and nothing to install. Your data lives in the browser's localStorage. To start fresh, run `localStorage.clear()` in the browser console and reload.

## Target devices

- **Samsung Galaxy S22 Ultra and S24 Ultra**: the app is installed from Chrome to the home screen. Screen width 384 CSS px (412 px at a smaller screen zoom). Both phones have an S Pen.
- **Computer**: desktop Chrome, mouse and keyboard.

It works on other screens too (down to 360 px), but these are the ones it is tuned and tested for. Details are in [docs/CONTEXT.md](docs/CONTEXT.md#target-devices).

## How it's built

- **Plain JavaScript ES modules, SVG and CSS.** No framework, no npm packages, no CDNs. GitHub Pages serves the files as they are.
- **Data:** `data/seed.json` holds the 204 games and the shelf plan "v5 – brackets" worked out in the planning chat. On first start the app copies it into localStorage. After that all changes stay in the browser. Backups are the same JSON format.
- **Shelves are hard-coded** in `js/core/shelves.js`: three 200 cm wall shelves (units 60 | 80 | 60, 8 cm overhang at the wall end, BOAXEL brackets under the top two levels), the 80 cm unit under the stairs with three heights, and the narrow 8 cm shelf. There is no settings screen.
- **BGG integration is offline:** Adam exports his collection as CSV on BoardGameGeek and imports the file. (Browsers can't call BGG directly. A live refresh would need a small server, story E4.)
- **Offline:** a service worker caches the app, so it works without internet once it has been opened, and it can be added to the home screen.
- **Big re-plans stay in chat.** The full automatic re-planning search (story D5) is heavy, so Tony runs it in Python in chat and Adam imports the resulting plan file.

The data model, the shared modules and all conventions are in [docs/CONTEXT.md](docs/CONTEXT.md).

## Releases and stories

Size: S ≈ 1–2 points, M ≈ 3–5, L ≈ 8, XL ≈ 13.

### MVP (40 points)

| ID | Story | Size | Owner |
|---|---|---|---|
| A1 | Import my BGG collection export | M5 | Stephen |
| A2 | Start with today's catalog and plan (seed data) | S2 | Tony ✅ |
| A3 | Box sizes: edit, "size missing", link to BGG versions | S2 | Stephen (panel) · Peter (filter) |
| A5 | Expansions stored inside the base box | S2 | Stephen |
| A6 | Searchable catalog list | S3 | Peter |
| B1 | Categories with several tags and colours | S2 | Stephen (editing) · Tony (colours ✅) |
| C1 | Built-in shelf model | M3 | Tony (numbers ✅) · Bruce (geometry) |
| C2 | To-scale front view | M5 | Bruce |
| C3 | Stack details | S2 | Bruce |
| C4 | Where's my game? | S2 | Peter |
| C5 | Special placements and objects (castle, bonsai, KLASK, standing cards, 2 deep) | M5 | Bruce |
| C6 | Cupboard list, move between cupboard and a stack | S2 | Bruce |
| E1 | Works offline on my phone | M3 | Peter |
| E2 | Backup, restore and plan import | S2 | Stephen |

### Next

| ID | Story | Size |
|---|---|---|
| A4 | Add games that aren't in my BGG list | S1 |
| B2 | Game families (Azul, 7 Wonders, Mars…) | S2 |
| D1 | Move a game (drag on desktop, pick a spot on phone) | L8 |
| D2 | Rule checker (1 cm overhang rule, heights, brackets, 2 deep only in easy spots…) | M5 |
| D3 | Free space at a glance | S2 |
| D4 | Suggest a spot for a new game | L8 |
| D6 | Undo and saved versions | M5 |
| E3 | Export to spreadsheet (CSV) | S1 |

### Later

| ID | Story | Size |
|---|---|---|
| D5 | Automatic full re-plan – keep doing it in chat and import the result | XL13 |
| D7 | Moving checklist between two plans | M3 |
| E4 | Optional live BGG refresh (needs a small server) | L8 |

The full story texts are in the "App user stories" tab of the planning workbook and, for the MVP, in the part briefs below.

## Team

Each developer is a separate Claude chat with this repo attached. They don't see each other's chats. Everything shared lives in this repo.

| Who | Role | Brief | Folders |
|---|---|---|---|
| **Adam** | Product owner. Merges PRs. | – | – |
| **Tony** | Lead and code reviewer. Owns the shared core, data and docs. | – | `js/core/`, `js/app.js`, `index.html`, `css/base.css`, `data/`, `docs/` |
| **Stephen** | Part A – data in and out: BGG import, game panel, backup and restore | [docs/part-a.md](docs/part-a.md) | `js/io/`, `js/game/` |
| **Bruce** | Part B – shelf map: model, drawing, stack details, special placements, cupboard | [docs/part-b.md](docs/part-b.md) | `js/map/` |
| **Peter** | Part C – catalog, search, app frame, offline | [docs/part-c.md](docs/part-c.md) | `js/catalog/`, `js/shell/`, `sw.js`, `manifest.webmanifest`, `icons/` |

The three parts only meet through the contracts in `js/core/contracts.js` (`openGame`, `showOnMap`, `showStack`, `go`) and the store. Placeholders exist for each, so every part can start today and be merged in any order.

## How we work

1. Each developer works on a branch named after them (`stephen/…`, `bruce/…`, `peter/…`) and changes **only their own folders**.
2. They open a PR into `main` with the template, and Adam passes the PR number to Tony.
3. Tony reviews: contracts kept, data handled through the store, works on a phone, tests pass. Adam merges.
4. Changes to shared files (`js/core/`, `index.html`, `css/base.css`, the data format) go through Tony. Developers ask in their PR under **Requests for Tony**.
5. When the shared context changes, Tony notes it under **Changes** in `docs/CONTEXT.md`, and developers re-read it.

## Repository layout

```
index.html               app page (Tony)
manifest.webmanifest     PWA manifest (Peter)
sw.js                    service worker (Peter, to be added)
css/base.css             colours, basics, light/dark (Tony)
data/seed.json           204 games + plan v5 (Tony)
icons/                   app icons (Peter)
js/app.js                entry point: loads data, starts the parts (Tony)
js/core/                 store, bus, contracts, shelves, categories, format, dom, schema (Tony)
js/shell/                router, navigation, service worker registration (Peter)
js/catalog/              catalog list, search, where's my game (Peter)
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
