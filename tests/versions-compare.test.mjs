// Compare two saved versions (Part C, D6 item 3). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { compareVersions, summarize, poseText } from '../js/versions/compare.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

// ---- tiny fixtures
const G = (id, title) => ({ id, title });
const box = (game, o = {}) => ({ game, row: 0, x: 0, up: 's', rot: false, on: [], ...o });
const stack = (id, boxes, zone = 'bottom') => ({ id, zone, x: 0, boxes });
const plan = (o = {}) => ({ stacks: [], cupboard: [], board: [], inside: {}, ...o });
const games = [G('g1', 'Ark Nova'), G('g2', 'Dixit'), G('g3', 'Azul'), G('g4', 'Lairs')];
const lines = (list) => list.map((e) => e.text);

test('the same state twice: no differences', () => {
  const p = plan({ stacks: [stack('B3', [box('g1'), box('g3', { x: 20 })])], board: [{ game: 'g2' }] });
  const r = compareVersions({ games, plan: p }, { games, plan: structuredClone(p) });
  assert.equal(r.identical, true);
  assert.equal(r.unchanged, 4);
  assert.deepEqual([r.moved, r.turned, r.added, r.removed], [[], [], [], []]);
  assert.equal(summarize(r), 'No differences.');
});

test('moved: "Ark Nova: M4 → B3", and a game that was on the board: "Dixit: Board → T2"', () => {
  const a = { games, plan: plan({ stacks: [stack('M4', [box('g1')], 'middle')] }) }; // g2, g3, g4 have no place: on the board
  const b = { games, plan: plan({ stacks: [stack('B3', [box('g1')]), stack('T2', [box('g2')], 'top')] }) };
  const r = compareVersions(a, b);
  assert.deepEqual(lines(r.moved), ['Ark Nova: M4 → B3', 'Dixit: Board → T2']);
  assert.deepEqual(r.moved.map((m) => [m.id, m.from, m.to, m.within]), [['g1', 'M4', 'B3', false], ['g2', 'Board', 'T2', false]]);
  assert.equal(r.unchanged, 2);
  assert.equal(r.identical, false);
});

test('an explicit board entry and a missing one are the same place', () => {
  const a = { games, plan: plan({ board: [{ game: 'g2' }] }) };
  const b = { games, plan: plan() };
  assert.equal(compareVersions(a, b).identical, true);
});

test('moved within a stack: a box that jumped in the order, changed row, or rests on another box', () => {
  const a = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 0 }), box('g2', { x: 30 }), box('g3', { x: 60 })])] }) };
  // Ark Nova stays first and Azul second: only Dixit jumped to the end
  const reordered = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 0 }), box('g3', { x: 30 }), box('g2', { x: 60 })])] }) };
  const r = compareVersions(a, reordered);
  assert.deepEqual(lines(r.moved), ['Dixit: moved within B3']);
  assert.deepEqual([r.moved[0].from, r.moved[0].to, r.moved[0].within], ['B3', 'B3', true]);
  assert.equal(r.unchanged, 3);
  // another row, and resting on another box that stayed
  const b = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 0 }), box('g2', { x: 30, row: 1 }), box('g3', { x: 60, on: ['g1'] })])] }) };
  assert.deepEqual(lines(compareVersions(a, b).moved), ['Azul: moved within B3', 'Dixit: moved within B3']);
});

test('a stack closes its gaps: neighbours that stayed in line did not move', () => {
  const a = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 0 }), box('g2', { x: 30 }), box('g3', { x: 60 }), box('g4', { x: 90 })])] }) };
  // Dixit leaves for the cupboard; Azul and Lairs slide left, Ark Nova stays
  const b = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 0 }), box('g3', { x: 30 }), box('g4', { x: 60 })])], cupboard: [{ game: 'g2', reason: '' }] }) };
  assert.deepEqual(lines(compareVersions(a, b).moved), ['Dixit: B3 → Cupboard']);
  // and the other way: Dixit comes back into the middle
  assert.deepEqual(lines(compareVersions(b, a).moved), ['Dixit: Cupboard → B3']);
  // a rounding difference in x is not a move either
  const c = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 12.5 })])] }) };
  const d = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 12.51 })])] }) };
  assert.equal(compareVersions(c, d).identical, true);
});

test('a box that rested on a box that left is not listed again', () => {
  const a = { games, plan: plan({ stacks: [stack('B3', [box('g1'), box('g2', { on: ['g1'] })])] }) };
  const b = { games, plan: plan({ stacks: [stack('B3', [box('g2')]), stack('T2', [box('g1')], 'top')] }) };
  assert.deepEqual(lines(compareVersions(a, b).moved), ['Ark Nova: B3 → T2']);
});

test('turned: same place, another side up or turned; a move is not listed twice', () => {
  const a = { games, plan: plan({ stacks: [stack('B3', [box('g1'), box('g2', { x: 30 }), box('g3', { x: 60 })])] }) };
  const b = { games, plan: plan({ stacks: [stack('B3', [box('g1', { up: 'l' }), box('g2', { x: 30, rot: true }), box('g3', { x: 60, up: 'm', rot: true })])] }) };
  const r = compareVersions(a, b);
  assert.deepEqual(lines(r.turned), ['Ark Nova: flat → standing', 'Azul: flat → on its side, long side out', 'Dixit: flat → flat, long side out']);
  assert.deepEqual(r.moved, []);
  assert.equal(r.unchanged, 1);
  assert.equal(summarize(r), '3 turned · 1 unchanged');
});

test('moved and turned at once: one line in Moved, the turn in brackets', () => {
  const a = { games, plan: plan({ stacks: [stack('M4', [box('g1')], 'middle')] }) };
  const b = { games, plan: plan({ stacks: [stack('B3', [box('g1', { up: 'l' })])] }) };
  const r = compareVersions(a, b);
  assert.deepEqual(lines(r.moved), ['Ark Nova: M4 → B3 (flat → standing)']);
  assert.deepEqual(r.moved[0].turn, { from: 'flat', to: 'standing' });
  assert.deepEqual(r.turned, []);
  // a move within the stack that also turns
  const c = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 0 }), box('g2', { x: 30 }), box('g3', { x: 60 })])] }) };
  const d = { games, plan: plan({ stacks: [stack('B3', [box('g1', { x: 0 }), box('g3', { x: 30 }), box('g2', { x: 60, up: 'm' })])] }) };
  assert.deepEqual(lines(compareVersions(c, d).moved), ['Dixit: moved within B3 (flat → on its side)']);
});

test('the cupboard, the board, and inside another box', () => {
  const a = { games, plan: plan({ stacks: [stack('B3', [box('g1'), box('g3', { x: 30 })])], inside: { g4: 'g1' } }) };
  const b = { games, plan: plan({ stacks: [stack('B3', [box('g3', { x: 30 })])], cupboard: [{ game: 'g1', reason: 'too big' }], inside: { g4: 'g1' } }) };
  const r = compareVersions(a, b);
  // Ark Nova went to the cupboard; Lairs is still inside it, so it travelled with it and is not listed
  assert.deepEqual(lines(r.moved), ['Ark Nova: B3 → Cupboard']);
  // out of the box onto a shelf, and a different host
  const c = { games, plan: plan({ stacks: [stack('B3', [box('g1'), box('g3', { x: 30 }), box('g4', { x: 60 })])] }) };
  assert.deepEqual(lines(compareVersions(a, c).moved), ['Lairs: In Ark Nova → B3']);
  const d = { games, plan: plan({ stacks: [stack('B3', [box('g1'), box('g3', { x: 30 })])], inside: { g4: 'g3' } }) };
  assert.deepEqual(lines(compareVersions(a, d).moved), ['Lairs: In Ark Nova → In Azul']);
});

test('only in one of them: removed (in a) and added (in b), with where they are', () => {
  const a = { games: [G('g1', 'Ark Nova'), G('g2', 'Dixit')], plan: plan({ stacks: [stack('B3', [box('g2')])] }) };
  const b = { games: [G('g1', 'Ark Nova'), G('g3', 'Azul')], plan: plan({ cupboard: [{ game: 'g3', reason: '' }] }) };
  const r = compareVersions(a, b);
  assert.deepEqual(lines(r.removed), ['Dixit: in B3']);
  assert.deepEqual(lines(r.added), ['Azul: in Cupboard']);
  assert.deepEqual([r.removed[0].id, r.removed[0].where, r.added[0].id, r.added[0].where], ['g2', 'B3', 'g3', 'Cupboard']);
  assert.deepEqual(r.moved, []);
  assert.equal(r.unchanged, 1);
  assert.equal(summarize(r), '2 only in one of them · 1 unchanged');
});

test('a renamed game keeps its id; names inside "In ..." come from the side they belong to', () => {
  const a = { games: [G('g1', 'Old name'), G('g4', 'Lairs')], plan: plan({ inside: { g4: 'g1' } }) };
  const b = { games: [G('g1', 'New name'), G('g4', 'Lairs')], plan: plan({ stacks: [stack('B3', [box('g4')])] }) };
  const r = compareVersions(a, b);
  assert.deepEqual(lines(r.moved), ['Lairs: In Old name → B3']);
});

test('groups are sorted by title and the inputs are not touched', () => {
  const many = ['Zoo', 'ábra', 'Apple', 'Mango'].map((t, i) => G(`g${i}`, t));
  const a = { games: many, plan: plan({ stacks: [stack('B1', many.map((g, i) => box(g.id, { x: i * 10 })))] }) };
  const b = { games: many, plan: plan({ stacks: [stack('B2', many.map((g, i) => box(g.id, { x: i * 10 })))] }) };
  const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
  const r = compareVersions(deepFreeze(structuredClone(a)), deepFreeze(structuredClone(b)));
  assert.deepEqual(r.moved.map((m) => m.title), ['ábra', 'Apple', 'Mango', 'Zoo']);
});

test('poseText', () => {
  assert.equal(poseText('s', false), 'flat');
  assert.equal(poseText('m', false), 'on its side');
  assert.equal(poseText('l', true), 'standing, long side out');
});

test('with the real store: save, move things, compare with now (and the other way round)', async () => {
  await store.init({ seed, storage: memory() });
  const stackOf = (id) => store.locate2(id);
  const onShelf = store.getGames().filter((g) => stackOf(g.id).kind === 'stack');
  const target = onShelf.find((g) => stackOf(g.id).on.length === 0 && stackOf(g.id).above.length === 0);
  const from = stackOf(target.id).stackId;
  const id = store.saveVersion('Before the move');

  const snapshot = () => ({ games: store.getGames(), plan: store.getPlan2() });
  assert.equal(compareVersions(store.getVersion(id), snapshot()).identical, true, 'nothing changed yet');

  store.moveToCupboard(target.id, 'test');
  const r = compareVersions(store.getVersion(id), snapshot());
  assert.deepEqual(lines(r.moved), [`${target.title}: ${from} → Cupboard`]);
  assert.equal(r.unchanged, store.getGames().length - 1);

  const back = compareVersions(snapshot(), store.getVersion(id));
  assert.deepEqual(lines(back.moved), [`${target.title}: Cupboard → ${from}`]);

  // a game added since, and a game removed since
  const added = store.addGame({ title: 'Brand new' });
  const gone = onShelf.find((g) => g.id !== target.id && stackOf(g.id).above.length === 0).id;
  store.removeGame(gone);
  const r2 = compareVersions(store.getVersion(id), snapshot());
  assert.deepEqual(r2.added.map((e) => e.id), [added]);
  assert.deepEqual(r2.removed.map((e) => e.id), [gone]);
  assert.equal(r2.added[0].where, 'Board');
});
