// Plan format v2: upgrade, geometry, locations, edit operations, undo, checks. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { boxSize, layoutStack2 } from '../js/core/geometry.js';
import { migrateDataV1, toV1Plan } from '../js/core/plan2.js';
import { checkData, knownFrom } from '../js/core/schema.js';
import { describeLocation2 } from '../js/core/format.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/v5-geometry.json', import.meta.url), 'utf8'));
const TOL = 0.05;
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= TOL, `${what}: got ${a}, expected ${b}`);

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
async function fresh() {
  await store.init({ seed, storage: memoryStorage() });
}
const id = (title) => {
  const g = store.getGames().find((x) => x.title === title);
  assert.ok(g, `no game "${title}"`);
  return g.id;
};
const box = (gid) => store.getPlan2().stacks.flatMap((s) => s.boxes).find((b) => b.game === gid);
const stack2 = (sid) => store.getStack2(sid);

/** No two boxes on the same surface overlap along the shelf. */
function assertNoOverlap(stackId) {
  const st = stack2(stackId);
  const lay = layoutStack2(st, store.getGame);
  const groups = new Map();
  for (const b of lay.boxes) {
    const key = `${b.row}|${[...b.on].sort().join(',')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.x - b.x);
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].x >= list[i - 1].x + list[i - 1].w - 0.01, `${stackId}: ${list[i].gameId} overlaps ${list[i - 1].gameId}`);
    }
  }
}

// ---------------------------------------------------------------- upgrade

test('boxSize: up and rot', () => {
  assert.deepEqual(boxSize([7, 30, 37], 's', false), { w: 30, d: 37, h: 7 });
  assert.deepEqual(boxSize([7, 30, 37], 's', true), { w: 37, d: 30, h: 7 });
  assert.deepEqual(boxSize([2.5, 9.5, 12.7], 'l', false), { w: 2.5, d: 9.5, h: 12.7 }); // a card box like a book
  assert.deepEqual(boxSize([15, 37, 46], 'm', false), { w: 15, d: 46, h: 37 }); // KLASK
  assert.deepEqual(boxSize([30, 7, 37], 'm', true), { w: 37, d: 7, h: 30 }); // dims in any order
});

test('upgrade: v1 → v2 → v1 gives back the seed plan exactly', () => {
  const up = migrateDataV1(structuredClone(seed));
  assert.equal(up.schema, 2);
  assert.deepEqual(toV1Plan(up.plan), seed.plan);
  assert.deepEqual(up.plan.board, []);
});

test('upgrade: every v5 stack keeps its size (geometry fixture)', () => {
  const up = migrateDataV1(structuredClone(seed));
  const byId = new Map(up.games.map((g) => [g.id, g]));
  for (const st of up.plan.stacks) {
    const want = fixture[st.id];
    assert.ok(want, `no fixture for ${st.id}`);
    const got = layoutStack2(st, (gid) => byId.get(gid));
    near(got.w, want.w, `${st.id} w`);
    near(got.d, want.d, `${st.id} d`);
    near(got.h, want.h, `${st.id} h`);
    near(st.x, want.x, `${st.id} x`);
  }
});

test('upgrade: pizza is off exactly for the 20 games that stood in v5', () => {
  const up = migrateDataV1(structuredClone(seed));
  const notPizza = up.games.filter((g) => !g.pizza).map((g) => g.title);
  assert.equal(notPizza.length, 20);
  assert.ok(notPizza.includes('KLASK') && notPizza.includes('Ice Cool') && notPizza.includes('Fluxx'));
  assert.deepEqual(checkData(seed).problems, []);
});

// ---------------------------------------------------------------- reads

test('locate2: floor, on a box, side by side, standing, inside, cupboard', async () => {
  await fresh();
  const ky = store.locate2(id("Let's Go! To Japan"));
  assert.deepEqual([ky.stackId, ky.on.length], ['B3', 0]);
  assert.deepEqual(ky.above, [id('Legacy of Yu'), id('Takenokolor'), id('Compile: Main 2'), id('Kontroll')]);
  const kon = store.locate2(id('Kontroll'));
  assert.deepEqual(kon.on, [id('Takenokolor')]);
  assert.deepEqual(kon.above, []);
  assert.deepEqual(kon.below, [id('Takenokolor'), id('Legacy of Yu'), id("Let's Go! To Japan")]);
  assert.equal(store.locate2(id('KLASK')).up, 'm');
  assert.equal(store.locate2(id('Fluxx')).up, 'l');
  assert.equal(store.locate2(id('Lairs: Box Zero')).kind, 'inside');
  assert.equal(store.locate2(id('Scythe')).kind, 'cupboard');
  const title = (g) => store.getGame(g)?.title;
  assert.equal(describeLocation2(kon, title), 'Bottom shelf · stack B3 · on Takenokolor · nothing on top');
  assert.equal(describeLocation2(store.locate2(id('Fluxx')), title), 'Under the stairs – card games · stack L1 · front row · standing on the shelf · nothing on top');
});

test('a new game has no place, so it is on the board', async () => {
  await fresh();
  const g = store.addGame({ title: 'New one', dims: [3, 10, 10] });
  assert.equal(store.locate2(g).kind, 'board');
  assert.deepEqual(store.getBoard(), [g]);
  assert.equal(store.locate(g).kind, 'unplaced'); // v1 view
  assert.equal(store.getGame(g).pizza, true);
});

// ---------------------------------------------------------------- moving

test('moveToBoard from the middle of a pile: the boxes above settle down', async () => {
  await fresh();
  const yu = id('Legacy of Yu');
  store.moveToBoard(yu);
  assert.deepEqual(store.locate2(id('Takenokolor')).on, [id("Let's Go! To Japan")]);
  assert.equal(store.locate2(yu).kind, 'board');
  assert.deepEqual(store.getBoard(), [yu]);
  assert.equal(store.locate(yu).kind, 'unplaced');
});

test('placeBox on the floor of a book row: the neighbours move over', async () => {
  await fresh();
  const tab = id('Tábortűz'); // a small tin; it lies flat on B4, so it is pizza – make it not pizza first
  store.updateGame(tab, { pizza: false });
  const fluxx = box(id('Fluxx'));
  const fluxxX = fluxx.x;
  store.placeBox(tab, { stackId: 'L1', row: 0, on: [], index: 0, up: 'l' });
  const w = boxSize(store.getGame(tab).dims, 'l', false).w;
  assert.equal(box(tab).x, 0);
  near(box(id('Fluxx')).x, fluxxX + w, 'Fluxx moved over');
  assertNoOverlap('L1');
  assertNoOverlap('B4');
});

test('placeBox on top of a box, and across two boxes (a bridge)', async () => {
  await fresh();
  const take = id('Takenokolor');
  const compile = id('Compile: Main 2');
  const kontroll = id('Kontroll');
  const mind = id('The Mind – Érezz rá!');
  store.placeBox(mind, { stackId: 'B3', on: [compile, kontroll] });
  const loc = store.locate2(mind);
  assert.deepEqual(loc.on, [compile, kontroll]);
  assert.deepEqual(store.locate2(compile).above, [mind]);
  const lay = layoutStack2(stack2('B3'), store.getGame);
  const m = lay.boxes.find((b) => b.gameId === mind);
  const c = lay.boxes.find((b) => b.gameId === compile);
  near(m.y, c.y + c.h, 'the bridge sits on top of its supports');
  const odin = id('Odin'); // a card game (not pizza): lying flat is fine too
  store.placeBox(odin, { stackId: 'B3', on: [take] }); // third box on Takenokolor, at the right end
  assert.ok(box(odin).x >= box(kontroll).x, 'Odin goes right of Kontroll');
  assertNoOverlap('B3');
  assert.match(describeLocation2(loc, (g) => store.getGame(g).title), /across Compile: Main 2 and Kontroll/);
});

test('placeUnder: slide a box under a pile', async () => {
  await fresh();
  const ice = id('Ice Cool'); // 21 × 41 × 6, not pizza (it stands in v5), so it may lie flat too
  store.placeUnder(ice, [id('7 Csoda')], { up: 's', rot: true });
  assert.deepEqual(store.locate2(id('7 Csoda')).on, [ice]);
  assert.deepEqual(store.locate2(ice).on, []);
  assert.equal(store.locate(ice).index, 0); // v1 view: at the bottom of B1
});

test('the store refuses: no size, pizza not flat, bad supports', async () => {
  await fresh();
  assert.throws(() => store.placeBox(id('Lairs: Box Zero'), { stackId: 'B4' }), /box size/);
  assert.throws(() => store.placeBox(id('Azul'), { stackId: 'B1', up: 'l' }), /pizza game/);
  assert.throws(() => store.turnBox(id('Ark Nova'), { up: 'm' }), /pizza game/);
  assert.throws(() => store.placeBox(id('Odin'), { stackId: 'B3', on: [id('Azul')] }), /not on stack B3/);
  assert.throws(() => store.placeBox(id('Odin'), { stackId: 'Z9' }), /no stack Z9/);
  assert.throws(() => store.updateGame(id('Fluxx'), { pizza: true }), /Turn it flat first/);
});

test('turnBox: a card game laid flat makes its neighbours move over', async () => {
  await fresh();
  const fluxx = id('Fluxx');
  const next = store.getStack2('L1').boxes.filter((b) => b.row === 0).sort((a, b) => a.x - b.x)[1];
  const nextX = next.x;
  store.turnBox(fluxx, { up: 's' });
  const dims = store.getGame(fluxx).dims;
  const dw = boxSize(dims, 's', false).w - boxSize(dims, 'l', false).w;
  near(box(next.game).x, nextX + dw, 'neighbour moved by the change in width');
  assertNoOverlap('L1');
  store.turnBox(id('Ark Nova'), { rot: false }); // pizza games can still be turned round
  assert.equal(box(id('Ark Nova')).rot, false);
});

test('stacks: create, move, remove (games to the board), renumber', async () => {
  await fresh();
  const sid = store.createStack('top', { x: 120 });
  assert.equal(sid, 'T10');
  store.placeBox(id('Odin'), { stackId: sid });
  store.moveStack(sid, 125);
  assert.equal(stack2(sid).x, 125);
  const map = store.renumberStacks();
  assert.equal(map.T10, 'T7'); // at 125 cm it is the 7th stack from the left (after T6 at 109.7)
  assert.equal(map.T9, 'T10');
  assert.equal(store.locate2(id('Odin')).stackId, map.T10);
  store.removeStack(map.T10);
  assert.equal(store.locate2(id('Odin')).kind, 'board');
});

// ---------------------------------------------------------------- undo

test('undo and redo; metadata is not an undo step', async () => {
  await fresh();
  assert.equal(store.canUndo(), false);
  const yu = id('Legacy of Yu');
  store.moveToBoard(yu);
  store.setMeta('lastBackup', 'x');
  assert.ok(store.canUndo());
  store.undo();
  assert.equal(store.locate2(yu).stackId, 'B3');
  assert.equal(store.getMeta().lastBackup, 'x', 'undo keeps metadata');
  assert.ok(store.canRedo());
  store.redo();
  assert.equal(store.locate2(yu).kind, 'board');
  store.batch(() => {
    store.moveToBoard(id('Odin'));
    store.moveToBoard(id('Spicy'));
  });
  store.undo();
  assert.equal(store.locate2(id('Odin')).stackId, 'L1');
  assert.equal(store.locate2(id('Spicy')).stackId, 'L1');
  assert.equal(store.locate2(yu).kind, 'board', 'one batch = one undo step');
});

// ---------------------------------------------------------------- checks and files

test('schema 2 checks: supports, loops, pizza, sizes, board', async () => {
  await fresh();
  const known = knownFrom(store.getGames());
  const base = () => structuredClone(store.exportData());
  const bad = (mutate, pattern) => {
    const f = base();
    mutate(f.plan);
    const { problems } = checkData({ app: 'shelp', schema: 2, plan: f.plan }, known);
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern}, got ${problems.join(' | ')}`);
  };
  const b3 = (p) => p.stacks.find((s) => s.id === 'B3').boxes;
  bad((p) => { b3(p)[0].on = ['a', 'b', 'c']; }, /at most 2/);
  bad((p) => { const bx = b3(p); bx[0].on = [bx[1].game]; }, /loop/);
  bad((p) => { p.stacks.find((s) => s.id === 'T1').boxes[0].on = [p.stacks.find((s) => s.id === 'T1').boxes.find((b) => b.row === 1).game]; }, /other row/);
  bad((p) => { b3(p)[0].up = 'l'; }, /pizza game/);
  bad((p) => { b3(p).push({ game: id('Lairs: Box Zero'), row: 0, x: 0, up: 's', rot: false, on: [] }); delete p.inside[id('Lairs: Box Zero')]; }, /no box size/);
  bad((p) => { p.board.push({ game: 'g999' }); }, /unknown game/);
});

test('files: v2 backup round trip, v1 backup upgrade, v2 plan replace', async () => {
  await fresh();
  store.moveToBoard(id('Azul'));
  const backup = store.exportData();
  assert.equal(backup.schema, 2);
  await fresh();
  assert.equal(store.importData(backup), 'all');
  assert.equal(store.locate2(id('Azul')).kind, 'board');
  assert.equal(store.importData(structuredClone(seed)), 'all'); // an old v1 backup
  assert.equal(store.locate2(id('Azul')).stackId, 'B2');
  const plan = structuredClone(store.getPlan2());
  plan.stacks = plan.stacks.filter((s) => s.id !== 'N5');
  plan.board.push({ game: id('Chess') });
  store.replacePlan(plan);
  assert.equal(store.locate2(id('Chess')).kind, 'board');
  assert.equal(store.undo(), true);
  assert.equal(store.locate2(id('Chess')).stackId, 'N5');
});

test('v1 compatibility: placeOnStack at the bottom slides the box under the pile', async () => {
  await fresh();
  const tm = id('T.I.M.E Stories: Lumen Fidei');
  store.placeOnStack(tm, 'M3', { index: 0 });
  assert.equal(store.locate(tm).index, 0);
  assert.deepEqual(store.locate2(id('SETI – Kutatás a földön kívüli élet után')).on, [tm]);
  store.placeOnStack(tm, 'M3'); // on top
  assert.deepEqual(store.locate2(tm).on, [id('Tokaido Duo')]);
});

test('preview: try a change without keeping it', async () => {
  await fresh();
  const events = [];
  const { on } = await import('../js/core/bus.js');
  const off = on('store:changed', (d) => events.push(d));
  const tm = id('T.I.M.E Stories: Lumen Fidei');
  const r = store.preview(() => store.placeBox(tm, { stackId: 'M3', on: [id('Tokaido Duo')] }));
  off();
  assert.equal(r.error, null);
  assert.ok(r.plan.stacks.find((s) => s.id === 'M3').boxes.some((b) => b.game === tm));
  assert.equal(store.locate2(tm).kind, 'cupboard', 'nothing changed for real');
  assert.equal(events.length, 0);
  assert.equal(store.canUndo(), false);
  const bad = store.preview(() => store.placeBox(id('Azul'), { stackId: 'B1', up: 'l' }));
  assert.match(bad.error.message, /pizza game/);
  assert.equal(bad.plan, null);
});
