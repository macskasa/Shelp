// Part B stack details tests (stories C3, B2.2 – schema 2). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { layoutStack2 } from '../js/core/geometry.js';
import { stackDetails, stackAriaLabel, restsOn } from '../js/map/details.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const byTitle = (t) => store.getGames().find((g) => g.title === t).id;
const details = (id, plan = store.getPlan2()) => {
  const st = plan.stacks.find((s) => s.id === id);
  return stackDetails(st, layoutStack2(st, getGame), getGame);
};
const titles = (row) => row.boxes.map((b) => b.title);

test('header facts: id, shelf, size (w × h from layoutStack2), game count, notes', () => {
  const d = details('B3');
  assert.deepEqual([d.id, d.shelf, d.size, d.count], ['B3', 'Bottom shelf', '24 × 27.7 cm', 5]);
  assert.deepEqual(d.tags, []);
  assert.deepEqual(d.notes, ['Compile and Kontroll side by side on top']);
});

test('a tree, top to bottom: each box says what it rests on', () => {
  const [row] = details('B3').rows;
  assert.equal(row.label, null);
  assert.deepEqual(titles(row), ['Compile: Main 2', 'Kontroll', 'Takenokolor', 'Legacy of Yu', "Let's Go! To Japan"]);
  assert.deepEqual(row.boxes.map((b) => b.rests), [
    'on Takenokolor', 'on Takenokolor', 'on Legacy of Yu', "on Let's Go! To Japan", 'on the shelf',
  ]);
});

test('a bridge says "across …" and is listed on top (store.preview, nothing saved)', () => {
  const [compile, kontroll, bridge] = ['Compile: Main 2', 'Kontroll', 'T.I.M.E Stories: Lumen Fidei'].map(byTitle);
  const { plan } = store.preview(() => store.placeBox(bridge, { stackId: 'B3', on: [compile, kontroll] }));
  const top = details('B3', plan).rows[0].boxes[0];
  assert.equal(top.gameId, bridge);
  assert.equal(top.rests, 'across Compile: Main 2 and Kontroll');
  assert.equal(details('B3', plan).count, 6);
});

test('topper, long side out and on its side', () => {
  const m4 = details('M4');
  assert.deepEqual(m4.tags, ['LEGO castle on top']);
  assert.equal(m4.size, '37.2 × 36 cm', 'height includes the castle');
  assert.deepEqual(m4.rows[0].boxes.find((b) => b.title === 'Ark Nova').flags, ['long side out']);
  const klask = details('T9').rows[0].boxes[0];
  assert.deepEqual([klask.rests, klask.flags], ['on the shelf', ['on its side']]);
});

test('two rows: front row first, then the back row, each top to bottom', () => {
  const d = details('T1');
  assert.deepEqual(d.tags, ['2 deep']);
  assert.deepEqual(d.rows.map((r) => r.label), ['Front row', 'Back row']);
  assert.equal(d.count, 13);
  assert.equal(d.rows[0].boxes.at(-1).rests, 'on the shelf');
  assert.ok(d.rows[0].boxes.every((b) => b.flags.includes('long side out')));
});

test('standing card games: all on the shelf, standing, left to right', () => {
  const d = details('L1');
  assert.deepEqual(d.tags, ['2 deep']);
  const front = d.rows[0].boxes;
  assert.ok(front.every((b) => b.rests === 'on the shelf' && b.flags.includes('standing')));
  const xs = front.map((b) => store.locate2(b.gameId).x);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), 'left to right');
});

test('an empty stack has no boxes', () => {
  const st = { id: 'E', zone: 'middle', x: 0, boxes: [] };
  const d = stackDetails(st, layoutStack2(st, getGame), getGame);
  assert.deepEqual([d.count, d.size, d.rows.length, d.rows[0].boxes.length], [0, '0 × 0 cm', 1, 0]);
});

test('restsOn and the accessible name', () => {
  const t = (id) => ({ a: 'Alpha', b: 'Beta' })[id];
  assert.equal(restsOn([], t), 'on the shelf');
  assert.equal(restsOn(['a'], t), 'on Alpha');
  assert.equal(restsOn(['a', 'b'], t), 'across Alpha and Beta');
  assert.equal(stackAriaLabel('B3', 'bottom', 5), 'Stack B3, Bottom shelf, 5 games');
  assert.equal(stackAriaLabel('T9', 'top', 1), 'Stack T9, Top shelf, 1 game');
});
