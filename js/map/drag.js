// Drag and drop on desktop (part-b3 item 6), the parts without DOM, so Node can test them.
// Owner: Bruce (Part B).
//   canStartDrag(e) / pastSlop   only a left mouse button drags, and only once it moved a few px
//   dropTarget(scene, pt, k)     the stack (and the row it draws) or the empty shelf under the pointer
//   stackLocal(st, pt)           a drawing point → cm from the stack's left end and up from its floor
//   spotAnchors / nearestSpot    which spot of a stack the pointer means: the nearest anchor point
//   ghostRect                    where the dragged box would sit for that spot (the outline drawn)
//   dropChoice                   what the spot sheet preselects after a drop, and the blocked note
//   probeStack / probeEmpty      checkSpots (or the new-stack check) for what is under the pointer,
//   aimStack / aimEmpty          worked out once per stack or spot; then the spot, outline and note
import { boxSize, layoutStack2 } from '../core/geometry.js';
import { ZONES } from '../core/shelves.js';
import { checkSpots } from '../rules/index.js';
import { tapTarget } from './placing.js';
import { blockReason, newStackWays } from './working.js';
import { spotChoices, orientationChoices } from './spots.js';
import { newStackX, newStackFn, checkMove } from './stacks.js';
import { newStackAt } from './free-layer.js';

/** Screen px the mouse must move with the button down before a press becomes a drag. */
export const DRAG_SLOP = 4;
/** Anchors sit this far (cm) above a surface or the floor, so a pointer just over a top is "on top". */
const LIFT = 1;

/** A press that may start a drag: the left mouse button only (touch and pen keep tapping, placing mode). */
export function canStartDrag(e) {
  return e?.pointerType === 'mouse' && (e.button ?? 0) === 0;
}

/** Has the pointer moved more than slop px from where the button went down? */
export function pastSlop(start, p, slop = DRAG_SLOP) {
  return Math.hypot(p.x - start.x, p.y - start.y) > slop;
}

/**
 * The drawing row a scene stack shows (scene.js): the back row only for a 2-deep stack in the back view.
 * A stack whose drawn boxes are all back-row boxes draws row 1.
 */
export function drawnRow(st, view = 'front') {
  return st?.deep && view === 'back' ? 1 : 0;
}

/**
 * What the pointer at drawing point pt is over.
 * @returns { kind: 'stack', stackId, row } | { kind: 'empty', zone, x } | null
 */
export function dropTarget(scene, pt, k = 0, view = 'front') {
  const hit = tapTarget(scene, pt, k);
  if (hit?.kind !== 'stack') return hit;
  const st = scene.stacks.find((s) => s.id === hit.stackId);
  return { ...hit, row: drawnRow(st, view) };
}

/** A drawing point → stack-local cm: x from the stack's left end, y up from its floor. */
export function stackLocal(st, pt) {
  return { x: pt.x - st.x, y: st.floor - pt.y };
}

const top = (b) => b.y + b.h;
const right = (b) => b.x + b.w;
const mid = (a, b) => (a + b) / 2;

/**
 * An anchor point per spot (stack-local cm, y up), from the stack's layout without the dragged game.
 *   shelf    at floor level, in the gap it names (left of the first box, between two, right of the last)
 *   on       just above the box's top: its middle, or the gap between the boxes already on it
 *   across   just above the two tops, where they meet
 *   under    a quarter up the box (or the boxes side by side), so its lower part means "under"
 * @param spots  spotChoices(stack, getGame, { row })
 * @param lay    layoutStack2(stack, getGame) of that same stack
 * @returns Map<key, { x, y }>
 */
export function spotAnchors(spots, lay, row = 0) {
  const boxes = lay.boxes.filter((b) => b.row === row);
  const byId = new Map(boxes.map((b) => [b.gameId, b]));
  const gapX = (list, i) => {
    if (!list.length) return 0;
    if (i <= 0) return list[0].x;
    if (i >= list.length) return right(list[list.length - 1]);
    return mid(right(list[i - 1]), list[i].x);
  };
  const sorted = (list) => [...list].sort((a, b) => a.x - b.x);
  const floor = sorted(boxes.filter((b) => !b.on.length));
  const out = new Map();
  for (const s of spots) {
    const t = s.run.target;
    if (s.kind === 'shelf') {
      out.set(s.key, { x: floor.length ? gapX(floor, t.index ?? 0) : 1.5, y: LIFT });
    } else if (s.kind === 'on') {
      const b = byId.get(t.on[0]);
      if (!b) continue;
      const kids = sorted(boxes.filter((k) => k.on.length === 1 && k.on[0] === b.gameId));
      out.set(s.key, { x: kids.length ? gapX(kids, t.index ?? 0) : mid(b.x, right(b)), y: top(b) + LIFT });
    } else if (s.kind === 'across') {
      const [a, b] = t.on.map((id) => byId.get(id));
      if (!a || !b) continue;
      out.set(s.key, { x: mid(right(a), b.x), y: Math.max(top(a), top(b)) + LIFT });
    } else if (s.kind === 'under') {
      const group = s.run.targets.map((id) => byId.get(id)).filter(Boolean);
      if (!group.length) continue;
      const x0 = Math.min(...group.map((b) => b.x));
      const x1 = Math.max(...group.map(right));
      const y0 = Math.min(...group.map((b) => b.y));
      const h = Math.max(...group.map((b) => b.h));
      out.set(s.key, { x: mid(x0, x1), y: y0 + h / 4 });
    }
  }
  return out;
}

/**
 * The spot nearest to the pointer (stack-local cm), or -1 when the stack has none.
 * Horizontal distance counts a little less than vertical: boxes are wide and thin.
 */
export function nearestSpot(spots, lay, p, row = 0) {
  const anchors = spotAnchors(spots, lay, row);
  let best = -1;
  let bestD = Infinity;
  spots.forEach((s, i) => {
    const a = anchors.get(s.key);
    if (!a) return;
    const d = ((a.x - p.x) * 0.6) ** 2 + (a.y - p.y) ** 2;
    if (d < bestD - 1e-9) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/**
 * Where the dragged box would sit for a spot (stack-local cm, y up from the floor): { x, y, w, h }.
 * size: the box's { w, h } for the way up shown. Under a box it takes that box's place.
 */
export function ghostRect(spot, lay, size, row = 0) {
  const anchors = spotAnchors([spot], lay, row);
  const a = anchors.get(spot.key);
  if (!a) return null;
  const { w, h } = size;
  if (spot.kind === 'under') {
    const group = spot.run.targets.map((id) => lay.boxes.find((b) => b.gameId === id)).filter(Boolean);
    return { x: Math.min(...group.map((b) => b.x)), y: Math.min(...group.map((b) => b.y)), w, h };
  }
  const y = a.y - LIFT;
  if (spot.kind === 'shelf') {
    const floor = lay.boxes.filter((b) => b.row === row && !b.on.length);
    const first = (spot.run.target.index ?? 0) === 0 && floor.length;
    return { x: first ? a.x - w : a.x, y, w, h };
  }
  return { x: a.x - w / 2, y, w, h };
}

/**
 * What the spot sheet does with a dropped spot.
 * @param spots   the sheet's spots (spotChoices)
 * @param checks  checkSpots for them, same order
 * @param index   the dropped spot's index in spots (-1: none)
 * @returns {{ keep: number, blocked: null | { key, label, reason } }}
 *   keep: the spot to preselect (the dropped one when it works; -1 lets the sheet choose its best);
 *   blocked: the dropped spot when it doesn't work, with the reason from its first block
 */
export function dropChoice(spots, checks, index, stackId = null) {
  const spot = spots[index];
  if (!spot) return { keep: -1, blocked: null };
  const check = checks[index];
  if (check?.best) return { keep: index, blocked: null };
  const first = check?.ways.find((w) => w.block.length)?.block[0];
  return { keep: -1, blocked: { key: spot.key, label: spot.label, reason: blockReason(first, stackId) } };
}

/** The pointer note while dragging: "On top of Azul" or "On top of Azul – Too tall for the shelf here". */
export function dragNote(label, reason = null) {
  return reason ? `${label} – ${reason}` : label;
}

/**
 * Everything the drag needs about one stack, worked out once when the pointer reaches it: its spots
 * on the drawn row (without the dragged game, like the spot sheet), its layout and checkSpots.
 */
export function probeStack(store, gameId, stackId, row = 0) {
  const base = store.locate2(gameId)?.kind === 'stack' ? store.preview(() => store.moveToBoard(gameId)).plan : store.getPlan2();
  const st = base.stacks.find((x) => x.id === stackId);
  if (!st) return null;
  const spots = spotChoices(st, store.getGame, { row });
  const checks = checkSpots(store.getPlan2(), store.getGames(), gameId, spots.map((x) => x.run));
  return { stackId, row, spots, checks, lay: layoutStack2(st, store.getGame) };
}

/**
 * The spot the pointer means on a probed stack (local: stackLocal), whether it works, and the
 * outline (stack-local, y up). null when the stack has no spot.
 */
export function aimStack(probe, game, local) {
  const i = nearestSpot(probe.spots, probe.lay, local, probe.row);
  if (i < 0) return null;
  const spot = probe.spots[i];
  const d = dropChoice(probe.spots, probe.checks, i, probe.stackId);
  const way = probe.checks[i]?.best ?? { up: 's', rot: false };
  const ghost = game?.dims ? ghostRect(spot, probe.lay, boxSize(game.dims, way.up, !!way.rot), probe.row) : null;
  return { index: i, key: spot.key, works: !d.blocked, note: dragNote(spot.label, d.blocked?.reason), ghost };
}

/**
 * Empty shelf at x cm (from tapTarget): where the new stack would go (newStackX) and whether any way
 * up works there (the same check as New stack here). Worked out once per spot.
 */
export function probeEmpty(store, gameId, zone, x) {
  const at = newStackX(zone, x);
  const game = store.getGame(gameId);
  if (at == null || !game?.dims) return null;
  const orients = orientationChoices(game);
  const placed = new Map(); // the same x as New stack here: the wall end when it works (part-b7)
  const fit = (o) => {
    if (!placed.has(o)) placed.set(o, newStackAt(store, gameId, zone, at, o));
    return placed.get(o);
  };
  const r = newStackWays(orients, (o) => checkMove(store, newStackFn(store, gameId, zone, fit(o), o), 'Place'));
  const o = orients[r.chosen] ?? orients[0];
  return { zone, x: at, works: r.list.length > 0, reason: r.reason, way: { up: o.up, rot: o.rot }, at: fit(o), size: { w: o.w, h: o.h } };
}

/** The outline (drawing cm, y down) and note for a probed empty spot. */
export function aimEmpty(probe, scene) {
  const z = scene.zones.find((x) => x.id === probe.zone);
  if (!z) return null;
  const { w, h } = probe.size;
  return {
    works: probe.works,
    note: dragNote(`New stack here · ${ZONES[probe.zone]?.label ?? probe.zone}`, probe.works ? null : probe.reason),
    rect: { x: z.x + probe.at, y: z.floor - h, w, h },
  };
}
