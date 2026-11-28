// The moving checklist (D7): in what order to do a change with your hands. Plain data function, no DOM, no store.
//
//   movingSteps(a, b) -> { takeOut: [Step], slide: [Step], putIn: [Step], inside: [Step] }      Step = { key, id, title, text }
//
// a and b are { games, plan } (schema 2), "from a to b". `key` is `phase:gameId` (takeOut / putIn / inside / outside).
// A box *stays* when it is in the same zone at the same shelf x (stack x + box x), row, side up and turn, and
// everything under it stays too. A stack that only moves along its shelf, as a whole, is one Slide step (its boxes
// stay). Everything else is lifted off top down and put in bottom up.
import { locations2 } from '../core/plan2.js';
import { ZONES } from '../core/shelves.js';
import { poseText } from './compare.js';

const SAME_X = 0.05; // cm
const zoneOrder = Object.keys(ZONES);
const round1 = (n) => String(Math.round(n * 10) / 10);

/** Every box of a plan on a stack: { id, stack, shelfX, row, up, rot, on }. */
function boxesOf(plan) {
  const map = new Map();
  for (const st of plan.stacks) {
    for (const b of st.boxes) {
      map.set(b.game, { id: b.game, stack: st, shelfX: st.x + b.x, row: b.row ?? 0, up: b.up, rot: !!b.rot, on: b.on ?? [] });
    }
  }
  return map;
}

const shelfOrder = (p, q) =>
  zoneOrder.indexOf(p.zone) - zoneOrder.indexOf(q.zone) || p.x - q.x || p.id.localeCompare(q.id);

/** The ids of boxes that stay where they are. */
function staying(A, B, slid = new Set()) {
  const memo = new Map();
  const stays = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    const p = A.get(id);
    const q = B.get(id);
    let ok = !!p && !!q && !seen.has(id)
      && (slid.has(id) || (p.stack.zone === q.stack.zone && Math.abs(p.shelfX - q.shelfX) <= SAME_X))
      && p.row === q.row && p.up === q.up && p.rot === q.rot
      && p.on.length === q.on.length && p.on.every((s) => q.on.includes(s));
    if (ok) {
      seen.add(id);
      ok = p.on.every((s) => stays(s, seen));
      seen.delete(id);
    }
    memo.set(id, ok);
    return ok;
  };
  return stays;
}

/** Order the boxes of one stack so that each comes after the boxes it needs first (`before(id)` lists those). */
function ordered(boxes, before) {
  const left = new Map(boxes.map((b) => [b.id, b]));
  const out = [];
  const ids = [...boxes].sort((p, q) => p.shelfX - q.shelfX || p.id.localeCompare(q.id)).map((b) => b.id);
  while (left.size) {
    const next = ids.find((id) => left.has(id) && before(id).every((o) => !left.has(o)));
    const id = next ?? ids.find((i) => left.has(i)); // cannot happen with a valid plan; never loop forever
    out.push(left.get(id));
    left.delete(id);
  }
  return out;
}

/** Stacks of `a` that move as a whole along their shelf: [{ from, to, delta, ids }]. */
function slides(A, B, a) {
  const claimed = new Set();
  const out = [];
  for (const st of a.plan.stacks) {
    const ids = st.boxes.map((x) => x.game);
    const q0 = B.get(ids[0]);
    if (!q0 || claimed.has(q0.stack.id)) continue;
    const delta = q0.shelfX - A.get(ids[0]).shelfX;
    const whole = Math.abs(delta) > SAME_X && ids.every((id) => {
      const p = A.get(id);
      const q = B.get(id);
      return q && q.stack.id === q0.stack.id && q.stack.zone === st.zone && Math.abs(q.shelfX - p.shelfX - delta) <= SAME_X
        && p.row === q.row && p.up === q.up && p.rot === q.rot && p.on.length === q.on.length && p.on.every((o) => q.on.includes(o));
    });
    if (!whole) continue;
    claimed.add(q0.stack.id);
    out.push({ from: st, to: q0.stack, delta, ids });
  }
  return out;
}

const nameOf = (...lists) => {
  const map = new Map();
  for (const games of lists) for (const g of games) if (!map.has(g.id)) map.set(g.id, g.title);
  return (id) => map.get(id) ?? id;
};

export function movingSteps(a, b) {
  const A = boxesOf(a.plan);
  const B = boxesOf(b.plan);
  const moves = slides(A, B, a);
  const stays = staying(A, B, new Set(moves.flatMap((m) => m.ids)));
  const inA = new Map(a.games.map((g) => [g.id, g]));
  const inB = new Map(b.games.map((g) => [g.id, g]));
  const nameA = nameOf(a.games, b.games);
  const nameB = nameOf(b.games, a.games);
  const whereA = locations2(a.plan);
  const whereB = locations2(b.plan);
  const kindB = (id) => (inB.has(id) ? (whereB.get(id)?.kind ?? 'board') : 'gone');

  const groups = (map, doesStay) => {
    const by = new Map();
    for (const box of map.values()) {
      if (doesStay(box.id)) continue;
      if (!by.has(box.stack.id)) by.set(box.stack.id, { stack: box.stack, boxes: [] });
      by.get(box.stack.id).boxes.push(box);
    }
    return [...by.values()].sort((p, q) => shelfOrder(p.stack, q.stack));
  };

  const takeOut = [];
  for (const { stack, boxes } of groups(A, stays)) {
    const resting = (id) => boxes.filter((o) => o.on.includes(id)).map((o) => o.id);
    for (const box of ordered(boxes, resting)) {
      const kind = kindB(box.id);
      const last = { board: ' → board', cupboard: ' → cupboard', gone: ' (not in the app any more)' }[kind] ?? '';
      takeOut.push({
        key: `takeOut:${box.id}`, id: box.id, title: nameA(box.id),
        text: `Take ${nameA(box.id)} off ${stack.id}${last}`,
      });
    }
  }

  const slide = [];
  const toWall = moves.filter((m) => m.delta > 0).sort((p, q) => zoneOrder.indexOf(p.to.zone) - zoneOrder.indexOf(q.to.zone) || q.to.x - p.to.x);
  const away = moves.filter((m) => m.delta < 0).sort((p, q) => shelfOrder(p.to, q.to));
  for (const m of [...toWall, ...away]) {
    const way = m.delta > 0 ? 'towards the wall' : 'away from the wall';
    slide.push({
      key: `slide:${m.to.id}`, id: m.to.id, title: m.to.id,
      text: `Slide ${m.to.id} ${round1(Math.abs(m.delta))} cm ${way} (to ${round1(m.to.x)} cm)`,
    });
  }

  const putIn = [];
  const staysB = (id) => !!B.get(id) && stays(id);
  for (const { stack, boxes } of groups(B, staysB)) {
    for (const box of ordered(boxes, (id) => B.get(id).on)) {
      const parts = [`on ${stack.id}`];
      if (box.on.length === 0) parts.push(`on the shelf from ${round1(box.shelfX)} cm`);
      else if (box.on.length === 1) parts.push(`on ${nameB(box.on[0])}`);
      else {
        const sides = [...box.on].sort((p, q) => B.get(p).shelfX - B.get(q).shelfX);
        parts.push(`across ${sides.map(nameB).join(' + ')}`);
      }
      if (box.row === 1) parts.push('back row');
      parts.push(poseText(box.up, box.rot));
      const was = whereA.get(box.id);
      const back = A.get(box.id)?.stack.id === stack.id;
      if (!inA.has(box.id)) parts.push('new');
      else if (was?.kind === 'cupboard') parts.push('from the cupboard');
      else if (was?.kind === 'board' || !was) parts.push('from the board');
      else if (was.kind === 'inside') parts.push(`from inside ${nameA(was.hostId)}`);
      putIn.push({
        key: `putIn:${box.id}`, id: box.id, title: nameB(box.id),
        text: `${back ? 'Put back' : 'Put'} ${nameB(box.id)} ${parts.join(' · ')}`,
      });
    }
  }

  const inside = [];
  const hostA = a.plan.inside ?? {};
  const hostB = b.plan.inside ?? {};
  const both = [...new Set([...Object.keys(hostA), ...Object.keys(hostB)])];
  for (const id of both.sort((p, q) => nameB(p).localeCompare(nameB(q), undefined, { sensitivity: 'base' }))) {
    if (hostA[id] === hostB[id] || !inB.has(id)) continue;
    if (hostA[id] && inA.has(id)) {
      inside.push({ key: `outside:${id}`, id, title: nameA(id), text: `Take ${nameA(id)} out of ${nameA(hostA[id])}` });
    }
    if (hostB[id]) {
      inside.push({ key: `inside:${id}`, id, title: nameB(id), text: `Put ${nameB(id)} inside ${nameB(hostB[id])}` });
    }
  }
  return { takeOut, slide, putIn, inside };
}
