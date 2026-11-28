// Plan format v2 (schema 2): upgrade from v1, locations, and the edit operations.
// Pure functions on plain objects, no DOM. The store (store.js) is the only caller that changes
// data; everyone else uses the store. Owner: Tony (lead).
//
// v2 stack: { id, zone, x, boxes: [Box], topper?, notes? }      (see geometry.js for Box)
// v2 plan:  { name, stacks, cupboard: [{ game, reason }], inside: { exp: host }, board: [{ game }] }
import { ZONES } from './shelves.js';
import { boxSize } from './geometry.js';

const round = (n) => Math.round(n * 100) / 100;
const PREFIX = { top: 'T', middle: 'M', bottom: 'B', 'under-cards': 'L', 'under-tall': 'U', 'under-gap': 'S', narrow: 'N' };
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const byX = (a, b) => a.x - b.x;

// ---------------------------------------------------------------- upgrade v1 → v2

/** A v1 plan (rows of items) as a v2 plan (boxes with positions). getGame gives the sizes. */
export function migratePlanV1(plan, getGame) {
  const stacks = (plan.stacks ?? []).map((st) => {
    const zone = ZONES[st.zone];
    const boxes = [];
    (st.rows ?? []).forEach((row, r) => {
      if (st.orientation === 'standing') {
        let x = 0;
        for (const it of row) {
          for (const p of it.side ?? [it]) {
            const dims = getGame(p.game)?.dims;
            const up = dims && Math.max(...dims) > (zone?.usable ?? Infinity) ? 'm' : 'l';
            boxes.push({ game: p.game, row: r, x: round(x), up, rot: false, on: [] });
            x += dims ? boxSize(dims, up, false).w : 0;
          }
        }
        return;
      }
      let below = [];
      for (const it of row) {
        const parts = it.side ?? [it];
        const level = [];
        let x = 0;
        for (const p of parts) {
          const dims = getGame(p.game)?.dims;
          const rot = !!p.rot || (dims ? Math.max(...dims) > (zone?.depth ?? Infinity) : false);
          boxes.push({ game: p.game, row: r, x: round(x), up: 's', rot, on: [...below] });
          x += dims ? boxSize(dims, 's', rot).w : 0;
          level.push(p.game);
        }
        below = level.slice(0, 2); // the next level rests on this one (on two boxes it is a bridge)
      }
    });
    const out = { id: st.id, zone: st.zone, x: st.x, boxes };
    if (st.topper) out.topper = { ...st.topper };
    if (st.notes) out.notes = [...st.notes];
    return out;
  });
  return {
    name: plan.name ?? 'Imported plan',
    stacks,
    cupboard: (plan.cupboard ?? []).map((c) => ({ game: c.game, reason: c.reason ?? '' })),
    inside: { ...(plan.inside ?? {}) },
    board: [],
  };
}

/**
 * A whole v1 file (games + plan) as v2. Games get `pizza`: false for the games that stood in the
 * v1 plan (card games, KLASK, Ice Cool), true for every other game. Games in no place go on the board.
 */
export function migrateDataV1(obj) {
  const standing = new Set();
  for (const st of obj.plan?.stacks ?? []) {
    if (st.orientation === 'standing') for (const row of st.rows ?? []) for (const it of row) for (const p of it.side ?? [it]) standing.add(p.game);
  }
  const games = (obj.games ?? []).map((g) => ({ ...g, pizza: g.pizza ?? !standing.has(g.id) }));
  const byId = new Map(games.map((g) => [g.id, g]));
  const plan = migratePlanV1(obj.plan ?? {}, (id) => byId.get(id));
  const placed = placedIds(plan);
  plan.board = games.filter((g) => !placed.has(g.id)).map((g) => ({ game: g.id }));
  const out = { ...obj, schema: 2, games, plan };
  return out;
}

/** Every game id that has a place in a v2 plan (stack, cupboard, inside, board). */
export function placedIds(plan) {
  const ids = new Set();
  for (const st of plan.stacks ?? []) for (const b of st.boxes ?? []) ids.add(b.game);
  for (const c of plan.cupboard ?? []) ids.add(c.game);
  for (const k of Object.keys(plan.inside ?? {})) ids.add(k);
  for (const b of plan.board ?? []) ids.add(b.game);
  return ids;
}

// ---------------------------------------------------------------- locations (v2)

/**
 * Map gameId → location for a v2 plan:
 *  { kind: 'stack', stackId, zone, row, rows, x, up, rot, on, above, below }
 *     on: what it rests on ([] = the shelf floor, two ids = a bridge)
 *     above: every box resting on it, directly or higher up, nearest first; below: everything under it
 *  { kind: 'inside', hostId, host }  { kind: 'cupboard', reason }  { kind: 'board', index }
 */
export function locations2(plan) {
  const where = new Map();
  for (const st of plan.stacks) {
    const rows = st.boxes.some((b) => b.row === 1) ? 2 : 1;
    const kids = new Map(st.boxes.map((b) => [b.game, []]));
    for (const b of [...st.boxes].sort(byX)) for (const s of b.on) kids.get(s)?.push(b.game);
    const sup = new Map(st.boxes.map((b) => [b.game, b.on]));
    const walk = (start, next) => {
      const out = [];
      const queue = [...(next.get(start) ?? [])];
      while (queue.length) {
        const id = queue.shift();
        if (out.includes(id) || id === start) continue;
        out.push(id);
        queue.push(...(next.get(id) ?? []));
      }
      return out;
    };
    for (const b of st.boxes) {
      where.set(b.game, Object.freeze({
        kind: 'stack', stackId: st.id, zone: st.zone, row: b.row ?? 0, rows, x: b.x, up: b.up, rot: !!b.rot,
        on: Object.freeze([...b.on]), above: Object.freeze(walk(b.game, kids)), below: Object.freeze(walk(b.game, sup)),
      }));
    }
  }
  plan.cupboard.forEach((c) => where.set(c.game, Object.freeze({ kind: 'cupboard', reason: c.reason ?? '' })));
  plan.board.forEach((b, index) => where.set(b.game, Object.freeze({ kind: 'board', index })));
  for (const [exp, host] of Object.entries(plan.inside)) {
    where.set(exp, Object.freeze({ kind: 'inside', hostId: host, host: where.get(host) ?? { kind: 'board', index: -1 } }));
  }
  return where;
}

// ---------------------------------------------------------------- edit operations (mutate `plan`)

export function findBox(plan, id) {
  for (const stack of plan.stacks) {
    const box = stack.boxes.find((b) => b.game === id);
    if (box) return { stack, box };
  }
  return null;
}

const widthOf = (box, getGame) => {
  const dims = getGame(box.game)?.dims;
  return dims ? boxSize(dims, box.up, box.rot).w : 0;
};

/** Boxes resting on `id`, directly or higher up (a bridge counts if any of its supports is in the set). */
function above(stack, id) {
  const out = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of stack.boxes) {
      if (!out.has(b.game) && b.game !== id && b.on.some((s) => s === id || out.has(s))) {
        out.add(b.game);
        grew = true;
      }
    }
  }
  return out;
}

/** Move a box and everything on it along the shelf by dx. */
function shift(stack, box, dx) {
  if (!dx) return;
  box.x = round(box.x + dx);
  for (const id of above(stack, box.game)) {
    const b = stack.boxes.find((x) => x.game === id);
    b.x = round(b.x + dx);
  }
}

/** The boxes that share a surface with `box` (same row, same supports), left to right, box excluded. */
function siblings(stack, row, on, except) {
  return stack.boxes.filter((b) => b.game !== except && (b.row ?? 0) === row && sameSet(b.on, on)).sort(byX);
}

/**
 * Take a game out of wherever it is. On a stack, the boxes resting on it now rest on what it
 * rested on (a bridge keeps its other support), and its neighbours on the same surface close up.
 */
export function detach(plan, id, getGame) {
  const found = findBox(plan, id);
  if (found) {
    const { stack, box } = found;
    const w = widthOf(box, getGame);
    for (const s of siblings(stack, box.row ?? 0, box.on, id)) if (s.x > box.x) shift(stack, s, -w);
    for (const b of stack.boxes) {
      if (!b.on.includes(id)) continue;
      b.on = b.on.length === 1 ? [...box.on] : b.on.filter((s) => s !== id);
    }
    stack.boxes = stack.boxes.filter((b) => b !== box);
  }
  plan.cupboard = plan.cupboard.filter((c) => c.game !== id);
  plan.board = plan.board.filter((b) => b.game !== id);
  delete plan.inside[id];
}

/**
 * Put a box on a surface: the shelf floor of a row (on = []), the top of a box (on = [id]),
 * or across two boxes (on = [a, b]). index = position among the boxes already on that surface,
 * left to right (default: right end). Those to its right move over to make room.
 */
export function insertOn(plan, getGame, id, { stackId, row = 0, on = [], index, up = 's', rot = false }) {
  const stack = plan.stacks.find((s) => s.id === stackId);
  if (!stack) throw new Error(`There is no stack ${stackId}`);
  if (on.length > 2) throw new Error('A box can rest on at most two boxes');
  for (const s of on) {
    const sup = stack.boxes.find((b) => b.game === s);
    if (!sup) throw new Error(`That box is not on stack ${stackId}`);
    if ((sup.row ?? 0) !== row) throw new Error('A box can only rest on boxes in the same row');
  }
  const sibs = siblings(stack, row, on, id);
  const at = index == null ? sibs.length : Math.max(0, Math.min(index, sibs.length));
  const base = on.length ? Math.min(...on.map((s) => stack.boxes.find((b) => b.game === s).x)) : 0;
  const x = at === 0 ? base : sibs[at - 1].x + widthOf(sibs[at - 1], getGame);
  const box = { game: id, row, x: round(x), up, rot: !!rot, on: [...on] };
  const w = widthOf(box, getGame);
  for (const s of sibs.slice(at)) shift(stack, s, w);
  stack.boxes.push(box);
  return box;
}

/**
 * Slide a box in UNDER other boxes: it takes their place and they rest on it.
 * targets = ids of boxes on one surface (one box, or a side-by-side level).
 */
export function insertUnder(plan, getGame, id, targets, { up = 's', rot = false } = {}) {
  const found = findBox(plan, targets[0]);
  if (!found) throw new Error('That box is not on a shelf');
  const { stack, box: first } = found;
  const group = targets.map((t) => stack.boxes.find((b) => b.game === t));
  if (group.some((b) => !b)) throw new Error('Those boxes are not on the same stack');
  const box = { game: id, row: first.row ?? 0, x: Math.min(...group.map((b) => b.x)), up, rot: !!rot, on: [...first.on] };
  // the new box replaces the group on its surface: neighbours make room for the difference in width
  const groupW = Math.max(...group.map((b) => b.x + widthOf(b, getGame))) - box.x;
  const dw = widthOf(box, getGame) - groupW;
  if (dw > 0) for (const s of siblings(stack, box.row, box.on, null)) if (!targets.includes(s.game) && s.x > box.x) shift(stack, s, dw);
  for (const b of group) b.on = [id];
  stack.boxes.push(box);
  return box;
}

/** Turn a box: which side faces up and which way round. Neighbours to its right follow the new width. */
export function turnBox(plan, getGame, id, { up, rot }) {
  const found = findBox(plan, id);
  if (!found) throw new Error('Only a box on a shelf can be turned');
  const { stack, box } = found;
  const before = widthOf(box, getGame);
  if (up != null) box.up = up;
  if (rot != null) box.rot = !!rot;
  const dw = widthOf(box, getGame) - before;
  for (const s of siblings(stack, box.row ?? 0, box.on, id)) if (s.x > box.x) shift(stack, s, dw);
}

/** The next free stack id on a shelf: T10 after T9. */
export function nextStackId(plan, zoneId) {
  const p = PREFIX[zoneId] ?? 'X';
  const nums = plan.stacks.map((s) => (s.id.startsWith(p) ? Number(s.id.slice(p.length)) : 0)).filter(Number.isFinite);
  return `${p}${Math.max(0, ...nums) + 1}`;
}

/** Rename the stacks of every shelf left to right (T1, T2, …). Returns { oldId: newId } for the ones that changed. */
export function renumber(plan) {
  const changed = {};
  for (const zoneId of Object.keys(ZONES)) {
    const p = PREFIX[zoneId];
    plan.stacks.filter((s) => s.zone === zoneId).sort(byX).forEach((s, i) => {
      const id = `${p}${i + 1}`;
      if (s.id !== id) changed[s.id] = id;
    });
  }
  for (const s of plan.stacks) if (changed[s.id]) s.id = changed[s.id];
  return changed;
}

/**
 * Join two neighbouring stacks of one shelf into one: the left one keeps its id and x, the right one's
 * boxes move into it at the same places on the shelf (their x grows by the distance between the two),
 * and the right stack is gone. Then a box can rest across the tops of both (a bridge), which only works
 * within one stack. Returns the joined stack's id.
 * Refused: another shelf, a stack between them (even an empty one), stacks that overlap, a topper on either.
 */
export function joinStacks(plan, getGame, aId, bId) {
  const a0 = plan.stacks.find((s) => s.id === aId);
  const b0 = plan.stacks.find((s) => s.id === bId);
  if (!a0 || !b0) throw new Error(`No stack ${a0 ? bId : aId}`);
  if (a0 === b0) throw new Error('A stack cannot be joined with itself');
  if (a0.zone !== b0.zone) throw new Error(`Stacks ${aId} and ${bId} are on different shelves`);
  const [left, right] = a0.x <= b0.x ? [a0, b0] : [b0, a0];
  const between = plan.stacks.find((s) => s !== left && s !== right && s.zone === left.zone && s.x > left.x && s.x < right.x);
  if (between) throw new Error(`Stack ${between.id} is between ${left.id} and ${right.id}`);
  for (const st of [left, right]) {
    if (st.topper) throw new Error(`Stack ${st.id} has a topper (${st.topper.label}), so it cannot be joined`);
  }
  const end = left.x + Math.max(0, ...left.boxes.map((b) => {
    const dims = getGame(b.game)?.dims;
    return (b.x ?? 0) + (dims ? boxSize(dims, b.up, b.rot).w : 0);
  }));
  if (end > right.x + 0.01) throw new Error(`Stacks ${left.id} and ${right.id} overlap; move them apart first`);
  const dx = right.x - left.x;
  for (const b of right.boxes) left.boxes.push({ ...b, x: round((b.x ?? 0) + dx), on: [...b.on] });
  if (right.notes?.length) left.notes = [...(left.notes ?? []), ...right.notes];
  plan.stacks = plan.stacks.filter((s) => s !== right);
  return left.id;
}

export { sameSet };
