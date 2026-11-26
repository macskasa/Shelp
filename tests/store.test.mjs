// Core tests. Run from the repo root:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { on } from '../js/core/bus.js';
import { validateData } from '../js/core/schema.js';
import { describeLocation, formatDims, formatRange } from '../js/core/format.js';
import { ZONES, bracketLimit, isEasy } from '../js/core/shelves.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

const id = (title) => {
  const g = store.getGames().find((x) => x.title === title);
  assert.ok(g, `no game "${title}"`);
  return g.id;
};

async function fresh() {
  const storage = memoryStorage();
  await store.init({ seed, storage });
  return storage;
}

test('seed data is valid and complete', () => {
  assert.deepEqual(validateData(seed), []);
  assert.equal(seed.games.length, 204);
});

test('every game in the seed is placed exactly once', async () => {
  await fresh();
  const unplaced = store.getGames().filter((g) => store.locate(g.id).kind === 'unplaced');
  assert.deepEqual(unplaced.map((g) => g.title), []);
});

test('every stack in the seed sits in a known zone', () => {
  for (const st of seed.plan.stacks) assert.ok(ZONES[st.zone], st.id);
});

test('locate: stack, side by side, standing, inside, cupboard', async () => {
  await fresh();
  const deluxe = store.locate(id('Tokaido: Deluxe Edition'));
  assert.equal(deluxe.stackId, 'M4');
  assert.equal(deluxe.index, 0);
  assert.deepEqual(deluxe.above, [id('Ark Nova')]);

  const kontroll = store.locate(id('Kontroll'));
  assert.equal(kontroll.stackId, 'B3');
  assert.equal(kontroll.side, 1);
  assert.deepEqual(kontroll.above, []);
  assert.equal(kontroll.below.length, 3);

  const klask = store.locate(id('KLASK'));
  assert.equal(klask.orientation, 'standing');
  assert.equal(klask.stackId, 'T9');

  const boxZero = store.locate(id('Lairs: Box Zero'));
  assert.equal(boxZero.kind, 'inside');
  assert.equal(boxZero.hostId, id('Lairs'));
  assert.equal(boxZero.host.stackId, 'B4');

  assert.equal(store.locate(id('Scythe')).kind, 'cupboard');
  assert.equal(store.locate('nope'), null);
});

test('reads are frozen', async () => {
  await fresh();
  assert.throws(() => { store.getGames()[0].title = 'x'; }, TypeError);
  assert.throws(() => { store.getPlan().stacks.push({}); }, TypeError);
});

test('moveToCupboard and placeOnStack emit one change each and save', async () => {
  const storage = await fresh();
  const events = [];
  const off = on('store:changed', (d) => events.push(d));
  const ark = id('Ark Nova');
  store.moveToCupboard(ark, 'testing');
  assert.deepEqual(store.locate(ark), { kind: 'cupboard', reason: 'testing' });
  store.placeOnStack(ark, 'M4');
  assert.equal(store.locate(ark).stackId, 'M4');
  assert.equal(store.locate(ark).index, 1);
  off();
  assert.equal(events.length, 2);
  assert.equal(events[0].plan, true);
  assert.ok(JSON.parse(storage.getItem(store.STORAGE_KEY)).plan);
});

test('taking one box out of a side-by-side pair leaves a normal item', async () => {
  await fresh();
  store.moveToCupboard(id('Kontroll'));
  const top = store.getStack('B3').rows[0].at(-1);
  assert.equal(top.side, undefined);
  assert.equal(top.game, id('Compile: Main 2'));
});

test('setInside refuses nesting', async () => {
  await fresh();
  assert.throws(() => store.setInside(id('Fluxx'), id('Lairs: Box Zero')), /itself inside/);
  assert.throws(() => store.setInside(id('Lairs'), id('Fesztáv')), /take them out first/);
  store.setInside(id('Zombie Fluxx'), id('Fluxx'));
  assert.equal(store.locate(id('Zombie Fluxx')).hostId, id('Fluxx'));
});

test('batch: one event, and rollback on error', async () => {
  await fresh();
  const events = [];
  const off = on('store:changed', (d) => events.push(d));
  store.batch(() => {
    store.updateGame(id('Fluxx'), { notes: 'a' });
    store.updateGame(id('Spicy'), { notes: 'b' });
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].games.length, 2);
  assert.throws(() => store.batch(() => {
    store.updateGame(id('Fluxx'), { notes: 'changed' });
    store.updateGame(id('Fluxx'), { categories: ['nonsense'] });
  }));
  assert.equal(store.getGame(id('Fluxx')).notes, 'a');
  assert.equal(events.length, 1);
  off();
});

test('updateGame sorts dims and rejects bad data', async () => {
  await fresh();
  const e = id('Ethiq: Morális játszmák');
  store.updateGame(e, { dims: [22.6, 5.6, 14.6] });
  assert.deepEqual(store.getGame(e).dims, [5.6, 14.6, 22.6]);
  assert.throws(() => store.updateGame(e, { id: 'g999' }), /cannot change/);
  assert.throws(() => store.updateGame(e, { type: 'promo' }), /type/);
});

test('addGame and removeGame', async () => {
  await fresh();
  const nid = store.addGame({ title: 'Test Game', dims: [3, 10, 10] });
  assert.equal(nid, 'g205');
  assert.equal(store.locate(nid).kind, 'unplaced');
  store.removeGame(id('Lairs'));
  assert.equal(store.locate(id('Lairs: Box Zero')).kind, 'cupboard');
});

test('export → import round trip, and plan-only import', async () => {
  await fresh();
  store.moveToCupboard(id('Azul'), 'x');
  const backup = store.exportData();
  await fresh();
  assert.equal(store.importData(backup), 'all');
  assert.equal(store.locate(id('Azul')).kind, 'cupboard');

  const planOnly = { app: 'shelp', schema: 1, plan: structuredClone(seed.plan) };
  assert.equal(store.importData(planOnly), 'plan');
  assert.equal(store.locate(id('Azul')).stackId, 'B2');

  const bad = { app: 'shelp', schema: 1, plan: { ...structuredClone(seed.plan), cupboard: [{ game: 'g999', reason: '' }] } };
  assert.ok(store.validate(bad).some((p) => p.includes('g999')));
  assert.throws(() => store.importData(bad), /g999/);
});

test('saved data is used on the next start; broken data falls back to the seed', async () => {
  const storage = await fresh();
  store.moveToCupboard(id('Azul'), 'kept');
  await store.init({ seed, storage });
  assert.equal(store.locate(id('Azul')).reason, 'kept');

  const broken = memoryStorage({ [store.STORAGE_KEY]: '{"app":"shelp","schema":1,"games":"no"}' });
  await store.init({ seed, storage: broken });
  assert.equal(store.getGames().length, 204);
  assert.ok(broken.getItem('shelp:data:broken'));
});

test('format helpers', async () => {
  await fresh();
  const title = (gid) => store.getGame(gid)?.title;
  assert.equal(formatDims([5.1, 22.6, 30.5]), '30.5 × 22.6 × 5.1 cm');
  assert.equal(formatDims(null), 'size missing');
  assert.equal(formatRange({ min: 2, max: 2 }), '2');
  assert.equal(formatRange({ min: 30, max: 60 }, 'min'), '30–60 min');
  assert.equal(describeLocation(store.locate(id('Tokaido: Deluxe Edition')), title), 'Middle shelf · stack M4 · at the bottom · 1 box on top');
  assert.match(describeLocation(store.locate(id('Lairs: Box Zero')), title), /^Inside the Lairs box \(Bottom shelf · stack B4/);
});

test('shelf helpers', () => {
  assert.equal(bracketLimit('middle', 36), 30.5);
  assert.equal(bracketLimit('bottom', 0), 37.5);
  assert.ok(isEasy('top', 0, 23));
  assert.ok(!isEasy('top', 36.5, 28));
  assert.ok(!isEasy('middle', 0, 10));
});
