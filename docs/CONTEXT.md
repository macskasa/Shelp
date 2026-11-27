# Shelp – shared context for the team

Read this whole file before you write code, and read it again when Tony says it has changed (see **Changes** at the bottom).
Your own brief is in `docs/part-a.md`, `docs/part-b.md` or `docs/part-c.md`.

## 1. Golden rules

1. **Stay in your folders.** Every file has one owner (section 7). Change only files you own. If you need a change in a shared file, don't make it; write it under **Requests for Tony** in your PR description.
2. **Data goes through the store.** Never read or write `localStorage` yourself, and never mutate what the store gives you (it is frozen). Use the write functions in `js/core/store.js`.
3. **Parts talk only through the contracts** in `js/core/contracts.js` (`openGame`, `showOnMap`, `showStack`, `go`). Don't import another part's files.
4. **No build step, no npm packages, no CDNs.** Plain ES modules that GitHub Pages serves as they are. The app must work offline, so nothing may load from another site.
5. **Phone first, desktop too.** The main devices are two Samsung Galaxy Ultra phones, with the app installed from Chrome. It must also work well on a computer. See **Target devices** in section 2.
6. **English UI.** Game titles stay as they are (mostly Hungarian). Sizes are in cm.
7. **Small PRs, with tests for logic.** The **Tests** check on GitHub must be green.
8. **Save tokens.** Read diffs, not whole files you already know. Run your own tests quietly. Keep PR descriptions short. Never print `data/seed.json`. Details are in sections 8 and 9.

## 2. What the app is for

Adam has about 200 board games on IKEA BOAXEL shelves, a few in a cupboard. Over many sessions, Tony and Adam planned where every box goes (plan "v5 – brackets"). Shelp shows that plan as a to-scale drawing, finds any game ("where's my game?"), keeps box sizes and categories, imports the BGG collection export, and backs everything up as one JSON file. There is no server. Data lives in the browser (localStorage) and in backup files.

### Target devices

| Device | Browser | CSS viewport (portrait) | Notes |
|---|---|---|---|
| **Samsung Galaxy S22 Ultra** (primary) | Chrome, installed to the home screen | 384 × ~824 px | S Pen built in |
| **Samsung Galaxy S24 Ultra** (primary) | Chrome, installed to the home screen | 384 × ~832 px | S Pen built in |
| Computer | Chrome (desktop) | 1280 px and wider | mouse, keyboard, trackpad |

The phone width depends on Samsung's screen zoom setting: 384 px by default, 412 px at a smaller zoom. Test both. Landscape is about 830–915 px wide.

What this means for everyone:

- **Android back gesture.** Back must close an open panel first and only then go to the previous screen. Open every panel and sheet with `showPanel()` from `js/core/dom.js`, which handles this. Never call `dialog.showModal()` yourself.
- **Installed app (standalone).** There is no browser bar, so the app needs its own way back to every screen (the nav), and it must look right edge to edge. Respect `env(safe-area-inset-*)`, especially above Samsung's gesture bar at the bottom.
- **Pointer Events, not touch events.** Use `pointerdown` / `pointermove` / `pointerup` so finger, S Pen and mouse all work with the same code. The S Pen is precise and can hover (`pointerType === 'pen'`).
- **Breakpoints:** phone < 600 px, wide 600–1023 px (phone in landscape), desktop ≥ 1024 px. Use `@media (hover: hover) and (pointer: fine)` for mouse-only touches like hover titles.
- **Desktop is a real target.** Use the space (bigger map, a table-like catalog), support the keyboard (Tab order, Enter, Esc) and the mouse wheel / trackpad. Drag and drop arrives with story D1.
- **Dark mode** is common on Samsung phones. Use the CSS variables from `css/base.css` so both themes work.
- **Testing in Chrome DevTools:** add custom devices "Galaxy S22/S24 Ultra" 384 × 832, DPR 2.8125, mobile + touch, and "Galaxy Ultra (small zoom)" 412 × 915, DPR 3.5. Then check desktop at 1440 × 900.

## 3. The shelves (domain)

All numbers are in `js/core/shelves.js` (`ZONES`, `GROUPS`, `BRACKET`). Don't copy them into your code; import them.

| Zone id | What | Length | Height (usable) | Notes |
|---|---|---|---|---|
| `top` | Top wall shelf | 200 + 8 overhang | 40 (38) | No brackets (ceiling above). Easy to reach: x 0–44. |
| `middle` | Middle wall shelf | 200 + 8 overhang | 37.5 (35.5) | Brackets at x 0, 60, 140, 200. Hard to reach. |
| `bottom` | Bottom wall shelf | 200 + 8 overhang | 38.5 (36.5) | Brackets at x 0, 60, 140, 200. All easy to reach. |
| `under-cards` | Under the stairs, left part | 31 | 17.8 (16.8) | Card games standing like books, 2 rows. |
| `under-tall` | Under the stairs, middle part | 40 | 37 (35) | Two piles. |
| `under-gap` | Under the stairs, tall gap | 9 | ~46 | Ice Cool stands upright. Height not measured. |
| `narrow` | Narrow shelf | 80 | 8 (7.9) | Flat duo games. Depth not measured (38 assumed). |

- **x** is measured in cm from the left end of a zone. On the wall shelves the left end is the stairs side, and the wall is at x = 200. Boxes may stick out up to 8 cm past the wall end (the overhang).
- The wall shelves are three units, 60 | 80 | 60 cm, so the **joints** are at x = 60 and x = 140.
- **Brackets** hang from the shelf above. Seen from the front each is a 0.4 cm wide bar centred on the joint, 6 cm tall at the back, getting lower towards the front (0 cm at the front edge). A stack may cross a bracket only if it is low enough: `bracketLimit(zone, depth)` gives the allowed height. That's why stacks start at x = 0.2 or 60.2.
- **Depth** of every shelf is 38 cm. A box deeper than that should be turned long side out (`rot: true`), or the rule checker warns.
- **Easy to reach**: top shelf 0–44, the whole bottom shelf, under the stairs, the narrow shelf. `isEasy(zoneId, x, w)`.
- The **cupboard** is not drawn. It is a list of games with a reason each.

### The rules (Adam's decisions, checked by the rule checker in `js/rules/`)

| Blocks: never allowed | Warns: allowed with "place anyway" |
|---|---|
| A game without a box size on a shelf | Less than 2 cm air under the shelf above (the usable height). A topper (castle, bonsai) may go up to 0.5 cm below the shelf. |
| A **pizza** game not lying flat | Too high where it crosses a bracket (`bracketLimit`, 1 cm air) |
| Two stacks overlapping | A box sticking out more than **1 cm** over what it rests on (`STACK_TOLERANCE`). Several boxes on one box count together; a bridge counts from the outer edges of its two supports. |
| Past the wall end (length + 8 cm overhang) | Deeper than the shelf + 0.5 cm (a stack of one standing box, like KLASK, may stick out) |
| Taller than the physical shelf gap | Two rows (2 deep) outside an easy-to-reach spot |
| A **bridge** whose two supports differ in height by more than 0.5 cm (it would tilt) | A **bridge** without enough support: its centre must be over the supports, and the gap between them at most a third of its width |

The store itself refuses the first two (missing size, pizza not flat), whatever path a change takes. The rest are the rule checker's job. The moving screens never offer "place anyway" for a blocking rule, and a plan import that breaks one is refused.

## 4. Data model (schema 2)

One file format is used for the seed (`data/seed.json`), for backups and for plan imports. **Schema 2** is current. Schema 1 files (old backups, plan files from the planning chat, today's seed) are still accepted: the store upgrades them on load or import (`js/core/plan2.js`).

```jsonc
{
  "app": "shelp",
  "schema": 2,
  "games": [ Game, … ],        // optional in a plan-only import
  "plan": Plan,
  "meta": { },                 // optional, free-form (e.g. lastImport)
  "versions": [ Version, … ]   // optional, full backups only: the saved versions (D6)
}
```

### Game

```jsonc
{
  "id": "g013",                 // stable, never reused. New games get the next number (store.addGame)
  "title": "Ark Nova",          // as printed on the box (often Hungarian) – the user's name for it
  "bggId": 342942,              // BoardGameGeek id, or null
  "bggName": "Ark Nova",        // the name on BGG (English), or null
  "type": "base",               // "base" | "expansion"
  "dims": [7, 30, 37],          // box size in cm, SORTED smallest first, or null = size missing
  "sizeSource": "HU edition",   // where the size came from, free text, or null
  "players": { "min": 1, "max": 4 },   // or null
  "time": { "min": 90, "max": 150 },   // minutes, or null
  "age": "14+",                 // free text, or null
  "categories": ["popular"],    // any of "party", "coop", "popular", "duo"
  "inBgg": true,                // is it in Adam's BGG collection?
  "notes": null,                // free text, or null
  "pizza": true                 // true: may only lie flat on its biggest side (a quarter turn is fine)
}
```

Pizza starts as `true` for every game except the 20 that stood in v5 (the card games under the stairs, KLASK, Ice Cool). New games are pizza. Don't add fields on your own. Ask Tony; the schema check (`js/core/schema.js`) and this file change together.

### Plan

```jsonc
{
  "name": "v5 – brackets",
  "stacks": [ Stack, … ],
  "cupboard": [ { "game": "g156", "reason": "No room left after the bracket and stacking rules" } ],
  "inside": { "g101": "g099" },  // expansion id → id of the box it is stored in (no nesting)
  "board": [ { "game": "g042" } ] // games moved to the board, in the order they arrived
}
```

Every game is in **at most one** place: a stack, the cupboard, inside another box, or the board. **A game with no place at all is on the board too**, after the listed ones (e.g. new from a BGG import). `store.getBoard()` gives the full board in order.

**A game without a box size (`dims: null`) is never on a stack.** It can be on the board, in the cupboard or inside another box.

### Stack

```jsonc
{
  "id": "B3",
  "zone": "bottom",
  "x": 60.2,                     // left edge, cm from the zone's left end
  "boxes": [ Box, … ],
  "topper": { "label": "LEGO castle", "w": 35, "h": 21 },   // optional object on top, centred
  "notes": ["Compile and Kontroll side by side on top"]      // optional, from the planning chat
}
```

**Box** – one game on the stack:

```jsonc
{ "game": "g036", "row": 0, "x": 0, "up": "s", "rot": false, "on": ["g178"] }
```

| Field | Meaning |
|---|---|
| `row` | 0 = front, 1 = back. A stack is 2 deep when any box has row 1. |
| `x` | cm from the stack's left edge to the box's left edge |
| `up` | which side faces up: `"s"` flat (lying on its biggest face), `"m"` on its side, `"l"` on end (like a book) |
| `rot` | `false`: the narrower of the two other sides runs along the shelf; `true`: the wider one ("long side out") |
| `on` | what it rests on: `[]` the shelf floor, `["g178"]` that box, `["a", "b"]` across two boxes (a **bridge**) |

- **Size of a box:** `boxSize(dims, up, rot)` in `js/core/geometry.js` gives `{ w, d, h }`.
- **Height comes from gravity:** a box sits on the highest of its supports. `layoutStack2(stack, getGame)` gives every box's `x, y, z, w, d, h` and the stack's `w, d, h, pileH` and topper.
- **One structure covers everything:** piles, several boxes side by side on one box, standing card games (boxes with `up: "l"` on the floor), and bridges.
- **Bridges** rest on exactly two boxes in the same row, side by side, seen from the front only (no bridges between the front and back row).

`tests/fixtures/v5-geometry.json` has the expected `x, w, d, h` of every v5 stack. The upgraded seed gives exactly these through `layoutStack2`.

### Location (from `store.locate2(id)`)

```jsonc
{ "kind": "stack", "stackId": "B3", "zone": "bottom", "row": 0, "rows": 1, "x": 0, "up": "s", "rot": false,
  "on": ["g178"], "above": ["g098"], "below": ["g178", "g102", "g104"] }
{ "kind": "inside", "hostId": "g099", "host": { …location of the host… } }
{ "kind": "cupboard", "reason": "…" }
{ "kind": "board", "index": 0 }
null   // unknown id
```

- `above` holds every box resting on it, directly or higher up, nearest first; `below` holds everything under it.
- `describeLocation2(loc, getTitle)` turns a location into text, e.g. "Bottom shelf · stack B3 · on Takenokolor · nothing on top".

### Saved versions (D6)

```jsonc
{ "id": "v3", "name": "Before the top shelf", "savedAt": "2026-11-27T10:15:00.000Z", "games": [ Game, … ], "plan": Plan }
```

- A saved version is a named copy of the games and the plan (schema 2).
- At most 10 are kept, under their own localStorage key.
- A backup carries them only when there are any. Importing a full backup **with** `versions` replaces them; any other import, and "Reset to the original data", leaves them alone.
- One broken version makes a backup invalid.

### The v1 shape, during Phase B only

Until every part has moved to schema 2, the old reads still work. They are computed from the v2 data:
- `getPlan()` / `getStack()`: stacks with `orientation` and `rows` of items, as before.
- `locate()`: `index`, `side`, `above`; games on the board are `'unplaced'`.
- `placeOnStack()`.

**New code uses only the v2 functions.** Tony removes the v1 shape when Phase B is done.

## 5. What you get ready made (`js/core/`, owner Tony)

| Module | What it gives you |
|---|---|
| `store.js` | `init()`. **Reads (v2):** `getGames()` (sorted by title), `getGame(id)`, `getPlan2()`, `getStack2(id)`, `locate2(id)`, `getBoard()`, `getMeta()`, `exportData()`, `validate(obj)`, `canUndo()`, `canRedo()`. **Writes:** `updateGame(id, patch)`, `addGame(fields) → id`, `removeGame(id)`, `moveToBoard(id)`, `moveToCupboard(id, reason)`, `setInside(id, hostId)`, `placeBox(id, { stackId, row, on, index, up, rot })`, `placeUnder(id, targetIds, { up, rot })`, `turnBox(id, { up, rot })`, `createStack(zone, { x }) → id`, `moveStack(id, x)`, `removeStack(id)` (games go to the board), `renumberStacks() → { old: new }`, `undo()`, `redo()`, `preview(fn) → { plan, games, error }` (try writes without keeping them), `replacePlan(plan)`, `importData(obj) → 'all' \| 'plan'`, `resetToSeed()`, `setMeta(key, value)`, `batch(fn)`. **Saved versions:** `listVersions()` (newest first, `{ id, name, savedAt, games, stacks }` with counts), `getVersion(id)`, `saveVersion(name) → id` (1–60 characters, at most `MAX_VERSIONS` = 10), `restoreVersion(id)` (one undo step), `renameVersion(id, name)`, `deleteVersion(id)`. Saving, renaming and deleting fire `store:changed` with `versions: true`, aren't undo steps, and are refused inside `preview` / `batch`. Every write except `setMeta` and those three is one undo step (a `batch` is one step, up to 30 kept). Writes throw an `Error` with a readable message (and `err.problems`, a list, when there are several). **v1 (Phase B only):** `getPlan()`, `getStack(id)`, `locate(id)`, `placeOnStack(id, stackId, { row, index })`. |
| `geometry.js` | `boxSize(dims, up, rot) → { w, d, h }`, `layoutStack2(stack, getGame) → { w, d, h, pileH, rows, boxes, topper }`. The geometry of schema 2, shared by everyone. |
| `plan2.js` | The upgrade from schema 1, the v1 view and the edit operations behind the store. **Don't call it directly**; use the store. Two exceptions: `locations2(plan)` is a pure read that works on any plan (Peter's compare), and Stephen's `js/rules/suggest.js` may run `detach` / `insertOn` on its **own copy** of a plan. Never on store data. |
| `bus.js` | `on(type, fn) → unsubscribe`, `emit(type, detail)`. Events: `store:changed` `{ games: id[] \| null, plan: bool }` (null = everything changed), `store:error` `{ message }` (app.js shows it), `route:changed` `{ id, params }`. |
| `contracts.js` | `openGame(id)`, `showOnMap(gameId)`, `showStack(stackId)`, `pickUp(gameId)` (placing mode, `#/map?pick=<id>`), `go(screen, params)`, `provide(name, fn)`. |
| `shelves.js` | `ZONES`, `GROUPS`, `BRACKET`, `STACK_TOLERANCE`, `bracketLimit(zone, depth)`, `isEasy(zoneId, x, w)`. |
| `categories.js` | `CATEGORIES` (id, label, cssVar), `OTHER`, `CATEGORY_IDS`, `category(id)`, `colorsFor(game)` → list of CSS colours in fixed order. |
| `format.js` | `formatDims(dims)` → "30.5 × 22.6 × 5.1 cm", `formatRange(r, unit)` → "2–4", `describeLocation2(loc, getTitle)` → "Bottom shelf · stack B3 · on Takenokolor · nothing on top" / "On the board". (`describeLocation` is the v1 version, Phase B only.) |
| `dom.js` | `h(tag, props, ...children)` for HTML, `s(tag, attrs, ...children)` for SVG, `clear(el)`, `loadCss(url)`, `toast(text, { error, ms, action })`: with `action: { label, run }` it gets a button and stays 6 s, one at a time (e.g. Undo after a move; close the panels first, a modal makes it untappable), `showPanel(dialog)`: opens a `<dialog>` as a modal that the Android back gesture closes; `closePanels(done)`: closes all of them (`go()` already does this, so navigating from a panel needs no extra code). |
| `schema.js` | `checkData(obj, known) → { problems, data }` (schema 1 or 2, upgraded to 2), `validateData`, `validateGame`, `validatePlan2`, `knownFrom(games)`. The store already uses these. |
| `css/base.css` | Colours and basics: `--cat-party`, `--cat-coop`, `--cat-popular`, `--cat-duo`, `--cat-other`, `--accent`, `--danger` (block problems), `--warn` (amber, warnings), `--bracket`, `--easy-zone`, … plus `.btn`, `.btn-primary`, `.card`, `.chip`, `dialog.panel`, `.toast`. Light and dark mode. Layout tokens: `--header-h`, and `--tabbar-h` (bottom tab bar height without the safe area: 56px below 1024 px, 0 on desktop). `.app-main` and `.toast` already keep clear of the tab bar. Anything you fix to the bottom of the screen must sit at `calc(var(--tabbar-h) + env(safe-area-inset-bottom))`. |
| `index.html` | The header has three slots: `.app-title`, `#app-nav` (the screen nav, which becomes the bottom tab bar on phones) and `#app-tools` (global tools such as search). Peter's shell owns what goes into `#app-nav` and `#app-tools`. |

### Screens and parts

Each part has `js/<part>/index.js` exporting optional `screens` and an optional `init()`. `app.js` (Tony) imports them, calls every `init()` once the store is ready, and gives all screens to the router.

```js
export const screens = [
  { id: 'map', title: 'Shelves', order: 10,
    mount(el, params) { /* render into el */ return () => { /* cleanup: unsubscribe etc. */ }; },
    update(params) { /* optional: same screen, new params – avoids a re-mount */ } },
];
export function init() { /* e.g. provide('openGame', openPanel) */ }
```

Routes are hashes: `#/map`, `#/map?game=g013`, `#/map?stack=B3`, `#/catalog`, `#/cupboard`, `#/data`. Re-render from the store when `store:changed` fires, and unsubscribe in your cleanup.

Load your stylesheet once in your module: `loadCss(new URL('./map.css', import.meta.url))`. Prefix your CSS classes with your part (`map-`, `cat-`, `shell-`, `io-`, `game-`).

## 6. How the parts meet

| From → to | How | Status |
|---|---|---|
| anyone → placing mode (B) | `pickUp(id)` → `#/map?pick=id` | Phase C |
| anyone → game panel (A) | `openGame(id)` | fallback panel in `contracts.js` until Stephen calls `provide('openGame', …)` |
| catalog/search (C) → map (B) | `showOnMap(id)` → `#/map?game=id` | placeholder map already highlights the stack |
| game panel (A) → map (B) | `showOnMap(id)` | – |
| BGG import / add a game (A) → board (B) | new games have no place, so they are on the board (`getBoard()`); v1 `locate()` calls them `'unplaced'` | in use |
| geometry (core) → everyone | schema 2 geometry is `js/core/geometry.js` (`boxSize`, `layoutStack2`). In Phase B the rule checker, the CSV export and the map move to it. `js/map/model.js` (`footprint`, `layoutStack`, v1) stays stable until nobody imports it. | Phase B |
| map / stack details (B) → rule checker (A) | Bruce calls the rule checker from `js/rules/` for warnings and previews. In Phase B Stephen adds v2 versions with `severity: 'block' \| 'warn'`. | in use; v2 in Phase B |
| everyone → offline (C) | Peter's service worker caches every same-origin file at runtime, so nobody maintains a file list | – |

## 7. Who owns what

| Path | Owner |
|---|---|
| `index.html`, `js/app.js`, `js/core/**`, `css/base.css`, `data/**`, `docs/**`, `README.md`, `.github/**`, `tests/store.test.mjs`, `tests/plan2.test.mjs`, `tests/fixtures/v5-geometry.json` | **Tony** (lead) |
| `js/io/**`, `js/game/**`, `js/rules/**`, `tests/io*.test.mjs`, `tests/game*.test.mjs`, `tests/rules*.test.mjs`, `tests/fixtures/bgg-*` | **Stephen** (Part A) |
| `js/map/**`, `tests/map*.test.mjs` | **Bruce** (Part B) |
| `js/catalog/**`, `js/shell/**`, `js/versions/**`, `sw.js`, `manifest.webmanifest`, `icons/**`, `tests/catalog*.test.mjs`, `tests/shell*.test.mjs`, `tests/versions*.test.mjs` | **Peter** (Part C) |

The placeholder screens in your folders were written by Tony only to test the wiring. Replace them completely.

## 8. Conventions

- Modern JavaScript (ES2022), ES modules, 2-space indent, semicolons, single quotes, `const` by default.
- Small modules: one job per file, roughly under 300 lines.
- Build UI with `h()` / `s()`. No `innerHTML` with game data (titles may contain any character).
- Accessible: real `<button>`s, labels on inputs, enough contrast, tap targets at least 40 px.
- No `alert()` / `confirm()`. Use a `<dialog class="panel">` opened with `showPanel()`, or `toast()`.
- Tests: `node:test` files in `tests/`, named `<part>*.test.mjs`. Keep logic (parsing, geometry, filtering) in plain functions without DOM, so it can be tested in Node.
- **While working, run only your own tests, quietly:** `node --test --test-reporter=dot tests/map*.test.mjs` (use your prefix: `io`, `game`, `rules`, `map`, `catalog`, `shell`). A failure still prints its details.
- **The full suite runs on GitHub** for every push (GitHub Actions, "Tests" check). Don't run it by hand or paste test output into chats. If you changed something other parts use, add `tests/store.test.mjs tests/plan2.test.mjs` to your local run.
- **Big files:** never print `data/seed.json` (about 100 KB) or other large files. Query them with a one-liner, e.g. `node -e "const s=require('./data/seed.json'); console.log(s.games.length)"`.
- Run locally: `python3 -m http.server 8000` in the repo root, then open **http://localhost:8000/?nosw**. The `?nosw` switch removes the service worker; without it you see your own changes one reload late. Reset local data from the browser console: `localStorage.clear()`.

## 9. Workflow

1. **Start of a round:** `git pull`, then read only what changed in the docs since your last round: the **Changes** list at the bottom of this file, and `git log --oneline -- docs/` / `git diff <your last commit>..HEAD -- docs/`. Don't re-read whole files you already know.
2. Branch from `main`: `stephen/<topic>`, `bruce/<topic>`, `peter/<topic>`. Commit in small steps with clear messages.
3. **Push, then check the Tests run** (it takes about a minute):
   `gh api repos/macskasa/shelp/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[] | "\(.name): \(.status) \(.conclusion)"'`
   If it is red, the log is on GitHub (Actions tab). Fix it before asking for a review.
4. Open a PR into `main` with the template. **About 15 lines in total.**
5. Tell Adam **one line**: "PR #n is ready". Tony reviews **on the PR only**. When Adam says "Tony reviewed #n", read the review yourself:
   `gh api repos/macskasa/shelp/pulls/<n>/reviews --jq '.[-1].body'` and `gh api repos/macskasa/shelp/issues/<n>/comments --jq '.[-1].body'`
   Adam merges.
6. After a merge, pull `main` before starting the next PR.
7. **Fresh chat per phase.** When your brief is done, Adam may start a new chat for the next one. Everything you need is in the repo: this file, your brief, and the PR history.

**Definition of done:** the stories' acceptance criteria are met, it works at 384 and 412 px wide (portrait and landscape) and on desktop Chrome, the Android back gesture behaves, there are no console errors, the **Tests** check is green, only your files changed, and the PR description says how you tested it.

## 10. Glossary

- **Stack**: one pile (or a two-row block) at one x position. Ids like T1, M4, B3, L1, U2, S1, N3.
- **Row**: front or back line of a stack ("2 deep").
- **Box**: one game on a stack, with its position, which side is up, and what it rests on.
- **Bridge**: a box resting across two boxes, like a brick in a wall.
- **Board**: the holding area for games without a place, while you rearrange.
- **Pizza**: a game that may only lie flat on its biggest side.
- **Topper**: a non-game object on top of a stack (the LEGO castle, the bonsai).
- **Long side out / rot**: the box is turned so its long side runs along the shelf.
- **Standing**: boxes stand on edge like books.
- **Inside**: an expansion stored in its base game's box; it takes no shelf space.
- **Unplaced** (v1 word): a game on the board.

## Changes

- 2026-11-27 – first version (Tony).
- 2026-11-27 – added **Target devices** (section 2): Galaxy S22/S24 Ultra in Chrome, installed, plus desktop Chrome; and `showPanel()` for the Android back gesture.
- 2026-11-27 – `--tabbar-h` token in `css/base.css` and the `#app-tools` header slot in `index.html` (requested by Peter). See section 5.
- 2026-11-27 – `closePanels()` in `js/core/dom.js`; `go()` closes open panels before navigating, also when the target is the current screen.
- 2026-11-27 – Stephen round 2 (`docs/part-a2.md`): new folder `js/rules/` (D2), which may import `footprint()` / `layoutStack()` from `js/map/model.js` read-only. Local testing: open the app with `?nosw` (section 8).
- 2026-11-27 – **No missing sizes on shelves** (section 4): a game with `dims: null` can never be on a stack; the store and the schema check enforce it (Adam's decision).
- 2026-11-27 – the CSV export (`js/io/export.js`) may also use `layoutStack()` read-only (section 6).
- 2026-11-27 – **Schema 2 (Phase A):** games on games, bridges, which side is up, the pizza flag, the board, undo/redo, the final block/warn rules (section 3). New core modules `geometry.js` and `plan2.js`, v2 reads and writes in the store, and `describeLocation2`. The v1 reads keep working during Phase B. Briefs: `docs/part-a3.md`, `docs/part-b2.md`, `docs/part-c2.md`.
- 2026-11-27 – **Leaner workflow:** the full test suite runs on GitHub for every push ("Tests" check), and locally you run only your own tests with the dot reporter (section 8). Reviews live only on the PR, and messages through Adam are one line. Read diffs at the start of a round, keep PR descriptions short, never print `seed.json`, and use a fresh chat per phase (section 9). New `docs/kickoff.md` holds the opening messages.
- 2026-11-27 – **Phase C briefs (moving by hand):** `docs/part-b3.md` (Bruce: pick up, placing mode, the board strip, turn chooser, stacks, then drag and drop), `docs/part-a4.md` (Stephen: bracket rule per box, Move in the game panel, D4 suggest a spot), `docs/part-c3.md` (Peter: Move in "Where's my game?", D6 saved versions, compare). Every move is one undo step, closes the panels and shows a toast with Undo. Peter owns the new `js/versions/` (section 7). Two allowed uses of `plan2.js` (section 5). Tony's core PR comes next: `toast()` with an action, the `pickUp` contract (`#/map?pick=<id>`), saved versions in the store and in backups.
- 2026-11-27 – **Core for Phase C:** `toast()` takes `action: { label, run }` (a button, 6 s, one at a time); the `pickUp(id)` contract (`#/map?pick=<id>`); saved versions in the store (`listVersions`, `getVersion`, `saveVersion`, `restoreVersion`, `renameVersion`, `deleteVersion`, at most 10) and in full backups (`versions`, section 4); `--warn` (amber) in `css/base.css`. The fallback game panel uses `locate2`. Stephen: one more line in `docs/part-a4.md` item 2 (the restore confirmation mentions saved versions).
- 2026-11-27 – **Adam's issues in the briefs:** Bruce `part-b3.md` items 7 (scrolling pans on desktop, #49) and 8 (the back row, #47), done first; Peter `part-c3.md` item 4 (pizza in the catalog, #46); Stephen `part-a4.md` item 5 (delete a game, #50). #48 is parked under Later in LEAD.md.
- 2026-11-27 – **v1 leftovers:** nothing in the app uses v1 since #40. Each developer removes their own v1 code and tests (Stephen `part-a4.md` item 6, Bruce `part-b3.md` item 9, Peter `part-c3.md` item 5); then Tony removes the store's v1 functions and converts the seed to schema 2. `docs/kickoff.md` now also has opening messages for a Claude Code project.
- 2026-11-27 – **Topper centring (issue #45):** `layoutStack2` centres a topper on the box (or the boxes side by side) at the top of the pile, not on the whole stack. The Bonsai in M3 now sits over Tokaido Duo. The matching assertion in `tests/map-scene.test.mjs` (Bruce) lands in the same PR.
