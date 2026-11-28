# Part C – Moving checklist (D7) · Peter

Adam moves boxes in the app first, then has to do the same on the real shelves. Compare tells him *what* is different. The checklist tells him **in what order to do it** with his hands: what to lift off first, and where each box goes, bottom up, so no box ever ends up under one that's already in place. He ticks the steps as he goes, and a long move can survive a reload.

**Start** from `main`. **One PR** for the whole brief. Nothing in the core changes.

## What you get ready made

- Your `compareVersions(a, b)` and the compare panel (any two of the saved versions and "now").
- `locations2(plan)` from `js/core/plan2.js` (the same allowed pure read): per game `stackId, zone, row, x, up, rot, on, above, below`.
- `layoutStack2(stack, getGame)` from `js/core/geometry.js`, if you need heights or the shelf x of a box.
- `store.setMeta(key, value)`: free-form, saved with the data and in backups, not an undo step; it fires `store:changed` with `{ games: [], plan: false, meta: true }`.

## 1. The steps: `movingSteps(a, b)`

A plain function in a new `js/versions/checklist.js`. It takes two `{ games, plan }`, like `compareVersions`, and returns `{ takeOut: [Step], putIn: [Step], inside: [Step] }`. Each Step is `{ key, id, title, text }`; `key` is `phase:gameId`.

- **A box stays** when it is in the same zone at the same shelf x (stack x + box x, within 0.05 cm), in the same row, with the same `up` / `rot`, and **everything under it stays too**. So renumbering or joining stacks gives no steps, and a box whose support leaves is lifted and put back.
- **Take out** every box in `a` that doesn't stay, **top down**: a box comes only after every box resting on it. Group by stack in shelf order (zone order, then x).
  - "Take Ark Nova off M4". When the box's last place is off the shelves, add it: "… → board", "… → cupboard", "… (not in the app any more)".
- **Put in** every box in `b` that doesn't stay, **bottom up**: a box comes only after what it rests on (both supports for a bridge). Group by stack of `b` in shelf order.
  - "Put Ark Nova on B3 · on Takenokolor · flat", "… · across ‹left box› + ‹right box› · flat", "… · on the shelf from 60.2 cm · standing". Use your `poseText`.
  - Say "Put back" when it returns to the stack it came off. Say where it comes from when that isn't the pile Adam just took apart: "from the cupboard", "from the board", "new".
- **Inside** lists the games whose host changes ("Put Lairs: Box Zero inside Lairs", "Take … out of …"). Order doesn't matter there.
- Games that only move between the board and the cupboard get no step.

## 2. The checklist panel

- In the compare panel, a **Moving checklist** button when there are differences. It opens a panel (`showPanel`) for the same two sides: "From Before the top shelf to now".
- Three sections with counts: **1. Take out (n)**, **2. Put in (n)**, **3. Inside boxes (n)**; leave out empty ones.
- Each step is a row with a checkbox (the whole row ticks it, at least 40 px tall) and the text. The game's title opens it (`openGame`) without ticking.
- At the top: "12 of 40 done", **Hide done** (a toggle) and **Clear ticks**.

## 3. Ticks survive a reload

- Keep them with `store.setMeta('checklist', { from, to, done: [key, …] })`; `from` / `to` are a version id or `'now'`.
- Opening the checklist for the same `from` / `to` keeps the ticks whose keys still exist. Steps are worked out again each time, because "now" can change while Adam is moving. Another pair starts fresh and replaces the old ticks.
- Don't re-render the open compare panel on your own `meta` changes.

## Rules for this PR

- `movingSteps` and the texts are plain functions with Node tests (`tests/versions-checklist.test.mjs`):
  - hand-made plans: a pile with its middle box moved (the box on top is lifted and put back), a bridge put in only after both supports, a stack moved along the shelf, renumbered stacks (no steps), board, cupboard, new and removed games, inside;
  - the seed against itself gives no steps;
  - a test helper that replays the steps on `a` and checks that every box is taken off only when nothing rests on it, and put in only when its supports are there.
- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode, Back closes the panel, no console errors.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change.

## Not yours

Moving the boxes in the app (Bruce), the saved versions in the store (Tony).
