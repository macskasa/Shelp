# Part B – Free space on the map (D3) · Bruce

The Free space screen (Peter) lists the room on every shelf unit as text and bars. Adam also wants to **see it where it is**: on the drawing, while he's looking at the stacks. Adam's decision (D3): the numbers come from Tony's `js/core/space.js`, and you may show them on the map. This round you do.

**Start** from `main`. **One PR** for the whole brief. Nothing in the core changes.

## What you get ready made (core)

`freeSpace(store.getPlan2(), store.getGame)` from `js/core/space.js` gives one Unit per shelf unit (the comment at the top has every field):
- `gaps: [{ x, w }]`: empty shelf floor, in zone x, cut at the unit's edges;
- `slots`: room on top of the stacks, and `standing`: standing spaces. Each is `{ kind, stackId, stackIds, y, h, x, w, rest: { x, w }, tilt, on }`. The air runs from `x` to `x + w` and from `y` up `h` cm. `rest` is the open part of the surface it sits on. Two `stackIds` means a surface across two stacks within 0.5 cm (`tilt`).
- On the seed: Anachrony in T8 has a standing space 4.3 cm wide × 31.8 cm high beside KLASK, and Thunder Road in M5 has one 6.5 × 29.5 beside M6. The bottom shelf has a 1.4 cm gap at 58.6. In Adam's plan, M1 and M2 share a surface (0.4 cm tilt).

Units can grow new fields (depth comes with #93). Draw only the ones above.

## 1. A "Free space" toggle

- On the Shelves screen, with the map's other view controls, off by default. Keep it in the route (`#/map?free=1`) so Back and a reload keep it.
- Hidden in placing mode and while dragging (taps there belong to the stacks and the shelf, as today).

## 2. Draw it

- **Room on top and standing spaces:** the air as a faint box with a dashed outline, and the `rest` part as a stronger line on the surface. Standing spaces look the same, just narrow. Use colours from `css/base.css` that aren't category colours, `--danger` or `--warn`, and check both themes.
- **Empty floor:** a faint hatched band along the floor of each gap.
- **Labels** only where they fit at the current zoom: "22.9 × 7.4" (width of the air × height), "4.3 wide" for a standing space, "12.5 cm" for a gap. The rest show on tap.
- The overlay is the front view, so it looks the same whichever row is shown.
- Keep the model (bands and labels in drawing coordinates) as plain functions in a new module, e.g. `js/map/free-layer.js`, and the drawing in another one. `view.js` is at its size limit already.

## 3. Tap a band

- Tapping a band shows its full line in the map caption, e.g. "On T8: standing room 4.3 cm wide · 31.8 cm high · rests on Anachrony: A jövő útjai".
- For a slot across two **different** stacks: "Across M1 and M2: … · join them to rest a box across both", with a **Join M1 and M2** button that runs your existing join (with its toast and Undo). This is the small leftover from #94.
- The caption has a link **Free space screen** (`go('space')`).

## Rules for this PR

- Tests in `tests/map-free.test.mjs` on the seed: the T8 and M5 standing bands, the bottom-shelf gap, labels hidden when too small, and a hand-made plan with a surface across two stacks (the Join text).
- Don't work out free space yourself: if a number looks wrong, write it under **Requests for Tony**.
- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode, no console errors, tap targets at least 40 px.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change.

## Not yours

The numbers (Tony, `js/core/space.js`), the Free space screen (Peter).
