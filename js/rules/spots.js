// Check every spot × way up on ONE stack, fast, for the spot sheet (part-a7). Pure function, no DOM. Owner: Stephen (Part A).
//
//   checkSpots(plan, games, gameId, runs) -> [{ ways, best }]   in the order of `runs`
//     runs  the store calls spotChoices() (js/map/spots.js) builds for one stack:
//           { fn: 'placeBox', target: { stackId, row, on, index } }  |  { fn: 'placeUnder', targets: [id, …] }
//     ways  one per way up the game allows: { up, rot, block: Warning[], warn: Warning[] }
//           (a pizza game: flat, turned or not; the others up to six, equal sizes once; no size: none)
//           only the NEW problems, counted as suggestSpots does: the stack and its overlaps on that shelf,
//           plus the family warning when the placing newly spreads a family out
//     best  the way with no block, then the fewest warnings, then reach, height, least turned; null when all are blocked
//
// Works on a copy of the one stack (detach / insertOn / insertUnder from js/core/plan2.js). Nothing in `plan` or the store changes.
// Like suggestSpots, the game is taken out of the plan first: spotChoices gets the stack without it.
import { layoutStack2 } from '../core/geometry.js';
import { ZONES } from '../core/shelves.js';
import { detach, insertOn, insertUnder } from '../core/plan2.js';
import { reachInStack } from './reach.js';
import { checkStack2, overlapsWith, familyPlacement, isSpread, familyWarning } from './check2.js';
import { key, cloneStack, orientations } from './suggest.js';

const ZONE_ORDER = Object.keys(ZONES);

/** Ids of the boxes of `st` resting on `id`, directly or higher up. */
function resting(st, id) {
  const out = [];
  const queue = [id];
  while (queue.length) {
    const at = queue.shift();
    for (const b of st.boxes) if (b.on.includes(at) && !out.includes(b.game)) { out.push(b.game); queue.push(b.game); }
  }
  return out;
}

export function checkSpots(plan, games, gameId, runs) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const game = byId.get(gameId);
  const getGame = (id) => byId.get(id);
  const ways = game?.dims ? orientations(game) : [];
  if (!runs.length) return [];
  const none = () => ({ ways: [], best: null });
  if (!ways.length) return runs.map(none);

  const base = structuredClone(plan);
  detach(base, gameId, getGame);

  const infoMemo = new Map();
  const info = (st) => {
    if (!infoMemo.has(st.id)) infoMemo.set(st.id, { layout: layoutStack2(st, getGame) });
    return infoMemo.get(st.id);
  };
  const end = (st) => st.x + info(st).layout.w;
  const others = (zone) => base.stacks.filter((s) => s.zone === zone && s.boxes.length).map((s) => ({ st: s, end: end(s) }));
  const othersMemo = new Map();
  const othersOf = (zone) => { if (!othersMemo.has(zone)) othersMemo.set(zone, others(zone)); return othersMemo.get(zone); };
  const knownMemo = new Map();
  const known = (st) => {
    if (!knownMemo.has(st.id)) knownMemo.set(st.id, new Set([...checkStack2(st, getGame, info(st).layout), ...overlapsWith(st, end(st), othersOf(st.zone))].map(key)));
    return knownMemo.get(st.id);
  };

  // the family check (B2), as in suggestSpots: where the other members are, once
  const fam = game.family ? familyPlacement(base, getGame) : null;
  const famIds = fam?.members.get(game.family) ?? [];
  const famSet = new Set(famIds);
  const famSpread = famIds.length ? isSpread(famIds, fam.zoneOf, fam.lists) : false;
  const familyOf = (st) => {
    if (!famIds.length || famSpread) return null;
    let next = fam.lists.get(st.zone) ?? [];
    if (!next.includes(st.id)) { // an empty stack holds boxes once the game is there
      const o = othersOf(st.zone).filter((x) => x.st.id !== st.id);
      const at = o.filter((x) => x.st.x < st.x || (x.st.x === st.x && x.st.id < st.id)).length;
      next = o.map((x) => x.st.id);
      next.splice(at, 0, st.id);
    }
    const ids = [...famSet, st.id].filter((id, i, a) => a.indexOf(id) === i);
    const zoneOf = new Map(fam.zoneOf).set(st.id, st.zone);
    const lists = new Map(fam.lists).set(st.zone, next);
    if (!isSpread(ids, zoneOf, lists)) return null;
    const pos = (id) => ZONE_ORDER.indexOf(zoneOf.get(id)) * 1e6 + lists.get(zoneOf.get(id)).indexOf(id);
    return familyWarning(game.family, ids.sort((a, b) => pos(a) - pos(b)));
  };

  const stackIdOf = (run) => (run.fn === 'placeUnder'
    ? base.stacks.find((s) => s.boxes.some((b) => b.game === run.targets[0]))?.id
    : run.target.stackId);

  return runs.map((run) => {
    const st = base.stacks.find((s) => s.id === stackIdOf(run));
    if (!st || !ZONES[st.zone]) return none();
    const old = known(st);
    const results = [];
    for (const way of ways) {
      const work = cloneStack(st);
      let placed;
      try {
        placed = run.fn === 'placeUnder'
          ? insertUnder({ stacks: [work] }, getGame, gameId, run.targets, { up: way.up, rot: way.rot })
          : insertOn({ stacks: [work] }, getGame, gameId, { ...run.target, up: way.up, rot: way.rot });
      } catch { continue; } // a spot that cannot be made (a box not there): no way
      const layout = layoutStack2(work, getGame);
      const found = [...checkStack2(work, getGame, layout), ...overlapsWith(work, work.x + layout.w, othersOf(work.zone))];
      const family = familyOf(work);
      if (family) found.push(family);
      const fresh = found.filter((w) => !old.has(key(w)));
      const block = fresh.filter((w) => w.severity === 'block');
      const warn = fresh.filter((w) => w.severity !== 'block');
      const out = { up: way.up, rot: way.rot, block, warn };
      let rank = null;
      if (!block.length) {
        rank = [warn.length, reachInStack(work, layout, placed, resting(work, gameId)).score, layout.h, (way.up === 's' ? 0 : 2) + (way.rot ? 1 : 0)];
      }
      results.push({ out, rank });
    }
    let best = null;
    let bestRank = null;
    for (const r of results) {
      if (!r.rank) continue;
      let less = false;
      for (let i = 0; i < r.rank.length; i++) { if (!bestRank || r.rank[i] !== bestRank[i]) { less = !bestRank || r.rank[i] < bestRank[i]; break; } }
      if (less) { best = r.out; bestRank = r.rank; }
    }
    return { ways: results.map((r) => r.out), best };
  });
}
