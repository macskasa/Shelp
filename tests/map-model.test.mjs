// Part B model tests (story C1). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { ZONES } from '../js/core/shelves.js';
import { footprint, isLongSideOut, layoutStack, layoutPlan, PLACEHOLDER_DIMS } from '../js/map/model.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/v5-geometry.json', import.meta.url), 'utf8'));

const TOL = 0.05;
const near = (actual, expected, what) =>
  assert.ok(Math.abs(actual - expected) <= TOL, `${what}: got ${actual}, expected ${expected}`);

const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const titled = (title) => store.getGames().find((g) => g.title === title);
const stack = (id) => store.getStack(id);

test('every v5 stack matches the expected geometry (w, d, h within 0.05 cm)', () => {
  const stacks = store.getPlan().stacks;
  for (const st of stacks) {
    const want = fixture[st.id];
    assert.ok(want, `no expected geometry for stack ${st.id}`);
    const got = layoutStack(st, getGame);
    near(got.w, want.w, `${st.id} w`);
    near(got.d, want.d, `${st.id} d`);
    near(got.h, want.h, `${st.id} h`);
    near(st.x, want.x, `${st.id} x (seed vs fixture)`);
  }
  const known = new Set(stacks.map((st) => st.id));
  for (const id of Object.keys(fixture)) assert.ok(known.has(id), `fixture stack ${id} is not in the plan`);
});

test('footprint: flat boxes lie on their smallest side', () => {
  const g = { dims: [7, 30, 37] };
  assert.deepEqual(footprint(g, { game: 'x' }, 'bottom', 'flat'), { w: 30, d: 37, h: 7 });
  // long side out
  assert.deepEqual(footprint(g, { game: 'x', rot: true }, 'bottom', 'flat'), { w: 37, d: 30, h: 7 });
  // deeper than the 38 cm shelf: turned automatically
  assert.deepEqual(footprint({ dims: [8, 30, 43.5] }, {}, 'top', 'flat'), { w: 43.5, d: 30, h: 8 });
  // dims in any order give the same result
  assert.deepEqual(footprint({ dims: [37, 7, 30] }, {}, 'bottom'), { w: 30, d: 37, h: 7 });
  // zone objects work as well as ids
  assert.deepEqual(footprint(g, {}, ZONES.bottom, 'flat'), footprint(g, {}, 'bottom', 'flat'));
});

test('footprint: standing boxes stand on their long side when it fits, otherwise on the middle side', () => {
  // Ice Cool in the tall gap: 41 cm fits under 45
  assert.deepEqual(footprint({ dims: [6, 21, 41] }, {}, 'under-gap', 'standing'), { w: 6, d: 21, h: 41 });
  // KLASK on the top shelf: 46 cm does not fit under 38, so it is 37 tall and 46 deep
  assert.deepEqual(footprint({ dims: [15, 37, 46] }, {}, 'top', 'standing'), { w: 15, d: 46, h: 37 });
  // rot means nothing for standing boxes
  assert.deepEqual(footprint({ dims: [6, 21, 41] }, { rot: true }, 'under-gap', 'standing'), { w: 6, d: 21, h: 41 });
});

test('footprint: a missing size uses the 10 × 10 × 3 placeholder', () => {
  assert.deepEqual([...PLACEHOLDER_DIMS], [3, 10, 10]);
  assert.deepEqual(footprint({ dims: null }, {}, 'bottom', 'flat'), { w: 10, d: 10, h: 3 });
  assert.deepEqual(footprint({ dims: null }, {}, 'under-cards', 'standing'), { w: 3, d: 10, h: 10 });
  assert.deepEqual(footprint(undefined, {}, 'bottom', 'flat'), { w: 10, d: 10, h: 3 });
});

test('footprint: an unknown zone is a clear error', () => {
  assert.throws(() => footprint({ dims: [1, 2, 3] }, {}, 'attic', 'flat'), /Unknown zone "attic"/);
});

test('isLongSideOut: asked for or forced by a deep box, flat only', () => {
  assert.equal(isLongSideOut({ dims: [7, 30, 37] }, { rot: true }, 'bottom'), true);
  assert.equal(isLongSideOut({ dims: [7, 30, 37] }, {}, 'bottom'), false);
  assert.equal(isLongSideOut({ dims: [8, 30, 43.5] }, {}, 'bottom'), true);
  assert.equal(isLongSideOut({ dims: [15, 37, 46] }, {}, 'top', 'standing'), false);
});

test('flat stack: boxes go bottom → top, each on the one below', () => {
  const lay = layoutStack(stack('B1'), getGame);
  let y = 0;
  lay.boxes.forEach((b, i) => {
    assert.equal(b.x, 0);
    near(b.y, y, `B1 box ${i} y`);
    assert.equal(b.index, i);
    assert.equal(b.row, 0);
    y += b.h;
  });
  near(lay.h, y, 'B1 h');
});

test('side by side: Compile and Kontroll share the top level of B3', () => {
  const lay = layoutStack(stack('B3'), getGame);
  const compile = lay.boxes.find((b) => b.gameId === titled('Compile: Main 2').id);
  const kontroll = lay.boxes.find((b) => b.gameId === titled('Kontroll').id);
  assert.equal(compile.side, 0);
  assert.equal(kontroll.side, 1);
  assert.equal(compile.index, kontroll.index);
  assert.equal(compile.y, kontroll.y);
  assert.equal(compile.x, 0);
  near(kontroll.x, compile.w, 'Kontroll starts where Compile ends');
  near(compile.y, 7 + 6.7 + 5.7, 'top level floor');
  near(lay.h, compile.y + Math.max(compile.h, kontroll.h), 'level height = taller box');
});

test('topper: the LEGO castle is centred on top of M4 and counts in the height', () => {
  const lay = layoutStack(stack('M4'), getGame);
  assert.equal(lay.topper.label, 'LEGO castle');
  near(lay.pileH, 15, 'M4 pile');
  near(lay.topper.y, lay.pileH, 'castle floor');
  near(lay.topper.x, (lay.w - 35) / 2, 'castle centred');
  near(lay.h, lay.pileH + 21, 'M4 h');
  const ark = lay.boxes.find((b) => b.gameId === titled('Ark Nova').id);
  assert.equal(ark.rot, true, 'Ark Nova long side out');
  assert.equal(layoutStack(stack('B1'), getGame).topper, null);
});

test('two rows: front row first, back row behind it, depth = front + back', () => {
  for (const id of ['T1', 'B5', 'B6', 'L1']) {
    const st = stack(id);
    const lay = layoutStack(st, getGame);
    const front = lay.boxes.filter((b) => b.row === 0);
    const back = lay.boxes.filter((b) => b.row === 1);
    assert.equal(front.length, st.rows[0].length, `${id} front count`);
    assert.equal(back.length, st.rows[1].length, `${id} back count`);
    assert.ok(lay.boxes.indexOf(back[0]) > lay.boxes.indexOf(front.at(-1)), `${id} front row listed first`);
    const frontD = Math.max(...front.map((b) => b.d));
    const backD = Math.max(...back.map((b) => b.d));
    assert.ok(front.every((b) => b.z === 0), `${id} front z`);
    assert.ok(back.every((b) => Math.abs(b.z - frontD) < 1e-9), `${id} back z`);
    near(lay.d, frontD + backD, `${id} d`);
  }
});

test('standing: L1 card games go left → right on the floor, each row from the left end', () => {
  const lay = layoutStack(stack('L1'), getGame);
  for (const r of [0, 1]) {
    let x = 0;
    for (const b of lay.boxes.filter((bx) => bx.row === r)) {
      near(b.x, x, `L1 row ${r} x`);
      assert.equal(b.y, 0);
      x += b.w;
    }
  }
  assert.ok(lay.h <= ZONES['under-cards'].usable, 'card games fit under the stairs');
});

test('special placements: KLASK sticks out past the wall end, Ice Cool stands in the gap', () => {
  const t9 = stack('T9');
  const klask = layoutStack(t9, getGame);
  near(t9.x + klask.w, 208, 'KLASK right edge');
  assert.ok(t9.x + klask.w > ZONES.top.length, 'KLASK sticks out past x = 200');
  near(klask.d, 46, 'KLASK depth');

  const ice = layoutStack(stack('S1'), getGame);
  near(ice.h, 41, 'Ice Cool height');
  assert.ok(ice.h <= ZONES['under-gap'].usable);
});

test('a box with a missing size is laid out as a marked placeholder', () => {
  const st = { id: 'X', zone: 'bottom', x: 0, orientation: 'flat', rows: [[{ game: 'a' }, { game: 'b' }]] };
  const games = { a: { dims: [5, 20, 30] }, b: { dims: null } };
  const lay = layoutStack(st, (id) => games[id]);
  assert.equal(lay.boxes[0].missing, false);
  assert.equal(lay.boxes[1].missing, true);
  assert.deepEqual([lay.boxes[1].w, lay.boxes[1].d, lay.boxes[1].h], [10, 10, 3]);
  near(lay.h, 8, 'X h');
  // unknown game ids get the placeholder too, instead of crashing
  const unknown = layoutStack({ ...st, rows: [[{ game: 'nope' }]] }, () => undefined);
  assert.equal(unknown.boxes[0].missing, true);
});

test('an empty stack has no size (but keeps its topper)', () => {
  const lay = layoutStack({ id: 'E', zone: 'middle', x: 0, orientation: 'flat', rows: [[]] }, getGame);
  assert.deepEqual([lay.w, lay.d, lay.h, lay.boxes.length], [0, 0, 0, 0]);
  const withTopper = layoutStack({ id: 'E', zone: 'middle', x: 0, orientation: 'flat', rows: [[]], topper: { label: 'Bonsai', w: 18, h: 20 } }, getGame);
  assert.equal(withTopper.h, 20);
});

test('every box agrees with store.locate (stack, row, index, side)', () => {
  const plan = layoutPlan(store.getPlan(), getGame);
  assert.equal(plan.size, store.getPlan().stacks.length);
  let count = 0;
  for (const [stackId, lay] of plan) {
    for (const b of lay.boxes) {
      const loc = store.locate(b.gameId);
      assert.equal(loc.kind, 'stack', b.gameId);
      assert.deepEqual([loc.stackId, loc.row, loc.index, loc.side], [stackId, b.row, b.index, b.side], b.gameId);
      count++;
    }
  }
  const onShelves = store.getGames().filter((g) => store.locate(g.id).kind === 'stack').length;
  assert.equal(count, onShelves, 'every game on a stack has exactly one box');
});
