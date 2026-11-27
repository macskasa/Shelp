// Stacks (part-b3 item 5), the parts without DOM, so Node can test them. Owner: Bruce (Part B).
//   newStackX(zone, x)       where a tap on empty shelf puts a new stack (rounded, snapped to a joint)
//   newStackFn / moveStackFn the store calls, for store.preview and the real write
//   checkMove(store, fn)     preview + only the new problems + what the confirm button says
//   stepX / arrowStep        the Move stack buttons and arrow keys
//   renameLines              the renumber confirmation
//   removeText               what removing a stack does to its games
import { ZONES, BRACKET } from '../core/shelves.js';
import { newProblems } from './spots.js';
import { confirmButton } from './pickup.js';

/** A new stack's x is rounded to this much (cm). */
export const X_STEP = 0.5;
/** Within this many cm of a joint (or the left end) of a wall shelf, a new stack snaps to it. */
export const SNAP = 3;

const round = (n, step) => Math.round(n / step) * step;
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * x of a new stack from a tap at x cm on a zone: rounded to 0.5 cm, and on the wall shelves
 * snapped to 0.2 / 60.2 / 140.2 (just right of the bracket) within 3 cm of the left end or a joint.
 * Never below 0 or past the wall end plus the overhang.
 */
export function newStackX(zoneId, x) {
  const z = ZONES[zoneId];
  if (!z) return null;
  const max = z.length + (z.overhang ?? 0);
  if (z.group === 'wall') {
    for (const j of [0, ...z.joints]) if (Math.abs(x - j) <= SNAP) return r2(j + BRACKET.width / 2);
  }
  return r2(Math.min(Math.max(0, round(x, X_STEP)), max));
}

/**
 * A new stack with the game on it, as one batch (one undo step). Returns the new stack's id, also
 * inside store.preview (catch it in a variable there: preview keeps only the plan).
 */
export function newStackFn(store, gameId, zone, x, { up = 's', rot = false } = {}) {
  return () => store.batch(() => {
    const id = store.createStack(zone, { x });
    store.placeBox(gameId, { stackId: id, up, rot });
    return id;
  });
}

export function moveStackFn(store, stackId, x) {
  return () => store.moveStack(stackId, x);
}

/**
 * Try a move: store.preview(fn), then only the problems it adds (checkPlan2 before and after).
 * @returns {{ plan, error, block, warn, result, button: { disabled, label } }}
 *   result: what fn returned inside the preview (a new stack's id); button for the given verb
 */
export function checkMove(store, fn, verb) {
  let result;
  const p = store.preview(() => { result = fn(); });
  const np = p.error ? { block: [], warn: [] } : newProblems(store.getPlan2(), p.plan, store.getGame);
  return { plan: p.plan, error: p.error, ...np, result, button: confirmButton({ error: p.error, ...np }, verb) };
}

/** One step of Move stack: x + d, to 0.1 cm, never below 0. */
export function stepX(x, d) {
  return Math.max(0, Math.round((x + d) * 10) / 10);
}

/** Arrow keys in Move stack: ←/→ 1 cm, with Shift 5 cm; anything else 0. */
export function arrowStep({ key, shiftKey }) {
  const sign = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
  return sign * (shiftKey ? 5 : 1);
}

/**
 * The renames renumberStacks() would make, in shelf order then by new number: ["B9 → B4", …].
 * @param map   { oldId: newId } from a preview of renumberStacks()
 * @param plan  the plan before (for each stack's shelf)
 */
export function renameLines(map, plan) {
  const zoneOf = new Map(plan.stacks.map((s) => [s.id, s.zone]));
  const order = Object.keys(ZONES);
  const num = (id) => Number(id.replace(/^\D+/, '')) || 0;
  return Object.entries(map ?? {})
    .sort(([a, na], [b, nb]) => order.indexOf(zoneOf.get(a)) - order.indexOf(zoneOf.get(b)) || num(na) - num(nb))
    .map(([from, to]) => `${from} → ${to}`);
}

/** What removing a stack does: null for an empty one, else "Its 3 games go to the board." */
export function removeText(stack) {
  const n = stack?.boxes?.length ?? 0;
  if (!n) return null;
  return n === 1 ? 'Its game goes to the board.' : `Its ${n} games go to the board.`;
}
