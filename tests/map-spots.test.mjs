// Part B spots, orientations and new problems (B2.3, reused in Phase C). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { spotChoices, orientationChoices, moveFn, newProblems, defaultSpot } from '../js/map/spots.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const byTitle = (t) => store.getGames().find((g) => g.title === t).id;
const spotsOf = (id, opts) => spotChoices(store.getStack2(id), getGame, opts);
const labels = (spots, kind) => spots.filter((s) => s.kind === kind).map((s) => s.label);

test('orientations: a pizza game lies flat (2 ways), others up to 6, equal sizes shown once', () => {
  const ark = orientationChoices(getGame(byTitle('Ark Nova'))); // pizza, 7 × 30 × 37
  assert.deepEqual(ark.map((o) => [o.up, o.rot, o.size]), [
    ['s', false, '30 along × 37 deep × 7 high'],
    ['s', true, '37 along × 30 deep × 7 high'],
  ]);
  const klask = orientationChoices(getGame(byTitle('KLASK'))); // not pizza, 15 × 37 × 46
  assert.equal(klask.length, 6);
  assert.deepEqual(klask.map((o) => o.label), [
    'Flat', 'Flat, long side out', 'On its side', 'On its side, long side out', 'Standing', 'Standing, long side out',
  ]);
  const square = orientationChoices(getGame(byTitle('T.I.M.E Stories: Lumen Fidei'))); // 20.6 × 20.6 × 4
  assert.equal(square.length, 1, 'turning a square box changes nothing');
  assert.deepEqual(orientationChoices({ dims: null }), []);
});

test('spots on B3: the shelf, on top of each box, across Compile and Kontroll, under a box or the level', () => {
  const spots = spotsOf('B3');
  assert.deepEqual(labels(spots, 'shelf'), ["On the shelf, left of Let's Go! To Japan", "On the shelf, right of Let's Go! To Japan"]);
  const on = labels(spots, 'on');
  assert.ok(on.includes('On top of Compile: Main 2'));
  assert.ok(on.includes('On top of Takenokolor, left of Compile: Main 2'));
  assert.ok(on.includes('On top of Takenokolor, right of Kontroll'));
  assert.deepEqual(labels(spots, 'across'), ['Across Compile: Main 2 and Kontroll']);
  const under = labels(spots, 'under');
  assert.ok(under.includes('Under Takenokolor'));
  assert.ok(under.includes('Under Compile: Main 2 + Kontroll'));
  assert.equal(new Set(spots.map((s) => s.key)).size, spots.length, 'keys are unique');
  assert.match(spots[defaultSpot(spots)].label, /^On top of (Compile: Main 2|Kontroll)$/, 'default: on top of the highest free box');
});

test('across is offered only when the two tops are level within 0.5 cm', () => {
  const games = { a: { title: 'A', dims: [5, 20, 30] }, b: { title: 'B', dims: [5.4, 20, 30] }, c: { title: 'C', dims: [6, 20, 30] } };
  const g = (id) => games[id];
  const st = (b2) => ({ id: 'X', zone: 'bottom', x: 0, boxes: [
    { game: 'a', row: 0, x: 0, up: 's', rot: false, on: [] },
    { game: b2, row: 0, x: 20, up: 's', rot: false, on: [] },
  ] });
  assert.deepEqual(labels(spotChoices(st('b'), g), 'across'), ['Across A and B'], '0.4 cm apart');
  assert.deepEqual(labels(spotChoices(st('c'), g), 'across'), [], '1 cm apart would tilt');
  const empty = spotChoices({ id: 'E', zone: 'middle', x: 0, boxes: [] }, g);
  assert.deepEqual(empty.map((s) => s.label), ['On the shelf']);
});

test('a clean placement: Lumen Fidei on top of M3 adds no problems; Undo restores the plan exactly', () => {
  const id = byTitle('T.I.M.E Stories: Lumen Fidei');
  const spots = spotsOf('M3');
  const spot = spots[defaultSpot(spots)];
  const fn = moveFn(store, id, spot, orientationChoices(getGame(id))[0]);
  const p = store.preview(fn);
  assert.equal(p.error, null);
  assert.deepEqual(newProblems(store.getPlan2(), p.plan, getGame), { block: [], warn: [] });
  const before = JSON.stringify(store.exportData().plan);
  fn();
  assert.equal(store.locate2(id).stackId, 'M3');
  store.undo();
  assert.equal(JSON.stringify(store.exportData().plan), before, 'one undo step puts it back exactly');
});

test('new problems only: a block is new, problems that were there before do not count', () => {
  const big = byTitle('Carcassonne Big Box 7'); // 43.5 cm, from the cupboard
  const shelf = spotsOf('T2').find((s) => s.kind === 'shelf');
  const p = store.preview(moveFn(store, big, shelf));
  const { block } = newProblems(store.getPlan2(), p.plan, getGame);
  assert.ok(block.some((w) => w.rule === 'overlap'), block.map((w) => w.rule).join(','));
  // compared with a plan that already has that problem, it is not new
  assert.deepEqual(newProblems(p.plan, p.plan, getGame), { block: [], warn: [] });
});

test('the store refuses: a pizza game standing, and the error comes back from preview', () => {
  const ark = byTitle('Ark Nova');
  const spot = spotsOf('B3').find((s) => s.kind === 'shelf');
  const p = store.preview(moveFn(store, ark, spot, { up: 'l', rot: false }));
  assert.ok(p.error instanceof Error);
  assert.equal(p.plan, null);
  assert.equal(store.locate2(ark).stackId, 'M4', 'nothing changed');
});

test('under: the game takes the place and the boxes rest on it', () => {
  const id = byTitle('T.I.M.E Stories: Lumen Fidei');
  const spot = spotsOf('B3').find((s) => s.label === 'Under Compile: Main 2 + Kontroll');
  const p = store.preview(moveFn(store, id, spot));
  assert.equal(p.error, null);
  const b3 = p.plan.stacks.find((s) => s.id === 'B3');
  const onIt = b3.boxes.filter((b) => b.on.includes(id)).map((b) => getGame(b.game).title).sort();
  assert.deepEqual(onIt, ['Compile: Main 2', 'Kontroll']);
});

test('newProblems keys a family warning by its name, not its stack (it follows the first member)', () => {
  const fam = (stackId) => ({ rule: 'family', family: 'Azul', stackId, stackIds: [stackId, 'B7'], gameId: null, otherStackId: null, severity: 'warn' });
  const fake = (plan) => plan.warnings;
  const np = newProblems({ warnings: [fam('B2')] }, { warnings: [fam('B1')] }, null, fake);
  assert.deepEqual(np, { block: [], warn: [] }, 'the same family, now first on another stack: not new');
  assert.equal(newProblems({ warnings: [] }, { warnings: [fam('B1')] }, null, fake).warn.length, 1);
});
