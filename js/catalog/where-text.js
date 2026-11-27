// The words of "Where's my game?": where a game is and what has to be lifted off it first.
// Plain functions, no DOM, tested in Node. Owner: Peter (Part C). Story C4 (schema 2).
import { describeLocation2 } from '../core/format.js';

/**
 * loc comes from store.locate2(id); getTitle(id) turns a game id into its title.
 * Returns { sentence, onTop } where
 *   sentence  one line from describeLocation2: "Bottom shelf · stack B3 · on Takenokolor · 2 boxes on top",
 *             "… · across Compile and Kontroll · nothing on top", "Inside the Lairs box (…)", "On the board"
 *   onTop     a line naming every box resting on it, nearest first (with piles and bridges that can be
 *             several), or null when nothing is on it or it is not on a stack. An expansion inside a box is
 *             reached through that box, so for it this is what rests on the box.
 */
export function whereText(loc, getTitle = (id) => id) {
  return { sentence: describeLocation2(loc, getTitle), onTop: onTopText(loc, getTitle) };
}

function onTopText(loc, getTitle) {
  let spot = loc;
  let hostId = null;
  while (spot?.kind === 'inside') {
    hostId = spot.hostId;
    spot = spot.host;
  }
  if (spot?.kind !== 'stack' || !spot.above?.length) return null;
  const names = spot.above.map(getTitle);
  const of = hostId ? ` of the ${getTitle(hostId)} box` : '';
  if (names.length === 1) return `On top${of}: ${names[0]}`;
  return `On top${of}, nearest first: ${names.join(', ')}`;
}

export const NO_SIZE_HINT = 'Add a box size first';

/** Moving needs a box size (a game without one can never be on a shelf). The hint to show, or null if moving is possible. */
export function moveHint(game) {
  return game.dims ? null : NO_SIZE_HINT;
}
