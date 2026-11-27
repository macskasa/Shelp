// D4: suggest a spot for a game. Pure function, no DOM. Owner: Stephen (Part A). Bruce shows the best ones in placing mode.
//
//   suggestSpots(plan, games, gameId, { limit = 5 }) -> Spot[]
//     plan  a v2 plan (store.getPlan2()),  games  store.getGames()
//   Spot = { kind: 'stack', target: { stackId, row, on, index, up, rot }, text, warnings }     -> store.placeBox(gameId, target)
//        | { kind: 'new-stack', zone, x, up, rot, text, warnings }                            -> createStack(zone, { x }) + placeBox, in one batch
//   text      "Bottom shelf · stack B3 · on Takenokolor · flat"   "Narrow shelf · new stack at 70 cm"
//   warnings  only the NEW ones: what the placing adds to the stack the game goes to (checker warnings, severity 'warn').
//             Not included: when the game is already on a shelf, taking it out can add a warning in the stack it LEAVES
//             (the boxes settle). That one is the same for every spot, is never a block, and a preview shows it anyway.
//
// Only spots without a new blocking problem are returned. Ranking (best first):
//   1. fewer new warnings
//   2. easy to reach
//   3. least extra shelf length: how much wider the stack gets (a new stack counts its full width), because shelf length
//      is what runs out; on top of a box, within the 1 cm rule, costs none
//   4. an existing stack before a new one
//   5. less overhang on what it rests on
//   6. the lower stack (smallest height after placing, topper included)
//   7. the least turned (flat first), then shelf order, left to right
//
// Every spot is tried on a copy of the one stack it changes, with detach() and insertOn() from js/core/plan2.js
// (the only place outside the store allowed to call them: store.preview thousands of times would be too slow).
// Nothing in `plan` or in the store is touched. Only what a spot can change is checked: that stack and its overlaps
// with the other stacks on its shelf.
import { boxSize, layoutStack2 } from '../core/geometry.js';
import { ZONES, isEasy } from '../core/shelves.js';
import { detach, insertOn, locations2, nextStackId, sameSet } from '../core/plan2.js';
import { checkStack2, overlapsWith } from './check2.js';

const SLACK = 0.01;
const BRIDGE_LEVEL = 0.5; // a bridge may rest on two boxes whose tops differ by this much
const BRACKET_HALF = 0.2; // brackets are 0.4 cm wide, centred on the joint
const ZONE_ORDER = Object.keys(ZONES);

const fmt = (n) => String(Math.round(n * 10) / 10);
const key = (w) => `${w.rule}|${w.gameId}|${w.otherStackId}|${w.rule === 'bracket' ? w.message : ''}`;
const cloneStack = (st) => ({ ...st, boxes: st.boxes.map((b) => ({ ...b, on: [...b.on] })) });
const ORIENTATION = { s: 'flat', m: 'on its side', l: 'on end' };

/** The ways the game may lie: a pizza game flat (turned or not), any other game every side up. */
function orientations(game) {
  const out = [];
  const seen = new Set();
  for (const up of game.pizza ? ['s'] : ['s', 'm', 'l']) {
    for (const rot of [false, true]) {
      const size = boxSize(game.dims, up, rot);
      const k = `${up}|${size.w}|${size.d}`;
      if (seen.has(k)) continue; // a box with two equal sides looks the same turned
      seen.add(k);
      out.push({ up, rot, size });
    }
  }
  return out;
}

const how = ({ up, rot }) => [ORIENTATION[up], rot ? 'long side out' : null].filter(Boolean).join(', ');

export function suggestSpots(plan, games, gameId, { limit = 5 } = {}) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const game = byId.get(gameId);
  if (!game?.dims) return []; // a game without a box size can never be on a shelf
  const getGame = (id) => byId.get(id);
  const title = (id) => byId.get(id)?.title ?? id;
  const ways = orientations(game);

  // where it is now, so that exact place is not suggested again
  const here = locations2(plan).get(gameId);
  let current = null;
  if (here?.kind === 'stack') {
    const st = plan.stacks.find((s) => s.id === here.stackId);
    const me = st.boxes.find((b) => b.game === gameId);
    const index = st.boxes.filter((b) => b.game !== gameId && (b.row ?? 0) === (me.row ?? 0) && sameSet(b.on, me.on) && b.x < me.x).length;
    current = { stackId: here.stackId, row: me.row ?? 0, on: me.on, index, up: me.up, rot: !!me.rot };
  }

  // the plan without the game: every spot is tried on this
  const base = structuredClone(plan);
  detach(base, gameId, getGame);

  const memo = new Map(); // stackId -> { layout, end }
  const info = (st) => {
    if (!memo.has(st.id)) {
      const layout = layoutStack2(st, getGame);
      memo.set(st.id, { layout, end: st.x + layout.w });
    }
    return memo.get(st.id);
  };
  const byZone = new Map(); // zone -> [{ st, end }] for stacks with boxes
  for (const st of base.stacks) {
    if (!st.boxes.length) continue;
    byZone.set(st.zone, [...(byZone.get(st.zone) ?? []), { st, end: info(st).end }]);
  }
  const others = (zoneId) => byZone.get(zoneId) ?? [];
  const knownMemo = new Map();
  const known = (st) => {
    if (!knownMemo.has(st.id)) {
      const { layout, end } = info(st);
      knownMemo.set(st.id, new Set([...checkStack2(st, getGame, layout), ...overlapsWith(st, end, others(st.zone))].map(key)));
    }
    return knownMemo.get(st.id);
  };

  const spots = [];

  /** Try one spot on a copy of `st` (a stack of the base plan, or a new empty one). */
  function tryAt(st, spec, way, isNew, describe) {
    const work = cloneStack(st);
    const placed = insertOn({ stacks: [work] }, getGame, gameId, { ...spec, stackId: work.id, up: way.up, rot: way.rot });
    const layout = layoutStack2(work, getGame);
    const end = work.x + layout.w;
    const found = [...checkStack2(work, getGame, layout), ...overlapsWith(work, end, others(work.zone))];
    const old = isNew ? null : known(st);
    const fresh = old ? found.filter((w) => !old.has(key(w))) : found;
    if (fresh.some((w) => w.severity === 'block')) return;

    const me = layout.boxes.find((b) => b.gameId === gameId);
    const kids = layout.boxes.filter((b) => b.row === me.row && sameSet(b.on, placed.on));
    let overhang = 0;
    if (placed.on.length) {
      const sup = placed.on.map((id) => layout.boxes.find((b) => b.gameId === id));
      const lo = Math.min(...sup.map((b) => b.x));
      const hi = Math.max(...sup.map((b) => b.x + b.w));
      const side = Math.max(0, lo - Math.min(...kids.map((b) => b.x))) + Math.max(0, Math.max(...kids.map((b) => b.x + b.w)) - hi);
      const deep = Math.max(0, Math.max(...kids.map((b) => b.d)) - Math.max(...sup.map((b) => b.d)));
      overhang = side + deep;
    }
    const text = describe(layout.rows);
    const extra = isNew ? layout.w : Math.max(0, layout.w - info(st).layout.w); // how much longer the stack gets on the shelf
    spots.push({
      rank: {
        warnings: fresh.length,
        hard: isEasy(work.zone, work.x + me.x, me.w) ? 0 : 1,
        extra: Math.round(extra * 100) / 100,
        isNew: isNew ? 1 : 0,
        overhang: Math.round(overhang * 100) / 100,
        height: layout.h,
        turned: (way.up === 's' ? 0 : 2) + (way.rot ? 1 : 0),
        zone: ZONE_ORDER.indexOf(work.zone),
        x: work.x,
        id: work.id,
        row: placed.row,
        at: placed.on.join(','),
        index: spec.index ?? 0,
      },
      spot: isNew
        ? { kind: 'new-stack', zone: work.zone, x: work.x, up: way.up, rot: way.rot, text, warnings: fresh }
        : { kind: 'stack', target: { stackId: work.id, row: placed.row, on: [...placed.on], index: spec.index, up: way.up, rot: way.rot }, text, warnings: fresh },
    });
  }

  const isCurrent = (stId, spec, way) => current && current.stackId === stId && current.row === spec.row && sameSet(current.on, spec.on)
    && current.index === spec.index && current.up === way.up && current.rot === way.rot;

  // ---- on existing stacks: the shelf floor of each row, on top of each box, across neighbouring pairs
  for (const st of base.stacks) {
    const zone = ZONES[st.zone];
    if (!zone) continue;
    const { layout } = info(st);
    const lay = new Map(layout.boxes.map((b) => [b.gameId, b]));
    const sameSurface = (row, on) => st.boxes.filter((b) => (b.row ?? 0) === row && sameSet(b.on, on)).sort((a, b) => a.x - b.x);
    const surfaces = []; // { row, on, sibs, top } top = how high the surface is
    for (const row of st.boxes.length ? [0, 1] : [0]) surfaces.push({ row, on: [], top: 0, label: 'the shelf' });
    for (const b of st.boxes) surfaces.push({ row: b.row ?? 0, on: [b.game], top: lay.get(b.game).y + lay.get(b.game).h, label: title(b.game) });
    for (const row of [0, 1]) { // bridges: neighbours on one surface whose tops are level
      const groups = new Map();
      for (const b of st.boxes.filter((x) => (x.row ?? 0) === row)) groups.set([...b.on].sort().join(','), [...(groups.get([...b.on].sort().join(',')) ?? []), b]);
      for (const list of groups.values()) {
        list.sort((a, b) => a.x - b.x);
        for (let i = 1; i < list.length; i++) {
          const [a, c] = [lay.get(list[i - 1].game), lay.get(list[i].game)];
          if (Math.abs(a.y + a.h - (c.y + c.h)) <= BRIDGE_LEVEL + SLACK) {
            surfaces.push({ row, on: [a.gameId, c.gameId], top: Math.max(a.y + a.h, c.y + c.h), label: `${title(a.gameId)} and ${title(c.gameId)}`, bridge: true });
          }
        }
      }
    }
    for (const surf of surfaces) {
      const sibs = sameSurface(surf.row, surf.on);
      for (const way of ways) {
        if (surf.top + way.size.h > zone.height + SLACK) continue; // too tall for the shelf: always a block
        for (let index = 0; index <= sibs.length; index++) {
          const spec = { row: surf.row, on: surf.on, index };
          if (isCurrent(st.id, spec, way)) continue;
          tryAt(st, spec, way, false, (rows) => {
            const side = !sibs.length ? '' : index === 0 ? `left of ${title(sibs[0].game)}` : index === sibs.length ? `right of ${title(sibs[sibs.length - 1].game)}` : `between ${title(sibs[index - 1].game)} and ${title(sibs[index].game)}`;
            const where = surf.bridge ? `across ${surf.label}` : surf.on.length ? `on ${surf.label}` : 'on the shelf';
            return [zone.label, `stack ${st.id}`, rows > 1 || surf.row === 1 ? (surf.row === 0 ? 'front row' : 'back row') : null,
              side ? `${where}, ${side}` : where, how(way)].filter(Boolean).join(' · ');
          });
        }
      }
    }
  }

  // ---- a new stack at the left end of every free gap where the box fits
  for (const zone of Object.values(ZONES)) {
    const stacks = others(zone.id).map((o) => o).sort((a, b) => a.st.x - b.st.x);
    const gaps = [];
    let cursor = 0;
    for (const o of stacks) {
      if (o.st.x > cursor + SLACK) gaps.push([cursor, o.st.x]);
      cursor = Math.max(cursor, o.end);
    }
    gaps.push([cursor, zone.length + zone.overhang]);
    const id = nextStackId(base, zone.id);
    for (const way of ways) {
      if (way.size.h > zone.height + SLACK) continue;
      for (const [from, to] of gaps) {
        const xs = [from];
        // a gap that starts at a joint: 0.2 cm further on the stack clears the bracket
        for (const bx of zone.brackets) {
          const at = bx + BRACKET_HALF;
          if (from < at - SLACK && from + way.size.w > bx - BRACKET_HALF + SLACK && at + way.size.w <= to + SLACK) xs.push(at);
        }
        for (const x of xs) {
          if (x + way.size.w > to + SLACK) continue; // does not fit in the gap
          const at = Math.round(x * 100) / 100;
          tryAt({ id, zone: zone.id, x: at, boxes: [] }, { row: 0, on: [], index: 0 }, way, true,
            () => `${zone.label} · new stack at ${fmt(at)} cm${way.up === 's' && !way.rot ? '' : ` · ${how(way)}`}`);
        }
      }
    }
  }

  const order = ['warnings', 'hard', 'extra', 'isNew', 'overhang', 'height', 'turned', 'zone', 'x', 'id', 'row', 'at', 'index'];
  spots.sort((a, b) => {
    for (const k of order) {
      const [p, q] = [a.rank[k], b.rank[k]];
      if (p !== q) return typeof p === 'string' ? p.localeCompare(q, 'en', { numeric: true }) : p - q;
    }
    return 0;
  });
  return spots.slice(0, limit).map((s) => s.spot);
}
