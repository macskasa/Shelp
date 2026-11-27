// What the pick-up sheet offers and says, and the turn chooser's options (Phase C items 1 and 4).
// Pure, no DOM, so Node can test it. Owner: Bruce (Part B).
import { boxSize } from '../core/geometry.js';
import { orientationChoices } from './spots.js';
import { restsOn } from './details.js';

/**
 * The actions of the pick-up sheet for a game at a location (store.locate2).
 *   move: placing mode (needs a box size), turn: only for a box on a shelf,
 *   board / cupboard: not where it already is, inside: "Put inside a box…" (the game panel's picker).
 * @returns {string[]} in display order, a subset of ['move', 'turn', 'board', 'cupboard', 'inside']
 */
export function pickUpActions(game, loc) {
  if (!game) return [];
  const kind = loc?.kind ?? 'board';
  const out = [];
  if (game.dims) out.push('move');
  if (kind === 'stack') out.push('turn');
  if (kind !== 'board') out.push('board');
  if (kind !== 'cupboard') out.push('cupboard');
  out.push('inside');
  return out;
}

/**
 * What happens to the boxes resting on a box when it leaves its stack:
 * "2 boxes on top settle down onto Takenokolor", "1 box on top settles down onto the shelf".
 * Boxes resting across it and another box keep the other one (the store's detach).
 * @param stack  store.getStack2(stackId)   @param gameId  the picked box
 * @returns {string | null}  null when nothing rests on it
 */
export function settleText(stack, gameId, getTitle) {
  const box = stack?.boxes.find((b) => b.game === gameId);
  if (!box) return null;
  // everything above, directly or higher up
  const above = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of stack.boxes) {
      if (above.has(b.game) || !b.on.some((s) => s === gameId || above.has(s))) continue;
      above.add(b.game);
      grew = true;
    }
  }
  if (!above.size) return null;
  const n = above.size;
  const direct = stack.boxes.filter((b) => b.on.includes(gameId));
  // only bridges rest on it: they keep their other support
  const dest = direct.every((b) => b.on.length === 2)
    ? restsOn(direct[0].on.filter((s) => s !== gameId), getTitle)
    : restsOn(box.on, getTitle);
  return `${n} box${n === 1 ? '' : 'es'} on top settle${n === 1 ? 's' : ''} down ${dest.replace(/^on /, 'onto ')}`;
}

/**
 * The turn chooser's options for a box: orientationChoices (flat for pizza, else up to six, equal
 * sizes once), each with current: true for the way it lies now (matched by size, since equal sizes
 * show once).
 * @param box  { up, rot } as it lies now, or null (not on a shelf)
 */
export function turnOptions(game, box) {
  const now = box && game?.dims ? boxSize(game.dims, box.up, box.rot) : null;
  return orientationChoices(game).map((o) => ({
    ...o,
    current: !!now && near(o.w, now.w) && near(o.d, now.d) && near(o.h, now.h),
  }));
}

const near = (a, b) => Math.abs(a - b) < 1e-6;

/**
 * The confirm button after a preview: a store refusal or a new block → disabled "Not allowed";
 * new warnings only → "<verb> anyway"; nothing new → "<verb>".
 * @param p  { error?, block: [], warn: [] }
 */
export function confirmButton(p, verb) {
  if (p.error || p.block.length) return { disabled: true, label: 'Not allowed' };
  return { disabled: false, label: p.warn.length ? `${verb} anyway` : verb };
}
