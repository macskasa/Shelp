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
7. **Small PRs, with tests for logic.** `node --test` must pass.

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
- **Depth** of every shelf is 38 cm. Boxes deeper than 38 cm are turned so the long side runs along the shelf.
- **Easy to reach**: top shelf 0–44, the whole bottom shelf, under the stairs, the narrow shelf. `isEasy(zoneId, x, w)`.
- The **cupboard** is not drawn. It is a list of games with a reason each.

### Stacking rules (from the planning sessions; enforced later by the rule checker, story D2)

- A box may not be wider or deeper than the box under it by more than **1 cm** (`STACK_TOLERANCE`).
- A stack must fit the usable height. Where it crosses a bracket it must be under `bracketLimit`.
- Two rows (front + back, "2 deep") only in easy spots. Only card games stand like books (plus KLASK and Ice Cool, which are too big to lie down).

## 4. Data model

One file format is used for the seed (`data/seed.json`), for backups and for plan imports.

```jsonc
{
  "app": "shelp",
  "schema": 1,
  "games": [ Game, … ],        // optional in a plan-only import
  "plan": Plan,
  "meta": { }                  // optional, free-form (e.g. lastImport)
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
  "notes": null                 // free text, or null
}
```

Don't add fields on your own. Ask Tony; the schema check (`js/core/schema.js`) and this file change together.

### Plan

```jsonc
{
  "name": "v5 – brackets",
  "stacks": [ Stack, … ],
  "cupboard": [ { "game": "g156", "reason": "No room left after the bracket and stacking rules" } ],
  "inside": { "g101": "g099" }   // expansion id → id of the box it is stored in (no nesting)
}
```

Every game is in **at most one** place: a stack, the cupboard or inside another box. A game in none of them is **unplaced** (for example just imported from BGG).

### Stack

```jsonc
{
  "id": "B3",
  "zone": "bottom",
  "x": 60.2,                     // left edge, cm from the zone's left end
  "orientation": "flat",         // "flat": boxes lie flat, items go bottom → top
                                 // "standing": boxes stand like books, items go left → right
  "rows": [ [Item, …] ],         // 1 row, or 2 rows: rows[0] = front, rows[1] = back ("2 deep")
  "topper": { "label": "LEGO castle", "w": 35, "h": 21 },   // optional object standing on top
  "notes": ["Compile and Kontroll side by side on top"]      // optional, shown in stack details
}
```

**Item** is either one box `{ "game": "g102" }`, optionally with `"rot": true` (turned so the long side runs along the shelf, "long side out"), or a side-by-side group on one level: `{ "side": [ { "game": "g036" }, { "game": "g098" } ] }`.

**How a box sits** (Bruce implements this; everyone else just needs the idea). With `dims = [s, m, l]`:

- flat: height = s. Normally width (along the shelf) = m and depth = l. If `rot` is true or l > zone depth (38), then width = l and depth = m.
- standing: width = s; height = l if l fits the zone's usable height, otherwise m; depth = the remaining side.

`tests/fixtures/v5-geometry.json` has the expected `x, w, d, h` of every v5 stack, worked out in Python. Height includes the topper; depth of a 2-row stack is front + back.

### Location (from `store.locate(id)`)

```jsonc
{ "kind": "stack", "stackId": "B3", "zone": "bottom", "orientation": "flat",
  "rows": 1, "row": 0, "index": 3, "side": 1, "above": [], "below": ["g104", "g102", "g178"] }
{ "kind": "inside", "hostId": "g099", "host": { …location of the host… } }
{ "kind": "cupboard", "reason": "…" }
{ "kind": "unplaced" }
null   // unknown id
```

`index` counts from 0, bottom → top for flat stacks and left → right for standing ones. `above` and `below` are game ids, flat stacks only.

## 5. What you get ready made (`js/core/`, owner Tony)

| Module | What it gives you |
|---|---|
| `store.js` | `init()`, reads: `getGames()` (sorted by title), `getGame(id)`, `getPlan()`, `getStack(id)`, `getMeta()`, `locate(id)`, `exportData()`, `validate(obj)`. Writes: `updateGame(id, patch)`, `addGame(fields) → id`, `removeGame(id)`, `moveToCupboard(id, reason)`, `placeOnStack(id, stackId, { row, index })`, `setInside(id, hostId)`, `replacePlan(plan)`, `importData(obj) → 'all' \| 'plan'`, `resetToSeed()`, `setMeta(key, value)`, `batch(fn)`. Writes throw an `Error` with a readable message (and `err.problems`, a list, when there are several). |
| `bus.js` | `on(type, fn) → unsubscribe`, `emit(type, detail)`. Events: `store:changed` `{ games: id[] \| null, plan: bool }` (null = everything changed), `store:error` `{ message }` (app.js shows it), `route:changed` `{ id, params }`. |
| `contracts.js` | `openGame(id)`, `showOnMap(gameId)`, `showStack(stackId)`, `go(screen, params)`, `provide(name, fn)`. |
| `shelves.js` | `ZONES`, `GROUPS`, `BRACKET`, `STACK_TOLERANCE`, `bracketLimit(zone, depth)`, `isEasy(zoneId, x, w)`. |
| `categories.js` | `CATEGORIES` (id, label, cssVar), `OTHER`, `CATEGORY_IDS`, `category(id)`, `colorsFor(game)` → list of CSS colours in fixed order. |
| `format.js` | `formatDims(dims)` → "30.5 × 22.6 × 5.1 cm", `formatRange(r, unit)` → "2–4", `describeLocation(loc, getTitle)` → "Bottom shelf · stack B3 · at the bottom · 3 boxes on top". |
| `dom.js` | `h(tag, props, ...children)` for HTML, `s(tag, attrs, ...children)` for SVG, `clear(el)`, `loadCss(url)`, `toast(text, { error })`, `showPanel(dialog)`: opens a `<dialog>` as a modal that the Android back gesture closes; `closePanels(done)`: closes all of them (`go()` already does this, so navigating from a panel needs no extra code). |
| `schema.js` | `validateData(obj, knownIds)`, `validateGame(g)`, `validatePlan(plan, ids)`. The store already uses these. |
| `css/base.css` | Colours and basics: `--cat-party`, `--cat-coop`, `--cat-popular`, `--cat-duo`, `--cat-other`, `--accent`, `--bracket`, `--easy-zone`, … plus `.btn`, `.btn-primary`, `.card`, `.chip`, `dialog.panel`, `.toast`. Light and dark mode. Layout tokens: `--header-h`, and `--tabbar-h` (bottom tab bar height without the safe area: 56px below 1024 px, 0 on desktop). `.app-main` and `.toast` already keep clear of the tab bar. Anything you fix to the bottom of the screen must sit at `calc(var(--tabbar-h) + env(safe-area-inset-bottom))`. |
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
| anyone → game panel (A) | `openGame(id)` | fallback panel in `contracts.js` until Stephen calls `provide('openGame', …)` |
| catalog/search (C) → map (B) | `showOnMap(id)` → `#/map?game=id` | placeholder map already highlights the stack |
| game panel (A) → map (B) | `showOnMap(id)` | – |
| BGG import (A) → cupboard screen (B) | new games are added **unplaced**; Bruce lists unplaced games | test with `store.addGame({ title: 'Test' })` in the console |
| rule checker (A) → shelf model (B) | `js/rules/` imports `footprint()` and `layoutStack()` from `js/map/model.js`, read-only. Bruce keeps those two signatures stable; changes go through Tony. | – |
| map / stack details (B) → rule checker (A) | Bruce calls `checkStack(stack, getGame)` from `js/rules/` to show warnings | when D2 is merged |
| everyone → offline (C) | Peter's service worker caches every same-origin file at runtime, so nobody maintains a file list | – |

## 7. Who owns what

| Path | Owner |
|---|---|
| `index.html`, `js/app.js`, `js/core/**`, `css/base.css`, `data/**`, `docs/**`, `README.md`, `tests/store.test.mjs`, `tests/fixtures/v5-geometry.json` | **Tony** (lead) |
| `js/io/**`, `js/game/**`, `js/rules/**`, `tests/io*.test.mjs`, `tests/game*.test.mjs`, `tests/rules*.test.mjs`, `tests/fixtures/bgg-*` | **Stephen** (Part A) |
| `js/map/**`, `tests/map*.test.mjs` | **Bruce** (Part B) |
| `js/catalog/**`, `js/shell/**`, `sw.js`, `manifest.webmanifest`, `icons/**`, `tests/catalog*.test.mjs`, `tests/shell*.test.mjs` | **Peter** (Part C) |

The placeholder screens in your folders were written by Tony only to test the wiring. Replace them completely.

## 8. Conventions

- Modern JavaScript (ES2022), ES modules, 2-space indent, semicolons, single quotes, `const` by default.
- Small modules: one job per file, roughly under 300 lines.
- Build UI with `h()` / `s()`. No `innerHTML` with game data (titles may contain any character).
- Accessible: real `<button>`s, labels on inputs, enough contrast, tap targets at least 40 px.
- No `alert()` / `confirm()`. Use a `<dialog class="panel">` opened with `showPanel()`, or `toast()`.
- Tests: `node:test` files in `tests/`, named `<part>*.test.mjs`. Keep logic (parsing, geometry, filtering) in plain functions without DOM, so it can be tested in Node. Run everything with `node --test` from the repo root.
- Run locally: `python3 -m http.server 8000` in the repo root, then open **http://localhost:8000/?nosw**. The `?nosw` switch removes the service worker; without it you see your own changes one reload late. Reset local data from the browser console: `localStorage.clear()`.

## 9. Workflow

1. Branch from `main`: `stephen/<topic>`, `bruce/<topic>`, `peter/<topic>`.
2. Commit in small steps with clear messages.
3. Push and open a PR into `main` using the template. Fill in **What**, **How I tested**, and **Requests for Tony** if you need anything in shared files.
4. Tell Adam the PR number. Adam tells Tony, Tony reviews, and Adam merges (or tells Tony to merge).
5. After a merge, pull `main` before starting the next PR.

**Definition of done:** the stories' acceptance criteria are met, it works at 384 and 412 px wide (portrait and landscape) and on desktop Chrome, the Android back gesture behaves, there are no console errors, `node --test` passes, only your files changed, and the PR description says how you tested it.

## 10. Glossary

- **Stack**: one pile (or a two-row block) at one x position. Ids like T1, M4, B3, L1, U2, S1, N3.
- **Row**: front or back line of a stack ("2 deep").
- **Item**: one box in a row, or a side-by-side group sharing one level.
- **Topper**: a non-game object on top of a stack (the LEGO castle, the bonsai).
- **Long side out / rot**: the box is turned so its long side runs along the shelf.
- **Standing**: boxes stand on edge like books.
- **Inside**: an expansion stored in its base game's box; it takes no shelf space.
- **Unplaced**: a game that is in no stack, not in the cupboard and not inside a box.

## Changes

- 2026-11-27 – first version (Tony).
- 2026-11-27 – added **Target devices** (section 2): Galaxy S22/S24 Ultra in Chrome, installed, plus desktop Chrome; and `showPanel()` for the Android back gesture.
- 2026-11-27 – `--tabbar-h` token in `css/base.css` and the `#app-tools` header slot in `index.html` (requested by Peter). See section 5.
- 2026-11-27 – `closePanels()` in `js/core/dom.js`; `go()` closes open panels before navigating, also when the target is the current screen.
- 2026-11-27 – Stephen round 2 (`docs/part-a2.md`): new folder `js/rules/` (D2), which may import `footprint()` / `layoutStack()` from `js/map/model.js` read-only. Local testing: open the app with `?nosw` (section 8).
