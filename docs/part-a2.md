# Part A, round 2 – Rule checker, CSV export, add a game · Stephen

Part A's MVP stories are done. This round has three stories, in this order:

1. **D2** – the rule checker (logic + a "Plan check" card on the Data screen)
2. **E3** – export the catalog and the plan as CSV for the planning workbook
3. **A4** – add a game by hand

Re-read `docs/CONTEXT.md` first (see **Changes** at the bottom).

**You own (new):** `js/rules/**`, `tests/rules*.test.mjs`, besides `js/io/**` and `js/game/**`.
**You may import read-only:** `footprint()` and `layoutStack()` from `js/map/model.js` (Bruce's tested geometry). Don't copy or change them; ask Tony if you need something different.

---

## D2 – Rule checker (`js/rules/`, logic without DOM)

The rules come from the planning chat. The checker must say **"0 warnings" for the v5 seed plan**. Tony has checked that the rules below give exactly that.

### API

```js
checkStack(stack, getGame)  → Warning[]   // one stack
checkPlan(plan, getGame)    → Warning[]   // every stack + overlaps between stacks
// Warning = { stackId, gameId /* or null */, rule, message }
```

`rule` is one of `size-missing`, `stacking`, `height`, `bracket`, `length`, `overlap`, `depth`, `two-deep`, `standing`. `message` is one plain English sentence with titles and sizes, e.g. *"Ark Nova (37 × 30) is more than 1 cm wider or deeper than Tokaido Duo (20.5 × 20.5) under it."*

Use `layoutStack(stack, getGame)` for a stack's `w`, `d`, `h`, and `footprint()` for single boxes. Compare with 0.01 cm slack.

### The rules

1. **size-missing:** a box with `dims: null` cannot be checked. One warning per box (it is drawn as a placeholder).
2. **stacking** (flat stacks, each row on its own): every level may be at most `STACK_TOLERANCE` (1 cm) wider **and** at most 1 cm deeper than the level under it. A side-by-side level counts as width = sum of its boxes, depth = deepest box. `gameId` = the upper box.
3. **height:** the stack's `h` (topper included) ≤ the zone's `usable` height. **With a topper** the limit is `zone.height − 0.5`. The LEGO castle may go right up to the shelf above, because nobody pulls it out.
4. **bracket:** for every x in `zone.brackets`, a stack whose span `[x, x + w]` overlaps `[bx − 0.2, bx + 0.2]` must have `h ≤ bracketLimit(zone, d)`.
5. **length:** `x + w ≤ zone.length + zone.overhang`.
6. **overlap:** within one zone, sorted by x, each stack starts at or after the end of the previous one.
7. **depth:** `d ≤ zone.depth + 0.5`. Exception: a standing stack with exactly one box (KLASK sticks out on purpose).
8. **two-deep:** a stack with 2 rows must lie fully in an easy-to-reach range: `isEasy(zone, x, w)`.
9. **standing:** standing stacks are allowed only in a zone with `standingOnly` (the card games under the stairs), or when the stack has exactly one box (KLASK, Ice Cool). In a `standingOnly` zone every stack must be standing.

### Plan check card (Data screen)

A card "Plan check": "No problems found" or the warnings grouped by stack. Each group has a **Show stack** button (`showStack(id)` from contracts). Re-check on `store:changed`.

Showing warnings on the map and in stack details is **Bruce's**. He will call your `checkStack` later, so keep the API as above.

### Acceptance

- `checkPlan` on the v5 seed returns `[]`.
- One test per rule that breaks it on purpose and gets exactly that warning. For example: Ark Nova on top of Tokaido Duo (stacking), a 2-row stack moved to x = 100 on the top shelf (two-deep), a stack pushed past 208 (length), two stacks at the same x (overlap), a tall stack across the 140 joint (bracket), a game with `dims: null` (size-missing).

---

## E3 – Export to spreadsheet (`js/io/`)

Two downloads on the Data screen, with the **same columns as the tabs in the planning workbook**, so Adam can paste them back:

**`shelp-catalog-YYYY-MM-DD.csv`**, one row per game, sorted by title:
`Title, BGG, Box size (cm), Players, Play time (min), Age, BGG name, Type, Location, Box size from, In BGG collection, Notes`

| Column | Value |
|---|---|
| BGG | `https://boardgamegeek.com/boardgame/<id>`, or empty |
| Box size (cm) | largest first, `30.5 × 22.6 × 5.1`, no unit; empty when missing |
| Players, Play time | `2–4` (en dash) or `2` |
| Type | `Base` / `Expansion` |
| Location | `describeLocation()` |
| In BGG collection | `Yes` / `No` |

**`shelp-plan-YYYY-MM-DD.csv`**, the Shelf plan tab:
`Shelf, Spot, Stack (left → right), Level / position (1 = bottom), Row / pile, Game, Box size (cm), Categories, Notes`

| Column | Value |
|---|---|
| Order | stacks by zone (top, middle, bottom, the under-stairs parts, narrow), then by x |
| Level / position | flat: 1 = bottom; standing: 1 = leftmost. A side-by-side group shares one level. |
| Row / pile | `Front row` / `Back row` for 2-row stacks, `side by side`, `long side out` (rot), `Standing` for a single standing box; empty otherwise |
| Spot | `Easy (from the stairs)` on the top shelf when `isEasy`, `Easy` elsewhere when `isEasy`, otherwise `Hard` |
| Categories | labels in fixed order joined with ` + `, e.g. `Party + Co-op` |
| Notes | the stack's notes on its first row |

- **Games stored inside a box:** a row right after their host, Row / pile `inside the base box`, Box size `—`, note `stored inside the <host> box`.
- **Cupboard:** at the end, Shelf and Spot = `Cupboard`, the reason in Notes.
- **Unplaced games:** last, Shelf = `Not placed`.

**Format:** UTF-8 **with BOM** (so Sheets and Excel read the accents), commas, quotes where needed, `\r\n` line ends.

**Acceptance:** for the v5 seed the plan file has exactly 204 rows (every game once). Parsing both files with your own `parseCsv` gives back the same cells.

---

## A4 – Add a game by hand (`js/game/` + `js/io/`)

- An **Add a game** button on the Data screen opens a panel (`showPanel`):
  - title (required)
  - BGG id (optional, whole number)
  - box size (the same three inputs and parsing as the game panel)
  - players min–max and play time min–max
  - type
  - categories
  - `inBgg` off by default
- If the BGG id already belongs to a game, warn ("Already in the app as …", with a link that opens it), but don't block.
- **Save** → `store.addGame()`, close, and `openGame(newId)`. The game starts **unplaced**, so Bruce's cupboard screen lists it under "Not placed yet".
- Reuse your panel's field helpers and parsing.

**Acceptance:** Fantasy Fluxx can be added with 9.4 × 12.4 × 2.8, it appears in the catalog as "Not placed", and Back closes the form without saving.

---

## Not yours (don't build)

Warnings on the map or in stack details, moving games (D1), and suggestions (D4): Bruce. Search: Peter. Undo and saved versions (D6): later.
