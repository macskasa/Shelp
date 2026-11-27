# Part A, Phase B – Rules, export and the pizza switch on schema 2 · Stephen

Adam approved a bigger model for the shelves (CONTEXT section 3 and section 4, read both again):
- games can carry several games
- a game can lie across two others like a brick in a wall (a **bridge**)
- every box records which side faces up
- some games are **pizza** (they only lie flat)
- a **board** holds games without a place

Tony's Phase A put this in the store. Your job is to move the rule checker, the CSV export and the game panel onto it.

**Order:** 1 first, because Bruce's picker waits for it. Then 2 to 4.

## 1. Rule checker v2 (`js/rules/`)

Add, next to the current API:

```js
checkStack2(stack, getGame) → Warning[]     // a v2 stack (store.getStack2)
checkPlan2(plan, getGame)   → Warning[]     // a v2 plan (store.getPlan2), with overlaps
// Warning = { stackId, gameId /* or null */, otherStackId /* overlaps */, rule, severity: 'block' | 'warn', message }
```

- Geometry comes from **`layoutStack2` in `js/core/geometry.js`**, not from `js/map/model.js`.
- Keep `checkStack` / `checkPlan` (v1) until Bruce has moved over, then delete them.

**The rules:** the full table is in CONTEXT section 3. Rule ids:

| Severity | Rule id | What it checks |
|---|---|---|
| block | `size-missing` | safety net |
| block | `pizza` | `up !== 's'` on a pizza game |
| block | `overlap` | |
| block | `length` | past the wall end |
| block | `shelf-height` | taller than `zone.height` (with or without a topper) |
| block | `bridge-level` | the two supports' tops differ by more than 0.5 cm |
| warn | `height` | usable height; with a topper, `zone.height − 0.5` |
| warn | `bracket` | |
| warn | `stacking` | 1 cm rule, see below |
| warn | `depth` | a stack with one standing box is exempt |
| warn | `two-deep` | |
| warn | `bridge-support` | the box's centre must be over its supports, and the gap between the two supports at most a third of the box's width |

**The 1 cm rule on trees:** the boxes resting on one box together must stay within its width + 1 cm and its depth + 1 cm. For a bridge, measure from the outer edges of its two supports.

**Dropped:** the card-shelf rule and the old "only card games stand" rule. The pizza flag replaces them.

**`otherStackId`** on overlap warnings (Bruce's idea): both stacks can then show the problem.

**Plan check card:** group warnings into **Must fix** (block) and **Warnings**. If games are waiting on the board, add an info line: "3 games are on the board".

**Acceptance:**
- `checkPlan2(getPlan2())` on the upgraded seed returns `[]`.
- One test per rule (bridges included) that breaks it on purpose.

## 2. CSV export on schema 2

- **Level / position:** the level in the tree, where 1 = on the shelf, 2 = on a box that stands on the shelf, and so on. Use the longest path down. Standing boxes on the floor: their position left to right.
- **Row / pile:** `standing`, `on its side`, `long side out`, `across <a> and <b>`, `Front row` / `Back row`, combined with commas.
- **Board games:** at the end, with Shelf = `Board`.
- Keep the 204-row acceptance. Every game appears once.

## 3. Pizza switch in the game panel

A toggle **"Pizza – may only lie flat"** in the game panel. `store.updateGame(id, { pizza })` refuses to switch it on for a game that stands or lies on its side; show the store's message.

## 4. Plan import refuses blocking problems

In restore and plan import (E2), after `store.validate()`, run `checkPlan2` on the incoming plan (`checkData` in `js/core/schema.js` gives you the upgraded file). If there is any **block** problem, list it and stop. Warnings are shown in the confirmation but don't stop the import.

## What you get ready made

- **Store (v2):** `getPlan2`, `getStack2`, `locate2`, `getBoard`.
- **Schema:** `checkData` / `knownFrom` in `js/core/schema.js`.
- **Geometry:** `layoutStack2` and `boxSize` in `js/core/geometry.js`.
- **Format:** `describeLocation2` in `js/core/format.js`.
- **Data:** the `pizza` field on every game.

## Not yours

The map and the picker (Bruce), and search wording and the Undo button (Peter). Phase C, moving by hand, comes next. Later on your list: D4, suggest a spot for a new game, which builds on your checker.
