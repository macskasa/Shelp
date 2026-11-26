# Part B – Shelf map · Bruce

You build the heart of the app: the to-scale drawing of the shelves with every box on it.
Read `README.md` and `docs/CONTEXT.md` first. Look at `docs/reference/shelf-v5.svg`: that's the drawing from the planning chat. Match its content; you can do better on looks.

**You own:** `js/map/**`, `tests/map*.test.mjs`.
**Screens:** `map` (route `#/map`, title "Shelves", order 10) and `cupboard` (route `#/cupboard`, title "Cupboard", order 30). Keep the ids.
**You handle the route params** `#/map?game=<id>` and `#/map?stack=<id>`. Other parts send people there with `showOnMap` / `showStack`.

## Stories

### C1 – Shelf model (`js/map/model.js`, no DOM)

The shelf numbers are ready in `js/core/shelves.js`. You write the geometry on top:

- `footprint(game, item, zone, orientation) → { w, d, h }` following "How a box sits" in CONTEXT section 4.
- `layoutStack(stack, getGame) → { w, d, h, boxes: [{ gameId, x, y, w, d, h, row }], topper }`: positions inside the stack (x from the stack's left edge, y up from the shelf floor). Flat: items bottom → top, a side group puts its boxes next to each other on one level. Standing: left → right. Two rows: rows[0] front, rows[1] back, depth = front + back.
- Unit tests: every stack in `tests/fixtures/v5-geometry.json` must match `w`, `d`, `h` within 0.05 cm (the fixture's `h` includes the topper).
- A box with `dims: null` (possible after a move) is drawn as a 10 × 10 × 3 placeholder marked "?".

### C2 – To-scale front view (`js/map/`)

- One SVG, built with `s()`. Order: the three wall shelves top to bottom, then under the stairs (its three parts side by side, bottom-aligned), then the narrow shelf. Use `GROUPS` and `ZONES`.
- Draw each zone's outline at its physical height, the dashed overhang area past x = 200, brackets as dark bars 0.4 wide and 6 tall hanging from the top at each `brackets` x, and easy-to-reach ranges as a dashed green outline. Approximate zones (`approximate: true`) get a dashed outline.
- Boxes to scale, filled with `colorsFor(game)`: one colour, or vertical stripes when it has several. Thin outline. Titles when there's room (or on zoom), stack ids under the stacks.
- Two-row stacks: draw the front row; mark the stack "2 deep" (the back row is listed in stack details).
- Opens showing the full width of the wall shelves on a 384 px phone (about 1.8 px per cm). Titles appear only from a zoom level where they are readable (11 px or more). In landscape (about 830 px) that's about 4 px per cm.
- Zoom and pan with **Pointer Events**: one finger pans, two fingers pinch, the S Pen taps precisely and hovers. On desktop, use the mouse wheel / trackpad pinch to zoom and drag to pan. Add +, − and "fit" buttons. Put `touch-action: none` on the map area only, never on the whole page.
- Hover (S Pen or mouse) shows the box title.
- A legend: the four categories, "Other", "striped = several", "easy to reach", "bracket".
- Re-render on `store:changed`.

### C3 – Stack details

Tap a stack → a panel opened with `showPanel()` (a bottom sheet on phones; the back gesture closes it) with: stack id, shelf, size (w × h, from your model), "2 deep" / "standing" / topper, the plan notes, then the boxes **top to bottom** (front row first): title, category chips, size, "long side out", "side by side". Tap a box → `openGame(id)`. A **Move to cupboard** button per box (asks an optional reason) → `store.moveToCupboard`.

### C5 – Special placements

All of these are in the seed. Check each one by eye against the reference drawing:
- the LEGO castle on M4 and the bonsai on M3 (`topper`: a dashed outline centred on top of the pile, with its label);
- KLASK standing at the wall end of the top shelf (T9, sticks out past 200);
- Ice Cool standing in the tall gap (S1);
- card games standing like books in two rows (L1);
- Compile + Kontroll side by side on top of B3;
- two-row stacks T1, B5 and B6.

### Highlight ("Where's my game?" lands here)

`#/map?game=<id>`: highlight that box and its stack (a clear outline or a gentle pulse), scroll it into view, and show a one-line caption with `describeLocation`. If the game is inside another box, highlight the host box and say so. If it is in the cupboard or unplaced, say that instead. `#/map?stack=<id>` selects the stack and opens its details. Implement `update(params)` so a new highlight doesn't reset the zoom.

### C6 – Cupboard list (screen `cupboard`)

- Games in the cupboard with their reason, and a second section **Not placed yet** (games where `locate().kind === 'unplaced'`, e.g. new from a BGG import).
- Each row: title, size, categories, and **Put on a stack…** → choose a stack (grouped by shelf), front or back row if it has two, and the position (default: on top) → `store.placeOnStack`. No rule checking in the MVP (that's D2); just show the stack's current height next to each option so Adam can judge.
- Tap a title → `openGame`.

## What you get ready made

`ZONES`, `GROUPS`, `BRACKET`, `bracketLimit`, `isEasy`, `colorsFor`, the store (`getPlan`, `getStack`, `getGame`, `locate`, `moveToCupboard`, `placeOnStack`), `s()` for SVG, `describeLocation`, the expected geometry fixture, and the reference drawing.

## Not yours (don't build)

The rule checker (D2), drag-and-drop moving (D1), free space (D3), suggestions (D4): next release. Keep the model functions clean so they can grow into these.
