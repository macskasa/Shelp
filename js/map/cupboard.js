// What the cupboard screen lists (stories C6, B2.3). Pure, no DOM. Owner: Bruce (Part B).
// Schema 2: the cupboard (with reasons) and the board (games without a place, in board order).
// Where a game can go and what a move would break is in spots.js.
import { ZONES, GROUPS } from '../core/shelves.js';
import { layoutStack2 } from '../core/geometry.js';

const ZONE_ORDER = GROUPS.flatMap((g) => g.zones);

/**
 * The games that are not on a shelf.
 * @param games     all games, in the order to show the cupboard (store.getGames() is by title)
 * @param locate2   store.locate2
 * @param board     store.getBoard(): the board's game ids, in board order
 * @param getGame   id → game
 * @returns {{ cupboard: [{ game, reason }], board: [{ game }] }}
 */
export function offShelf(games, locate2, board, getGame) {
  const cupboard = [];
  for (const game of games) {
    const loc = locate2(game.id);
    if (loc?.kind === 'cupboard') cupboard.push({ game, reason: loc.reason ?? '' });
  }
  return { cupboard, board: board.map((id) => ({ game: getGame(id) })).filter((x) => x.game) };
}

/**
 * Every stack, grouped by shelf in drawing order, with its current height for the picker.
 * @returns [{ zone, label, stacks: [{ id, height, limit, topper, rows }] }]
 *   limit: the usable height of the shelf; with a topper (castle, bonsai) the shelf's full
 *   height, because a topper may reach up to the shelf above. topper: its label, or null.
 */
export function stackChoices(plan, getGame) {
  const groups = [];
  for (const zoneId of ZONE_ORDER) {
    const zone = ZONES[zoneId];
    const stacks = plan.stacks
      .filter((st) => st.zone === zoneId)
      .sort((a, b) => a.x - b.x)
      .map((st) => {
        const lay = layoutStack2(st, getGame);
        return { id: st.id, height: lay.h, limit: st.topper ? zone.height : zone.usable, topper: st.topper?.label ?? null, rows: lay.rows };
      });
    if (stacks.length) groups.push({ zone: zoneId, label: zone.label, stacks });
  }
  return groups;
}
