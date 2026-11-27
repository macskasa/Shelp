# Part C – Free space: how wide the room on top is · Peter

Adam: "We should consider adding the available width as well in free space. Currently we get the stack and the available height but width is a constraint too. For example look at M2." Today the card says "up to 4.1 cm on top of M2", but not how wide that space is, or how big the box under it is. Tony's core now works that out (`slots` in `js/core/space.js`). You show it.

**Start** from Tony's core PR with the slots: branch from `main` once it is merged (check that `freeSpace` units have `slots`), or from its branch `ccr-96632897-bcu0g0` while it is still open. Either way your PR goes into `main`. **One PR** for the whole brief.

## What you get ready made (core)

Each unit from `freeSpace(plan, getGame)` now also has:
- `slots`: the room on top of each stack whose top lies in the unit, most height first:
  `{ stackId, y, h, x, w, rest: { x, w }, on: [gameId] }`
  - `y` is the height of the stack's top surface, `h` the height left above it.
  - `x, w` is the **air** at that height: from the nearest taller thing on the left to the one on the right (a box, a topper, a bracket on the middle and bottom shelves, or the shelf's end). It reaches over lower neighbours. Above M2 it runs from M1's narrower top box (27.1 cm) to the bracket at 60 cm: 32.7 cm.
  - `rest` is the part of the top that is open: what a box there would rest on (Port Royal, 12.7 cm). A box wider than `rest.w + 2` sticks out more than 1 cm, which is the stacking warning. `on` lists its boxes (two side by side at the same height make one surface).
- `room` is now `slots[0]` (the most height), so it has these fields too. `stacks[i].slot` is that stack's slot, or null.
- Read the comment at the top of `js/core/space.js`: front view only, no ledges lower down a pile, toppers aren't surfaces.

## 1. The room line shows both widths

- Instead of "up to 4.1 cm on top of M2": "**On M2:** 4.1 cm high · 32.7 cm of air · rests on Port Royal, 12.7 cm". When the air is no wider than `rest.w + 2`, leave the air out: "On B3: 8.8 cm high · rests on Compile: Main 2 + Kontroll, 16.6 cm".
- Keep "No room on top" and "(not measured)" as they are.
- Below the line, **"More room on top (3)"**, a small toggle: the unit's other slots, one per line in the same words. Hide it when there is only one.

## 2. The bar shows the slots

- Draw each slot as a faint band at the top of the unit's bar: from `x` to `x + w` along, and from the top down by `h` (as a share of the usable height). Mark the `rest` part a little stronger, so you can see the box it would rest on.
- Clip it at the unit's edges like the stacks; the overhang part stays faint.

## 3. The two nits from #79

- At 1024–1279 px the catalog's Family column leaves the title about 156 px. Narrow it there, or show the family in the title's muted line as on the phone.
- `family=Gone` falls back to Any in the list, but stays in the URL until the next filter change. Replace the URL when it falls back.

## Rules for this PR

- The texts and the band maths are plain functions in `js/space/logic.js` (and `js/catalog/` for item 3), with Node tests on the seed. For example: Middle shelf · left reads "On M2: 4.1 cm high · 32.7 cm of air · rests on Port Royal, 12.7 cm".
- Don't work out free space yourself: if a number from `js/core/space.js` looks wrong, write it under **Requests for Tony**.
- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode, no console errors, tap targets at least 40 px.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change.

## Not yours

The numbers (Tony, `js/core/space.js`), the map (Bruce), the rules (Stephen).
