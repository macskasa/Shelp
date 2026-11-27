# Part C, Phase B – Search wording, the board and Undo on schema 2 · Peter

Adam approved a bigger model for the shelves (CONTEXT section 3 and section 4, read both again):
- games can carry several games
- a game can lie across two others like a brick in a wall
- every box records which side faces up
- some games are **pizza**
- a **board** holds games without a place
- every change can be undone

Tony's Phase A put this in the store. Your job is to move search and the catalog onto it, and to add Undo.

## 1. Search and "Where's my game?" on schema 2

- Locations come from `store.locate2(id)` and their text from `describeLocation2(loc, getTitle)`. Examples: "Bottom shelf · stack B3 · on Takenokolor · nothing on top", "… · across Compile: Main 2 and Kontroll · …", "On the board".
- **What's on top of it:** `locate2(id).above` lists every box resting on it, nearest first. With trees and bridges that can be several boxes side by side; name them all.
- An expansion inside a box: the host's location, as today.

## 2. Catalog on schema 2

- Short location: `B3`, `Cupboard`, `In <host>`, `Board`.
- The location filter's "Not placed" becomes **On the board** (`kind: 'board'`).
- Keep the "Size missing" filter.

## 3. Undo and Redo

- An **Undo** button in `#app-tools`. Redo goes in the same place, or as a long-press / second button; your call.
- Use `store.undo()` / `store.redo()`. Enable them from `store.canUndo()` / `store.canRedo()` and refresh on `store:changed`.
- After an undo, show a short toast: "Undone".
- **Desktop:** Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y), but not while the focus is in a text field.
- Every write except `setMeta` is one undo step, and a `batch` is one step. Up to 30 steps are kept, in memory only (a reload starts fresh).
- Acceptance:
  - move a game to the cupboard in stack details, Undo, and it's back in place with the map redrawn;
  - Redo works;
  - after a BGG import (one batch), one Undo removes all of it.

## What you get ready made

- **Store (v2):** `locate2`, `getBoard`, `undo`, `redo`, `canUndo`, `canRedo`.
- **Format:** `describeLocation2` in `js/core/format.js`.
- **Data:** `pizza` on every game. Not needed for your screens, but you may show it as a chip if useful.

## Then: D6, saved versions

Once this is merged, the next item is **saved versions** (D6): save the current games + plan under a name, list them, switch to one, and compare two (which boxes moved). Tony will add the store support (named snapshots) and write that brief separately.
