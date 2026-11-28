// Pushing the wall-end stacks to the wall (#100): wallPush in js/core/space.js and store.pushToWall.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freeSpace, wallPush } from '../js/core/space.js';
import * as store from '../js/core/store.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const byId = new Map(seed.games.map((g) => [g.id, g]));
const getGame = (id) => byId.get(id);

// a hand-made middle shelf: 'a' is 20 wide, the others 30 wide and 8 cm high; all 30 deep
const games = new Map(['a', 'b', 'c', 't1', 't2', 't3', 't4'].map((id) => [id, { id, dims: id === 'a' ? [10, 20, 30] : [8, 30, 30] }]));
const pile = (id, x, ids) => ({
  id, zone: 'middle', x, boxes: ids.map((g, i) => ({ game: g, row: 0, x: 0, up: 's', rot: false, on: i ? [ids[i - 1]] : [] })),
});
const push = (stacks) => wallPush({ stacks }, (id) => games.get(id), 'middle');

test('wallPush on the seed: the middle and bottom wall ends move up to the 8 cm overhang', () => {
  assert.deepEqual(wallPush(seed.plan, getGame, 'middle'), {
    zone: 'middle', moves: [{ stackId: 'M7', from: 182.9, to: 185.4 }, { stackId: 'M6', from: 152.4, to: 154.9 }],
    gap: { x: 152.4, w: 2.5 }, gain: 2.5, // M5 crosses the joint and stays: the gap opens right of it
  });
  const bottom = wallPush(seed.plan, getGame, 'bottom');
  assert.deepEqual(bottom.moves.map((m) => [m.stackId, m.to]), [['B8', 178], ['B7', 148.3]]);
  assert.deepEqual([bottom.gap, bottom.gain], [{ x: 144.5, w: 3.8 }, 3.8]);
  assert.equal(wallPush(seed.plan, getGame, 'top'), null); // KLASK is at 208 already; T8 could gain only 0.3
  assert.equal(wallPush(seed.plan, getGame, 'narrow'), null); // wall shelves only
});

test('wallPush: a low stack crosses the bracket at 200, a tall one stops in front of it', () => {
  const low = push([pile('M1', 141, ['a']), pile('M2', 175, ['b', 'c'])]);
  assert.deepEqual(low.moves, [{ stackId: 'M2', from: 175, to: 178 }, { stackId: 'M1', from: 141, to: 158 }]);
  assert.deepEqual([low.gap, low.gain], [{ x: 140, w: 18 }, 17]);
  const tall = push([pile('M1', 141, ['a']), pile('M2', 165, ['t1', 't2', 't3', 't4'])]); // 32 cm: too high for the bracket
  assert.deepEqual(tall.moves.map((m) => [m.stackId, m.to]), [['M2', 169.8], ['M1', 149.8]]);
  assert.equal(push([pile('M2', 178, ['b'])]), null); // already at the wall
  assert.equal(push([]), null);
});

test('freeSpace: push only on the wall-end units of the wall shelves', () => {
  const list = freeSpace(seed.plan, getGame);
  assert.deepEqual(list.filter((u) => u.push).map((u) => u.id), ['middle-3', 'bottom-3']);
  assert.equal(list.find((u) => u.id === 'middle-3').push.gain, 2.5);
});

test('store.pushToWall: one undo step, refuses when nothing moves', async () => {
  const m = new Map();
  await store.init({ seed, storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } });
  const before = store.exportData().plan;
  assert.equal(store.pushToWall('middle').gain, 2.5);
  assert.deepEqual(['M5', 'M6', 'M7'].map((id) => store.getStack2(id).x), [122.9, 154.9, 185.4]);
  assert.throws(() => store.pushToWall('middle'), /middle shelf are as close to the wall/);
  assert.throws(() => store.pushToWall('top'), /top shelf/);
  store.undo();
  assert.deepEqual(store.exportData().plan, before);
});
