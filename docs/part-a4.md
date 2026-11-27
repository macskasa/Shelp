# Part A, Phase C – Bracket per box, Move, and suggest a spot · Stephen

Phase C is about moving games by hand. Bruce builds the moving screens on the map. Your rule checker runs behind every move he previews. This round sharpens one rule, adds a Move button to the game panel, and adds **D4: suggest a spot** for a game.

**PRs, in this order:**
1. Items 1 and 2
2. Item 3, once Tony's core PR with the `pickUp` contract is merged
3. Item 4
4. Item 5 (issue #50)
5. Item 6 (v1 leftovers), small

## 1. The bracket rule per box

From the #27 review: `bracket` uses the whole stack's height and depth. With trees (several boxes side by side on one box) a tall pile next to a joint warns even when only a low box crosses the bracket.

- Check **each box** whose x range (stack x + box x, width w) crosses a bracket (joint ± 0.2 cm):
  - its top `y + h` must be at most `bracketLimit(zone, z + d)`;
  - `z + d` is how far back it reaches, so a back-row box counts with its back edge.
- A **topper** that crosses a bracket counts too, with the stack's depth.
- Keep **one warning per stack**, naming the boxes that are too high: "Stack M2 crosses the bracket at 60 cm: Ark Nova reaches 31.2 cm there, but 29.5 cm is the most for its depth."
- Tests:
  - the v5 seed still gives 0 warnings;
  - a tall pile beside a joint whose low neighbour crosses it gives none;
  - a high box that crosses it gives one, naming the box;
  - a back-row box uses its back edge.

## 2. Pizza switch: clear the old message

The nit from #29: `refresh()` in `pizzaSection` also clears the error hint, so an old message doesn't stay after an Undo or a turn elsewhere.

Also in this PR: backups can now carry **saved versions** (CONTEXT section 4). When a full backup has `versions`, the restore confirmation adds a line: "It also has 3 saved versions; they replace the ones on this device." Without `versions`, say nothing: the current ones stay.

## 3. Move button in the game panel

- A **Move** button next to "Show on map": it calls `pickUp(id)` from `js/core/contracts.js`. That's Bruce's placing mode: `#/map?pick=<id>`.
- For a game without a box size it is disabled, with the hint "Add a box size first" (the store would refuse anyway).

## 4. D4: suggest a spot

`suggestSpots(plan, games, gameId, { limit = 5 })` in **`js/rules/suggest.js`**. It's a pure function with no DOM, tested in Node. Bruce shows the first three in placing mode. You only export it.

- **Candidates:**
  - every surface of every stack: on the shelf at each position in each row, on top of each box, across each neighbouring pair whose tops are within 0.5 cm;
  - in each orientation the game allows (a pizza game: flat, turned or not);
  - a **new stack** at the left end of every free gap on a shelf where the box fits.
  - Skip "under".
  - For a game that is on a shelf now, its current place is not a suggestion.
- **Only spots with no new block problem.** Rank them. Propose your ranking in your plan; a starting point:
  1. no new warnings before any with warnings;
  2. easy to reach;
  3. least overhang on what it rests on;
  4. the lower stack.
- **Result:** a list of
  - `{ kind: 'stack', target: { stackId, row, on, index, up, rot }, text, warnings }`, which Bruce passes to `store.placeBox`, or
  - `{ kind: 'new-stack', zone, x, up, rot, text, warnings }`, which Bruce turns into `createStack` + `placeBox` in one batch.
  - `text` is short: "Bottom shelf · stack B3 · on Takenokolor · flat", "Narrow shelf · new stack at 70 cm".
  - `warnings` are the new ones.
- **How to try a spot:** work on your own `structuredClone(plan)` with `detach` and `insertOn` from `js/core/plan2.js`. That's the one place outside the store allowed to call them, because thousands of `store.preview` calls would be too slow. Never touch store data. Check only what a spot can change: `checkStack2` on the target stack, plus overlaps with its neighbours on that shelf.
- **Speed:** quick on the phone. The test (#60) takes each game's best of 3 runs in Node on the seed plan: the median game under 200 ms, the slowest under 400 ms (CI runners are slow and run the test files in parallel).

## 5. Delete a game (issue #50)

- The store already does it: `removeGame(id)` deletes the game everywhere in **one undo step**. Boxes on top of it settle down, and boxes stored inside it go to the cupboard ("Was stored inside the … box"), as the BGG import already says.
- Add **Delete game…** at the bottom of the game panel, as a danger button. It asks first and says what happens: "Ark Nova is removed from the app and from the shelf plan. 2 boxes on top of it settle down. Lairs: Box Zero, stored inside it, goes to the cupboard."
- After deleting: close the panels, then show a toast with Undo, as in Phase C: `toast('Deleted Ark Nova', { action: { label: 'Undo', run: store.undo } })`.
- Saved versions keep the game: they're snapshots.

## 6. Remove your v1 leftovers

Nothing in the app uses v1 any more. Before Tony removes the store's v1 functions, take out yours:
- delete `js/rules/check.js` and `tests/rules-check.test.mjs`, and drop `checkStack`, `checkPlan` and `RULES` from `js/rules/index.js` (and its v1 comment);
- in `tests/game-logic.test.mjs`, `tests/io-bgg.test.mjs` and `tests/io-backup.test.mjs`, use `locate2`, `getPlan2`, `getStack2` and the v2 writes instead of `locate`, `getPlan`, `getStack` and `placeOnStack`.

## What you get ready made

- **Rules (yours):** `checkStack2`, `checkPlan2`, `blocking`, `forStack`.
- **Core:** `layoutStack2`, `boxSize` (`js/core/geometry.js`), `detach`, `insertOn`, `locations2` (`js/core/plan2.js`, read the comments above each), `ZONES`, `isEasy`, `bracketLimit` (`js/core/shelves.js`).
- **Contracts:** `pickUp(id)` (Tony's core PR).

## Not yours

The moving screens and the board strip (Bruce), saved versions (Peter). **B2, game families**, comes later: it needs a new schema field, and Tony adds it first.
