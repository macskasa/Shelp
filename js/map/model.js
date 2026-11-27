// Shelf geometry (story C1). Pure functions, no DOM, so Node can test them. Owner: Bruce (Part B).
// The shelf numbers come from js/core/shelves.js; this file works out how boxes sit in a stack.
//
// CONTRACT: the rule checker (js/rules/, Stephen) imports footprint() and layoutStack().
// Keep their signatures and results stable; changes go through Tony (CONTEXT section 6).
//
// Coordinates inside a stack, all in cm:
//   x  along the shelf, from the stack's left edge
//   y  up from the shelf floor
//   z  front to back, from the front edge of the stack (0 for the front row)
import { ZONES } from '../core/shelves.js';

/** Size used for a box whose size is missing (dims: null): 10 × 10 × 3 cm, drawn marked "?". */
export const PLACEHOLDER_DIMS = Object.freeze([3, 10, 10]);

const round = (n) => Math.round(n * 100) / 100;
const max = (list) => list.reduce((a, b) => Math.max(a, b), 0);
const sum = (list) => list.reduce((a, b) => a + b, 0);

function zoneOf(zone) {
  const z = typeof zone === 'string' ? ZONES[zone] : zone;
  if (!z) throw new Error(`Unknown zone "${zone}"`);
  return z;
}

/** The box's sides sorted smallest first, or the placeholder when the size is missing. */
function sides(game) {
  return game?.dims ? [...game.dims].sort((a, b) => a - b) : [...PLACEHOLDER_DIMS];
}

/**
 * How much room one box takes on a shelf ("How a box sits", CONTEXT section 4).
 * With dims = [s, m, l] (smallest first):
 *  - flat: h = s. Width along the shelf = m, depth = l; turned (rot, or l deeper than the zone): w = l, d = m.
 *  - standing: w = s. h = l if l fits the zone's usable height, otherwise m. d = the remaining side.
 * @param game  a game (only `dims` is used; null/undefined dims → PLACEHOLDER_DIMS)
 * @param item  the plan item ({ game, rot? }); only `rot` is used
 * @param zone  zone id or zone object from ZONES
 * @param orientation 'flat' | 'standing'
 * @returns {{ w: number, d: number, h: number }}
 */
export function footprint(game, item, zone, orientation = 'flat') {
  const z = zoneOf(zone);
  const [s, m, l] = sides(game);
  if (orientation === 'standing') {
    return l <= z.usable ? { w: s, d: m, h: l } : { w: s, d: l, h: m };
  }
  return item?.rot || l > z.depth ? { w: l, d: m, h: s } : { w: m, d: l, h: s };
}

/** Is this box drawn as rotated ("long side out")? True if asked for, or forced by a too-deep box. */
export function isLongSideOut(game, item, zone, orientation = 'flat') {
  if (orientation !== 'flat') return false;
  const [, , l] = sides(game);
  return !!item?.rot || l > zoneOf(zone).depth;
}

/** Lay out one row. Returns { w, d, h, boxes } with boxes positioned inside the row (z = 0). */
function layoutRow(row, r, stack, zone, getGame) {
  const boxes = [];
  const flat = stack.orientation !== 'standing';
  let x = 0; // standing: next free x
  let y = 0; // flat: floor of the next level
  let w = 0; // flat: widest level so far
  row.forEach((item, index) => {
    const parts = item.side ?? [item];
    const level = parts.map((part, k) => {
      const game = getGame(part.game);
      const f = footprint(game, part, zone, stack.orientation);
      return {
        gameId: part.game, w: f.w, d: f.d, h: f.h, row: r, index,
        side: item.side ? k : null,
        rot: isLongSideOut(game, part, zone, stack.orientation),
        missing: !game?.dims,
      };
    });
    if (flat) {
      // One level: a side group puts its boxes next to each other, all on the same floor.
      let lx = 0;
      for (const b of level) {
        boxes.push({ ...b, x: lx, y });
        lx += b.w;
      }
      w = Math.max(w, lx);
      y += max(level.map((b) => b.h));
    } else {
      // Standing like books: every box (side groups too) goes left → right on the shelf floor.
      for (const b of level) {
        boxes.push({ ...b, x, y: 0 });
        x += b.w;
      }
    }
  });
  const d = max(boxes.map((b) => b.d));
  return flat ? { w, d, h: y, boxes } : { w: x, d, h: max(boxes.map((b) => b.h)), boxes };
}

/**
 * Where every box of a stack sits, and how big the stack is.
 * @param stack    a plan stack ({ id, zone, x, orientation, rows, topper? })
 * @param getGame  id → game (e.g. store.getGame); unknown ids get the placeholder size
 * @returns {{
 *   w: number,   width along the shelf (widest level / row; a topper is not counted)
 *   d: number,   depth: deepest box, or front + back for a 2-row stack
 *   h: number,   height of the tallest row, plus the topper
 *   pileH: number, height without the topper
 *   boxes: Array<{ gameId, x, y, z, w, d, h, row, index, side, rot, missing }>,
 *          in plan order: front row first, then bottom → top (flat) or left → right (standing).
 *          index / side match store.locate(); rot = long side out; missing = size missing.
 *   topper: null | { label, x, y, w, h }   centred on top of the pile
 * }}
 */
export function layoutStack(stack, getGame) {
  const zone = zoneOf(stack.zone);
  const rows = stack.rows.map((row, r) => layoutRow(row, r, stack, zone, getGame));
  let z = 0;
  const boxes = [];
  for (const row of rows) {
    for (const b of row.boxes) boxes.push({ ...b, z });
    z += row.d;
  }
  const w = max(rows.map((row) => row.w));
  const pileH = max(rows.map((row) => row.h));
  const t = stack.topper;
  const topper = t ? { label: t.label, x: round((w - t.w) / 2), y: round(pileH), w: t.w, h: t.h } : null;
  return {
    w: round(w),
    d: round(sum(rows.map((row) => row.d))),
    h: round(pileH + (t?.h ?? 0)),
    pileH: round(pileH),
    boxes: boxes.map((b) => ({ ...b, x: round(b.x), y: round(b.y), z: round(b.z) })),
    topper,
  };
}

/** Layouts of many stacks at once: Map stackId → layoutStack(). */
export function layoutPlan(plan, getGame) {
  return new Map(plan.stacks.map((st) => [st.id, layoutStack(st, getGame)]));
}
