// Part B stacks (Phase C item 5). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { checkPlan2 } from '../js/rules/index.js';
import { buildScene, SPACING } from '../js/map/scene.js';
import { tapTarget } from '../js/map/placing.js';
import { spotChoices } from '../js/map/spots.js';
import {
  newStackX, fitNewStack, newStackFn, moveStackFn, checkMove, stepX, arrowStep, renameLines, removeText, X_STEP, SNAP,
} from '../js/map/stacks.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const plan = () => JSON.stringify(store.exportData().plan);
const byTitle = (t) => store.getGames().find((g) => g.title === t).id;

test('new stack x: rounded to 0.5 cm, snapped right of a joint on the wall shelves, kept on the shelf', () => {
  assert.equal(X_STEP, 0.5);
  assert.equal(SNAP, 3);
  assert.equal(newStackX('bottom', 1.4), 0.2, 'near the left end');
  assert.equal(newStackX('bottom', 57.1), 60.2, 'within 3 cm left of a joint');
  assert.equal(newStackX('middle', 62.9), 60.2, 'within 3 cm right of a joint');
  assert.equal(newStackX('top', 143), 140.2, 'the top shelf has joints too (no brackets)');
  assert.equal(newStackX('bottom', 63.3), 63.5, 'more than 3 cm away: rounded');
  assert.equal(newStackX('bottom', 100.74), 100.5);
  assert.equal(newStackX('bottom', 100.76), 101);
  assert.equal(newStackX('bottom', 250), 208, 'never past the wall end plus the overhang');
  assert.equal(newStackX('narrow', 1.2), 1, 'no snapping off the wall shelves');
  assert.equal(newStackX('narrow', -2), 0);
  assert.equal(newStackX('nope', 5), null);
});

test('a new stack with a game: one batch, one undo step, the id comes back from preview too', () => {
  const ark = byTitle('Ark Nova');
  store.moveToBoard(ark);
  const before = plan();
  const fn = newStackFn(store, ark, 'narrow', 60, { up: 's', rot: false });
  const c = checkMove(store, fn, 'Place');
  assert.match(c.result, /^N\d+$/);
  assert.equal(plan(), before, 'preview keeps nothing');
  const st = c.plan.stacks.find((s) => s.id === c.result);
  assert.deepEqual(st.boxes.map((b) => b.game), [ark]);
  const id = fn();
  assert.equal(id, c.result);
  assert.equal(store.locate2(ark).stackId, id);
  store.undo();
  assert.equal(plan(), before, 'one undo restores the plan exactly');
  store.undo(); // the moveToBoard
});

test('checkMove: only new problems count; block → no button, warnings → anyway', () => {
  const ark = byTitle('Ark Nova');
  const at = store.getPlan2().stacks.find((s) => s.zone === 'bottom');
  // on top of an existing stack: a new block (overlap)
  const over = checkMove(store, newStackFn(store, ark, 'bottom', at.x + 1), 'Place');
  assert.ok(over.block.some((w) => w.rule === 'overlap'), over.block.map((w) => w.rule).join());
  assert.deepEqual(over.button, { disabled: true, label: 'Not allowed' });
  // a store refusal: a pizza game standing
  const refused = checkMove(store, newStackFn(store, ark, 'narrow', 10, { up: 'l' }), 'Place');
  assert.ok(refused.error);
  assert.equal(refused.button.disabled, true);
  // warnings only → "anyway": with B1 gone, B2 at x 0 crosses the bracket at the left end
  const before = plan();
  store.removeStack('B1');
  const warned = checkMove(store, moveStackFn(store, 'B2', 0), 'Save');
  assert.deepEqual(warned.block, []);
  assert.ok(warned.warn.some((w) => w.rule === 'bracket'));
  assert.deepEqual(warned.button, { disabled: false, label: 'Save anyway' });
  store.undo();
  assert.equal(plan(), before);
  const v5 = checkPlan2(store.getPlan2(), getGame);
  assert.equal(v5.filter((w) => w.severity === 'block').length, 0, 'the v5 plan has no blocks');
  const nothing = checkMove(store, moveStackFn(store, at.id, at.x), 'Save');
  assert.deepEqual(nothing.button, { disabled: false, label: 'Save' }, 'no change, nothing new');
});

test('moving a stack: steps, arrow keys, overlap blocks, and one undo step', () => {
  assert.equal(stepX(60.2, -1), 59.2);
  assert.equal(stepX(60.2, 5), 65.2);
  assert.equal(stepX(0.2, -1), 0, 'never below 0');
  assert.equal(stepX(0.1 + 0.2, 1), 1.3, 'no float dust');
  assert.equal(arrowStep({ key: 'ArrowLeft' }), -1);
  assert.equal(arrowStep({ key: 'ArrowRight', shiftKey: true }), 5);
  assert.equal(arrowStep({ key: 'ArrowLeft', shiftKey: true }), -5);
  assert.equal(arrowStep({ key: 'Enter' }), 0);

  const wall = store.getPlan2().stacks.filter((s) => s.zone === 'bottom').sort((a, b) => a.x - b.x);
  const [a, b] = wall;
  const into = checkMove(store, moveStackFn(store, a.id, b.x), 'Save');
  assert.ok(into.block.some((w) => w.rule === 'overlap'));
  assert.equal(into.button.disabled, true);
  const before = plan();
  store.moveStack(a.id, stepX(a.x, -0.1));
  store.undo();
  assert.equal(plan(), before);
});

test('empty stacks stay: drawn as a thin outline, tappable, with "On the shelf" as their spot', () => {
  const before = plan();
  const id = store.createStack('middle', { x: 34 });
  const scene = buildScene(store.getPlan2(), getGame);
  const st = scene.stacks.find((s) => s.id === id);
  const zone = scene.zones.find((z) => z.id === 'middle');
  assert.equal(st.empty, true);
  assert.equal(st.w, SPACING.emptyW);
  assert.equal(st.top, zone.top);
  assert.equal(st.h, zone.height);
  assert.equal(st.label.x, st.x + SPACING.emptyW / 2);
  assert.deepEqual(tapTarget(scene, { x: st.x + 1, y: zone.top + 2 }), { kind: 'stack', stackId: id });
  assert.ok(scene.stacks.filter((s) => s.id !== id).every((s) => !s.empty), 'v5 has no empty stacks');
  const spots = spotChoices(store.getStack2(id), getGame);
  assert.deepEqual(spots.map((s) => s.label), ['On the shelf']);
  assert.equal(removeText(store.getStack2(id)), null, 'an empty stack goes without asking');
  store.removeStack(id);
  store.undo();
  store.undo();
  assert.equal(plan(), before);
});

test('removing a stack with games asks first; they go to the board, and Undo puts them back', () => {
  const st = store.getPlan2().stacks.find((s) => s.boxes.length > 1);
  assert.equal(removeText(st), `Its ${st.boxes.length} games go to the board.`);
  assert.equal(removeText({ boxes: [{ game: 'g' }] }), 'Its game goes to the board.');
  const before = plan();
  store.removeStack(st.id);
  for (const b of st.boxes) assert.equal(store.locate2(b.game).kind, 'board');
  store.undo();
  assert.equal(plan(), before);
});

test('renumber: the confirmation lists the renames from a preview, shelf order', () => {
  const before = plan();
  const none = {};
  store.preview(() => Object.assign(none, store.renumberStacks()));
  assert.deepEqual(renameLines(none, store.getPlan2()), [], 'v5 is numbered left to right');
  const id = store.createStack('bottom', { x: 0 }); // left of B1, so every bottom stack moves up one
  const mid = store.createStack('middle', { x: 34 }); // between M1 and M2
  let map = {};
  const p = store.preview(() => { map = store.renumberStacks(); });
  assert.equal(p.error, null);
  const lines = renameLines(map, store.getPlan2());
  assert.equal(lines[0], `${mid} → M2`, 'the middle shelf comes before the bottom shelf');
  assert.equal(lines[1], 'M2 → M3');
  const b = lines.indexOf(`${id} → B1`);
  assert.ok(b > 0 && lines[b + 1] === 'B1 → B2', lines.join(', '));
  assert.deepEqual(renameLines(null, store.getPlan2()), []);
  store.undo();
  store.undo();
  assert.equal(plan(), before);
});

test('a new stack slides left within its gap so the box ends before the next stack', () => {
  const before = plan();
  store.removeStack('M2'); // 30 cm free between M1 (ends 30.2) and M3 (starts 60.2)
  const p = store.getPlan2();
  assert.equal(fitNewStack(p, getGame, 'middle', 45, 19.5), 40.5, 'largest x on the 0.5 grid that ends by 60.2');
  assert.equal(fitNewStack(p, getGame, 'middle', 32, 19.5), 32, 'fits where tapped: unchanged');
  assert.equal(fitNewStack(p, getGame, 'middle', 45, 29.9), 30.2, 'never left of the gap start');
  assert.equal(fitNewStack(p, getGame, 'middle', 45, 31), 45, 'too wide for the gap: unchanged, the check says why');
  assert.equal(fitNewStack(p, getGame, 'narrow', 79, 0.5), 79);
  assert.equal(fitNewStack({ stacks: [] }, getGame, 'bottom', 200, 10), 198, 'the wall end plus the overhang counts as the next stack');
  // per way up: the fitted x passes the check
  const id = byTitle('Scrabble Original');
  const g = getGame(id);
  for (const o of [{ up: 's', rot: false }, { up: 's', rot: true }]) {
    const w = o.rot ? g.dims[2] : g.dims[1];
    const x = fitNewStack(p, getGame, 'middle', 45, w);
    const c = checkMove(store, newStackFn(store, id, 'middle', x, o), 'Place');
    if (w <= 30) assert.deepEqual(c.block.filter((b) => b.rule === 'overlap'), [], `${o.rot}: ${x}`);
  }
  store.undo();
  assert.equal(plan(), before);
});
