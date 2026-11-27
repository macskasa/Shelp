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

## Where things stand (2026-11-27, afternoon)

- **MVP, Phase A, Phase B:** all merged. #40 was the last Phase B PR; nothing in the app calls v1 any more.
- **Phase C, moving by hand** (Adam's top priority). Merged: core (#39), Stephen's bracket rule, `suggestSpots` and Move button (#37, #38, #42), Peter's saved versions and compare (#41, #43), the issue follow-ups in the briefs (#52). Next per developer:
  - **Bruce** (`docs/part-b3.md`): push the one test line from #51 to `tony/topper-centre`, then item 7 scrolling pans on desktop (#49), item 8 the back row (#47), item 9 his v1 leftovers, then pick-up, placing mode, stacks, drag and drop.
  - **Stephen** (`docs/part-a4.md`): item 5 Delete game (#50), then item 6 his v1 leftovers.
  - **Peter** (`docs/part-c3.md`): item 4 pizza in the catalog (#46), with item 5 his v1 leftovers.
- **Open:** draft #51 (topper fix for #45) waits for Bruce's test line. Issues open: #45–#50 (each has a comment with the next step).
- **Tony next:**
  - once the developers' v1 PRs are merged: remove the store's v1 compatibility (`getPlan`, `getStack`, `locate`, `placeOnStack`, `toV1Plan`, `describeLocation`), move `tests/store.test.mjs` and `tests/plan2.test.mjs` to v2, convert `data/seed.json` to schema 2 (`grep -rn` first);
  - review the PRs as they come.
- **Later:** B2 game families (Stephen; Tony adds the schema field first), D7 moving checklist (on top of Peter's compare), issue #48 (fewer boxes on top counts as easier to reach: Stephen's rules and `suggestSpots`).
- **Possible move to a Claude Code project:** Adam may run the team as a project in the Code section (one coordinator conversation, one thread per task). The opening messages are in `docs/kickoff.md`. The roles, ownership, briefs and review steps stay the same; only the relaying changes.

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
- **A core change can break a developer's test** (#51: the topper fix broke one assertion in `tests/map-scene.test.mjs`). Run the full suite before opening the PR. Put the exact test change in the PR body and ask the developer to push it to your branch, so both land together.

## Environment notes

- **GitHub:** REST only (`gh api`); GraphQL is blocked. That means:
  - Tony can't take a PR out of draft (Adam taps "Ready for review");
  - Tony can't delete branches (the proxy refuses).
- **Push:** `git -c push.negotiate=true push -u origin <branch>`.
- **Pages:** https://macskasa.github.io/Shelp/. Use `?nosw` to skip the service worker.
- **Planning workbook:** a Claude Docs artifact (Catalog, Shelf plan, Not identified, App user stories): https://claude.ai/artifact/RX9eSK3arZSpGBZR6mqh9k
- **The v5 planner is not in the repo.** It was Python in the first Tony chat's sandbox. A full re-plan (D5) would need a new planner on schema 2, ideally reusing `js/core/geometry.js`.
