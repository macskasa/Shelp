# Part C – Catalog, search, app frame and offline · Peter

You build what people touch first: the frame and navigation, the searchable catalog, "Where's my game?", and making it all work offline as an installed app.
Read `README.md` and `docs/CONTEXT.md` first.

**You own:** `js/catalog/**`, `js/shell/**`, `sw.js`, `manifest.webmanifest`, `icons/**`, `tests/catalog*.test.mjs`, `tests/shell*.test.mjs`.
**Screen:** `catalog` (route `#/catalog`, title "Games", order 20). Keep the id.
**Contract you keep:** `js/shell/router.js` exports `go(id, params)`, `currentRoute()`, `startRouter(screens, el, opts)` and `getScreens()` with the same meaning. Everyone navigates through them. Improve the inside as you like.

## Stories

### Frame and navigation (`js/shell/`)

- Make the starter router and nav production-ready: active state, the page title, unknown routes falling back to the map, `update(params)` support (already sketched).
- Phones: a bottom tab bar (Shelves, Games, Cupboard, Data) that respects the safe area. Desktop: the top bar.
- A search button or field in the header that opens "Where's my game?" from any screen.
- Styles in `js/shell/shell.css`, loaded with `loadCss`. Don't edit `css/base.css`; ask Tony for token changes.

### A6 – Searchable catalog list (screen `catalog`)

- All games from `store.getGames()`. Each row: title (and BGG name if different, smaller), category chips (`CATEGORIES`, `var(--cat-…)`), players, play time, a short location ("B3", "Cupboard", "In Lairs", "Not placed").
- Search on title and BGG name, **ignoring accents and case** ("ejszaka" finds "éjszakája", "fold" finds "Föld és víz").
- Filters: category (several), number of players (shows games that support that count), play time (≤ 15, ≤ 30, ≤ 60, ≤ 120 min, any), location (shelf, cupboard, inside a box, not placed), and **size missing** (`dims === null`, story A3).
- Show the count ("37 games"). Remember the filters in the URL params so Back works.
- Tap a row → `openGame(id)`.
- Must stay fast with 200+ games on a phone (no lag while typing).
- Filtering and matching are plain functions (no DOM), tested in Node.

### C4 – Where's my game?

- Type a title → best matches as you type (same accent-insensitive matching).
- For each match, say where it is in one sentence (`describeLocation`) and **what's on top of it** by name (from `locate().above`).
- An expansion stored inside another box says "Inside the Lairs box" plus where that box is.
- **Show on map** → `showOnMap(id)`. Bruce's map highlights it (the placeholder map already highlights the stack, so you can test now).

### E1 – Works offline on my phone

- `sw.js` in the repo root, registered from `js/shell/sw-register.js` with scope `./`. The app runs under `https://macskasa.github.io/Shelp/`, so use relative URLs everywhere.
- Precache the shell (index.html, css/base.css, js/app.js, data/seed.json, manifest, icons). For every other same-origin GET use **stale-while-revalidate**, so files added by other parts are cached without anyone keeping a list.
- Version the cache name and delete old caches on `activate`. When a new version is waiting, show a toast-style banner "New version – Reload".
- `manifest.webmanifest`: name, short name, `start_url: "./"`, `display: "standalone"`, theme colours, PNG icons 192 and 512 (plus maskable). `index.html` already links `icons/icon-192.png` as the Apple touch icon; create that file. Keep or redraw `icons/icon.svg`.
- Ask for persistent storage (`navigator.storage.persist()`), so the browser doesn't drop the data.
- Test: load once, go offline (DevTools), reload. Everything works, including a game opened from search. It installs from Chrome on Android and from Safari's "Add to Home Screen".

## What you get ready made

A working starter router and nav, the store (`getGames`, `getGame`, `locate`), `describeLocation`, `formatRange`, `formatDims`, category colours, `h()`, `toast()`, `loadCss()`, and a placeholder catalog showing how `openGame` and `showOnMap` are called.

## Not yours (don't build)

The game panel (Stephen), the map and the cupboard screen (Bruce), export to CSV (E3, next release).
