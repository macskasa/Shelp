# Part A – Game families (B2) · Stephen

Story B2: "I can link games into a family (Azul, 7 Wonders, Mars, Root, Tokaido…). The map can highlight a family, and the rule checker warns when its members end up far apart." You build the families in the game panel, a quick way to link many at once, the rule, and families in `suggestSpots`. The map highlight (Bruce) and a catalog filter (Peter) come later, on top of yours.

**Start** from Tony's core PR with the `family` field: branch from `main` once it is merged (check that `store.getFamilies` exists), or from its branch `ccr-96632897-bcu0g0` while it is still open. Either way your PR goes into `main`. **One PR** for the whole brief.

## What you get ready made (core)

- Every game has **`family`**: a name (1–40 characters) or null. Files from before families load as null. See CONTEXT section 4.
- `updateGame(id, { family })` and `addGame({ family })`. The store trims the name, turns `''` into null, and gives it the spelling of an existing family that differs only in letter case ("azul" joins "Azul").
- `getFamilies()` → `[{ name, ids }]`, sorted by name, ids in title order. A family with one game is listed.
- `renameFamily(name, newName) → count`: renames the family on all its games, one undo step. A name that already exists merges the two; null takes the family off all its games.
- The BGG import keeps `family` already (it sends patches), and new games start with null.

## 1. Family in the game panel

- A **Family** field in the game panel, with the other fields (`js/game/fields.js`). It saves through `updateGame` on Enter or when it loses focus, like the other text fields. Empty clears it.
- **Suggestions** as tappable chips under the field, at most 4 (a `<datalist>` is unreliable in Chrome on Android):
  - the start of the BGG name, before ":", " – " or "(": "Azul" for "Azul: Crystal Mosaic", with a trailing edition word dropped (Duo, Kids, Junior, Big Box, Deluxe Edition);
  - the family of the box it is stored inside (an expansion inside its base game);
  - existing families whose name shares a word with the title or the BGG name.
  - No chips for the family it already has.
- Below the field: **"Also in Azul: Azul Kids · Azul: Crystal Mosaic"**. Each title is a button that opens that game (`openGame`).
- **Rename family…** (only when it has one): a small panel with the name, then `renameFamily`. Close the panels and show a toast with Undo, as for moves: `toast('Renamed the family to “Azul”', { action: { label: 'Undo', run: store.undo } })`.
- Keep the suggestion logic in a plain function in `js/game/logic.js` (or a new `js/game/family.js`), tested in Node.

## 2. Suggested families on the Data screen

Adam has about 200 games. Linking them one by one is slow, so the Data screen gets a **Game families** section:
- **Suggested**: groups of 2 or more games that have no family yet and whose BGG names (or titles, when there is no BGG name) start the same, by the same rule as the first chip. Each group shows its name (editable) and its games with a tick each (all ticked). **Link** sets the family on the ticked games: one `batch`, one undo step, then a toast with Undo.
- **Families**: the existing ones from `getFamilies()`, "Azul · 3 games". Tapping one opens its first game.
- On today's seed, the suggestions include 7 Wonders, Azul, Root, SETI, Sky Team, Terraforming Mars and Tokaido (Tokaido Duo and Tokaido: Deluxe Edition) among others. Adam unticks what he doesn't want.
- A plain function `suggestFamilies(games) → [{ name, ids }]`, tested on the seed.

## 3. The rule: a family far apart (Adam's decision)

A new rule **`family`** in `js/rules/check2.js`, severity **warn**, checked by `checkPlan2` (not `checkStack2`: it needs the whole plan).

- **Where a member is:** its stack. A game inside another box counts where its host is. Games on the board or in the cupboard, and boxes inside a host that isn't on a shelf, don't count.
- **Fine** when the members that count are all on one stack, or all on **one shelf (zone) with no other stack between them**: their stacks are neighbours in x order among that zone's stacks that hold boxes. An empty stack between them doesn't count.
- **Otherwise one warning per family:**
  `{ rule: 'family', severity: 'warn', family: 'Azul', stackId: <the first member stack in shelf order>, stackIds: [<every member stack, in shelf order>], gameId: null, otherStackId: null, message }`
  Message: "The Azul family is spread out: B2, M5 and T8. Keep a family on one shelf, next to each other."
- `forStack(warnings, id)` also matches `stackIds`, so the warning shows on each member stack. Check that your Data screen check card and `groupWarnings` read well with it.
- Bruce keys "new problems" by `family` for this rule (Tony asked him), because `stackId` changes when a member moves. Do the same in `suggest.js`'s `key`.
- Add `family: 'warn'` to `SEVERITY`. CONTEXT's rule table already lists it.
- Tests:
  - the seed with every suggested family linked (item 2) gives **0** family warnings (Sky Team N1/N2, SETI M2/M3 and Tokaido M3/M4 are neighbours);
  - a member on another shelf gives one warning naming both stacks;
  - a stack with boxes between two member stacks gives one; an empty stack between gives none;
  - an expansion inside its host counts at the host's stack; board and cupboard members are ignored.

## 4. suggestSpots keeps families together

- A spot that would make its family spread out (the warning wasn't there before) has the family warning in its `warnings`, so it ranks after the spots without new warnings.
- A new step right after "fewer new warnings": **near its family**. On a member's stack first, then a stack (or a new stack) right next to a member stack on the same shelf, then the rest. Only for a game whose family has other members on shelves.
- The family check needs only where the members are, so work it out once per call. The speed limits of #60 stay.
- Tests: a family member's first suggestion is on or beside its family's stacks when that is possible without warnings.

## 5. Family in the CSV export

A **Family** column in `js/io/export.js`, after the categories.

## Rules for this PR

- Every write is one undo step, and moving or linking actions close the panels and show a toast with Undo.
- Phone first (384 and 412 px, portrait and landscape), desktop too, Android back closes the open panel first, tap targets at least 40 px.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.

## Not yours

The map highlight of a family (Bruce, `#/map?family=<name>`, later) and a family filter in the catalog (Peter, later). Free space (D3) is Peter's.
