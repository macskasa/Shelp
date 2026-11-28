# Part C – Free space: standing spaces and tilted surfaces (#88, #89) · Peter

Two issues from Adam, both about what the Free space screen finds:
- **#88:** "a space that requires a game to be put on another in standing position is not found currently. Take a look at the gap next to KLASK on top of Anachrony or next to M6 on Thunder Road."
- **#89:** "we need some tilting tolerance to maximise usable space … Free spaces does not consider the leftover space on Csúcstámadás because of approximately 3 mm of height difference." In Adam's plan, Csúcstámadás (M1) has a 2.8 cm open edge at 28.1 cm, right beside M2's top at 27.7 cm.

Tony's core now finds both (`js/core/space.js`). You show them. Your PR closes both issues.

**Start** from Tony's core PR: branch from `main` once it is merged (check that `freeSpace` units have `standing`), or from its branch `ccr-96632897-bcu0g0` while it is still open. Either way your PR goes into `main`. **One PR** for the whole brief.

## What you get ready made (core)

- Every slot has three new fields: `kind` (`'top'` or `'standing'`), `stackIds` (one stack, or two when a surface runs across both) and `tilt` (cm).
- **`unit.slots`** is still the room on top of stacks (`kind: 'top'`), and `unit.room` is still `slots[0]`, so your current screen keeps working.
- **`unit.standing`** is new: the standing spaces (`kind: 'standing'`), most height first. Each is the open edge of a box beside something taller, narrow and tall. On the seed: Anachrony (T8) beside KLASK, 4.3 cm wide × 31.8 cm high; Thunder Road (M5) beside M6, 6.5 × 29.5 cm.
- **Tilt:** surfaces side by side within 0.5 cm in height (the same tolerance a bridge gets) count as one, also across two stacks, never across a bracket. Then `stackIds` has both stacks, `y` is the higher one, `tilt` is the difference and `on` lists the boxes of both. In Adam's plan, middle · left becomes: across M1 and M2, 7.4 cm high, 22.9 cm of air, resting on Csúcstámadás + SETI: Space Agencies, 21.7 cm, 0.4 cm tilt.
- Open strips down to 2 cm count now (`MIN_REST`), because thin boxes can stand.

## 1. Tilted surfaces in the room line

- When a slot has two `stackIds`: "**Across M1 and M2:** 7.4 cm high · 22.9 cm of air · rests on Csúcstámadás + SETI: Space Agencies, 21.7 cm · 0.4 cm tilt". Leave "tilt" out when it is 0.
- Same in "More room on top".

## 2. Standing spaces

- Under the room line (and "More room on top"), a second toggle: **"Standing room (3)"**, listing `unit.standing` one per line: "On T8: 4.3 cm wide · 31.8 cm high · rests on Anachrony, 4 cm". The width comes first here, because that's what limits a standing box. Hide the toggle when there are none.
- In the bar, draw each standing space as a narrow band from its surface up (from `y` to `y + h`, as shares of the usable height), in the same faint style as the room on top, with its `rest` part a little stronger.

## Rules for this PR

- Texts and band maths stay plain functions in `js/space/logic.js`, with Node tests on the seed (and a small hand-made unit for the tilted case).
- Don't work out free space yourself: if a number from `js/core/space.js` looks wrong, write it under **Requests for Tony**.
- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode, no console errors, tap targets at least 40 px.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change. Put "Closes #88" and "Closes #89" in the PR body.

## Not yours

The numbers (Tony, `js/core/space.js`).
