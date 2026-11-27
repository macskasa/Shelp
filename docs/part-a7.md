# Part A – Check every spot on a stack, fast · Stephen

Adam tried moving on his phone: "It looks good but a bit complicated. Any idea to filter out some dead options?" The spot sheet (Bruce's put panel) lists every spot on a stack. For a six-box pile like M2 that's about 19 ("On top of X, left of Y" for every box, "Under …" for every box), and most of them can never work. Adam chose: **the sheet lists only the spots that work, best first, with a "Show N blocked spots" link for the rest**. Bruce builds that (`docs/part-b5.md`) once your check is merged. Today he would need one `store.preview` per spot and way up, which is too slow on the phone. Your stack-copy approach from `suggestSpots` is fast.

**Start** from `main`. **One PR** for the whole brief.

## 1. `checkSpots`

A pure function in `js/rules/` (in `suggest.js` or a new `js/rules/spots.js`), exported from `js/rules/index.js`:

`checkSpots(plan, games, gameId, runs) → [{ ways, best }]`, in the order of `runs`

- **runs** are the store calls Bruce's `spotChoices` already builds for one stack:
  - `{ fn: 'placeBox', target: { stackId, row, on, index } }`
  - `{ fn: 'placeUnder', targets: [id, …] }`
- **ways:** one entry per way up the game allows (a pizza game: flat, turned or not; others up to six, with equal sizes shown once, as in `orientations()`):
  `{ up, rot, block: Warning[], warn: Warning[] }`. Only the **new** problems, the way `suggestSpots` counts them: the target stack and its overlaps on that shelf, plus the family warning when it would newly spread out, keyed by `family`. A size missing or a pizza game on its side gives no ways.
- **best:** the way with no block, the fewest warnings, then your usual order (reach, height, least turned). `null` when every way is blocked.
- Work on your own copy of the one stack, as `suggestSpots` does: `detach`, `insertOn`, and for `placeUnder` `insertUnder` from `js/core/plan2.js` (Tony adds `insertUnder` to the allowed list in CONTEXT section 5). Never touch store data.
- **Speed:** one stack, every run × every way, on the seed's tallest piles: under 50 ms in Node. Take the best of 3 and leave headroom: CI runners are slow and run the test files in parallel.
- **Tests:** on M2 with a game that fits on top, "on top of Port Royal" has a best way and "on top of Scrabble Original, left of Kerge futam" has none (it would overhang or go past the shelf above). A blocked way's `block` names the rule. The result agrees with `store.preview` + `checkPlan2` for a sample of runs (same block or not, same new warnings).

## 2. Reach text shows the real count (nit from #83)

`reachFrom` caps the boxes at 3 for the **score**, which is right. The **text** should say the real count, as the `?game=` caption does: "4 boxes on top", not "3 boxes on top". Keep the score capped, with a test.

## Rules for this PR

- Plain functions with Node tests (`tests/rules*.test.mjs`); run only your own tests quietly.
- The seed still gives 0 problems in `checkPlan2`, and the #60 speed limits for `suggestSpots` stay.
- Only your files change.

## Not yours

The spot sheet itself (Bruce, `docs/part-b5.md`), Free space (Peter).
