# Part C – Free space at a glance (D3) · Peter

Story D3: "Each unit shows how much width and height is left. I can see at once where a new box could go." Tony's core works out the numbers (`js/core/space.js`). You build the **Free space** screen in a new folder, **`js/space/`** (yours, with `tests/space*.test.mjs`). Bruce may show the same numbers on the map later.

**Start** from Tony's core PR: branch from `main` once it is merged (check that `js/core/space.js` exists), or from its branch `tony/families-space` while it is still open. Either way your PR goes into `main`. **One PR** for the whole brief.

## What you get ready made (core)

- `UNITS`: 13 units in shelf order. Each wall shelf (top, middle, bottom) is three units, **left 60 | middle 80 | right 60**; then under the stairs (card games 31, tall part 40, tall gap 9) and the narrow shelf (80).
- `freeSpace(store.getPlan2(), store.getGame)` → one entry per unit, same order:
  - `id`, `zone`, `label` ("Bottom shelf · middle"), `x0`, `x1`, `length` (60, 80…), `end` (the right unit of a wall shelf reaches 208: the 8 cm overhang), `height` (usable), `approximate`;
  - `free` (empty shelf floor in cm), `widest` (the widest empty stretch), `gaps: [{ x, w }]`;
  - `stacks: [{ id, x, w, h, room }]`: stacks that reach into the unit, with `room` = height left above each;
  - `room: { stackId, h } | null`: the stack with the most room above it.
- Read the comment at the top of `js/core/space.js`: front view only, a stack across a joint counts in both units, gaps under 1 cm are left out.
- `js/space/index.js` is a placeholder (no screen) that `app.js` already imports. Replace it completely.

## 1. The Free space screen

- A screen `{ id: 'space', title: 'Free space', order: 15 }`, so its tab comes right after Shelves. Add its tab icon in `js/shell/icons.js`. Check that five tabs fit at 384 and 412 px; if "Free space" is too long for a tab, show "Space" there.
- **One card per unit**, grouped like the shelves: Top shelf, Middle shelf, Bottom shelf (each with left, middle, right), Under the stairs, Narrow shelf.
  - The headline is the floor: "**10 cm free**", or "Full" when `free` is 0. When there are several gaps, add "widest 6 cm".
  - The second line is the height: "up to 4.1 cm on top of M2" from `room`, or nothing when there are no stacks. For an `approximate` unit add "(not measured)".
  - A **to-scale bar** of the unit: each stack a block whose filled height shows how full it is (h / usable height), each gap marked in the accent colour. The wall shelf's right unit shows its overhang part fainter.
  - Tapping a stack in the bar opens it on the map (`showStack(id)`).
- **At the top:** "45 cm of free shelf in all · widest 10 cm, Middle shelf · left".
- **Phone:** cards one under another. **Desktop (≥ 1024 px):** each wall shelf as one row of three cards at 60 : 80 : 60 widths, like the real shelf.
- The screen follows `store:changed`, so a move on the map shows here right away.

## 2. Logic and tests

- The texts and totals ("10 cm free", "widest 6 cm", the summary line, the bar's blocks and gaps as fractions of the unit) are plain functions in `js/space/logic.js`, tested in Node on the seed (`tests/space-logic.test.mjs`). On today's plan, for example: Middle shelf · left has 10 cm free (30.2–40.2) and up to 4.1 cm on top of M2; the tall gap under the stairs has two 1.5 cm gaps.
- Don't work out free space yourself: if a number looks wrong, write it under **Requests for Tony**.

## Rules for this PR

- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode, no console errors, tap targets at least 40 px.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change. `app.js` already imports `js/space/index.js`.

## Not yours

The numbers themselves (Tony, `js/core/space.js`), suggesting a spot (Stephen, `suggestSpots`), the map (Bruce). A **family filter** in the catalog comes later, once Stephen's B2 is merged.
