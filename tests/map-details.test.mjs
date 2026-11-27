// Part B stack details tests (story C3). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutStack } from '../js/map/model.js';
import { stackDetails, stackAriaLabel, gameCount } from '../js/map/details.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const games = new Map(seed.games.map((g) => [g.id, g]));
const getGame = (id) => games.get(id);
const stack = (id) => seed.plan.stacks.find((s) => s.id === id);
const details = (id) => stackDetails(stack(id), layoutStack(stack(id), getGame), getGame);
const titles = (row) => row.boxes.map((b) => b.title);

test('header facts: id, shelf, size (w × h from the model), game count', () => {
  const d = details('B3');
  assert.equal(d.id, 'B3');
  assert.equal(d.shelf, 'Bottom shelf');
  assert.equal(d.size, '24 × 27.7 cm');
  assert.equal(d.count, 5);
  assert.deepEqual(d.tags, []);
  assert.deepEqual(d.notes, ['Compile and Kontroll side by side on top']);
});

test('flat stack: boxes top to bottom, a side-by-side level keeps its order', () => {
  const d = details('B3');
  assert.equal(d.rows.length, 1);
  assert.equal(d.rows[0].label, null);
  assert.equal(d.rows[0].order, 'top to bottom');
  assert.deepEqual(titles(d.rows[0]), ['Compile: Main 2', 'Kontroll', 'Takenokolor', 'Legacy of Yu', "Let's Go! To Japan"]);
  assert.deepEqual(d.rows[0].boxes[0].flags, ['side by side']);
  assert.deepEqual(d.rows[0].boxes[1].flags, ['side by side']);
  assert.deepEqual(d.rows[0].boxes[2].flags, []);
});

test('topper and long side out: M4 with the LEGO castle and Ark Nova turned', () => {
  const d = details('M4');
  assert.deepEqual(d.tags, ['LEGO castle on top']);
  assert.equal(d.size, '37.2 × 36 cm', 'height includes the castle');
  const [ark, deluxe] = d.rows[0].boxes;
  assert.equal(ark.title, 'Ark Nova');
  assert.deepEqual(ark.flags, ['long side out']);
  assert.equal(ark.size, '37 × 30 × 7 cm');
  assert.equal(deluxe.title, 'Tokaido: Deluxe Edition');
});

test('two rows: front row first, then the back row, each top to bottom', () => {
  const d = details('T1');
  assert.deepEqual(d.tags, ['2 deep']);
  assert.deepEqual(d.rows.map((r) => r.label), ['Front row', 'Back row']);
  const front = stack('T1').rows[0].map((it) => getGame(it.game).title).reverse();
  const back = stack('T1').rows[1].map((it) => getGame(it.game).title).reverse();
  assert.deepEqual(titles(d.rows[0]), front);
  assert.deepEqual(titles(d.rows[1]), back);
  assert.ok(d.rows[0].boxes.every((b) => b.flags.includes('long side out')));
  assert.equal(d.count, 13);
});

test('standing stacks list left to right', () => {
  const d = details('L1');
  assert.deepEqual(d.tags, ['2 deep', 'standing']);
  assert.equal(d.rows[0].order, 'left to right');
  assert.deepEqual(titles(d.rows[0]), stack('L1').rows[0].map((it) => getGame(it.game).title));
  assert.deepEqual(details('T9').tags, ['standing']);
});

test('categories and a missing size come through', () => {
  const st = { id: 'X', zone: 'narrow', x: 0, orientation: 'flat', rows: [[{ game: 'a' }]] };
  const g = { a: { title: 'Mystery', dims: null, categories: ['duo', 'coop'] } };
  const d = stackDetails(st, layoutStack(st, (id) => g[id]), (id) => g[id]);
  assert.deepEqual(d.rows[0].boxes[0], { gameId: 'a', title: 'Mystery', categories: ['duo', 'coop'], size: 'size missing', flags: [] });
  assert.equal(d.shelf, 'Narrow shelf');
});

test('an empty stack has no boxes', () => {
  const st = { id: 'E', zone: 'middle', x: 0, orientation: 'flat', rows: [[]] };
  const d = stackDetails(st, layoutStack(st, getGame), getGame);
  assert.deepEqual(d.rows[0].boxes, []);
  assert.equal(d.count, 0);
  assert.equal(d.size, '0 × 0 cm');
});

test('accessible names count every game', () => {
  assert.equal(stackAriaLabel(stack('B3')), 'Stack B3, Bottom shelf, 5 games');
  assert.equal(stackAriaLabel(stack('T9')), 'Stack T9, Top shelf, 1 game');
  assert.equal(gameCount(stack('L1')), 18);
});
