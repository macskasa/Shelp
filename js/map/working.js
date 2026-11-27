// Only the spots that work (part-b5): which spots and ways up the spot sheet lists, in which order,
// and why the others are blocked. Pure, no DOM, so Node can test it. Owner: Bruce (Part B).
//   sortSpots(spots, checks, orients)  the spots that work, best first, and the blocked ones with a reason
//   workingWays(check, orients)        the ways up without a block for one spot, best preselected
//   blockReason(w, getTitle, stackId)  a short reason for a block ("Too tall for the shelf here")
//   blockedLinkText(n)                 "Show 12 blocked spots"
//   newStackWays(orients, checkFor)    New stack here: the ways up without a block at the fitted x
import { boxSize } from '../core/geometry.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;

/** The index in orients (orientationChoices) of a way { up, rot } from checkSpots: by up/rot, else by size. */
export function orientIndex(orients, way, game = null) {
  const i = orients.findIndex((o) => o.up === way.up && !!o.rot === !!way.rot);
  if (i >= 0 || !game?.dims) return i;
  const s = boxSize(game.dims, way.up, !!way.rot);
  return orients.findIndex((o) => near(o.w, s.w) && near(o.d, s.d) && near(o.h, s.h));
}

/**
 * A short reason for a blocking problem, for a greyed-out spot.
 * @param w         a Warning (checkPlan2 / checkSpots): { rule, stackId, otherStackId, message }
 * @param stackId   the stack the sheet is for (an overlap names the other one)
 */
export function blockReason(w, stackId = null) {
  if (!w) return 'Can’t go here';
  switch (w.rule) {
    case 'shelf-height': return 'Too tall for the shelf here';
    case 'length': return 'Goes past the end of the shelf';
    case 'overlap': {
      const other = w.stackId === stackId ? w.otherStackId : w.stackId;
      return other ? `Runs into stack ${other}` : 'Runs into the next stack';
    }
    case 'bridge-level': return 'Would tilt: the two tops aren’t level';
    case 'pizza': return 'A pizza game only lies flat';
    case 'size-missing': return 'A box here has no size yet';
    default: return w.message || 'Can’t go here';
  }
}

/**
 * The spot sheet's list. A spot works when checkSpots gives it a best way.
 * Order: no warnings (for its best way) first, then fewer warnings, then the order of spotChoices.
 * A preset spot (a suggestion, index `keep`) stays in the list and goes first: it was checked already.
 * @param spots   spotChoices(...) (maybe with presetFor's extra spot)
 * @param checks  checkSpots(plan, games, gameId, spots.map((s) => s.run)), same order
 * @returns {{ working: [{ i, spot, check }], blocked: [{ i, spot, reason }] }}  i: index in spots
 */
export function sortSpots(spots, checks, { keep = -1, stackId = null } = {}) {
  const working = [];
  const blocked = [];
  spots.forEach((spot, i) => {
    const check = checks[i] ?? { ways: [], best: null };
    if (check.best || i === keep) working.push({ i, spot, check });
    else {
      const first = check.ways.find((w) => w.block.length)?.block[0];
      blocked.push({ i, spot, reason: blockReason(first, stackId) });
    }
  });
  const warns = (x) => (x.check.best ? x.check.best.warn.length : 0);
  working.sort((a, b) => (b.i === keep) - (a.i === keep) || warns(a) - warns(b) || a.i - b.i);
  return { working, blocked };
}

/**
 * The ways up for one spot: only those without a block, in orients order, and the one to preselect
 * (the best way; a preset way when given and listed). A way the store must still be asked about is
 * not hidden here: the sheet's final check stays store.preview + newProblems.
 * @param check    one entry of checkSpots: { ways: [{ up, rot, block, warn }], best }
 * @param orients  orientationChoices(game)
 * @param prefer   an orients index to preselect when it works (a suggestion's way)
 * @returns {{ list: number[], chosen: number }}  orients indexes; chosen -1 when none works
 */
export function workingWays(check, orients, { prefer = -1, game = null } = {}) {
  const ok = new Set();
  for (const w of check?.ways ?? []) {
    if (w.block.length) continue;
    const i = orientIndex(orients, w, game);
    if (i >= 0) ok.add(i);
  }
  if (prefer >= 0 && prefer < orients.length) ok.add(prefer); // a suggestion's way is always offered
  const list = orients.map((_, i) => i).filter((i) => ok.has(i));
  const best = check?.best ? orientIndex(orients, check.best, game) : -1;
  const chosen = list.includes(prefer) ? prefer : list.includes(best) ? best : (list[0] ?? -1);
  return { list, chosen };
}

/** The link under the list: "Show 12 blocked spots", "Show 1 blocked spot"; null when there are none. */
export function blockedLinkText(n, open = false) {
  if (!n) return null;
  return open ? `Hide ${n === 1 ? 'the blocked spot' : 'blocked spots'}` : `Show ${n} blocked spot${n === 1 ? '' : 's'}`;
}

/** The headline when nothing works on a stack. */
export function nothingFitsText(stackId) {
  return `Nothing fits on ${stackId}`;
}

/**
 * New stack here: the ways up without a block at the fitted x.
 * @param orients   orientationChoices(game)
 * @param checkFor  (orient) => { error, block, warn, result } (checkMove at fitNewStack's x for that way)
 * @param prefer    an orients index to preselect when it works
 * @returns {{ list: number[], chosen: number, checks: object[], reason: string | null }}
 *   reason: when none works, why (from the first way's first block, or the store's refusal)
 */
export function newStackWays(orients, checkFor, { prefer = -1 } = {}) {
  const checks = orients.map((o) => checkFor(o));
  const list = checks.map((c, i) => (!c.error && !c.block.length ? i : -1)).filter((i) => i >= 0);
  let reason = null;
  if (!list.length && checks.length) {
    const c = checks.find((x) => !x.error && x.block.length) ?? checks[0];
    reason = c.error ? c.error.message : blockReason(c.block[0], c.result ?? null);
  } else if (!checks.length) reason = 'This game has no box size yet';
  const chosen = list.includes(prefer) ? prefer : (list[0] ?? -1);
  return { list, chosen, checks, reason };
}
