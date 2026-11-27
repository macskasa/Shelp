# Part B – A family on the map (B2) · Bruce

Story B2 ends with "The map can highlight a family". Stephen's part is merged (#76): every game has `family`, `store.getFamilies()` lists them, and `checkPlan2` warns with the `family` rule when a family is spread out. This brief puts a family on the Shelves screen.

**Start** from Tony's PR with the `showFamily` contract: branch from `main` once it is merged (check that `showFamily` is in `js/core/contracts.js`), or from its branch `ccr-96632897-bcu0g0` while it is still open. Either way your PR goes into `main`. **One PR** for items 1–3.

`docs/part-b3.md` item 6 (drag and drop on desktop) still waits until Adam has tried moving games on his phone. Item 4 here waits for Stephen's `reachOf` (`docs/part-a6.md`) and is a later, separate PR.

## 1. `#/map?family=<name>`

- The route comes from the new contract **`showFamily(name)`**. Stephen's game panel, his Data screen and Peter's catalog call it.
- **Highlight every member** that is on a shelf, like `?game=` does for one game. Dim the rest of the drawing a little, so the family stands out.
  - A game stored inside another box highlights its host box.
  - Members on the board: their chips in the board strip are highlighted too.
- **A caption** where the `?game=` caption goes: "**Azul** family · 3 games · B2, B3" and a close button (× → `#/map`).
  - Members not on a shelf are named after the stacks: "· 1 on the board", "· 1 in the cupboard".
  - When the family is spread out, the family warning's message from `checkPlan2` follows in amber.
- **Back row:** when every shelf member is in the back row, open the back view. When the members are in both rows, stay in the front view and add "· 1 in the back row" to the caption (the row switch shows the rest).
- **Zoom:** pan so the highlighted boxes are in view, keeping the zoom when they fit, as `?game=` does. When they don't fit (a spread family), zoom out just enough.
- An unknown family (renamed, or an old link): a toast "No family “Azul” any more", and replace the route with `#/map`.
- Back, Esc and the × leave the highlight. Tapping the Shelves tab resets it, as with `?game=`.

## 2. The family in stack details

- Each box line of a game with a family gets a small chip with the family's name. Tapping it calls `showFamily(name)`; `go()` closes the panel first.
- The family warning already reaches each member stack through `forStack` (it matches `stackIds`), so check that it reads well there.

## 3. Empty stacks are easier to tap (#75 nit)

An empty stack is a 3 cm outline, about 5 px at the phone's fit zoom. Make its tap target wider where the neighbours leave room: at least the width of its id label, or 40 px on screen, whichever fits.

## 4. Later, after Stephen's #48 PR: reach in stack details

Once `reachOf(plan, getGame, gameId)` from `js/rules/` is merged (`docs/part-a6.md`), each box line in stack details shows its text in the muted style: "Easy to reach", "2 boxes on top · back row". Tony starts this as a separate thread when it's time.

## Rules for this PR

- Keep the logic (which boxes, the caption text, the view to open, the box to fit) in plain functions with Node tests in `tests/map*.test.mjs`.
- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode; Android back closes the open panel first; no console errors.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change (`js/map/**`, `tests/map*.test.mjs`).

## Not yours

Family editing and the rule (Stephen), the catalog family filter (Peter).
