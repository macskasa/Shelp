# Lead handover · Tony

For a fresh Tony chat. Read this, `docs/CONTEXT.md` and `README.md`, and nothing else until a task needs it.

## Role

Tony is the lead and code reviewer.
- **Owns:** `js/core/`, `js/app.js`, `index.html`, `css/base.css`, `data/`, `docs/`, `tests/store.test.mjs`, `tests/plan2.test.mjs`, `tests/fixtures/v5-geometry.json` and `.github/`.
- **Never edits the developers' files.** Changes they need go to them as review notes.
- **Team:**
  - Adam: product owner, merges PRs.
  - Stephen: Part A, data, rules and export (Sonnet).
  - Bruce: Part B, the map (Opus).
  - Peter: Part C, catalog, search, frame and offline (Sonnet).

## Where things stand (2026-11-27)

- **MVP:** done (all stories A1–E2 merged).
- **Phase A:** merged (#26). Schema 2, games on games, bridges, which side is up, pizza, the board, undo/redo, `preview()`.
- **Phase B:** merged except Bruce's items 2–3 (stack details as a tree, the cupboard picker on v2). Stephen's and Peter's parts are done (#27–#30, #33; #31's commit came into main as #34).
- **Phase C, moving by hand:** Adam's top priority. The briefs are written:
  - `docs/part-b3.md` (Bruce): pick up, the turn chooser, placing mode (`#/map?pick=<id>`), the board strip, stacks, then drag and drop.
  - `docs/part-a4.md` (Stephen): bracket rule per box, Move in the game panel, D4 `suggestSpots()`.
  - `docs/part-c3.md` (Peter): Move in "Where's my game?", D6 saved versions in `js/versions/`, compare.
- **Tony next: the core PR** (Peter and Bruce wait for it, Stephen only for his item 3):
  - `toast(text, { action: { label, run } })` in `dom.js`;
  - the `pickUp(id)` contract → `go('map', { pick: id })`;
  - saved versions in the store: `listVersions`, `getVersion`, `saveVersion` (at most 10), `restoreVersion` (one undo step), `renameVersion`, `deleteVersion`. They live under their own localStorage key, aren't undo steps, and fire `store:changed` with `versions: true`;
  - an optional `versions` in full backups (schema check, `exportData`, `importData`; a plan-only import leaves them);
  - CONTEXT sections 4 and 5, plus a Changes entry.
- **After Bruce's Phase B, Tony:**
  - remove the v1 compatibility (`getPlan`, `getStack`, `locate`, `placeOnStack`, `describeLocation`, `toV1Plan`, and Stephen's v1 `checkStack` / `checkPlan`) once nothing uses it (`grep -rn` first);
  - convert `data/seed.json` to schema 2;
  - delete `js/map/model.js` if Bruce hasn't.
- **Later:** B2 game families (Stephen; Tony adds the schema field first), D7 moving checklist (on top of Peter's compare).

## Adam's decisions (don't reopen)

- **Target devices:** Galaxy S22 Ultra and S24 Ultra, the app installed from Chrome (384 px wide, or 412 at a smaller screen zoom), plus desktop Chrome.
- **Sizes:** a game without a box size is never on a shelf. It can exist in the app, but can't be placed.
- **Pizza:** a pizza game only lies flat; the quarter turn is allowed. It's off for the 20 games that stood in v5, on for everything else and for new games.
- **The board:** unlimited, and replaces "Not placed yet". New games land there.
- **Block or warn:** the table in CONTEXT section 3. The card-shelf rule and the old "only card games stand" rule are dropped.
- **Bridges:** exactly two supports, neighbours in the same row, seen from the front only. Supports whose tops differ by more than 0.5 cm → block; not enough support → warn.
- **Stack names:** they keep their ids. A new stack gets the next free number on its shelf, and "Renumber left to right" is an explicit action.
- **Thunder Road: Vendetta:** the BGG id in the workbook is a typo (8807105); the seed uses 342070.
- **Lean workflow:** see CONTEXT sections 8 and 9.

## How to review a PR

1. `gh api repos/macskasa/shelp/pulls/<n> --jq '"\(.head.ref) → \(.base.ref) draft=\(.draft) \(.mergeable_state)"'` and read the body. The base must be `main`.
2. **Tests:**
   - Single PR: trust the "Tests" check: `gh api repos/macskasa/shelp/commits/<sha>/check-runs --jq '.check_runs[] | .conclusion'`.
   - Several related open PRs: merge them locally on a scratch branch and run `node --test --test-reporter=dot`.
3. **Read the diff** (`git diff main...origin/<branch>`), and open full files only where needed.
4. **UI changes:** headless Chrome via Playwright (`/usr/bin/google-chrome`, `--no-sandbox`).
   - Phone: 384 × 832, `is_mobile`, `has_touch`, DPR 2.8125.
   - Desktop: 1440 × 900.
   - Serve with `python3 -m http.server 8765` and open `/?nosw`; block service workers in the context.
   - Prefer text checks. Take screenshots only for visual changes.
5. **Post the review on the PR only:** `gh api repos/macskasa/shelp/pulls/<n>/reviews -f event=COMMENT -f body=…`. The verdict first, then the action items, then one line on what was tested.
   - GitHub refuses APPROVE (same account), so the comment is the approval.
   - Tell Adam one line.

## Lessons learned

- **Check that a PR is still open before pushing to its branch.** Commits pushed after a merge are lost (that happened with #5).
- **Double-check PR numbers** before writing them in comments.
- **Check each PR's base branch** (`.base.ref`), not only its head. A stacked PR targets the developer's other branch: #31 was merged into `stephen/rules-v2` after #27 was already in main, so it never reached main (fixed by #34). Tell the developer to retarget it to `main` once its base is merged, or open the PR yourself from their unchanged branch.
- **Undo after a move:** a modal panel makes the header Undo unreachable on the phone. So moving actions close the panels and show a toast with an Undo button (Phase C rule).
- **Don't edit a file a developer owns,** even to fix a conflict. Give them the exact code instead.

## Environment notes

- **GitHub:** REST only (`gh api`); GraphQL is blocked. That means:
  - Tony can't take a PR out of draft (Adam taps "Ready for review");
  - Tony can't delete branches (the proxy refuses).
- **Push:** `git -c push.negotiate=true push -u origin <branch>`.
- **Pages:** https://macskasa.github.io/Shelp/. Use `?nosw` to skip the service worker.
- **Planning workbook:** a Claude Docs artifact (Catalog, Shelf plan, Not identified, App user stories): https://claude.ai/artifact/RX9eSK3arZSpGBZR6mqh9k
- **The v5 planner is not in the repo.** It was Python in the first Tony chat's sandbox. A full re-plan (D5) would need a new planner on schema 2, ideally reusing `js/core/geometry.js`.
