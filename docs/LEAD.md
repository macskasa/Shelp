# Lead handover · Tony

For a fresh Tony chat. Read this, `docs/CONTEXT.md` and `README.md`, and nothing else until a task needs it. `docs/kickoff.md` has the thread prompt template.

## Role

Tony is the lead and code reviewer.
- **Owns:** `js/core/`, `js/app.js`, `index.html`, `css/base.css`, `data/`, `docs/`, `README.md`, `.github/`, `tests/store.test.mjs`, `tests/plan2.test.mjs`, `tests/core-*.test.mjs`, `tests/fixtures/v5-geometry.json`, `tests/fixtures/seed-v1.json`.
- **Never edits the developers' files.** Changes they need go to them as review notes or a message to their thread.
- **Messages to Adam:** only problems, decisions he has to make, and actions he has to take ("#66 ready to merge", "merge #95 first"). What was done and tested goes on the PR.
- **Team:**
  - Adam: product owner, merges PRs.
  - Stephen: Part A, data, rules and export (Sonnet).
  - Bruce: Part B, the map (Opus).
  - Peter: Part C, catalog, search, frame, offline, free space (Sonnet).

## Where things stand (2026-11-28, handover)

- **Merged:** everything up to #97. Nothing is open, and no threads are running. `main` is green and deployed.
- **Done:**
  - MVP and Phases A–C: schema 2, undo, saved versions and compare.
  - **D1, moving games:** Pick up, Turn, Move, placing mode, the board strip, stacks (new, move, remove, renumber), only working spots in the spot sheet, drag and drop on desktop, and **Join with the next stack** (#94, #95, #97) with bridges across two tops whose open edges meet.
  - **B2 families:** editing, the "spread out" rule, the catalog filter, the map highlight.
  - **D3 free space:** room on top with both widths, standing spaces, tilt (#84–#91).
  - **D4 suggest a spot**, and **#48 reach** (score per box, shown in stack details).
  - **`box-overlap`:** a block rule for boxes taking the same place in a stack (#96).
- **Open issue:** #93, the room behind shallow boxes (depth) in free space. Tony's core first (the API is in `docs/part-c9.md`), then Peter's screen.
- **Briefs written, threads not started:** `part-c8.md` (Peter, D7 checklist), `part-b7.md` (Bruce, free space on the map), both from `main`; `part-c9.md` (Peter, #93) after Tony's core. E4 needs a decision from Adam first (a server or proxy, and a BGG API token).
- **Possible next work** (ask Adam; don't start on your own):
  - #93 (depth);
  - D7 moving checklist, on top of Peter's compare;
  - Bruce shows the D3 numbers on the map;
  - E4 live BGG refresh (needs a server);
  - D5 full re-plan (in chat; no planner in the repo).
- **Small leftovers, for a later brief:**
  - Ties in the spot sheet keep the spotChoices order; Stephen could return `best`'s rank (reach, height) from `checkSpots` for Bruce to sort by.
  - In free space, "standing" means "below the top of the pile", so wide ledges land there too.
  - An "Across M1 and M2" slot could point to the Join action.
- **Adam's real plan differs from the seed** (he has moved things; e.g. M1 has Scythe standing at its left, pile at 10–39.7 cm). When a question depends on his data, ask him to upload a fresh backup into the chat (see Environment notes).

## How the team runs

- A Claude Code project since 2026-11-27. The project conversation is Tony.
- **One thread per PR:** each piece of developer work is a new session from `create_session`:
  - `model`: `opus` for Bruce, `sonnet` for Stephen and Peter;
  - `source_url`: `https://github.com/macskasa/Shelp`;
  - `outcome_branch`: e.g. `bruce/join-stacks`;
  - `source_revision`: only when the work needs an unmerged branch (a core PR, or a developer's earlier PR). The thread starts from it and still opens its PR into `main`.
- **The prompt** follows the template in `docs/kickoff.md`. It names the brief item and branch, and asks the thread to read CONTEXT and the brief, use `context.route` for browser checks, open the PR with the GitHub MCP tools, wait for the green "Tests" check, and send Tony one line ("#n green") with `send_message` to Tony's session id.
- **Tony's own work** goes on the session's branch (its name is in the session settings, e.g. `ccr-…`). Push only there. Open a PR for core and docs work, and restart the branch from `main` after its PR merges (a plain push fast-forwards; force pushes are refused).
- **Order:** core first (Tony's PR with the field or function plus the briefs), then the threads, started from that branch while it's open. Tell Adam the merge order ("#84 first").
- **Briefs** are `docs/part-<a|b|c><n>.md`, one per round: the story, Adam's decision, what the core gives, numbered items, tests, rules, "Not yours". Check every number you quote in a brief against the code first (an example in `part-c6.md` was wrong).

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
- **B2 "far apart":** a family warns unless its boxes on shelves are on one stack, or on one shelf with no other stack between them. The board and the cupboard don't count; a box inside another counts where its host is.
- **D3, where it shows:** Tony's core `js/core/space.js` and Peter's Free space screen (`js/space/`). Bruce may show the numbers on the map later.
- **Free space:** the room on top shows both widths, the air and the box it rests on. Surfaces within 0.5 cm side by side count as one (tilt), also across two stacks but never across a bracket. Standing spaces count (#88, #89).
- **#48 reach:** brief it (2026-11-27). Tony's score, which Adam didn't object to: +4 outside an easy zone, +2 back row (on every shelf, not only the bottom ones), +1 per box on top, counting at most 3. The text shows the real count.
- **Moving (2026-11-27):** the spot sheet lists only spots that work, with a "Show N blocked spots" link. Stacks on the map are not dimmed, and Turn keeps all its ways. Drag and drop on desktop is "the way to do it" there; the phone keeps tapping.
- **Join stacks (2026-11-28):** "Join with the next stack" is how a box comes to rest across two stacks. Depth is issue #93, for later.

## How to review a PR

1. **Verify on GitHub.** `gh api repos/macskasa/shelp/pulls/<n> --jq '"\(.head.ref) → \(.base.ref) draft=\(.draft) \(.state) \(.mergeable_state) \(.head.sha)"'`, then read the body. The base must be `main`.
2. **Tests:** `gh api repos/macskasa/shelp/commits/<sha>/check-runs --jq '.check_runs[] | "\(.name): \(.conclusion)"'` ("test" must be success). For PRs that land together, merge them locally in a scratch worktree and run `node --test`.
3. **Read the diff:** `git fetch origin <branch>` and `git diff origin/main...origin/<branch>`. When the branch starts from an unmerged core branch, diff against that branch to see only the developer's part. Check module sizes (about 300 lines) and that only their files changed.
4. **Browser check:** `git worktree add --detach <scratchpad>/wt<n> origin/<branch>`, then a Node script with `require('playwright')` and `chromium.launch()` (pre-installed; never `playwright install`). Serve the worktree's files with `context.route('http://shelp.test/**', …)` (no local server), open `/?nosw`, and pass `serviceWorkers: 'block'`.
   - Phone: 384 × 832, `isMobile`, `hasTouch`. Desktop: 1440 × 900 (and 1024 × 768 for tables).
   - Prefer text checks: `innerText`, hashes, `exportData().plan` before and after Undo. Drive the store from the page with `await import('/js/core/store.js')`.
   - Adam's data: `store.importData(JSON.parse(backup))` in the page.
   - Remove the worktree afterwards (`git worktree remove --force …`).
5. **Post the review on the PR only:** the GitHub MCP tool `pull_request_review_write` (load it with ToolSearch), `method: create`, `event: COMMENT`, `commitID` = the **full** head SHA (a short one fails). Put the verdict first ("Approved: ready to merge" or "Almost ready: …"), then the action items or nits, then what was tested, then the footer. GitHub refuses APPROVE (same account), so the comment is the approval.
6. **Action items** go to the thread too, with `send_message`. Then tell Adam one line.

## Lessons learned

- **Check that a PR is still open before pushing to its branch.** Commits pushed after a merge are lost (that happened with #5).
- **Double-check PR numbers**, and Adam's: "89 is merged" meant PR #90 (#89 was the issue).
- **Check each PR's base branch** (`.base.ref`), not only its head. A stacked PR into a developer's branch never reaches main (#31, fixed by #34). Threads open their PRs into `main` even when they start from another branch.
- **Undo after a move:** a modal panel makes the header Undo unreachable on the phone. So moving actions close the panels and show a toast with an Undo button.
- **Don't edit a file a developer owns,** even to fix a conflict. Give them the exact code instead.
- **A core change can break a developer's test** (#51). Run the full suite before opening the PR. Prefer additive, backward-compatible fields: in #90, standing spaces went into a new `standing` list so Peter's `slots` tests kept passing.
- **Two docs PRs both append to CONTEXT's Changes list,** so the second one conflicts. Merge `main` in and keep both entries; never force-push.
- **A thread can stall, or finish without its message.** Stephen's #62 thread waited on a permission prompt; Bruce's "#92 green" arrived after Tony had already reviewed. When a PR is green and no message came, check the thread with `get_session` and review anyway.
- **A message that crosses a review isn't the answer to it:** compare the message time with the review time, and check the commits before calling a PR ready (#75, #97).
- **Wall-clock limits in tests flake on CI:** ask for best-of-N and headroom, not a bare limit.
- **Don't silently drop data as "noise":** #84 left ledges out of free space, and Adam found them missing (#88). When a heuristic hides something real, say so or ask.
- **Check fixes against Adam's real data** when he reports a problem: his plan differs from the seed (#89 only showed up with his backup).
- **Developers find core bugs while building on the core** (Bruce found the bridge placement in `insertOn`, #95). Fix it in the core quickly on Tony's branch, message the thread how to merge it, and add a rule as a safety net (#96).

## Environment notes

- **GitHub:**
  - `gh api` works for repository reads (PRs, check runs, issues, job logs). The GitHub MCP tools (load with ToolSearch) create PRs, issues and reviews. GraphQL is blocked.
  - Tony can't take a PR out of draft, and can't delete branches. Old `tony/*` branches are left over; Adam can delete them.
  - **Attachments on issues** (`github.com/user-attachments/…`) can't be fetched from the session. Ask Adam to upload the file into the chat; it lands under `/root/.claude/uploads/…`.
- **Push:** `git -c push.negotiate=true push -u origin <branch>`. Force pushes are refused by the auto mode.
- **Pages:** https://macskasa.github.io/Shelp/. Use `?nosw` to skip the service worker.
- **CI checks:** "test" (the suite), plus build and deploy on `main`.
- **Planning workbook:** a Claude Docs artifact (Catalog, Shelf plan, Not identified, App user stories): https://claude.ai/artifact/RX9eSK3arZSpGBZR6mqh9k
- **The v5 planner is not in the repo.** It was Python in the first Tony chat's sandbox. A full re-plan (D5) would need a new planner on schema 2, ideally reusing `js/core/geometry.js`.
