# Part C – Free space: depth (#93) · Peter

Adam's issue #93: the Free space screen only sees the shelves from the front. It misses room that only shows from the side:
- **Behind a shallow stack.** Most shelves are 38 cm deep, and a pile of 24 cm deep boxes leaves 14 cm empty behind it. A second row could go there.
- **On a front-row box in front of a taller back row.** Its top is open, but only as deep as the box. Today the taller back box counts as a wall.

Tony's core now finds both (`js/core/space.js`). You show them. Your PR closes #93.

**Start** from Tony's core PR for #93: branch from `main` once it is merged (check that `freeSpace` units have `behind`), or from its branch while it is still open. Either way your PR goes into `main`. **One PR** for the whole brief.

## What you get ready made (core)

- **`unit.behind`** (new list): the floor behind each stack of one row, where a box could stand as a back row. Each is `{ kind: 'behind', stackId, x, w, z, d, h, easy }`:
  - `x, w`: the stack's width, cut at a bracket;
  - `z`: where the free floor starts (the stack's depth); `d`: how deep it is (shelf depth − `z`), at least 5 cm;
  - `h`: the usable height;
  - `easy`: false outside an easy-to-reach spot, where a second row gets the "two rows" warning.
  - Easy ones come first, then most depth. Stacks with two rows have none (there is no third row).
- **Every slot** (`slots`, `standing`) gets `d`: the depth of the air at that height. That's the shelf depth, or less when a taller back-row box stands behind. `rest` gets `d` too: how deep the surface is.
- **Front-row boxes in front of a taller back row** now have their own slots, with `row: 0` and `d` up to the back-row box. On the seed: a_way in B6 (1.3 cm below the back row) and the front card games in L1. Other slots keep `row: null`.
- `unit.approximate` is still true on the narrow shelf (its depth isn't measured).
- **Push to the wall (#100, already in #99):** `unit.push` on `top-3`, `middle-3`, `bottom-3`: `{ zone, moves: [{ stackId, from, to }], gap: { x, w }, gain }`, or null. The shelves may stick out 8 cm past the wall end, and pushing the stacks there collects the floor in one gap on the left. `store.pushToWall(zone)` does it (one undo step).

## 1. Room behind

- A third toggle under the room line: **"Room behind (n)"**, one line each: "Behind B3: 24 cm wide · 14 cm deep · 36.5 cm high". Hide the toggle when there are none.
- When `easy` is false, add " · 2 rows warn here" and show the line in the muted style. Keep the line: Adam wants to see real room, not have it hidden.
- On the narrow shelf, write "about 20 cm deep".
- Seed checks: B3 is 24 × 14 (easy). T3 is 28 cm wide × 10 cm deep, not easy. N3 is 18 cm wide, about 20 cm deep.

## 2. Depth in the room lines

- In the room line, "More room on top" and "Standing room", add "· only 9.5 cm deep" when the slot's `d` is less than the shelf depth. Leave it out otherwise, so today's lines don't change.
- A slot with `row: 0` reads "On a_way (front row): …".

## 3. Push to the wall (#100)

- In a unit with `push`, a line under the floor line: "**Push M6 and M7 to the wall:** the gap at 152.4 cm grows to 2.5 cm (+2.5)", with a **Push** button. It runs `store.pushToWall(zone)` and shows a toast with Undo. The seed has that line on the middle shelf (M6 and M7) and on the bottom shelf (B7 and B8, +3.8). The top shelf has none.

## 4. Totals

- `totals` and the summary line stay as they are. Room behind is a different kind of room, and the toggle count is enough.

## Rules for this PR

- Texts stay plain functions in `js/space/logic.js`, with Node tests on the seed (B3, T3, N3, the B6 front slot, the two push lines) and a small hand-made unit for a slot limited by a back-row box.
- Don't work out free space yourself: if a number from `js/core/space.js` looks wrong, write it under **Requests for Tony**.
- The bar doesn't change (it's the front view).
- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode, no console errors, tap targets at least 40 px.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change. Put "Closes #93" and "Closes #100" in the PR body.

## Not yours

The numbers (Tony, `js/core/space.js`).
