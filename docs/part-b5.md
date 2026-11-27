# Part B – Only the spots that work · Bruce

Adam tried moving on his phone: "It looks good but a bit complicated. Any idea to filter out some dead options?" On a six-box pile like M2 the spot sheet lists about 19 spots, and most of them can never work. Adam chose: **the sheet lists only the spots that work, best first and preselected, with a "Show N blocked spots" link for the rest**. Stacks on the map stay as they are.

**Start when** Stephen's `checkSpots` (`docs/part-a7.md`) is merged: check that `checkSpots` is exported from `js/rules/index.js`. **One PR** for the whole brief.

## What you get (Stephen)

`checkSpots(plan, games, gameId, runs) → [{ ways, best }]`, in the order of `runs`. `runs` are your `spotChoices(...)[i].run` (`placeBox` target or `placeUnder` targets). `ways` holds one entry per way up the game allows, `{ up, rot, block, warn }`, with only the new problems. `best` is the way to preselect, or `null` when every way is blocked. It works on a stack copy, so it's fast enough to run for the whole sheet at once.

## 1. The spot sheet (put panel)

- Run `checkSpots` once for the stack and row when the sheet opens (and again after `store:changed`), not one preview per choice.
- **List only spots with a `best` way.** Order them: no warnings first, then by Stephen's order (the order of their `best`). Preselect the first.
- **Which way up** lists only the ways without a block for the chosen spot, with the best one preselected. When only one works, show it as text instead of a select.
- Keep the preview picture and the new warnings for the chosen spot and way, and keep **Place** / **Place anyway** as now. The final check stays the real one (`store.preview` + `newProblems`) when the choice changes, so the sheet never offers what the store refuses.
- **"Show 12 blocked spots"**, a small link under the list: it reveals the hidden spots greyed out, each with the reason from its first block ("Too tall for the shelf here", "Sticks out 3.2 cm over Kerge futam"). They can't be chosen. The link hides when there are none.
- **Nothing works on this stack:** the sheet says "Nothing fits on M4" with the link to the reasons, and no Place button.
- The same goes for the back row, and for a suggestion that presets a spot (it's always a working one).

## 2. New stack here

The **Which way up** select lists only the ways without a block at the fitted x (`fitNewStack` per way). When none works, say why, with no Place button.

## 3. Nit from #83

The " – " between a box's place and its reach in stack details blends with titles that contain an en dash ("on SETI – Kutatás a földön kívüli élet után – Hard-to-reach spot · 1 box on top"). Use " · " or put the reach on its own line.

## Rules for this PR

- Keep the logic (which spots to list, their order, the hidden count and reasons, the way-up list) in plain functions with Node tests in `tests/map*.test.mjs`.
- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode; Android back closes the open sheet first; no console errors. Undo from the toast still restores `exportData().plan` exactly.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change (`js/map/**`, `tests/map*.test.mjs`).

## Not yours

`checkSpots` (Stephen). Drag and drop (`docs/part-b3.md` item 6) comes after this, when Adam says so.
