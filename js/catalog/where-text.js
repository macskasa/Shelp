// The words of "Where's my game?": where a game is and what has to be lifted off it first.
// Plain functions, no DOM, tested in Node. Owner: Peter (Part C). Story C4.
import { describeLocation } from '../core/format.js';

/**
 * loc comes from store.locate(id); getTitle(id) turns a game id into its title.
 * Returns { sentence, onTop } where
 *   sentence  one line from describeLocation: "Bottom shelf · stack B3 · 2nd from the bottom · 2 boxes on top"
 *             or "Inside the Lairs box (Bottom shelf · stack B4 · …)"
 *   onTop     a line naming what sits on top, nearest first, or null when that makes no sense
 *             (standing games, the cupboard, not placed). An expansion inside a box is reached through
 *             that box, so for it this is what sits on top of the box.
 */
export function whereText(loc, getTitle = (id) => id) {
  return { sentence: describeLocation(loc, getTitle), onTop: onTopText(loc, getTitle) };
}

function onTopText(loc, getTitle) {
  let spot = loc;
  let hostId = null;
  while (spot?.kind === 'inside') {
    hostId = spot.hostId;
    spot = spot.host;
  }
  if (spot?.kind !== 'stack' || spot.orientation === 'standing') return null;
  const names = spot.above.map(getTitle);
  const what = hostId ? `the ${getTitle(hostId)} box` : '';
  if (!names.length) return hostId ? `Nothing on top of ${what}` : 'Nothing on top';
  if (names.length === 1) return `On top${what ? ` of ${what}` : ''}: ${names[0]}`;
  return `On top${what ? ` of ${what}` : ''}, nearest first: ${names.join(', ')}`;
}
