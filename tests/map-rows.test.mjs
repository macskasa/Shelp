// Part B back row tests (issue #47). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { buildScene, findInScene } from '../js/map/scene.js';
import { deepStackIds, rowForView, viewForLocation, VIEWS } from '../js/map/rows.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const plan = store.getPlan2();
const front = buildScene(plan, store.getGame);
const back = buildScene(plan, store.getGame, { view: 'back' });
const stackIn = (scene, id) => scene.stacks.find((s) => s.id === id);
const planStack = (id) => plan.stacks.find((s) => s.id === id);
const ids = (list) => list.map((b) => b.gameId).sort();

test('the 2-deep stacks of v5 are T1, B5, B6 and L1', () => {
  assert.deepEqual(deepStackIds(plan), ['T1', 'B5', 'B6', 'L1']);
  for (const id of ['T1', 'B5', 'B6', 'L1']) assert.equal(stackIn(front, id).deep, true);
  assert.equal(stackIn(front, 'B3').deep, false);
  assert.deepEqual(VIEWS, ['front', 'back']);
  assert.deepEqual([rowForView('front'), rowForView('back')], [0, 1]);
});

test('front view: front row drawn, no outlines', () => {
  for (const st of front.stacks) {
    assert.ok(st.boxes.every((b) => b.row === 0), st.id);
    assert.deepEqual(st.ghosts, []);
  }
  assert.equal(buildScene(plan, store.getGame, { view: 'front' }).stacks.length, front.stacks.length);
});

test('back view: 2-deep stacks draw the back row, the front row as outlines in the same place', () => {
  for (const id of deepStackIds(plan)) {
    const f = stackIn(front, id);
    const b = stackIn(back, id);
    const rows = (r) => planStack(id).boxes.filter((x) => x.row === r).map((x) => x.game).sort();
    assert.deepEqual(ids(b.boxes), rows(1), `${id} back row`);
    assert.ok(b.boxes.every((x) => x.row === 1));
    assert.deepEqual(b.ghosts, f.boxes.map(({ gameId, x, y, w, h }) => ({ gameId, x, y, w, h })), `${id} outlines`);
    assert.deepEqual(b.back, f.back);
    assert.deepEqual([b.x, b.w, b.h, b.top], [f.x, f.w, f.h, f.top]);
  }
});

test('back view: other stacks look the same', () => {
  for (const f of front.stacks.filter((s) => !s.deep)) {
    const b = stackIn(back, f.id);
    assert.deepEqual(b.boxes, f.boxes, f.id);
    assert.deepEqual(b.ghosts, []);
    assert.deepEqual(b.topper, f.topper);
  }
});

test('findInScene: a back-row game has its box in the back view only', () => {
  const g = planStack('T1').boxes.find((b) => b.row === 1).game;
  assert.equal(findInScene(front, g).box, null);
  assert.equal(findInScene(back, g).stack.id, 'T1');
  assert.equal(findInScene(back, g).box.gameId, g);
  const f = planStack('B5').boxes.find((b) => b.row === 0).game;
  assert.equal(findInScene(back, f).stack.id, 'B5');
  assert.equal(findInScene(back, f).box, null);
  const single = planStack('B3').boxes[0].game;
  assert.equal(findInScene(back, single).box.gameId, single);
});

test('?game= view: back row → back, front row of a 2-deep stack → front, else keep the view', () => {
  const at = (r, id = 'B6') => store.locate2(planStack(id).boxes.find((b) => b.row === r).game);
  assert.equal(viewForLocation(at(1)), 'back');
  assert.equal(viewForLocation(at(1, 'L1')), 'back');
  assert.equal(viewForLocation(at(0)), 'front');
  assert.equal(viewForLocation(store.locate2(planStack('B3').boxes[0].game)), null);
  // an expansion stored inside a back-row box opens the back view too
  const [inner] = Object.entries(plan.inside).find(([, host]) => store.locate2(host).row === 1);
  assert.equal(viewForLocation(store.locate2(inner)), 'back');
  assert.equal(viewForLocation(store.locate2(seed.plan.cupboard[0].game)), null);
  assert.equal(viewForLocation(null), null);
});
