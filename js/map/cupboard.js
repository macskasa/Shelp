// What the cupboard screen lists and what "Put on a stack…" offers (story C6). Pure, no DOM.
// Owner: Bruce (Part B). The warnings come from Stephen's rule checker (js/rules/).
import { ZONES, GROUPS } from '../core/shelves.js';
import { checkPlan } from '../rules/index.js';
import { layoutStack } from './model.js';

const ZONE_ORDER = GROUPS.flatMap((g) => g.zones);

/**
 * The games that are not on a shelf: in the cupboard (with the reason) and not placed yet.
 * @param games   all games, in the order to show them (store.getGames() is sorted by title)
 * @param locate  store.locate
 * @returns {{ cupboard: [{ game, reason }], unplaced: [{ game }] }}
 */
export function offShelf(games, locate) {
  const cupboard = [];
  const unplaced = [];
  for (const game of games) {
    const loc = locate(game.id);
    if (loc?.kind === 'cupboard') cupboard.push({ game, reason: loc.reason ?? '' });
    else if (loc?.kind === 'unplaced') unplaced.push({ game });
  }
  return { cupboard, unplaced };
}

/**
 * Every stack, grouped by shelf in drawing order, with its current height for the picker.
 * @returns [{ zone, label, stacks: [{ id, height, limit, topper, rows, standing }] }]
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
      .map((st) => ({
        id: st.id,
        height: layoutStack(st, getGame).h,
        limit: st.topper ? zone.height : zone.usable,
        topper: st.topper?.label ?? null,
        rows: st.rows.length,
        standing: st.orientation === 'standing',
      }));
    if (stacks.length) groups.push({ zone: zoneId, label: zone.label, stacks });
  }
  return groups;
}

/**
 * Where in a row the game can go: [{ index, label }], last one = on top (flat) or the right end
 * (standing), which is the default.
 */
export function positionChoices(stack, row, getGame) {
  const items = stack.rows[row] ?? [];
  const name = (item) => (item.side ?? [item]).map((x) => getGame(x.game)?.title ?? x.game).join(' + ');
  const standing = stack.orientation === 'standing';
  const out = [];
  for (let i = 0; i <= items.length; i++) {
    let label;
    if (i === items.length) label = standing ? 'At the right end' : 'On top';
    else if (i === 0) label = standing ? 'At the left end' : 'At the bottom';
    else label = standing ? `Right of ${name(items[i - 1])}` : `Above ${name(items[i - 1])}`;
    out.push({ index: i, label });
  }
  if (items.length === 0) out[0].label = standing ? 'At the left end' : 'On the shelf';
  return out;
}

/**
 * What the stack would look like with the game added, checked by the rule checker.
 * The whole plan is checked, so a stack that would grow into its neighbour is caught too (the
 * checker reports that overlap on the neighbour, so new warnings on other stacks are included).
 * @returns {{ height, warnings: [{ stackId, rule, message, isNew }] }}
 *   the target stack's warnings, plus any new warning elsewhere;
 *   isNew: false for a problem that was there before (same stack, rule and game)
 */
export function previewPlacement(plan, getGame, gameId, stackId, { row = 0, index } = {}) {
  const next = structuredClone(plan);
  const st = next.stacks.find((s) => s.id === stackId);
  if (!st || !st.rows[row]) return { height: 0, warnings: [] };
  const items = st.rows[row];
  items.splice(index == null ? items.length : Math.max(0, Math.min(index, items.length)), 0, { game: gameId });
  next.cupboard = next.cupboard.filter((c) => c.game !== gameId);

  const key = (w) => `${w.stackId}|${w.rule}|${w.gameId ?? ''}`;
  const before = new Set(checkPlan(plan, getGame).map(key));
  const warnings = checkPlan(next, getGame)
    .filter((w) => w.stackId === stackId || !before.has(key(w)))
    .map((w) => ({ stackId: w.stackId, rule: w.rule, message: w.message, isNew: !before.has(key(w)) }));
  return { height: layoutStack(st, getGame).h, warnings };
}

/** The rule checker's warnings for one stack of the plan (overlaps with its neighbours included). */
export function stackWarnings(plan, getGame, stackId) {
  return checkPlan(plan, getGame).filter((w) => w.stackId === stackId);
}
