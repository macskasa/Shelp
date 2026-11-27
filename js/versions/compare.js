// Compare two states of the shelves (saved versions, or a saved version and "now").
// A plain data function with no DOM and no store, so the D7 "moving checklist" can build on it.
//
//   compareVersions(a, b) -> { moved, turned, added, removed, unchanged, identical }
//
// a and b are { games, plan } (schema 2). The result reads "from a to b":
//   moved    games in both that are somewhere else, or somewhere else in the same stack
//   turned   games in both, in the same place, with a different side up or turned
//   added    games only in b          removed   games only in a
// Every entry has { id, title, text } and the groups are sorted by title.
// Inside a stack only real changes count: a box that stayed in line does not "move" because a neighbour left.
import { locations2 } from '../core/plan2.js';
import { shortLocation } from '../catalog/filter.js';

const POSE = { s: 'flat', m: 'on its side', l: 'standing' };
const SAME_X = 0.05; // cm; boxes closer than this stand at the same place

/** "flat", "on its side", "standing", plus ", long side out" when turned. */
export function poseText(up, rot) {
  return `${POSE[up] ?? 'flat'}${rot ? ', long side out' : ''}`;
}

const byTitle = (x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: 'base' }) || x.id.localeCompare(y.id);

/** A game with no place is on the board; locations2 does not list it. */
const BOARD = Object.freeze({ kind: 'board', index: -1 });

/** Where one game rests, as a comparable key: the stack, the cupboard, the board, or inside a box. */
function placeKey(loc) {
  switch (loc.kind) {
    case 'stack': return `stack:${loc.stackId}`;
    case 'inside': return `inside:${loc.hostId}`;
    default: return loc.kind;
  }
}

const sameSet = (p, q) => p.length === q.length && p.every((id) => q.includes(id));

/** Ids in left-to-right order. Boxes at the same x (a pile) keep a steady order by id. */
function leftToRight(ids, where) {
  return [...ids].sort((p, q) => {
    const dx = where.get(p).x - where.get(q).x;
    return Math.abs(dx) > SAME_X ? dx : p.localeCompare(q);
  });
}

/** Positions in `seq` that are not part of a longest increasing run: the ones that jumped. */
function outOfOrder(seq) {
  const best = []; // best[i]: length of the longest run ending at i
  const prev = [];
  let end = -1;
  seq.forEach((v, i) => {
    best[i] = 1; prev[i] = -1;
    for (let j = 0; j < i; j++) if (seq[j] < v && best[j] + 1 > best[i]) { best[i] = best[j] + 1; prev[i] = j; }
    if (end < 0 || best[i] > best[end]) end = i;
  });
  const keep = new Set();
  for (let i = end; i >= 0; i = prev[i]) keep.add(i);
  return seq.map((_, i) => i).filter((i) => !keep.has(i));
}

/**
 * Per stack, the games that stayed in it and what moved *inside* it. A stack closes its gaps when a box
 * leaves, so x is no help (every neighbour shifts); the order along the row is. Only the games that
 * changed their place in that order count, plus a changed row, plus resting on a different box that stayed.
 */
function movedWithinStacks(whereA, whereB, inBoth) {
  const stayed = new Map(); // stackId -> [ids]
  for (const [id, after] of whereB) {
    const before = whereA.get(id);
    if (!inBoth(id) || before?.kind !== 'stack' || after.kind !== 'stack' || before.stackId !== after.stackId) continue;
    if (!stayed.has(after.stackId)) stayed.set(after.stackId, []);
    stayed.get(after.stackId).push(id);
  }
  const moved = new Set();
  for (const ids of stayed.values()) {
    const keep = new Set(ids);
    const known = (list) => list.filter((id) => keep.has(id));
    const rows = new Map();
    for (const id of ids) {
      if (whereA.get(id).row !== whereB.get(id).row) { moved.add(id); continue; }
      if (!sameSet(known(whereA.get(id).on), known(whereB.get(id).on))) moved.add(id);
      const row = whereA.get(id).row;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push(id);
    }
    for (const inRow of rows.values()) {
      const order = leftToRight(inRow, whereA);
      const seq = leftToRight(inRow, whereB).map((id) => order.indexOf(id));
      const now = leftToRight(inRow, whereB);
      for (const i of outOfOrder(seq)) moved.add(now[i]);
    }
  }
  return moved;
}

const turnedBetween = (p, q) => p.up !== q.up || !!p.rot !== !!q.rot;

function titles(...lists) {
  const map = new Map();
  // the first list that knows a game wins, so each side names things the way it knew them
  for (const games of lists) for (const g of games) if (!map.has(g.id)) map.set(g.id, g.title);
  return (id) => map.get(id) ?? id;
}

export function compareVersions(a, b) {
  const whereA = locations2(a.plan);
  const whereB = locations2(b.plan);
  const inA = new Map(a.games.map((g) => [g.id, g]));
  const inB = new Map(b.games.map((g) => [g.id, g]));
  const nameA = titles(a.games, b.games);
  const nameB = titles(b.games, a.games);

  const jumped = movedWithinStacks(whereA, whereB, (id) => inA.has(id) && inB.has(id));
  const moved = [];
  const turned = [];
  const added = [];
  const removed = [];
  let unchanged = 0;

  for (const [id, game] of inA) {
    const before = whereA.get(id) ?? BOARD;
    if (!inB.has(id)) {
      removed.push({ id, title: game.title, where: shortLocation(before, nameA), text: `${game.title}: in ${shortLocation(before, nameA)}` });
      continue;
    }
    const after = whereB.get(id) ?? BOARD;
    const title = inB.get(id).title;
    const from = shortLocation(before, nameA);
    const to = shortLocation(after, nameB);
    const bothStack = before.kind === 'stack' && after.kind === 'stack';
    const turn = bothStack && turnedBetween(before, after)
      ? { from: poseText(before.up, before.rot), to: poseText(after.up, after.rot) }
      : null;

    if (placeKey(before) !== placeKey(after)) {
      moved.push({ id, title, from, to, within: false, turn, text: `${title}: ${from} → ${to}${turn ? ` (${turn.from} → ${turn.to})` : ''}` });
    } else if (jumped.has(id)) {
      moved.push({ id, title, from, to, within: true, turn, text: `${title}: moved within ${to}${turn ? ` (${turn.from} → ${turn.to})` : ''}` });
    } else if (turn) {
      turned.push({ id, title, where: to, from: turn.from, to: turn.to, text: `${title}: ${turn.from} → ${turn.to}` });
    } else {
      unchanged += 1;
    }
  }

  for (const [id, game] of inB) {
    if (inA.has(id)) continue;
    const after = whereB.get(id) ?? BOARD;
    added.push({ id, title: game.title, where: shortLocation(after, nameB), text: `${game.title}: in ${shortLocation(after, nameB)}` });
  }

  moved.sort(byTitle);
  turned.sort(byTitle);
  added.sort(byTitle);
  removed.sort(byTitle);
  return {
    moved, turned, added, removed, unchanged,
    identical: !moved.length && !turned.length && !added.length && !removed.length,
  };
}

/** "3 moved · 1 turned · 2 only in one of them · 198 unchanged", or "No differences." */
export function summarize(result) {
  if (result.identical) return 'No differences.';
  const only = result.added.length + result.removed.length;
  const parts = [];
  if (result.moved.length) parts.push(`${result.moved.length} moved`);
  if (result.turned.length) parts.push(`${result.turned.length} turned`);
  if (only) parts.push(`${only} only in one of them`);
  parts.push(`${result.unchanged} unchanged`);
  return parts.join(' · ');
}
