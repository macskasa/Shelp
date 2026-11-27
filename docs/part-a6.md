# Part A – Easy to reach, box by box (#48) · Stephen

Issue #48 (Adam): "If a game is closer to the top of its stack it's much easier to get it", and his comment: "being in the front row should count towards easy to reach on the bottom shelves". Today "easy to reach" only means the easy zones of a shelf (`isEasy(zone, x, w)` in `js/core/shelves.js`). This brief adds a reach score per box and uses it where "easy" matters.

**Start** from Tony's PR with the `showFamily` contract (item 4 needs it): branch from `main` once it is merged (check that `showFamily` is in `js/core/contracts.js`), or from its branch `ccr-96632897-bcu0g0` while it is still open. Either way your PR goes into `main`. **One PR** for the whole brief.

## 1. `reachOf`: how easy a box is to get

A plain function in a new **`js/rules/reach.js`**, exported from `js/rules/index.js`:

`reachOf(plan, getGame, gameId) → { score, parts, text } | null`

- **Where:** a box on a stack counts where it is. A game inside another box counts as its host. Board, cupboard, a host that isn't on a shelf, or an unknown id → `null`.
- **Score** (lower is easier), from three parts:
  - **hard-to-reach spot:** the box isn't in an easy zone (`isEasy(zone, stack.x + box.x, box.w)`) → **+4**. So an easy zone always beats a hard one.
  - **back row:** row 1 → **+2**, on every shelf. Adam's comment names the bottom shelves; the back row is never the easier one anywhere, and two rows only exist in easy spots anyway (the `two-deep` warning).
  - **boxes on top:** every box resting on it, directly or higher up (the `above` list of a location), capped at 3 → **+1 each**. A topper (castle, bonsai) counts as one box on top of the boxes it stands on.
- **parts:** `['hard spot', 'back row', '2 boxes on top']`, only the ones that apply. **text:** "Easy to reach" when the score is 0, otherwise the parts joined with " · ": "Back row · 2 boxes on top", "Hard-to-reach spot · 1 box on top".
- Pure and quick: work from `locations2(plan)` and `layoutStack2`; no store calls. A helper `reachAll(plan, getGame) → Map<gameId, reach>` for screens that need every box at once.
- Tests on the seed, for example: a box at the top of a bottom-shelf pile is "Easy to reach"; the box under it has "1 box on top"; a back-row box in T1 says "Back row"; a middle-shelf box says "Hard-to-reach spot"; a game inside its base counts as the base.

## 2. `suggestSpots` ranks by reach

- Replace the rank step **easy to reach** (`hard: 0 | 1`) with the **reach score of the game at that spot**: easy zone, row, and how many boxes would be on top of it there (work it out on the stack copy you already try the spot on). It keeps its place in the order, right after "near its family".
- Update the ranking comment at the top of `suggest.js`. The speed limits of #60 stay.
- Tests: with everything else equal, a spot on top of a pile beats one under a box, and a front-row spot beats a back-row one.

## 3. Reach in the CSV export

The plan export's easy / hard column (`js/io/export.js`) becomes the reach text ("Easy to reach", "Back row · 1 box on top"…).

## 4. Show on map from the family

The `showFamily(name)` contract is in `js/core/contracts.js` (Tony's PR): it opens `#/map?family=<name>` (Bruce, `docs/part-b4.md`). Add a **Show on map** button to the family part of the game panel (next to Rename family…) and to each family on the Data screen. Until Bruce's PR is merged the map just opens without the highlight, so it can land first.

## Rules for this PR

- Plain functions with Node tests (`tests/rules*.test.mjs`, `tests/io*.test.mjs`, `tests/game*.test.mjs`); run only your own tests quietly.
- The v5 seed still gives 0 problems in `checkPlan2`: reach is not a rule and makes no warnings.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change.

## Not yours

Showing the reach in stack details (Bruce, `docs/part-b4.md` item 4, after this is merged), the catalog (Peter).
