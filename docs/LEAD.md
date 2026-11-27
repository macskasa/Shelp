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
- **Phase B:** in progress. Briefs: `docs/part-a3.md` (Stephen), `docs/part-b2.md` (Bruce), `docs/part-c2.md` (Peter). Open PRs at handover: #27–#31 (Stephen's four, Peter's one), none reviewed yet.
- **After Phase B, Tony:**
  - remove the v1 compatibility (`getPlan`, `getStack`, `locate`, `placeOnStack`, `describeLocation`, `toV1Plan`) once nothing uses it (`grep -rn` first);
  - convert `data/seed.json` to schema 2;
  - delete `js/map/model.js` if Bruce hasn't.
- **Phase C, moving by hand.** Adam's top priority. Briefs still to write.
  - **Bruce:**
    1. **Pick up a box:** Move / Turn / To the board / To the cupboard / Put inside a box.
    2. **The board strip** on the Shelves screen.
    3. **Placing mode:** tap a stack → choose a spot (on the shelf left or right of…, on top of…, across two, under…) → live check with `store.preview` + `checkPlan2` → Place, or Place anyway (warnings only).
    4. **Turn chooser:** only allowed orientations; pizza games get flat only, plus the quarter turn.
    5. **Stacks:** a new stack in empty space; move a stack with ±1 / ±5 cm.
    6. **Later:** drag and drop on desktop.
  - **Peter:** saved versions (D6). Tony first adds named snapshots to the store.
  - **Stephen, later:** D4, suggest a spot for a new game (uses his checker), and B2, game families (needs a schema field, Tony).

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

1. `gh api repos/macskasa/shelp/pulls/<n> --jq '"\(.head.ref) draft=\(.draft) \(.mergeable_state)"'` and read the body.
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
- **Don't edit a file a developer owns,** even to fix a conflict. Give them the exact code instead.

## Environment notes

- **GitHub:** REST only (`gh api`); GraphQL is blocked. That means:
  - Tony can't take a PR out of draft (Adam taps "Ready for review");
  - Tony can't delete branches (the proxy refuses).
- **Push:** `git -c push.negotiate=true push -u origin <branch>`.
- **Pages:** https://macskasa.github.io/Shelp/. Use `?nosw` to skip the service worker.
- **Planning workbook:** a Claude Docs artifact (Catalog, Shelf plan, Not identified, App user stories): https://claude.ai/artifact/RX9eSK3arZSpGBZR6mqh9k
- **The v5 planner is not in the repo.** It was Python in the first Tony chat's sandbox. A full re-plan (D5) would need a new planner on schema 2, ideally reusing `js/core/geometry.js`.
