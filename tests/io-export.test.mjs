// CSV export of the catalog and the shelf plan. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { parseCsv } from '../js/io/csv.js';
import {
  CATALOG_HEADER, PLAN_HEADER, catalogFileName, catalogRows, planFileName, planRows, sizeText, toCsv,
} from '../js/io/export.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const fresh = () => store.init({ seed, storage: memoryStorage() });
const catalog = () => catalogRows(store.getGames(), store.locate2);
const plan = () => planRows(store.getGames(), store.getPlan2());
const col = (header, name) => header.indexOf(name);
const find = (rows, title, c = 0) => rows.find((r) => r[c] === title);

test('toCsv: BOM, comma separated, quotes only where needed, \\r\\n line ends', () => {
  const text = toCsv([['a', 'b,c', 'say "hi"'], ['line1\nline2', '', null]]);
  assert.equal(text, '﻿a,"b,c","say ""hi"""\r\n"line1\nline2",,\r\n');
  assert.equal(text.charCodeAt(0), 0xfeff);
});

test('toCsv and parseCsv give back the same cells, accents and symbols included', () => {
  const rows = [['Jégvarázs „Elsa”', '2–4', '30.5 × 22.6 × 5.1'], ['a "quoted", comma', 'two\r\nlines', '']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test('file names use the local date', () => {
  const d = new Date(2026, 10, 27, 0, 41);
  assert.equal(catalogFileName(d), 'shelp-catalog-2026-11-27.csv');
  assert.equal(planFileName(d), 'shelp-plan-2026-11-27.csv');
});

test('sizeText: largest first, no unit, empty when missing', () => {
  assert.equal(sizeText([5.1, 22.6, 30.5]), '30.5 × 22.6 × 5.1');
  assert.equal(sizeText([7, 30, 37]), '37 × 30 × 7');
  assert.equal(sizeText(null), '');
});

test('catalog: the columns of the workbook, one row per game, sorted by title', async () => {
  await fresh();
  const rows = catalog();
  assert.deepEqual(rows[0], ['Title', 'BGG', 'Box size (cm)', 'Players', 'Play time (min)', 'Age', 'BGG name', 'Type', 'Location', 'Box size from', 'In BGG collection', 'Notes']);
  assert.deepEqual(rows[0], CATALOG_HEADER);
  assert.equal(rows.length - 1, 204);
  assert.deepEqual(rows.slice(1).map((r) => r[0]), store.getGames().map((g) => g.title));
  assert.ok(rows.every((r) => r.length === 12));
});

test('catalog: values', async () => {
  await fresh();
  const rows = catalog();
  const lairs = find(rows, 'Lairs');
  assert.equal(lairs[1], 'https://boardgamegeek.com/boardgame/404883');
  assert.equal(lairs[2], '29.5 × 21.5 × 5.2');
  assert.equal(lairs[3], '2');
  assert.equal(lairs[4], '30–60');
  assert.equal(lairs[5], '8+');
  assert.equal(lairs[7], 'Base');
  assert.match(lairs[8], /^Bottom shelf · stack B4/);
  assert.equal(lairs[10], 'Yes');

  const zero = find(rows, 'Lairs: Box Zero');
  assert.equal(zero[2], '', 'missing size is empty');
  assert.equal(zero[7], 'Expansion');
  assert.match(zero[8], /^Inside the Lairs box \(Bottom shelf/);

  const ethiq = find(rows, 'Ethiq: Morális játszmák');
  assert.equal(ethiq[1], '', 'no BGG id, no link');
  assert.equal(ethiq[10], 'No');
  assert.equal(ethiq[11], 'not in your BGG list');
});

test('acceptance: the plan file has exactly 204 rows, every game once', async () => {
  await fresh();
  const rows = plan();
  assert.deepEqual(rows[0], PLAN_HEADER);
  assert.deepEqual(rows[0], ['Shelf', 'Spot', 'Stack (left → right)', 'Level / position (1 = bottom)', 'Row / pile', 'Game', 'Box size (cm)', 'Categories', 'Notes']);
  const body = rows.slice(1);
  assert.equal(body.length, 204);
  assert.ok(body.every((r) => r.length === 9));
  assert.deepEqual(body.map((r) => r[5]).sort(), store.getGames().map((g) => g.title).sort());
});

test('plan: order is shelf by shelf, left to right, then cupboard', async () => {
  await fresh();
  const body = plan().slice(1);
  const stackOrder = [...new Set(body.map((r) => r[2]).filter(Boolean))];
  assert.deepEqual(stackOrder.slice(0, 9), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9']);
  assert.deepEqual(stackOrder.slice(9, 16), ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
  assert.deepEqual(stackOrder.slice(16, 24), ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']);
  assert.deepEqual(stackOrder.slice(24), ['L1', 'U1', 'U2', 'S1', 'N1', 'N2', 'N3', 'N4', 'N5']);
  const cupboardAt = body.findIndex((r) => r[0] === 'Cupboard');
  assert.ok(body.slice(cupboardAt).every((r) => r[0] === 'Cupboard' || r[4] === 'inside the base box'));
  assert.equal(body.filter((r) => r[0] === 'Cupboard').length, 15);
});

test('plan: spot, level, row / pile and notes', async () => {
  await fresh();
  const body = plan().slice(1);
  const first = (stackId) => body.find((r) => r[2] === stackId);
  const inStack = (stackId) => body.filter((r) => r[2] === stackId && r[4] !== 'inside the base box');

  assert.deepEqual([first('T1')[0], first('T1')[1]], ['Top shelf', 'Easy (from the stairs)']);
  assert.equal(first('T4')[1], 'Hard');
  assert.equal(first('M2')[1], 'Hard', 'the middle shelf is hard to reach');
  assert.equal(first('B4')[1], 'Easy');
  assert.equal(first('N1')[1], 'Easy');

  // notes only on the first row of the stack
  assert.equal(first('T1')[8], 'Party games; 2 deep, long side out');
  assert.ok(inStack('T1').slice(1).every((r) => r[8] === ''));
  assert.equal(first('B6')[8], 'Sits across the 140 cm joint, low enough to pass under the bracket; 2 deep');

  // levels count from the bottom, and a side-by-side group shares one level
  assert.deepEqual(inStack('B3').map((r) => r[3]), [1, 2, 3, 4, 4]);
  assert.deepEqual(inStack('B3').map((r) => r[4]), ['', '', '', 'side by side', 'side by side']);

  // two rows
  const t1 = inStack('T1').map((r) => r[4]);
  assert.ok(t1.some((p) => p.startsWith('Front row')) && t1.some((p) => p.startsWith('Back row')));
  assert.ok(t1.every((p) => p.includes('long side out')));

  // boxes that stand say so (on its side / standing); standing boxes on the floor count from the left, row by row
  assert.equal(first('T9')[4], 'on its side'); // KLASK
  assert.equal(first('S1')[4], 'standing'); // Ice Cool
  const l1 = inStack('L1');
  const frontRow = l1.filter((r) => r[4].startsWith('Front row'));
  const backRow = l1.filter((r) => r[4].startsWith('Back row'));
  assert.deepEqual(frontRow.map((r) => r[3]), frontRow.map((_, i) => i + 1));
  assert.deepEqual(backRow.map((r) => r[3]), backRow.map((_, i) => i + 1));
  assert.equal(frontRow.length + backRow.length, 18);
  assert.ok(l1.every((r) => /standing|on its side/.test(r[4])));

  // categories in a fixed order joined with " + "
  assert.equal(find(body, 'So Clover!', 5)[7], 'Party + Co-op');
});

test('plan: games stored inside a box come right after their host', async () => {
  await fresh();
  const body = plan().slice(1);
  const i = body.findIndex((r) => r[5] === 'Lairs');
  const zero = body[i + 1];
  assert.equal(zero[5], 'Lairs: Box Zero');
  assert.equal(zero[4], 'inside the base box');
  assert.equal(zero[6], '—');
  assert.equal(zero[8], 'stored inside the Lairs box');
  assert.deepEqual(zero.slice(0, 4), body[i].slice(0, 4), 'same shelf, spot, stack and level as the host');
  assert.equal(body.filter((r) => r[4] === 'inside the base box').length, 7);
});

test('plan: the cupboard has its reason, and games on the board come last', async () => {
  await fresh();
  const cupboard = find(plan(), 'Twilight Struggle (Deluxe Edition)', 5);
  assert.deepEqual([cupboard[0], cupboard[1], cupboard[2], cupboard[8]], ['Cupboard', 'Cupboard', '', "No room left – and it's a 5-hour game"]);

  const id = store.addGame({ title: 'Fantasy Fluxx' });
  const rows = plan();
  assert.equal(rows.length - 1, 205);
  const last = rows.at(-1);
  assert.deepEqual([last[0], last[5]], ['Board', 'Fantasy Fluxx']);
  assert.equal(store.locate2(id).kind, 'board');
});

test('plan: a game taken out of its box moves to the cupboard rows', async () => {
  await fresh();
  const zero = store.getGames().find((g) => g.title === 'Lairs: Box Zero');
  store.moveToCupboard(zero.id, 'Taken out of the Lairs box');
  const row = find(plan(), 'Lairs: Box Zero', 5);
  assert.deepEqual([row[0], row[4], row[6], row[8]], ['Cupboard', '', '', 'Taken out of the Lairs box']);
});

test('both files survive a round trip through the CSV parser', async () => {
  await fresh();
  for (const rows of [catalog(), plan()]) {
    const text = toCsv(rows);
    const parsed = parseCsv(text);
    assert.equal(parsed.length, rows.length);
    assert.deepEqual(parsed, rows.map((r) => r.map((c) => String(c ?? ''))));
  }
});

// ---------------------------------------------------------------- schema 2: trees, bridges, the board

/** Hand-made games and plan, so the shapes are exactly what the test says. */
function world() {
  const ids = 'abcdefghij'.split('');
  const games = ids.map((id) => ({ id, title: id.toUpperCase(), dims: [7, 30, 37], categories: [], pizza: false }));
  const box = (game, o = {}) => ({ game, row: 0, x: 0, up: 's', rot: false, on: [], ...o });
  return { games, box };
}

test('plan: level is the longest path down the tree; a bridge sits above its higher support', () => {
  const { games, box } = world();
  const stack = {
    id: 'X', zone: 'bottom', x: 0,
    boxes: [
      box('a'), box('b', { x: 30 }), // on the shelf: level 1
      box('c', { on: ['a'] }), // 2
      box('d', { x: 15, on: ['a', 'b'] }), // bridge on two level-1 boxes: 2
      box('e', { on: ['c'] }), // 3
      box('f', { x: 15, on: ['c', 'b'] }), // bridge on a level-2 and a level-1 box: 3
      box('g', { x: 20, on: ['e', 'b'] }), // bridge on a level-3 and a level-1 box: 4
    ],
  };
  const rows = planRows(games, { stacks: [stack], cupboard: [], inside: {}, board: [] }).slice(1).filter((r) => r[2]);
  const level = (t) => rows.find((r) => r[5] === t)[3];
  assert.deepEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(level), [1, 1, 2, 2, 3, 3, 4]);
  // rows come bottom to top, left to right
  assert.deepEqual(rows.map((r) => r[5]), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
});

test('plan: Row / pile says standing, on its side, long side out, across a and b, front and back row', () => {
  const { games, box } = world();
  const stack = {
    id: 'X', zone: 'bottom', x: 0,
    boxes: [
      box('a'), box('b', { x: 30 }),
      box('c', { x: 15, on: ['a', 'b'] }),
      box('d', { rot: true, on: ['a'] }),
      box('e', { x: 60, up: 'l' }),
      box('f', { x: 70, up: 'm' }),
      box('g', { row: 1 }),
    ],
  };
  const rows = planRows(games, { stacks: [stack], cupboard: [], inside: {}, board: [] }).slice(1).filter((r) => r[2]);
  const pile = (t) => rows.find((r) => r[5] === t)[4];
  assert.equal(pile('A'), 'Front row');
  assert.equal(pile('C'), 'Front row, across A and B');
  assert.equal(pile('D'), 'Front row, long side out');
  assert.equal(pile('E'), 'Front row, standing');
  assert.equal(pile('F'), 'Front row, on its side');
  assert.equal(pile('G'), 'Back row');
  // a bridge and the boxes on its sides are not "side by side"; two boxes on the same box are
  const two = { id: 'Y', zone: 'middle', x: 0, boxes: [box('a'), box('b', { on: ['a'] }), box('c', { x: 10, on: ['a'] })] };
  const r2 = planRows(games, { stacks: [two], cupboard: [], inside: {}, board: [] }).slice(1).filter((r) => r[2]);
  assert.deepEqual(r2.map((r) => r[4]), ['', 'side by side', 'side by side']);
});

test('plan: standing boxes on the floor are numbered from the left, row by row, whatever their order', () => {
  const { games, box } = world();
  const stack = {
    id: 'X', zone: 'under-cards', x: 0,
    boxes: [box('c', { x: 20, up: 'l' }), box('a', { x: 0, up: 'l' }), box('b', { x: 10, up: 'l' }), box('d', { row: 1, x: 5, up: 'l' }), box('e', { row: 1, x: 0, up: 'l' })],
  };
  const rows = planRows(games, { stacks: [stack], cupboard: [], inside: {}, board: [] }).slice(1).filter((r) => r[2]);
  assert.deepEqual(rows.map((r) => [r[5], r[3]]), [['A', 1], ['B', 2], ['C', 3], ['E', 1], ['D', 2]]);
});

test('plan: a flat box on standing boxes is level 2 and the standing ones keep their position', () => {
  const { games, box } = world();
  const stack = { id: 'X', zone: 'under-tall', x: 0, boxes: [box('a', { up: 'l' }), box('b', { x: 10, up: 'l' }), box('c', { x: 0, on: ['a'] })] };
  const rows = planRows(games, { stacks: [stack], cupboard: [], inside: {}, board: [] }).slice(1).filter((r) => r[2]);
  assert.deepEqual(rows.map((r) => [r[5], r[3]]), [['A', 1], ['B', 2], ['C', 2]]);
});

test('plan: the board comes last (moved games in order, then games with no place); inside games follow their host', () => {
  const { games, box } = world();
  const plan = {
    stacks: [{ id: 'X', zone: 'bottom', x: 0, boxes: [box('a')] }],
    cupboard: [{ game: 'b', reason: 'No room' }],
    inside: { c: 'd' }, // c is inside d, and d is on the board
    board: [{ game: 'e' }, { game: 'd' }],
  };
  const rows = planRows(games.slice(0, 6), plan).slice(1);
  assert.deepEqual(rows.map((r) => [r[0], r[5]]), [
    ['Bottom shelf', 'A'], ['Cupboard', 'B'], ['Board', 'E'], ['Board', 'D'], ['Board', 'C'], ['Board', 'F'],
  ]);
  assert.equal(rows[4][4], 'inside the base box');
  assert.equal(rows.length, 6, 'every game once');
});
