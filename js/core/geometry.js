// Box and stack geometry for the plan format v2 (schema 2). Pure, no DOM. Owner: Tony (lead).
//
// A box on a stack: { game, row, x, up, rot, on }
//   row  0 = front, 1 = back
//   x    cm from the stack's left edge to the box's left edge
//   up   which side faces up: 's' = flat (smallest side up, lying on its biggest face),
//        'm' = on its side, 'l' = on end (like a book)
//   rot  false: the narrower of the two remaining sides runs along the shelf; true: the wider one
//   on   [] = on the shelf floor, [id] = on that box, [a, b] = a bridge across two boxes
// Height comes from gravity: a box sits on the highest of its supports.

const SIDE = { s: 0, m: 1, l: 2 };

/**
 * The room a box takes: { w, d, h } in cm (w along the shelf, d front to back, h up).
 * dims = [s, m, l] sorted smallest first. The two sides that are not up: the narrower one runs
 * along the shelf (w) unless rot is true.
 */
export function boxSize(dims, up = 's', rot = false) {
  const sorted = [...dims].sort((a, b) => a - b);
  const i = SIDE[up] ?? 0;
  const h = sorted[i];
  const [a, b] = sorted.filter((_, k) => k !== i); // a <= b
  return rot ? { w: b, d: a, h } : { w: a, d: b, h };
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * Where every box of a v2 stack sits, and how big the stack is.
 * @param stack    { id, zone, x, boxes: [...], topper? }
 * @param getGame  id → game (a game without dims gets 0 × 0 × 0: such games are never on a stack)
 * @returns {{ w, d, h, pileH, rows,
 *   boxes: [{ gameId, row, x, y, z, w, d, h, up, rot, on }]   y = bottom of the box, z = front edge
 *   topper: null | { label, x, y, w, h } }}
 */
export function layoutStack2(stack, getGame) {
  const byId = new Map(stack.boxes.map((b) => [b.game, b]));
  const size = new Map(stack.boxes.map((b) => {
    const dims = getGame(b.game)?.dims;
    return [b.game, dims ? boxSize(dims, b.up, b.rot) : { w: 0, d: 0, h: 0 }];
  }));
  const y = new Map();
  const seen = new Set();
  const bottom = (id) => {
    if (y.has(id)) return y.get(id);
    if (seen.has(id)) return 0; // a loop: the schema check refuses those, never hang here
    seen.add(id);
    const b = byId.get(id);
    const sup = (b?.on ?? []).filter((s) => byId.has(s));
    const v = sup.length ? Math.max(...sup.map((s) => bottom(s) + size.get(s).h)) : 0;
    y.set(id, v);
    return v;
  };
  const rowsUsed = stack.boxes.some((b) => b.row === 1) ? 2 : 1;
  const rowDepth = [0, 1].map((r) => Math.max(0, ...stack.boxes.filter((b) => (b.row ?? 0) === r).map((b) => size.get(b.game).d)));
  const boxes = stack.boxes.map((b) => {
    const sz = size.get(b.game);
    return {
      gameId: b.game, row: b.row ?? 0, x: round(b.x ?? 0), y: round(bottom(b.game)), z: (b.row ?? 0) === 1 ? round(rowDepth[0]) : 0,
      w: sz.w, d: sz.d, h: sz.h, up: b.up ?? 's', rot: !!b.rot, on: [...(b.on ?? [])],
    };
  });
  const w = Math.max(0, ...boxes.map((b) => b.x + b.w));
  const pileH = Math.max(0, ...boxes.map((b) => b.y + b.h));
  const t = stack.topper;
  return {
    w: round(w),
    d: round(rowDepth[0] + (rowsUsed === 2 ? rowDepth[1] : 0)),
    h: round(pileH + (t?.h ?? 0)),
    pileH: round(pileH),
    rows: rowsUsed,
    boxes,
    topper: t ? { label: t.label, x: round((w - t.w) / 2), y: round(pileH), w: t.w, h: t.h } : null,
  };
}
