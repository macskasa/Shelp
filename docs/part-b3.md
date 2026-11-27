# Part B, Phase C – Moving games by hand · Bruce

Phase C is Adam's top priority: he wants to rearrange the shelves in the app, box by box, the way he would by hand. You own the whole moving flow on the Shelves screen. Read CONTEXT sections 3 and 4 again (the rules, bridges, pizza, the board).

**Start when** your Phase B items 2 and 3 are merged, and Tony's core PR is in (check that `toast()` takes `action` and that `pickUp` is in `js/core/contracts.js`).

**PRs, in this order:**
1. Scrolling pans on desktop (item 7, issue #49), a small one first
2. The back row on the Shelves screen (item 8, issue #47)
3. Pick up a box + the turn chooser (items 1 and 4)
4. Placing mode + the board strip (items 3 and 2)
5. Stacks (item 5)
6. Drag and drop on desktop (item 6), only after Adam has tried 3–5 on his phone

Also on #51 (Tony's topper fix, issue #45): push the one-line change to `tests/map-scene.test.mjs` shown in the PR to its branch `tony/topper-centre`.

## Rules for every move

- **One move = one undo step.** Use one store write, or one `store.batch()` when a move needs several (a new stack plus the box on it).
- **Check before you write.** Run the same function inside `store.preview(fn)`, then Stephen's `checkPlan2` on the previewed plan. **Only new problems count:** compare with `checkPlan2` on the current plan, as your Phase B picker does.
  - A new **block** problem: no button to go ahead, and the reason is shown. (Adam: the moving screens never offer "anyway" for a blocking rule.)
  - New **warnings** only: the button becomes "Place anyway" and the warnings are listed.
  - If `preview` returns an `error` (no size, pizza not flat), show its message.
- **After a move:** close the panels (`closePanels()`), then show a toast that says what happened, with an Undo button: `toast('Ark Nova → stack B3', { action: { label: 'Undo', run: store.undo } })`. That answers Peter's point: a modal panel makes the header Undo unreachable on the phone, so the panel closes and the toast is right under the thumb.
- Phone first (384 and 412 px, portrait and landscape), desktop too, Android back closes the open sheet first. Tap targets at least 40 px.

## 1. Pick up a box

- In stack details, each box line gets a **Pick up** action. It opens a small sheet with:
  - **Move** → placing mode with this game (item 3).
  - **Turn** → the turn chooser (item 4).
  - **To the board** (`moveToBoard`) and **To the cupboard** (`moveToCupboard`, optional reason).
  - **Put inside a box…**: a host picker with a title search. Candidates are every other game that is not itself inside a box. `store.setInside` refuses the rest; show its message.
- When boxes rest on the picked box, say so before the move: "2 boxes on top settle down onto Takenokolor". The store already lets them settle when a box leaves.
- The same sheet opens from the board strip (item 2) and the cupboard list. Turn is shown only for a box on a shelf.

## 2. The board strip

- A strip on the Shelves screen with the games from `store.getBoard()`, in that order: "Board (3)", then one chip per game (title, category colours). On a phone it scrolls sideways and sits above the tab bar. On desktop it may be a column beside the map.
- It's hidden while the board is empty, and it follows `store:changed`.
- Tapping a chip opens the pick-up sheet. The board is unlimited (Adam's decision).

## 3. Placing mode

- The route is **`#/map?pick=<gameId>`**. `pickUp(id)` (new contract, Tony) goes there, so the game panel (Stephen) and "Where's my game?" (Peter) can start a move too.
- A bar at the bottom (above the tab bar and the safe area) says: "Placing **Ark Nova** · 30 × 30 × 7 cm · tap a stack or an empty spot", with **Cancel**. Zoom and pan keep working. Cancel, Esc and Android back leave placing mode without changing anything.
- **Tap a stack** → the spot sheet (your Phase B picker, reused): on the shelf left or right of…, on top of…, across two… (only pairs whose tops are within 0.5 cm), under…. Then which side is up (item 4).
- The sheet shows the stack **as it would be** (draw the previewed stack with `layoutStack2`) and the new problems. Then **Place** or **Place anyway**.
- **Tap empty shelf space** → "New stack here" (item 5).
- After placing: leave placing mode on `#/map?game=<id>`, so the new place is highlighted, plus the toast with Undo.
- Desktop: Tab moves between stacks, Enter opens the spot sheet, Esc cancels.
- **Suggestions:** when Stephen's `suggestSpots()` is merged (his brief, item 4), show the first three at the top of the bar. Tapping one opens the spot sheet with that spot chosen. Until then, leave it out.

## 4. Turn chooser

- It lists only the orientations the store allows:
  - a **pizza** game gets flat and flat turned (`rot`), two options;
  - any other game gets flat, on its side and on end, each turned or not, up to six options.
- Options with the same `w × d × h` (a box with two equal sides) show once.
- Each option shows its size along × deep × high and a small to-scale outline. The current orientation is marked.
- For a box on a shelf, choosing one previews `turnBox(id, { up, rot })` and goes through the same check (Turn / Turn anyway). In the spot sheet it just sets `up` and `rot` for the placement.

## 5. Stacks

- **New stack in empty space:** take x from the tap, rounded to 0.5 cm. Snap to x = 0.2, 60.2 or 140.2 when within 3 cm of a joint (wall shelves). Preview and write `batch(() => { const id = store.createStack(zone, { x }); store.placeBox(gameId, { stackId: id, up, rot }); })`. That's one undo step; it works inside `preview` too.
- **Move a stack:** stack details → **Move stack**: ←5 ←1 1→ 5→ (cm) and the current x. Every step previews `moveStack` and shows new problems; **Save** writes one `moveStack` (one undo step). Desktop: arrow keys ±1, Shift+arrow ±5.
- **Empty stacks stay** (Adam: stacks keep their ids). Draw an empty stack as a thin outline with its id, so you can tap it to put something there. Its details offer **Remove stack**. Removing a stack that still has games asks first; its games go to the board.
- **Renumber left to right** (Adam's decision: an explicit action): a button on the Shelves screen. A confirmation lists the renames from a preview, then `renumberStacks()` runs.

## 6. Drag and drop on desktop (last PR)

- Mouse only (`pointerType === 'mouse'`). On the phone a drag would fight pan and zoom, and tapping through placing mode is the phone way.
- Drag a box from the map or a chip from the board strip onto a stack. While dragging, the nearest spot under the pointer is outlined. Dropping opens the spot sheet with that spot chosen. Same check, same Place / Place anyway.
- Esc during a drag cancels it.

## 7. Scrolling pans on desktop (issue #49)

- Today every wheel event zooms (`pan-zoom.js`). On a Mac trackpad, two-finger scrolling should **move** the drawing instead.
- Wheel **without** Ctrl: pan by `deltaX` / `deltaY` (both directions; Shift + mouse wheel scrolls sideways, as browsers do).
- Wheel **with** Ctrl: zoom at the pointer, as now. A trackpad pinch arrives as Ctrl + wheel, and Ctrl + mouse wheel zooms too. The + / − buttons stay.
- Touch is unchanged: the phone has no wheel events.

## 8. The back row (issue #47)

- Today only the front row of a 2-deep stack is drawn (T1, B5, B6, L1). A back-row game can't be seen, and "Where's my game?" can only highlight its stack.
- Add a **Front row / Back row** switch on the Shelves screen. In the back view, 2-deep stacks draw their back row, with the front row as faint outlines in front. Other stacks look the same.
- `?game=` for a back-row game opens the back view and highlights the box. Leaving the screen goes back to the front view.
- Placing mode (item 3) uses the same view to put a box in a back row.
- Phone first: the switch is a two-button toggle, at least 40 px, and it doesn't cover the drawing.

## Acceptance (whole phase)

- Every way of moving makes exactly one undo step, and Undo from the toast puts the plan back **exactly** as before (compare `exportData().plan`).
- A blocking move can't be confirmed anywhere; a warning-only move can, after "anyway".
- Moving a box with boxes on top: they settle as the store says, and the text said so first.
- The v5 plan still shows 0 problems after a move and its Undo.
- 384, 412 and landscape, desktop 1440, back gesture, keyboard, no console errors.

## What you get ready made

- **Store:** `placeBox`, `placeUnder`, `turnBox`, `moveToBoard`, `moveToCupboard`, `setInside`, `createStack`, `moveStack`, `removeStack`, `renumberStacks`, `preview`, `batch`, `undo`, `getBoard`, `locate2`.
- **Rules (Stephen):** `checkPlan2`, `forStack`, `blocking` in `js/rules/`.
- **Core (Tony, in the core PR):** `toast(text, { action: { label, run } })`, and the `pickUp(id)` contract → `#/map?pick=<id>`.

## Not yours

Saved versions (Peter), suggesting a spot (Stephen, `suggestSpots`, which you only display), game families (later).
