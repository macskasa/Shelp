# Part C, Phase C – Saved versions and Move · Peter

Phase C is about moving games by hand (Bruce builds the moving screens). Before a big rearrangement Adam wants to save where everything is, try things, and go back or compare. That's **D6, saved versions**, promised at the end of your last brief.

**Start when** Tony's core PR is merged (check that `store.saveVersion` exists and that `pickUp` is in `js/core/contracts.js`).

**PRs:**
1. Items 1 and 2
2. Item 3

## 1. Move from "Where's my game?"

A **Move** button on each card, next to "Show on map" and "Details". It calls `pickUp(id)`, which opens Bruce's placing mode (`#/map?pick=<id>`). For a game without a box size it is disabled, with the hint "Add a box size first".

## 2. Saved versions

- A **Versions** button in `#app-tools`, between Redo and search: a clock icon, a label on desktop.
  - Check that the header still fits at 384 and 412 px with four buttons and the title.
  - Buttons stay at least 44 px.
- The button opens a panel (`showPanel`) with:
  - **Save this version**: a name field, default "Version 27 Nov 10:15", at most 60 characters. Disabled when 10 are saved, with the hint "Delete one to save another."
  - **The list**, newest first: name, date, "204 games · 34 stacks".
- For each version:
  - **Switch to it**: a confirmation says "This replaces your games and shelf plan with “Before top shelf”. You can undo it." It has a checkbox, ticked by default when there is room: "Save the current state as a version first". Then `restoreVersion(id)` and a toast "Switched to “Before top shelf”" with an Undo button (`toast(text, { action: { label: 'Undo', run: store.undo } })`).
  - **Compare** (item 3).
  - **Rename** and **Delete** (Delete asks first).
- The panel follows `store:changed`.
- Put the panel and its logic in a new folder, **`js/versions/`** (yours, with `tests/versions*.test.mjs`). The header button stays in `js/shell/tools.js`.

## 3. Compare

- **Compare with now**, or pick two versions: a list of what is different, grouped:
  - **Moved**: "Ark Nova: M4 → B3", "Dixit: Board → T2"; a move within a stack reads "moved within B3";
  - **Turned**: same place, different `up` / `rot`;
  - **Only in one of them**: games added or removed since.
  - Each line opens the game (`openGame`).
- Use a plain function `compareVersions(a, b)` in `js/versions/compare.js`, tested in Node. It takes two `{ games, plan }` and returns the groups.
  - Locations come from `locations2(plan)` in `js/core/plan2.js`. It's a pure read that works on any plan, which is why it's allowed here.
  - Your `shortLocation` gives the short names.
- This list is the base of the later D7 "moving checklist", so keep it a plain data function.

## What you get ready made (Tony's core PR)

- **Store:**
  - `listVersions()`: newest first, `{ id, name, savedAt, games, stacks }` (the last two are counts);
  - `getVersion(id)`: `{ id, name, savedAt, games, plan }`, frozen;
  - `saveVersion(name) → id`: refused when 10 exist;
  - `restoreVersion(id)`: replaces games and plan; one undo step;
  - `renameVersion(id, name)`, `deleteVersion(id)`.
  - Saving, renaming and deleting fire `store:changed` with `versions: true`, but they are not undo steps.
- **Backups:** a full backup carries the saved versions, and restoring one replaces them. A plan-only import leaves them alone.
- **Core:** `toast(text, { action: { label, run } })`, and the `pickUp(id)` contract.

## Not yours

The moving screens (Bruce), suggesting a spot (Stephen). D7, the moving checklist, comes later, on top of your compare.
