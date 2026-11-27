// Where a game can go on a stack, which way up, and what problems a move would add
// (Phase B item 3; Phase C reuses it for the spot sheet and the turn chooser). Pure, no DOM. Owner: Bruce.
import { boxSize, layoutStack2 } from '../core/geometry.js';
import { checkPlan2 } from '../rules/index.js';

/** Bridge supports may differ by this much in height (CONTEXT section 3); more and it would tilt. */
export const BRIDGE_LEVEL = 0.5;

const UP = { s: 'Flat', m: 'On its side', l: 'Standing' };
const n1 = (n) => String(Math.round(n * 10) / 10);
const sameOn = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The ways a game may lie: flat for a pizza game, otherwise flat, on its side or standing; each
 * turned round or not ("long side out"). Options with the same w × d × h show once.
 * @returns [{ up, rot, w, d, h, label, size }]  size: "30 along × 37 deep × 7 high"
 */
export function orientationChoices(game) {
  if (!game?.dims) return [];
  const ups = game.pizza === false ? ['s', 'm', 'l'] : ['s'];
  const out = [];
  for (const up of ups) {
    for (const rot of [false, true]) {
      const { w, d, h } = boxSize(game.dims, up, rot);
      if (out.some((o) => o.w === w && o.d === d && o.h === h)) continue;
      out.push({ up, rot, w, d, h, label: rot ? `${UP[up]}, long side out` : UP[up], size: `${n1(w)} along × ${n1(d)} deep × ${n1(h)} high` });
    }
  }
  return out;
}

/**
 * Every spot on one row of a v2 stack where a game can be put.
 * Pass the stack as it would be WITHOUT the game (for a game already on it: preview a moveToBoard).
 * @returns [{ key, kind: 'shelf' | 'on' | 'across' | 'under', label, run, free?, top? }]
 *   free/top: an 'on' spot on a box with nothing on it yet, and the height of that box's top
 *   run: { fn: 'placeBox', target: { stackId, row, on, index } } or { fn: 'placeUnder', targets: [ids] }
 */
export function spotChoices(stack, getGame, { row = 0 } = {}) {
  const title = (id) => getGame(id)?.title ?? id;
  const lay = layoutStack2(stack, getGame);
  const boxes = lay.boxes.filter((b) => b.row === row).sort((a, b) => a.x - b.x || a.y - b.y);
  const top = (b) => b.y + b.h;
  const out = [];
  const place = (on, index) => ({ fn: 'placeBox', target: { stackId: stack.id, row, on, index } });

  // on the shelf: left of the first floor box, then right of each
  const floor = boxes.filter((b) => b.on.length === 0);
  if (!floor.length) out.push({ key: 'shelf:0', kind: 'shelf', label: 'On the shelf', run: place([], 0) });
  floor.forEach((b, i) => {
    if (i === 0) out.push({ key: 'shelf:0', kind: 'shelf', label: `On the shelf, left of ${title(b.gameId)}`, run: place([], 0) });
    out.push({ key: `shelf:${i + 1}`, kind: 'shelf', label: `On the shelf, right of ${title(b.gameId)}`, run: place([], i + 1) });
  });

  // on top of a box: on its own, or left / right of the boxes already on it
  for (const b of boxes) {
    const kids = boxes.filter((k) => sameOn(k.on, [b.gameId]));
    if (!kids.length) out.push({ key: `on:${b.gameId}:0`, kind: 'on', label: `On top of ${title(b.gameId)}`, run: place([b.gameId], 0), free: true, top: top(b) });
    kids.forEach((k, i) => {
      if (i === 0) out.push({ key: `on:${b.gameId}:0`, kind: 'on', label: `On top of ${title(b.gameId)}, left of ${title(k.gameId)}`, run: place([b.gameId], 0) });
      out.push({ key: `on:${b.gameId}:${i + 1}`, kind: 'on', label: `On top of ${title(b.gameId)}, right of ${title(k.gameId)}`, run: place([b.gameId], i + 1) });
    });
  }

  // across two neighbours whose tops are level (within BRIDGE_LEVEL): boxes side by side on one
  // surface, or the tops of two neighbouring piles
  const pairs = new Map();
  const consider = (a, b) => {
    if (Math.abs(top(a) - top(b)) > BRIDGE_LEVEL + 1e-9) return;
    const key = `across:${a.gameId}:${b.gameId}`;
    if (!pairs.has(key)) pairs.set(key, { key, kind: 'across', label: `Across ${title(a.gameId)} and ${title(b.gameId)}`, run: place([a.gameId, b.gameId]) });
  };
  const surfaces = new Map();
  for (const b of boxes) {
    const k = b.on.join('+');
    if (!surfaces.has(k)) surfaces.set(k, []);
    surfaces.get(k).push(b);
  }
  for (const group of surfaces.values()) for (let i = 1; i < group.length; i++) consider(group[i - 1], group[i]);
  const free = boxes.filter((b) => !boxes.some((o) => o.on.includes(b.gameId)));
  for (let i = 1; i < free.length; i++) consider(free[i - 1], free[i]);
  out.push(...pairs.values());

  // under a box, or under a side-by-side level
  for (const b of boxes) out.push({ key: `under:${b.gameId}`, kind: 'under', label: `Under ${title(b.gameId)}`, run: { fn: 'placeUnder', targets: [b.gameId] } });
  for (const group of surfaces.values()) {
    if (group.length < 2) continue;
    const ids = group.map((b) => b.gameId);
    out.push({ key: `under:${ids.join('+')}`, kind: 'under', label: `Under ${ids.map(title).join(' + ')}`, run: { fn: 'placeUnder', targets: ids } });
  }
  return out;
}

/** Turn a spot + orientation into the store call, for store.preview and the real write. */
export function moveFn(store, gameId, spot, { up = 's', rot = false } = {}) {
  if (spot.run.fn === 'placeUnder') return () => store.placeUnder(gameId, spot.run.targets, { up, rot });
  return () => store.placeBox(gameId, { ...spot.run.target, up, rot });
}

/**
 * The problems a move adds: checkPlan2 after, minus what checkPlan2 already found before
 * (same stack, other stack, rule and game; a family warning by family name). Only new problems count (part-b3).
 * @param check  the checker (default checkPlan2), for tests
 * @returns {{ block: Warning[], warn: Warning[] }}
 */
export function newProblems(before, after, getGame, check = checkPlan2) {
  // a family warning (one per game family) is keyed by its name: its stackId follows the first member
  const key = (w) => (w.family ? `family|${w.family}` : `${w.stackId}|${w.otherStackId ?? ''}|${w.rule}|${w.gameId ?? ''}`);
  const old = new Set(check(before, getGame).map(key));
  const fresh = check(after, getGame).filter((w) => !old.has(key(w)));
  return { block: fresh.filter((w) => w.severity === 'block'), warn: fresh.filter((w) => w.severity !== 'block') };
}

/** The spot to preselect: on top of the highest box with nothing on it; else the first spot. */
export function defaultSpot(spots) {
  let best = 0;
  let bestTop = -1;
  spots.forEach((s, i) => {
    if (s.free && s.top > bestTop) {
      best = i;
      bestTop = s.top;
    }
  });
  return best;
}
