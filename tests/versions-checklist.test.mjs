// The moving checklist (Part C, D7). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { movingSteps } from '../js/versions/checklist.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

const G = (id, title) => ({ id, title });
const box = (game, o = {}) => ({ game, row: 0, x: 0, up: 's', rot: false, on: [], ...o });
const stack = (id, boxes, o = {}) => ({ id, zone: 'bottom', x: 0, boxes, ...o });
const plan = (o = {}) => ({ stacks: [], cupboard: [], board: [], inside: {}, ...o });
const games = [G('g1', 'Ark Nova'), G('g2', 'Dixit'), G('g3', 'Azul'), G('g4', 'Lairs'), G('g5', 'Zoo')];
const side = (p, g = games) => ({ games: g, plan: p });
const texts = (list) => list.map((s) => s.text);

/** Replays the steps on `a`: nothing is lifted with a box still on it, nothing is put on missing supports. */
export function replay(a, b, steps) {
  const sup = (plan) => new Map(plan.stacks.flatMap((st) => st.boxes.map((x) => [x.game, x.on])));
  const supA = sup(a.plan);
  const supB = sup(b.plan);
  const placed = new Set([...supA.keys()]);
  for (const s of steps.takeOut) {
    assert.ok(placed.has(s.id), `${s.key}: not on the shelf`);
    for (const other of placed) assert.ok(!supA.get(other).includes(s.id), `${s.key}: ${other} still rests on it`);
    placed.delete(s.id);
  }
  for (const s of steps.putIn) {
    assert.ok(!placed.has(s.id), `${s.key}: already there`);
    for (const need of supB.get(s.id)) assert.ok(placed.has(need), `${s.key}: support ${need} missing`);
    placed.add(s.id);
  }
  assert.deepEqual([...placed].sort(), [...supB.keys()].sort());
}

test('a pile with its middle box moved: the top box is lifted and put back', () => {
  const pile = stack('B3', [box('g1'), box('g2', { on: ['g1'] }), box('g3', { on: ['g2'] })]);
  const a = side(plan({ stacks: [pile, stack('M4', [box('g4')], { zone: 'middle', x: 80 })] }));
  const b = side(plan({
    stacks: [stack('B3', [box('g1'), box('g3', { on: ['g1'] })]), stack('M4', [box('g4'), box('g2', { on: ['g4'], up: 'm' })], { zone: 'middle', x: 80 })],
  }));
  const r = movingSteps(a, b);
  assert.deepEqual(texts(r.takeOut), ['Take Azul off B3', 'Take Dixit off B3']);
  assert.deepEqual(texts(r.putIn), ['Put Dixit on M4 · on Lairs · on its side', 'Put back Azul on B3 · on Ark Nova · flat']);
  assert.deepEqual(r.takeOut.map((s) => s.key), ['takeOut:g3', 'takeOut:g2']);
  assert.equal(r.takeOut[0].title, 'Azul');
  replay(a, b, r);
});

test('a bridge is put in only after both supports', () => {
  const a = side(plan({ stacks: [stack('B3', [box('g1'), box('g2', { x: 30 }), box('g3', { on: ['g1', 'g2'], x: 15 })])] }));
  const b = side(plan({ stacks: [stack('B3', [box('g1', { x: 5 }), box('g2', { x: 40 }), box('g3', { on: ['g1', 'g2'], x: 20, up: 'l' })])] }));
  const r = movingSteps(a, b);
  assert.deepEqual(r.takeOut.map((s) => s.id), ['g3', 'g1', 'g2']);
  assert.deepEqual(texts(r.putIn), [
    'Put back Ark Nova on B3 · on the shelf from 5 cm · flat',
    'Put back Dixit on B3 · on the shelf from 40 cm · flat',
    'Put back Azul on B3 · across Ark Nova + Dixit · standing',
  ]);
  replay(a, b, r);
});

test('a stack moved along the shelf: all its boxes are lifted; a stack that is only renumbered gives nothing', () => {
  const a = side(plan({ stacks: [stack('B1', [box('g1'), box('g2', { on: ['g1'] })], { x: 10 }), stack('B2', [box('g3')], { x: 100 })] }));
  const b = side(plan({ stacks: [stack('B1', [box('g1'), box('g2', { on: ['g1'] })], { x: 25 }), stack('B7', [box('g3')], { x: 100 })] }));
  const r = movingSteps(a, b);
  assert.deepEqual(texts(r.takeOut), ['Take Dixit off B1', 'Take Ark Nova off B1']);
  assert.deepEqual(texts(r.putIn), ['Put back Ark Nova on B1 · on the shelf from 25 cm · flat', 'Put back Dixit on B1 · on Ark Nova · flat']);
  replay(a, b, r);
});

test('joining two stacks and shifting x between stack and box give no steps', () => {
  const a = side(plan({ stacks: [stack('B1', [box('g1')], { x: 10 }), stack('B2', [box('g2')], { x: 50 })] }));
  const b = side(plan({ stacks: [stack('B1', [box('g1'), box('g2', { x: 40 })], { x: 10 })] }));
  assert.deepEqual(movingSteps(a, b), { takeOut: [], putIn: [], inside: [] });
  const c = side(plan({ stacks: [stack('Z9', [box('g1', { x: 3 })], { x: 7 })] }));
  const d = side(plan({ stacks: [stack('Z1', [box('g1', { x: 0 })], { x: 10 })] }));
  assert.deepEqual(movingSteps(c, d).takeOut, []);
});

test('turned or in another row counts; the back row is named', () => {
  const a = side(plan({ stacks: [stack('B1', [box('g1'), box('g2', { x: 30 })])] }));
  const b = side(plan({ stacks: [stack('B1', [box('g1', { rot: true }), box('g2', { x: 30, row: 1 })])] }));
  const r = movingSteps(a, b);
  assert.deepEqual(texts(r.putIn), ['Put back Ark Nova on B1 · on the shelf from 0 cm · flat, long side out', 'Put back Dixit on B1 · on the shelf from 30 cm · back row · flat']);
});

test('board, cupboard, new and removed games', () => {
  const a = side(plan({
    stacks: [stack('B1', [box('g1'), box('g2', { x: 30 }), box('g3', { x: 60 }), box('g5', { x: 90 })])],
    cupboard: [{ game: 'g4', reason: 'x' }],
  }));
  const gamesB = [...games.filter((g) => g.id !== 'g5'), G('g6', 'Newbie')];
  const b = side(plan({
    stacks: [stack('B1', [box('g1'), box('g4', { x: 30 }), box('g6', { x: 60 })])],
    board: [{ game: 'g2' }], cupboard: [{ game: 'g3' }],
  }), gamesB);
  const r = movingSteps(a, b);
  assert.deepEqual(texts(r.takeOut), ['Take Dixit off B1 → board', 'Take Azul off B1 → cupboard', 'Take Zoo off B1 (not in the app any more)']);
  assert.deepEqual(texts(r.putIn), ['Put Lairs on B1 · on the shelf from 30 cm · flat · from the cupboard', 'Put Newbie on B1 · on the shelf from 60 cm · flat · new']);
  const c = movingSteps(side(plan({ board: [{ game: 'g1' }] })), side(plan({ cupboard: [{ game: 'g1' }] })));
  assert.deepEqual(c, { takeOut: [], putIn: [], inside: [] });
  const d = movingSteps(side(plan()), side(plan({ stacks: [stack('B1', [box('g2')])] })));
  assert.deepEqual(texts(d.putIn), ['Put Dixit on B1 · on the shelf from 0 cm · flat · from the board']);
});

test('boxes inside other boxes', () => {
  const a = side(plan({ inside: { g2: 'g1', g3: 'g1' } }));
  const b = side(plan({ inside: { g2: 'g4', g5: 'g4' } }));
  const r = movingSteps(a, b);
  assert.deepEqual(texts(r.inside), ['Take Azul out of Ark Nova', 'Take Dixit out of Ark Nova', 'Put Dixit inside Lairs', 'Put Zoo inside Lairs']);
  assert.deepEqual(r.inside.map((s) => s.key), ['outside:g3', 'outside:g2', 'inside:g2', 'inside:g5']);
  assert.equal(movingSteps(b, b).inside.length, 0);
});

test('the key is phase:gameId and a box that rested on a gone support is lifted', () => {
  const a = side(plan({ stacks: [stack('B1', [box('g1'), box('g2', { on: ['g1'] })])] }));
  const b = side(plan({ stacks: [stack('B1', [box('g2', { x: 0 })])] }), games);
  const r = movingSteps(a, b);
  assert.deepEqual(r.takeOut.map((s) => s.key), ['takeOut:g2', 'takeOut:g1']);
  assert.deepEqual(r.putIn.map((s) => s.key), ['putIn:g2']);
  assert.deepEqual(Object.keys(r.putIn[0]).sort(), ['id', 'key', 'text', 'title']);
});

test('the seed against itself has no steps; the seed with a box moved replays cleanly', async () => {
  await store.init({ seed, storage: memory() });
  const now = () => ({ games: store.getGames(), plan: store.getPlan2() });
  const before = now();
  assert.deepEqual(movingSteps(before, now()), { takeOut: [], putIn: [], inside: [] });
  const withStack = store.getPlan2().stacks.find((s) => s.boxes.length >= 3);
  const id = withStack.boxes[0].game;
  store.moveToBoard(id);
  const after = now();
  const r = movingSteps(before, after);
  assert.ok(r.takeOut.length >= 1);
  assert.ok(r.takeOut.some((s) => s.id === id && s.text.endsWith('→ board')));
  replay(before, after, r);
  const back = movingSteps(after, before);
  replay(after, before, back);
});
