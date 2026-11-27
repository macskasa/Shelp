// Easy to reach, box by box (#48). Owner: Stephen (Part A). Pure logic: no screens, no store calls.
//
//   reachOf(plan, getGame, gameId) -> { score, parts, text } | null
//   reachAll(plan, getGame)        -> Map<gameId, reach>   every box on a stack, and every game inside one of them
//
// Lower score = easier. Three parts:
//   hard spot     the box is not in an easy zone of its shelf (isEasy)           +4
//   back row      row 1, on every shelf                                           +2
//   boxes on top  every box resting on it, directly or higher up, at most 3      +1 each
//                 (a topper counts as one box on top of the boxes it stands on)
// text: "Easy to reach" at score 0, otherwise the parts joined with " · ": "Back row · 2 boxes on top".
// A game inside another box counts as its host. Board, cupboard, a host not on a shelf, an unknown id -> null.
import { layoutStack2 } from '../core/geometry.js';
import { isEasy } from '../core/shelves.js';
import { locations2 } from '../core/plan2.js';

export const REACH = Object.freeze({ HARD_SPOT: 4, BACK_ROW: 2, PER_BOX: 1, MAX_BOXES: 3 });

/** The reach of a box from its three facts: easy zone or not, row (0 front, 1 back), boxes on top. */
export function reachFrom({ easy, row, onTop }) {
  const boxes = Math.min(onTop, REACH.MAX_BOXES); // the score counts at most 3 boxes; the text says the real count
  const parts = [];
  if (!easy) parts.push('hard spot');
  if (row === 1) parts.push('back row');
  if (onTop) parts.push(`${onTop} ${onTop === 1 ? 'box' : 'boxes'} on top`);
  const score = (easy ? 0 : REACH.HARD_SPOT) + (row === 1 ? REACH.BACK_ROW : 0) + boxes * REACH.PER_BOX;
  const words = parts.map((p) => (p === 'hard spot' ? 'Hard-to-reach spot' : p === 'back row' ? 'Back row' : p));
  return { score, parts, text: score === 0 ? 'Easy to reach' : words.join(' · ') };
}

/** Reach of one box of `stack`, given its layout and the ids resting on it (directly or higher up). */
export function reachInStack(stack, layout, box, above) {
  const lay = layout.boxes.find((b) => b.gameId === box.game);
  if (!lay) return null;
  let onTop = above.length;
  if (stack.topper && layout.topper) {
    const tops = layout.boxes.filter((b) => b.y + b.h >= layout.pileH - 0.01);
    if (tops.some((t) => t.gameId === box.game)) onTop += 1; // it stands right on this box
    else if (above.some((id) => tops.some((t) => t.gameId === id))) onTop += 1; // or higher up on the pile above it
  }
  return reachFrom({ easy: isEasy(stack.zone, stack.x + lay.x, lay.w), row: box.row ?? 0, onTop });
}

export function reachAll(plan, getGame) {
  const where = locations2(plan);
  const out = new Map();
  for (const stack of plan.stacks) {
    const layout = layoutStack2(stack, getGame);
    for (const box of stack.boxes) {
      const r = reachInStack(stack, layout, box, where.get(box.game).above);
      if (r) out.set(box.game, r);
    }
  }
  for (const [id, host] of Object.entries(plan.inside ?? {})) {
    if (out.has(host)) out.set(id, out.get(host));
  }
  return out;
}

export function reachOf(plan, getGame, gameId) {
  const where = locations2(plan);
  let at = where.get(gameId);
  if (at?.kind === 'inside') at = where.get(at.hostId);
  if (at?.kind !== 'stack') return null;
  const stack = plan.stacks.find((s) => s.id === at.stackId);
  const box = stack.boxes.find((b) => b.game === (where.get(gameId).kind === 'inside' ? where.get(gameId).hostId : gameId));
  return reachInStack(stack, layoutStack2(stack, getGame), box, at.above);
}
