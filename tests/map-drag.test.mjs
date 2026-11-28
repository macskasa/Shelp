// Part B drag and drop on desktop (part-b3 item 6). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { layoutStack2 } from '../js/core/geometry.js';
import { buildScene } from '../js/map/scene.js';
import { spotChoices } from '../js/map/spots.js';
import { sortSpots } from '../js/map/working.js';
import {
  DRAG_SLOP, canStartDrag, pastSlop, drawnRow, dropTarget, stackLocal, spotAnchors, nearestSpot, ghostRect,
  dropChoice, dragNote, probeStack, aimStack, probeEmpty, aimEmpty,
} from '../js/map/drag.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const small = store.addGame({ title: 'Tiny Drag Game', dims: [4, 12, 15], pizza: true });
const huge = store.addGame({ title: 'Huge Drag Game', dims: [40, 60, 60], pizza: false });

// a small stack of its own: A and B side by side on the shelf, C on A
const fake = {
  a: { id: 'a', title: 'A', dims: [30, 30, 7] },
  b: { id: 'b', title: 'B', dims: [30, 30, 7] },
  c: { id: 'c', title: 'C', dims: [20, 20, 5] },
};
const getFake = (id) => fake[id];
const stack = {
  id: 'T1', zone: 'bottom', x: 10,
  boxes: [{ game: 'a', x: 0, on: [], up: 's' }, { game: 'b', x: 30, on: [], up: 's' }, { game: 'c', x: 5, on: ['a'], up: 's' }],
};
const lay = layoutStack2(stack, getFake);
const spots = spotChoices(stack, getFake);
const at = (p) => spots[nearestSpot(spots, lay, p)]?.key;

test('only a left mouse press drags, and only past the slop', () => {
  assert.equal(canStartDrag({ pointerType: 'mouse', button: 0 }), true);
  assert.equal(canStartDrag({ pointerType: 'mouse', button: 2 }), false, 'right button');
  assert.equal(canStartDrag({ pointerType: 'touch', button: 0 }), false, 'touch keeps tapping');
  assert.equal(canStartDrag({ pointerType: 'pen', button: 0 }), false, 'the pen keeps tapping');
  assert.equal(canStartDrag(null), false);
  assert.equal(pastSlop({ x: 0, y: 0 }, { x: DRAG_SLOP, y: 0 }), false, 'a click that wobbles stays a click');
  assert.equal(pastSlop({ x: 0, y: 0 }, { x: 3, y: 4 }), true);
});

test('anchors: shelf gaps on the floor, on top above the box, under in its lower part', () => {
  const a = spotAnchors(spots, lay);
  assert.deepEqual(a.get('shelf:0'), { x: 0, y: 1 });
  assert.deepEqual(a.get('shelf:1'), { x: 30, y: 1 });
  assert.deepEqual(a.get('shelf:2'), { x: 60, y: 1 });
  assert.deepEqual(a.get('on:b:0'), { x: 45, y: 8 });
  assert.equal(a.get('on:c:0').y, 13);
  assert.equal(a.get('under:a').y, 7 / 4);
  for (const s of spots) assert.ok(a.has(s.key), `${s.key} has an anchor`);
});

test('the spot under the pointer: nearest anchor', () => {
  assert.equal(at({ x: 45, y: 9 }), 'on:b:0', 'just over B');
  assert.equal(at({ x: 45, y: 6 }), 'on:b:0', 'upper part of B');
  assert.equal(at({ x: 45, y: 1.5 }), 'under:b', 'lower part of B');
  assert.equal(at({ x: 62, y: 2 }), 'shelf:2', 'right of B, on the floor');
  assert.equal(at({ x: -2, y: 1 }), 'shelf:0', 'left of A');
  assert.equal(at({ x: 15, y: 14 }), 'on:c:0', 'over C');
  assert.equal(nearestSpot([], lay, { x: 0, y: 0 }), -1);
  // an empty stack: only "On the shelf"
  const empty = { id: 'T2', zone: 'bottom', x: 0, boxes: [] };
  const es = spotChoices(empty, getFake);
  assert.equal(es[nearestSpot(es, layoutStack2(empty, getFake), { x: 10, y: 20 })].key, 'shelf:0');
});

test('the outline sits where the box would go', () => {
  const by = (k) => spots.find((s) => s.key === k);
  assert.deepEqual(ghostRect(by('on:b:0'), lay, { w: 10, h: 4 }), { x: 40, y: 7, w: 10, h: 4 });
  assert.deepEqual(ghostRect(by('shelf:2'), lay, { w: 10, h: 4 }), { x: 60, y: 0, w: 10, h: 4 });
  assert.deepEqual(ghostRect(by('shelf:0'), lay, { w: 10, h: 4 }), { x: -10, y: 0, w: 10, h: 4 }, 'left of the first box');
  assert.deepEqual(ghostRect(by('under:b'), lay, { w: 10, h: 4 }), { x: 30, y: 0, w: 10, h: 4 });
});

test('stack-local points and the drawn row', () => {
  assert.deepEqual(stackLocal({ x: 13, floor: 100 }, { x: 20, y: 90 }), { x: 7, y: 10 });
  assert.equal(drawnRow({ deep: true }, 'back'), 1);
  assert.equal(drawnRow({ deep: true }, 'front'), 0);
  assert.equal(drawnRow({ deep: false }, 'back'), 0);
});

test('dropChoice: a working spot is chosen; a blocked one names its reason and the sheet chooses', () => {
  const st = store.getPlan2().stacks.find((s) => s.id === 'M2');
  const sp = spotChoices(st, store.getGame);
  const ok = probeStack(store, small, 'M2', 0);
  const good = ok.checks.findIndex((c) => c.best);
  assert.deepEqual(dropChoice(ok.spots, ok.checks, good, 'M2'), { keep: good, blocked: null });
  const bad = ok.checks.findIndex((c) => !c.best);
  const d = dropChoice(ok.spots, ok.checks, bad, 'M2');
  assert.equal(d.keep, -1);
  assert.equal(d.blocked.key, sp[bad].key);
  assert.ok(d.blocked.reason);
  // the sheet's list with keep: the dropped spot first; blocked: it stays in the blocked list
  assert.equal(sortSpots(ok.spots, ok.checks, { keep: good }).working[0].i, good);
  assert.ok(sortSpots(ok.spots, ok.checks, { keep: d.keep }).blocked.some((x) => x.spot.key === d.blocked.key));
  assert.deepEqual(dropChoice(ok.spots, ok.checks, -1), { keep: -1, blocked: null });
  assert.equal(dragNote('On top of A'), 'On top of A');
  assert.equal(dragNote('On top of A', 'Too tall for the shelf here'), 'On top of A – Too tall for the shelf here');
});

test('dragging over a real stack: spot, outline in the drawing, works or not', () => {
  const scene = buildScene(store.getPlan2(), store.getGame);
  const st = scene.stacks.find((s) => s.id === 'M2');
  const pt = { x: st.x + st.w / 2, y: st.top + 1 }; // just under the top of the pile
  assert.deepEqual(dropTarget(scene, pt, 2), { kind: 'stack', stackId: 'M2', row: 0 });
  const hugeAim = aimStack(probeStack(store, huge, 'M2', 0), store.getGame(huge), stackLocal(st, pt));
  assert.equal(hugeAim.works, false, 'the huge game fits nowhere on M2');
  assert.match(hugeAim.note, / – /, 'the note gives the reason');
  // a box already on the stack: its spots come from the stack without it
  const own = st.boxes[0].gameId;
  const p = probeStack(store, own, 'M2', 0);
  assert.ok(p.spots.every((s) => !s.label.includes(store.getGame(own).title)), 'no spot names the dragged game');
  assert.equal(probeStack(store, small, 'nope', 0), null);
});

test('dragging over empty shelf: the new stack x, its check and outline', () => {
  // make room: the seed's shelves are full (its games go to the board)
  for (const id of ['B1', 'B2', 'B3']) if (store.getPlan2().stacks.some((s) => s.id === id)) store.removeStack(id);
  const scene = buildScene(store.getPlan2(), store.getGame);
  // the widest free stretch of shelf
  let hit = null;
  let z = null;
  let best = 0;
  for (const zone of scene.zones) {
    let run = 0;
    for (let x = zone.x + 0.5; x < zone.x + zone.length; x += 0.5) {
      const t = dropTarget(scene, { x, y: zone.floor - 1 }, 2);
      run = t?.kind === 'empty' ? run + 0.5 : 0;
      if (run > best) [best, hit, z] = [run, dropTarget(scene, { x: x - run / 2, y: zone.floor - 1 }, 2), zone];
    }
  }
  assert.ok(hit?.kind === 'empty' && best > 20, `some empty shelf (${best} cm)`);
  const p = probeEmpty(store, small, hit.zone, hit.x);
  assert.equal(p.works, true);
  const a = aimEmpty(p, scene);
  assert.match(a.note, /^New stack here · /);
  assert.equal(a.rect.y + a.rect.h, z.floor, 'the outline stands on the shelf');
  const no = probeEmpty(store, huge, hit.zone, hit.x);
  assert.equal(no.works, false);
  assert.ok(no.reason);
  assert.match(aimEmpty(no, scene).note, / – /);
});
