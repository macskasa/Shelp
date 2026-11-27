# Lead handover · Tony

For a fresh Tony chat. Read this, `docs/CONTEXT.md` and `README.md`, and nothing else until a task needs it.

## Role

Tony is the lead and code reviewer.
- **Owns:** `js/core/`, `js/app.js`, `index.html`, `css/base.css`, `data/`, `docs/`, `tests/store.test.mjs`, `tests/plan2.test.mjs`, `tests/fixtures/v5-geometry.json`, `tests/fixtures/seed-v1.json` and `.github/`.
- **Never edits the developers' files.** Changes they need go to them as review notes.
- **Messages to Adam:** only problems, decisions he has to make, and actions he has to take ("#66 ready to merge"). No summaries of what was done or tested; that goes on the PR.
- **Team:**
  - Adam: product owner, merges PRs.
  - Stephen: Part A, data, rules and export (Sonnet).
  - Bruce: Part B, the map (Opus).
  - Peter: Part C, catalog, search, frame and offline (Sonnet).

## Where things stand (2026-11-27)

- **Merged:** everything up to #81. Phase C has Pick up, Turn, Move, placing mode, the board strip and stacks (#75). B2 game families is done: the field (#73), editing and the rule (#76), the catalog filter (#79), the map highlight (#81). D3 free space (#74) and the reach score for #48 (#80) are in. README "Releases and stories" is current.
- **Bruce's #83** (reach text in stack details, `view.js` split to 291 lines) is reviewed and closes #48. No thread is running.
- **Nits for the next briefs:**
  - Peter (#79): at 1024–1279 px the catalog's Family column leaves the title about 156 px; `family=Gone` stays in the URL after falling back to Any.
  - Stephen (#83 review): the reach text caps the count at "3 boxes on top" while the `?game=` caption counts them all; cap the score, not the text.
  - Bruce (#83): the " – " before the reach blends with titles that contain an en dash; " · " or a line break.
- **Bruce, waiting:** `docs/part-b3.md` item 6 (drag and drop) waits until Adam has tried moving games on his phone.
- **Open issues:** #48 (closes when #83 merges).
- **Later:** D7 moving checklist (on top of Peter's compare); Bruce may show the D3 numbers on the map after drag and drop.
- **How the team runs:** a Claude Code project since 2026-11-27. The project conversation is Tony. Each piece of developer work is a thread (a new session from `create_session`, one PR each, Opus for Bruce, Sonnet for Stephen and Peter) whose prompt names the brief item, the branch (`outcome_branch`) and asks for a one-line `send_message` to Tony when the PR is green. A thread whose work needs an unmerged core PR starts from that PR's branch (`source_revision`) and still opens its PR into `main`. Tony verifies on GitHub, reviews, and tells Adam one line. The opening messages are in `docs/kickoff.md`.
- **Tony's branch:** each Tony session has its own branch name from the session settings (this one: `ccr-96632897-bcu0g0`). Push only there; restart it from `main` after its PR merges.

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
- **B2 "far apart":** a family warns unless its boxes on shelves are on one stack, or on one shelf with no other stack between them. The board and the cupboard don't count; a box inside another counts where its host is. 0 warnings on today's plan.
- **D3, where it shows:** Tony's core `js/core/space.js`, and Peter's Free space screen in `js/space/`. Bruce may show the numbers on the map later.

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
- **Two docs PRs both append to CONTEXT's Changes list,** so the second one conflicts (#51). Merge `main` into the branch and keep both entries; never force-push.
- **A thread can stall on a permission prompt** (Stephen's #62 thread waited on "may I start a local web server?"). Check a quiet thread with `get_session`. Browser checks don't need a server: serve the repo with Playwright's `context.route`, and put that in the thread prompt.
- **A message that crosses a review isn't the answer to it:** Bruce's "#75 green" was sent before the review arrived and covered only the earlier note. Compare the message time with the review time, and check the commits before calling a PR ready.
- **Wall-clock limits in tests flake on CI:** `node --test` runs the files in parallel on a small shared runner (#58's first run: 215 ms against a 200 ms limit). Ask for best-of-N and headroom, not a bare limit.

## Environment notes

- **GitHub:** REST only; GraphQL is blocked. In a project session, `gh api` works for reads (PRs, check runs, issues, job logs) and the GitHub MCP tools post reviews (`pull_request_review_write`, event `COMMENT`). That means:
  - Tony can't take a PR out of draft (Adam taps "Ready for review");
  - Tony can't delete branches (the proxy refuses).
- **Push:** `git -c push.negotiate=true push -u origin <branch>`.
- **Pages:** https://macskasa.github.io/Shelp/. Use `?nosw` to skip the service worker.
- **Planning workbook:** a Claude Docs artifact (Catalog, Shelf plan, Not identified, App user stories): https://claude.ai/artifact/RX9eSK3arZSpGBZR6mqh9k
- **The v5 planner is not in the repo.** It was Python in the first Tony chat's sandbox. A full re-plan (D5) would need a new planner on schema 2, ideally reusing `js/core/geometry.js`.
