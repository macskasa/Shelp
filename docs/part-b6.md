# Part B – Join two stacks · Bruce

Since #88/#89 the Free space screen finds surfaces **across two stacks**, e.g. in Adam's plan "Across M1 and M2: 7.4 cm high · rests on Csúcstámadás + SETI: Space Agencies, 21.7 cm · 0.4 cm tilt". The moving tools can't use them: a box belongs to one stack and rests only on boxes of that stack. Adam chose a **"Join with the next stack"** action: the two stacks become one, every box stays where it is, and then a box can be placed across both tops.

**Start** from Tony's core PR with `store.joinStacks` (check that it exists in `js/core/store.js`), or from its branch `ccr-96632897-bcu0g0` while it is still open; and after your drag and drop PR (#92) is merged, so the two don't collide. Your PR goes into `main`. **One PR** for the whole brief.

## What you get ready made (core)

`store.joinStacks(aId, bId) → id`: joins two neighbouring stacks of one shelf, in either order. The left one keeps its id and x; the right one's boxes move into it at the same places on the shelf (their x grows by the distance between the two), its notes join, and it is gone. One undo step; works inside `preview`. It refuses, with a readable message: another shelf, a stack between them (even an empty one), stacks that overlap, a topper on either.

## 1. "Join with …" in stack details

- In stack details, next to Move stack and Remove stack: **Join with M2 →** (the next stack to the right on the same shelf) and **← Join with M1** (the one to the left), each only when that neighbour exists.
- Tapping one opens a small confirmation: "Join M1 and M2? They become one stack, M1. Every box stays where it is, and you can then put a box across both tops." with the new problems from a preview (`checkPlan2`, only new ones count, as for every move; joining itself shouldn't add any). If the store refuses, show its message and no button.
- **Join**: one `joinStacks`, `closePanels()`, then a toast with Undo: "Joined M2 into M1". The map highlights the joined stack (`#/map?stack=M1`).
- Desktop: the buttons are in the Tab order; Enter confirms.

## 2. Across two boxes that sit side by side

After joining, the spot sheet must offer the bridge across the two tops. Today `spotChoices` offers "Across A and B" only for boxes side by side on one surface or the tops of two neighbouring piles. Add: any two boxes of the stack (same row) whose **open top edges meet**: B starts within 0.5 cm of where A ends, their tops are within 0.5 cm in height, and the strip of each top next to the other isn't covered by a box higher up. Csúcstámadás and SETI: Space Agencies in Adam's plan are the example (Csúcstámadás has Műgyűjtők társasága on it, but its right edge is open). The existing bridge rules decide the rest (`bridge-level`, `bridge-support`), and Stephen's `checkSpots` filters the dead ones as now.

## Rules for this PR

- Keep the logic (which neighbours can be joined, the confirmation text, the new across pairs) in plain functions with Node tests in `tests/map*.test.mjs`. A test: join M1 and M2 on a plan like Adam's (M1's pile at 10–39.7 cm, M2 at 40.2), then the spot sheet lists "Across Csúcstámadás (Peaks) and SETI: Space Agencies" for a box that fits.
- Phone first (384 and 412 px, portrait and landscape), desktop 1440; Android back closes the confirmation first; Undo restores `exportData().plan` exactly; no console errors.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change (`js/map/**`, `tests/map*.test.mjs`).

## Not yours

`joinStacks` (Tony), the Free space screen (Peter). Splitting a stack again isn't part of this; Undo covers a mistake.
