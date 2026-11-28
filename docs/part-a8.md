# Part A – Boxes overlapping inside a stack · Stephen

Bruce found a gap while building "Join with …" (`docs/part-b6.md`): the store placed a bridge across Csúcstámadás and SETI: Space Agencies at Csúcstámadás' left edge, right inside Műgyűjtők társasága, which already rests there. **No rule caught it**: `overlap` only compares whole stacks with each other. Tony fixed the placement in `insertOn` (a bridge now starts right of the boxes already on its left support). The rule checker should still refuse such a plan, whatever path made it: a plan import, an old backup, or a future bug.

**Start** from `main`. **One PR** for the whole brief.

## 1. A new block rule: `box-overlap`

- In `checkStack2`: two boxes of one stack, **in the same row**, whose rectangles in the front view overlap (x from `x` to `x + w`, height from `y` to `y + h`, from `layoutStack2`) by more than a hair (your `SLACK`) in both directions. A box and what it rests on only touch, so they never count.
- Severity **block**: add it to `SEVERITY` with the other blocks. The message names both: "Halmazállapot and Műgyűjtők társasága take the same place in stack M1."
- One warning per pair, `gameId` the box that sits higher (or, at the same height, the one further right).
- A topper overlapping a box counts too (it stands on the pile; it may only overlap air).
- `suggestSpots` and `checkSpots` pick it up through `checkStack2`; check that their tests and the #60 speed limits still pass.

## 2. Tests

- The v5 seed and every stack in it still give **0** problems.
- A hand-made stack where a box rests on A and a second box is put at the same x on A: one `box-overlap` block naming both.
- Two boxes side by side that just touch, a box on its support, a bridge on two supports: no warning.
- Front and back row at the same x: no warning (different rows).

## Rules for this PR

- Pure functions with Node tests (`tests/rules*.test.mjs`); run only your own tests quietly.
- Only your files change. CONTEXT's rule table gets the new line from Tony.

## Not yours

`insertOn` (Tony, fixed), the map (Bruce).
