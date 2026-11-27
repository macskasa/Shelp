// Part B pick up + turn chooser (Phase C items 1 and 4). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { pickUpActions, settleText, turnOptions, confirmButton } from '../js/map/pickup.js';
import { newProblems } from '../js/map/spots.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const title = (id) => getGame(id)?.title ?? id;
const byTitle = (t) => store.getGames().find((g) => g.title === t).id;

test('actions: a box on a shelf, in the cupboard, on the board, without a size', () => {
  const ark = getGame(byTitle('Ark Nova'));
  assert.deepEqual(pickUpActions(ark, { kind: 'stack' }), ['move', 'turn', 'board', 'cupboard', 'inside']);
  assert.deepEqual(pickUpActions(ark, { kind: 'cupboard' }), ['move', 'board', 'inside']);
  assert.deepEqual(pickUpActions(ark, { kind: 'board', index: 0 }), ['move', 'cupboard', 'inside']);
  assert.deepEqual(pickUpActions(ark, { kind: 'inside', hostId: 'g001' }), ['move', 'board', 'cupboard', 'inside']);
  assert.deepEqual(pickUpActions({ ...ark, dims: null }, { kind: 'board' }), ['cupboard', 'inside'], 'no size: it cannot be moved onto a shelf');
  assert.deepEqual(pickUpActions(null, null), []);
  const inCupboard = store.getPlan2().cupboard[0].game;
  assert.deepEqual(pickUpActions(getGame(inCupboard), store.locate2(inCupboard)), ['move', 'board', 'inside']);
});

test('settle text: what the boxes on top do when a box leaves', () => {
  const b3 = store.getStack2('B3');
  assert.equal(settleText(b3, byTitle('Takenokolor'), title), '2 boxes on top settle down onto Legacy of Yu');
  assert.equal(settleText(b3, byTitle("Let's Go! To Japan"), title), "4 boxes on top settle down onto the shelf");
  const m3 = store.getStack2('M3');
  assert.equal(settleText(m3, byTitle('SETI – Kutatás a földön kívüli élet után'), title), '1 box on top settles down onto the shelf');
  const topBox = b3.boxes.find((b) => !b3.boxes.some((o) => o.on.includes(b.game))).game;
  assert.equal(settleText(b3, topBox, title), null, 'nothing on top');
  assert.equal(settleText(b3, 'nope', title), null);
  // a box across two: the bridge keeps its other support
  const stack = { id: 'X', boxes: [
    { game: 'a', on: [] }, { game: 'b', on: [] }, { game: 'c', on: ['a', 'b'] }, { game: 'd', on: ['c'] },
  ] };
  assert.equal(settleText(stack, 'a', (id) => id.toUpperCase()), '2 boxes on top settle down onto B');
  assert.equal(settleText(stack, 'c', (id) => id.toUpperCase()), '1 box on top settles down across A and B');
});

test('turn options: pizza 2, others up to 6, the current way marked once', () => {
  const ark = getGame(byTitle('Ark Nova')); // pizza
  const opts = turnOptions(ark, { up: 's', rot: true });
  assert.deepEqual(opts.map((o) => [o.up, o.rot, o.current]), [['s', false, false], ['s', true, true]]);
  const klask = getGame(byTitle('KLASK')); // not pizza
  const k = turnOptions(klask, { up: 'l', rot: false });
  assert.equal(k.length, 6);
  assert.deepEqual(k.filter((o) => o.current).map((o) => o.label), ['Standing']);
  assert.equal(turnOptions(ark, null).some((o) => o.current), false, 'not on a shelf: nothing is current');
  const square = getGame(byTitle('T.I.M.E Stories: Lumen Fidei'));
  assert.deepEqual(turnOptions(square, { up: 's', rot: true }).map((o) => o.current), [true], 'equal sizes once, still current');
});

test('turn on a shelf: a turn that adds a warning says "Turn anyway", the store refuses a pizza standing', () => {
  // find a turn in the v5 plan that only adds warnings (a box sticking out over the one below)
  const before = store.getPlan2();
  let found = null;
  for (const st of before.stacks) {
    for (const b of st.boxes) {
      const g = getGame(b.gameId ?? b.game);
      for (const o of turnOptions(g, b)) {
        if (o.current) continue;
        const p = store.preview(() => store.turnBox(g.id, { up: o.up, rot: o.rot }));
        if (p.error) continue;
        const np = newProblems(before, p.plan, getGame);
        if (np.warn.length && !np.block.length) found = found ?? { g, o, np };
      }
    }
  }
  assert.ok(found, 'some turn in v5 only warns');
  assert.deepEqual(confirmButton(found.np, 'Turn'), { disabled: false, label: 'Turn anyway' });
  const pizza = byTitle('Ark Nova');
  const p = store.preview(() => store.turnBox(pizza, { up: 'l', rot: false }));
  assert.match(p.error.message, /pizza/);
  assert.deepEqual(confirmButton({ error: p.error, block: [], warn: [] }, 'Turn'), { disabled: true, label: 'Not allowed' });
  assert.deepEqual(confirmButton({ block: [{}], warn: [{}] }, 'Turn'), { disabled: true, label: 'Not allowed' });
  assert.deepEqual(confirmButton({ block: [], warn: [] }, 'Turn'), { disabled: false, label: 'Turn' });
  assert.deepEqual(store.getPlan2(), before, 'previews change nothing');
});

test('to the board and Undo put the plan back exactly', () => {
  const before = JSON.stringify(store.exportData().plan);
  store.moveToBoard(byTitle('Legacy of Yu'));
  assert.equal(store.locate2(byTitle('Takenokolor')).on[0], byTitle("Let's Go! To Japan"), 'settled down as the text said');
  store.undo();
  assert.equal(JSON.stringify(store.exportData().plan), before);
});
