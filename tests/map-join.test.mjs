// Part B: join two stacks and the bridge across two tops whose open edges meet (part-b6).
// Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { checkSpots } from '../js/rules/index.js';
import { joinNeighbours, joinText, joinFn } from '../js/map/join.js';
import { spotChoices, openEdgePairs } from '../js/map/spots.js';
import { checkMove } from '../js/map/stacks.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const byTitle = (t) => store.getGames().find((g) => g.title === t).id;
const ACROSS = 'Across Csúcstámadás (Peaks) and SETI: Space Agencies';
const acrossOf = (id) => spotChoices(store.getStack2(id), store.getGame).filter((s) => s.kind === 'across').map((s) => s.label);

test('joinNeighbours: the stacks right next to it on its shelf', () => {
  const plan = store.getPlan2();
  assert.deepEqual(joinNeighbours(plan, 'M1'), { left: null, right: 'M2' });
  assert.deepEqual(joinNeighbours(plan, 'M2'), { left: 'M1', right: 'M3' });
  assert.deepEqual(joinNeighbours(plan, 'nope'), { left: null, right: null });
  const last = plan.stacks.filter((s) => s.zone === 'middle').sort((a, b) => b.x - a.x)[0].id;
  assert.equal(joinNeighbours(plan, last).right, null, 'the last stack has no right neighbour');
});

test('joinText: the left stack keeps its id, whichever was tapped', () => {
  const t = joinText(store.getPlan2(), 'M2', 'M1');
  assert.equal(t.title, 'Join M1 and M2?');
  assert.equal(t.text, 'They become one stack, M1. Every box stays where it is, and you can then put a box across both tops.');
  assert.equal(t.done, 'Joined M2 into M1');
  assert.deepEqual(joinText(store.getPlan2(), 'M1', 'M2'), t);
});

test('refusals show the store message and change nothing: a topper, a stack between', () => {
  const before = JSON.stringify(store.exportData().plan);
  const topper = checkMove(store, joinFn(store, 'M3', 'M4'), 'Join');
  assert.match(topper.error.message, /topper/);
  assert.equal(topper.button.disabled, true);
  store.createStack('middle', { x: 33 });
  const between = checkMove(store, joinFn(store, 'M1', 'M2'), 'Join');
  assert.match(between.error.message, /is between M1 and M2/);
  store.undo();
  assert.equal(JSON.stringify(store.exportData().plan), before);
});

test('a plan like Adam\'s: after joining M1 and M2 the spot sheet offers the bridge, checkSpots has a best way; Undo restores', () => {
  // M1's pile at 10–39.7 cm (Csúcstámadás is 29.7 wide), M2 at 40.2, nothing on SETI: Space Agencies
  const peaks = byTitle('Csúcstámadás (Peaks)');
  const seti = byTitle('SETI: Space Agencies');
  const royal = byTitle('Port Royal');
  store.moveStack('M1', 10);
  store.moveToBoard(royal);
  assert.ok(!acrossOf('M1').includes(ACROSS) && !acrossOf('M2').includes(ACROSS), 'not across two stacks');

  const before = JSON.stringify(store.exportData().plan);
  const c = checkMove(store, joinFn(store, 'M1', 'M2'), 'Join');
  assert.equal(c.error, null);
  assert.deepEqual([c.block.length, c.warn.length], [0, 0], 'joining adds no problems');
  assert.equal(c.button.label, 'Join');
  assert.equal(JSON.stringify(store.exportData().plan), before, 'the preview changes nothing');

  assert.equal(store.joinStacks('M1', 'M2'), 'M1');
  const spots = spotChoices(store.getStack2('M1'), store.getGame);
  const spot = spots.find((s) => s.label === ACROSS);
  assert.ok(spot, 'the across spot is listed');
  assert.deepEqual(spot.run.target.on, [peaks, seti]);
  const checked = checkSpots(store.getPlan2(), store.getGames(), royal, spots.map((s) => s.run));
  const best = checked[spots.indexOf(spot)].best;
  assert.ok(best, 'Port Royal fits across: checkSpots gives a best way');
  assert.equal(best.block.length, 0);
  // placed there, it sits on the open strip, right of Műgyűjtők társasága (Tony's insertOn fix, #95)
  const p = store.preview(() => store.placeBox(royal, { ...spot.run.target, up: best.up, rot: best.rot }));
  const placed = p.plan.stacks.find((s) => s.id === 'M1').boxes.find((b) => b.game === royal);
  const art = store.getStack2('M1').boxes.find((b) => b.game === byTitle('Műgyűjtők társasága'));
  assert.ok(placed.x >= art.x + 26.9 - 0.01, `starts at ${placed.x}`);

  store.undo();
  assert.equal(JSON.stringify(store.exportData().plan), before, 'Undo restores the plan exactly');
  store.undo();
  store.undo();
});

test('openEdgePairs: meeting edges, level tops and an open strip on each', () => {
  const box = (id, x, w, y, h, on = []) => ({ gameId: id, row: 0, x, w, y, h, on });
  const a = box('a', 0, 30, 0, 7);
  const b = box('b', 30.4, 20, 0, 7.3);
  const ids = (pairs) => pairs.map(([p, q]) => `${p.gameId}+${q.gameId}`);
  assert.deepEqual(ids(openEdgePairs([a, b])), ['a+b']);
  assert.deepEqual(ids(openEdgePairs([a, box('b', 30.6, 20, 0, 7)])), [], 'more than 0.5 cm apart');
  assert.deepEqual(ids(openEdgePairs([a, box('b', 30, 20, 0, 7.6)])), [], 'tops 0.6 cm apart');
  assert.deepEqual(ids(openEdgePairs([a, b, box('c', 0, 27, 7, 4, ['a'])])), ['a+b'], 'a box on A ends 3 cm before the edge');
  assert.deepEqual(ids(openEdgePairs([a, b, box('c', 0, 29, 7, 4, ['a'])])), [], 'only 1 cm of A open');
  assert.deepEqual(ids(openEdgePairs([a, b, box('c', 30.4, 10, 7.3, 4, ['b'])])), [], 'B\'s left edge is covered');
});
