// Part B: a family on the map (part-b4 items 1, 2). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { layoutStack2 } from '../js/core/geometry.js';
import { checkPlan2 } from '../js/rules/index.js';
import { buildScene, stackArea } from '../js/map/scene.js';
import { stackDetails } from '../js/map/details.js';
import {
  findFamily, familyPlaces, familyView, familyFocus, familyCaption, familyWarning, unionRect,
} from '../js/map/family.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;

/** Put games in a family for one test, and take it off again. */
function withFamily(name, ids, fn) {
  store.batch(() => ids.forEach((id) => store.updateGame(id, { family: name })));
  try {
    return fn(findFamily(store.getFamilies(), name));
  } finally {
    store.batch(() => ids.forEach((id) => store.updateGame(id, { family: null })));
  }
}

const front = (stackId) => store.getStack2(stackId).boxes.find((b) => !b.row).game;
const backOf = (stackId) => store.getStack2(stackId).boxes.find((b) => b.row > 0).game;
const show = (fam) => {
  const places = familyPlaces(fam, store.locate2);
  const view = familyView(places) ?? 'front';
  const scene = buildScene(store.getPlan2(), getGame, { view });
  return { scene, focus: familyFocus(fam, places, scene, view) };
};

test('findFamily: the exact name, or any letter case; null for unknown or empty names', () => {
  const fams = [{ name: 'Azul', ids: ['a'] }, { name: 'Ticket to Ride', ids: ['b'] }];
  assert.equal(findFamily(fams, 'Azul'), fams[0]);
  assert.equal(findFamily(fams, 'ticket to ride'), fams[1]);
  assert.equal(findFamily(fams, ' azul '), fams[0]);
  assert.equal(findFamily(fams, 'Carcassonne'), null);
  assert.equal(findFamily(fams, ''), null);
  assert.equal(findFamily(fams, undefined), null);
});

test('familyPlaces: on a stack, inside a box (counts at its host), on the board, in the cupboard', () => {
  const [exp, host] = Object.entries(store.getPlan2().inside)[0];
  const cup = store.getPlan2().cupboard[0].game;
  const b3 = front('B3');
  const hostLoc = store.locate2(host);
  store.moveToBoard(b3);
  const places = familyPlaces({ name: 'X', ids: [front('M1'), exp, b3, cup] }, store.locate2);
  store.undo();
  assert.deepEqual(places.map((p) => [p.kind, p.shownId]), [
    ['stack', front('M1')], [hostLoc.kind === 'stack' ? 'stack' : 'board', host], ['board', b3], ['cupboard', cup],
  ]);
  assert.equal(places[0].stackId, 'M1');
});

test('familyView: back only when every row-dependent member is in the back row', () => {
  const p = (row, rows = 2) => ({ kind: 'stack', stackId: 'X', row, rows });
  assert.equal(familyView([p(1), p(1)]), 'back');
  assert.equal(familyView([p(1), p(0, 1)]), 'back', 'a one-row stack shows in both views');
  assert.equal(familyView([p(1), p(0)]), 'front', 'both rows: stay in the front view');
  assert.equal(familyView([p(0, 1), { kind: 'board' }]), null, 'nothing row-dependent: keep the view');
  assert.equal(familyView([]), null);
});

test('a family in two stacks of one shelf: boxes, stacks in shelf order, caption, no warning', () => {
  const ids = [front('B3'), front('B2')];
  withFamily('Azul', ids, (fam) => {
    assert.ok(fam, 'the store lists it');
    const { focus } = show(fam);
    assert.deepEqual(focus.stackIds, ['B2', 'B3']);
    assert.deepEqual(new Set(focus.boxIds), new Set(ids));
    assert.deepEqual(focus.ringStackIds, []);
    assert.equal(familyCaption(focus), 'family · 2 games · B2, B3');
    assert.equal(familyWarning(checkPlan2(store.getPlan2(), getGame), 'Azul'), null, 'B2, B3 are next to each other');
  });
});

test('a spread family: the warning from checkPlan2, and an area over every member stack', () => {
  withFamily('Azul', [front('T2'), front('B3')], (fam) => {
    const { focus, scene } = show(fam);
    const w = familyWarning(checkPlan2(store.getPlan2(), getGame), 'Azul');
    assert.ok(w, 'spread over two shelves');
    assert.deepEqual(w.stackIds, ['T2', 'B3']);
    assert.match(w.message, /Azul family is spread out/);
    const rect = unionRect(focus.stackIds.map((id) => stackArea(scene, id)));
    const t2 = stackArea(scene, 'T2');
    const b3 = stackArea(scene, 'B3');
    assert.equal(rect.y, t2.y);
    assert.equal(rect.y + rect.h, b3.y + b3.h);
    assert.equal(rect.x, Math.min(t2.x, b3.x));
  });
});

test('the board and the cupboard are named after the stacks', () => {
  const cup = store.getPlan2().cupboard[0].game;
  const b3 = front('B3');
  withFamily('Azul', [front('B2'), b3, cup], (fam) => {
    store.moveToBoard(b3);
    const { focus } = show(fam);
    store.undo();
    assert.deepEqual(focus.boardIds, [b3]);
    assert.equal(familyCaption(focus), 'family · 3 games · B2 · 1 on the board · 1 in the cupboard');
  });
});

test('back row: all members there → back view; both rows → front view and "1 in the back row"', () => {
  withFamily('Azul', [backOf('T1'), backOf('B5')], (fam) => {
    const places = familyPlaces(fam, store.locate2);
    assert.equal(familyView(places), 'back');
    const scene = buildScene(store.getPlan2(), getGame, { view: 'back' });
    const focus = familyFocus(fam, places, scene, 'back');
    assert.equal(focus.boxIds.length, 2);
    assert.equal(focus.otherRow, null);
    assert.equal(familyCaption(focus), 'family · 2 games · T1, B5');
  });
  withFamily('Azul', [front('B3'), backOf('B5')], (fam) => {
    assert.equal(familyView(familyPlaces(fam, store.locate2)), 'back', 'B3 has one row: the back view shows both');
  });
  withFamily('Azul', [front('T1'), backOf('B5')], (fam) => {
    const places = familyPlaces(fam, store.locate2);
    assert.equal(familyView(places), 'front');
    const scene = buildScene(store.getPlan2(), getGame, { view: 'front' });
    const focus = familyFocus(fam, places, scene, 'front');
    assert.deepEqual(focus.boxIds, [front('T1')]);
    assert.deepEqual(focus.ringStackIds, ['B5'], 'its stack is ringed; the row switch shows the rest');
    assert.equal(familyCaption(focus), 'family · 2 games · T1, B5 · 1 in the back row');
  });
});

test('one game: "1 game"; unionRect of nothing is null', () => {
  assert.equal(familyCaption({ count: 1, stackIds: [], otherRow: null, onBoard: 1, inCupboard: 0 }), 'family · 1 game · 1 on the board');
  assert.equal(unionRect([]), null);
  assert.deepEqual(unionRect([{ x: 1, y: 2, w: 3, h: 4 }, null, { x: 0, y: 5, w: 1, h: 10 }]), { x: 0, y: 2, w: 4, h: 13 });
});

test('stack details: each box carries its family (the chip), null without one', () => {
  const id = front('B3');
  withFamily('Azul', [id], () => {
    const st = store.getStack2('B3');
    const boxes = stackDetails(st, layoutStack2(st, getGame), getGame).rows[0].boxes;
    assert.equal(boxes.find((b) => b.gameId === id).family, 'Azul');
    assert.ok(boxes.filter((b) => b.gameId !== id).every((b) => b.family === null));
  });
});
