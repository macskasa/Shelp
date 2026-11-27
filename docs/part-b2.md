# Part B, Phase B – The map on schema 2 · Bruce

Adam approved a bigger model for the shelves (CONTEXT section 3 and section 4, read both again):
- games can carry several games
- a game can lie across two others like a brick in a wall (a **bridge**)
- every box records which side faces up
- some games are **pizza** (they only lie flat)
- a **board** holds games without a place

Tony's Phase A put all of this in the store, with an upgrade of today's data. Your job in Phase B is to move the map onto it. Phase C (moving games by hand) builds on what you do here.

**Order:** 1 → 2 → 3. Item 3 needs Stephen's v2 rule checker (his Phase B item 1), so do it after that is merged.

## 1. Drawing on schema 2

- Read the plan with `store.getPlan2()` and lay stacks out with `layoutStack2(stack, getGame)` from **`js/core/geometry.js`**. Every box comes with `x, y, z, w, d, h, row, up, rot, on`. Draw what you get: no packing of your own any more.
- Standing boxes (`up: 'l'`) and boxes on their side (`up: 'm'`) are just boxes with their real `w × h`. Bridges need nothing special: they sit on their supports.
- Two rows: draw the front row as now and mark the stack "2 deep".
- Highlight and caption from `locate2()` and `describeLocation2()`. A game on the board gets the caption "On the board" with a link to the cupboard screen (see 3).
- When nothing imports `js/map/model.js` any more (Stephen moves the rule checker and the CSV export to core geometry in his Phase B), delete it and its tests. Until then keep `footprint()` / `layoutStack()` working.
- Acceptance:
  - the v5 drawing looks the same as today;
  - the fixture test runs on `layoutStack2` for every stack;
  - a bridge made in the console (`store.placeBox(id, { stackId: 'B3', on: [compileId, kontrollId] })`) draws across both boxes.

## 2. Stack details as a tree

- List the boxes **top to bottom by height** (`y`), front row first. Each line says what the box rests on: "on Takenokolor", "across Compile: Main 2 and Kontroll", "on the shelf". Show `standing` / `on its side` when `up` is not `'s'`, and "long side out" for `rot`.
- Keep **To cupboard**. Add **To the board** (`store.moveToBoard`). The boxes above settle down automatically.
- Warnings: once Stephen's v2 checker is in, show its warnings with their severity (block = red, warn = amber).

## 3. Cupboard screen and the picker on schema 2

- "Not placed yet" becomes **On the board**: `store.getBoard()`, in that order. Rename the section and keep its actions.
- **Put on a stack…** becomes a choice of surface plus a position:
  - **On the shelf**, left or right of each box standing on the floor of that row: `placeBox(id, { stackId, row, on: [], index })`.
  - **On top of** a box: `on: [boxId]`, with `index` = position among the boxes already on it.
  - **Across** two neighbouring boxes on one level: `on: [a, b]`. Offer only pairs whose tops are within 0.5 cm, so the bridge would not tilt.
  - **Under** a box or a side-by-side level: `placeUnder(id, [ids])`.
- Orientation: flat by default. Non-pizza games can also stand (`up: 'l'`) or lie on their side (`up: 'm'`), and every game can be turned round (`rot`). Show the resulting size.
- **Preview** with **`store.preview(() => store.placeBox(id, target))`**. It returns the plan as it *would* be, without saving anything, firing an event or making an undo step. Run Stephen's `checkPlan2` on that plan. If the store refuses the change (no size, pizza), `error` holds its message.
  - A **block** problem disables the button and says why.
  - **Warnings** allow "Put it on … anyway".

## What you get ready made

- **Store (v2):** `getPlan2`, `getStack2`, `locate2`, `getBoard`, `placeBox`, `placeUnder`, `turnBox`, `moveToBoard`, `createStack`, `moveStack`, `removeStack`, `renumberStacks`, `undo`, `redo`, `preview`.
- **Helpers:** `layoutStack2` and `boxSize` in `js/core/geometry.js`, and `describeLocation2` in `js/core/format.js`.
- **Refused by the store:** pizza games not lying flat, and games without a size.

## Not yours yet

Phase C (moving by hand: placing mode, the board strip on the map, the turn chooser, new and moved stacks, drag and drop) comes in the next brief. Keep your picker code reusable: it becomes Phase C's "put down" step.
