# Part C – Families in the catalog (B2), Free space fixes · Peter

Stephen's game families are merged (#76): every game has `family` (a name or null), and `store.getFamilies()` lists them as `[{ name, ids }]`. This brief adds families to the catalog and fixes the two nits from #74.

**Start** from Tony's PR with the `showFamily` contract: branch from `main` once it is merged (check that `showFamily` is in `js/core/contracts.js`), or from its branch `ccr-96632897-bcu0g0` while it is still open. Either way your PR goes into `main`. **One PR** for the whole brief.

## 1. A Family filter in the catalog

- A **Family** select next to the other filters: "Any", then every family from `getFamilies()` as "Azul (3)", then "No family".
- Keep it in the URL like the other filters: `family=<name>`, and `family=-` for "No family". Back keeps it, and a link with a family that no longer exists falls back to "Any".
- "Clear filters" resets it.
- The filter logic goes into your plain functions in `js/catalog/filter.js` (state ↔ params, filtering), tested in Node.

## 2. Family in the rows and the search

- Each catalog row shows the family's name in its muted details line (desktop: a Family column), so a family is visible without filtering.
- The search also matches the family name: "Mars" finds every game in the "Terraforming Mars" family, even one whose title is Hungarian (A Mars terraformálása). Add the folded family name to the entry's search key.

## 3. Show the family on the map

While the Family filter shows one family, a **Show on map** button sits above the list. It calls `showFamily(name)` from `js/core/contracts.js` (Bruce's `#/map?family=<name>`, `docs/part-b4.md`). Until Bruce's PR is merged the map just opens without the highlight, so the button can land first.

## 4. Free space: the two nits from #74

- The stack fill on the Free space screen uses `--cat-duo`. On this screen a category colour reads as "duo games". Use a neutral token from `css/base.css`.
- `roomText` says "up to 0 cm on top of …" when every stack in a unit reaches the usable height. Say "No room on top" instead, with a test.

## Rules for this PR

- Phone first (384 and 412 px, portrait and landscape), desktop 1440, dark mode, no console errors, tap targets at least 40 px. Check that the filter row still fits on the phone with one more select.
- Browser checks don't need a local server: serve the repo with Playwright's `context.route`, open `/?nosw`, block service workers.
- Only your files change.

## Not yours

The family on the map (Bruce), family editing and the rule (Stephen).
