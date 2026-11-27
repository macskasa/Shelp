// Placing mode and the board strip, the parts without DOM (Phase C items 3 and 2), so Node can test
// them. Owner: Bruce (Part B).
//   placingFor(params)        which game #/map?pick=<id> places, or why it can't
//   hashAfter(how, gameId)    where placing mode leaves to: the placed game, or plain #/map
//   toDrawing / tapTarget     which stack or empty shelf spot a tap means
//   topSuggestions, chipText  the suggestions shown in the placing bar
//   presetFor                 a suggestion → the spot sheet's spot and orientation
//   boardChips                the board strip's chips
import { boxSize } from '../core/geometry.js';
import { colorsFor } from '../core/categories.js';
import { hitSpan } from './hit.js';

/** How many suggestions the placing bar shows (part-b3 item 3). */
export const SUGGESTIONS = 3;

/**
 * What #/map?… asks of placing mode.
 * @returns null (no ?pick: not placing) | { gameId } | { error }  (unknown game, or no box size)
 */
export function placingFor(params, getGame) {
  const id = params?.pick;
  if (!id) return null;
  const game = getGame(id);
  if (!game) return { error: 'There is no such game' };
  if (!game.dims) return { error: `${game.title} has no box size yet, so it can’t go on a shelf` };
  return { gameId: id };
}

/**
 * The address placing mode leaves to. It replaces the ?pick entry (no new history step), so Back
 * and a reload never come back into placing mode.
 * @param how  'placed' (show the new place, highlighted) or 'cancel'
 */
export function hashAfter(how, gameId) {
  return how === 'placed' && gameId ? `#/map?game=${encodeURIComponent(gameId)}` : '#/map';
}

/**
 * A point in the frame (px from its top-left corner) → drawing cm, for a view { x, y, k }
 * (viewport.js: the drawing point at the frame's corner, and screen px per cm).
 */
export function toDrawing(view, px, py) {
  return { x: view.x + px / view.k, y: view.y + py / view.k };
}

/**
 * What a tap at drawing point pt means, in a scene from scene.js.
 *   { kind: 'stack', stackId }  inside a stack's column (its tap area, as drawn: from the top of
 *                               the shelf down to its id, at least 2 cm wide; an empty stack's is
 *                               wider at k screen px per cm, hit.js)
 *   { kind: 'empty', zone, x }  on a shelf but not on a stack; x in cm from the zone's left end
 *   null                        anywhere else (band titles, margins)
 */
export function tapTarget(scene, pt, k = 0) {
  const zones = new Map(scene.zones.map((z) => [z.id, z]));
  for (const st of scene.stacks) {
    const z = zones.get(st.zone);
    if (!z) continue;
    const top = Math.min(z.top, st.top);
    const span = hitSpan(st, k);
    if (pt.x >= span.x && pt.x <= span.x + span.w && pt.y >= top && pt.y <= st.label.y + 3) return { kind: 'stack', stackId: st.id };
  }
  for (const z of scene.zones) {
    if (pt.x >= z.x && pt.x <= z.x + z.length + z.overhang && pt.y >= z.top && pt.y <= z.floor) {
      return { kind: 'empty', zone: z.id, x: Math.round((pt.x - z.x) * 10) / 10 };
    }
  }
  return null;
}

/**
 * The suggestions for the placing bar: the first n, in Stephen's order, on an existing stack
 * (kind 'stack') or as a new stack in a free gap (kind 'new-stack', item 5).
 * @param spots  suggestSpots(plan, games, gameId)
 */
export function topSuggestions(spots, n = SUGGESTIONS) {
  return (spots ?? []).filter((s) => s.kind === 'stack' || s.kind === 'new-stack').slice(0, n);
}

/**
 * A short chip label from a suggestion's text: "Bottom shelf · stack B3 · on Takenokolor · flat"
 * → "B3 · on Takenokolor". The shelf name goes (the stack id says it), and so does "flat", the
 * usual way; any other way up stays. A new stack keeps its shelf: "Narrow shelf · new stack at 70 cm".
 */
export function chipText(spot) {
  const parts = String(spot?.text ?? '').split(' · ');
  const i = parts.findIndex((p) => /^stack /.test(p));
  if (i < 0) return parts.filter((p) => p !== 'flat').join(' · ');
  return [parts[i].slice(6), ...parts.slice(i + 1).filter((p) => p !== 'flat')].join(' · ');
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const near = (a, b) => Math.abs(a - b) < 1e-6;

/**
 * A suggestion as the spot sheet's preset. Matches it to one of the sheet's spots (spotChoices for
 * that stack and row) by surface and position, and to one of its orientations by size (equal sizes
 * show once). A suggestion the sheet has no spot for (e.g. beside a box already across two) comes
 * first as its own spot, so the sheet can always do exactly what was suggested.
 * @param spots    spotChoices(stack, getGame, { row: target.row })
 * @param orients  orientationChoices(game)
 * @param target   suggestion.target: { stackId, row, on, index, up, rot }
 * @returns {{ spots, spot: number, orient: number }}  spots: the list to show (maybe one longer)
 */
export function presetFor(spots, orients, game, target, label) {
  const index = target.index ?? 0;
  let spot = spots.findIndex((s) => s.run.fn === 'placeBox' && (s.run.target.row ?? 0) === (target.row ?? 0)
    && sameSet(s.run.target.on, target.on) && (s.run.target.index ?? 0) === index);
  let list = spots;
  if (spot < 0) {
    const kind = target.on.length === 2 ? 'across' : target.on.length ? 'on' : 'shelf';
    const run = { fn: 'placeBox', target: { stackId: target.stackId, row: target.row ?? 0, on: [...target.on], index } };
    list = [{ key: 'suggested', kind, label: label ?? 'The suggested spot', run }, ...spots];
    spot = 0;
  }
  const size = boxSize(game.dims, target.up ?? 's', !!target.rot);
  const orient = Math.max(0, orients.findIndex((o) => near(o.w, size.w) && near(o.d, size.d) && near(o.h, size.h)));
  return { spots: list, spot, orient };
}

/**
 * The board strip's chips, in board order. Ids without a game are skipped.
 * @param board  store.getBoard()
 * @returns [{ id, title, colors }]  colors: CSS colours for the category stripes
 */
export function boardChips(board, getGame) {
  return (board ?? []).map((id) => getGame(id)).filter(Boolean)
    .map((g) => ({ id: g.id, title: g.title, colors: colorsFor(g) }));
}
