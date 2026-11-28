// Core tests. Run from the repo root:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { on } from '../js/core/bus.js';
import { validateData } from '../js/core/schema.js';
import { describeLocation2, formatDims, formatRange } from '../js/core/format.js';
import { ZONES, bracketLimit, isEasy } from '../js/core/shelves.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8')); // schema 2
const seedV1 = JSON.parse(readFileSync(new URL('./fixtures/seed-v1.json', import.meta.url), 'utf8')); // for schema 1 files

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
  const onBoard = store.getGames().filter((g) => store.locate2(g.id).kind === 'board');
  assert.deepEqual(onBoard.map((g) => g.title), []);
  assert.deepEqual(store.getBoard(), []);
});

test('every stack in the seed sits in a known zone', () => {
  for (const st of seed.plan.stacks) assert.ok(ZONES[st.zone], st.id);
});

test('locate2: stack, side by side, standing, inside, cupboard', async () => {
  await fresh();
  const deluxe = store.locate2(id('Tokaido: Deluxe Edition'));
  assert.equal(deluxe.stackId, 'M4');
  assert.deepEqual(deluxe.on, []); // at the bottom
  assert.deepEqual(deluxe.above, [id('Ark Nova')]);

  const kontroll = store.locate2(id('Kontroll'));
  assert.equal(kontroll.stackId, 'B3');
  assert.deepEqual(kontroll.on, store.locate2(id('Compile: Main 2')).on, 'side by side with Compile');
  assert.deepEqual(kontroll.above, []);
  assert.equal(kontroll.below.length, 3);

  const klask = store.locate2(id('KLASK'));
  assert.equal(klask.up, 'm'); // standing on its side
  assert.equal(klask.stackId, 'T9');

  const boxZero = store.locate2(id('Lairs: Box Zero'));
  assert.equal(boxZero.kind, 'inside');
  assert.equal(boxZero.hostId, id('Lairs'));
  assert.equal(boxZero.host.stackId, 'B4');

  assert.equal(store.locate2(id('Scythe')).kind, 'cupboard');
  assert.equal(store.locate2('nope'), null);
});

test('reads are frozen', async () => {
  await fresh();
  assert.throws(() => { store.getGames()[0].title = 'x'; }, TypeError);
  assert.throws(() => { store.getPlan2().stacks.push({}); }, TypeError);
});

test('moveToCupboard and placeBox emit one change each and save', async () => {
  const storage = await fresh();
  const events = [];
  const off = on('store:changed', (d) => events.push(d));
  const ark = id('Ark Nova');
  const deluxe = id('Tokaido: Deluxe Edition');
  store.moveToCupboard(ark, 'testing');
  assert.deepEqual(store.locate2(ark), { kind: 'cupboard', reason: 'testing' });
  store.placeBox(ark, { stackId: 'M4', on: [deluxe], rot: true });
  assert.equal(store.locate2(ark).stackId, 'M4');
  assert.deepEqual(store.locate2(ark).on, [deluxe]);
  off();
  assert.equal(events.length, 2);
  assert.equal(events[0].plan, true);
  assert.ok(JSON.parse(storage.getItem(store.STORAGE_KEY)).plan);
});

test('taking one box out of a side-by-side pair leaves the other where it was', async () => {
  await fresh();
  const compile = id('Compile: Main 2');
  const before = store.locate2(compile);
  store.moveToCupboard(id('Kontroll'));
  const b3 = store.getStack2('B3').boxes;
  assert.equal(b3.length, 4);
  assert.ok(!b3.some((b) => b.game === id('Kontroll')));
  assert.deepEqual(store.locate2(compile), before);
});

test('setInside refuses nesting', async () => {
  await fresh();
  assert.throws(() => store.setInside(id('Fluxx'), id('Lairs: Box Zero')), /itself inside/);
  assert.throws(() => store.setInside(id('Lairs'), id('Fesztáv')), /take them out first/);
  store.setInside(id('Zombie Fluxx'), id('Fluxx'));
  assert.equal(store.locate2(id('Zombie Fluxx')).hostId, id('Fluxx'));
});

test('games without a box size never go on a shelf', async () => {
  await fresh();
  const boxZero = id('Lairs: Box Zero'); // dims: null, stored inside Lairs
  assert.throws(() => store.placeBox(boxZero, { stackId: 'B4' }), /box size/);
  assert.equal(store.locate2(boxZero).kind, 'inside');
  // its size may stay empty while it is inside a box or in the cupboard
  store.moveToCupboard(boxZero, 'test');
  store.updateGame(boxZero, { notes: 'still no size' });
  // a game on a shelf cannot lose its size
  assert.throws(() => store.updateGame(id('Ark Nova'), { dims: null }), /cannot be removed/);
  assert.deepEqual(store.getGame(id('Ark Nova')).dims, [7, 30, 37]);
  // a plan or backup (schema 1, as made in chat) that puts a size-less game on a stack is refused
  const plan = structuredClone(seedV1.plan);
  plan.inside = Object.fromEntries(Object.entries(plan.inside).filter(([k]) => k !== boxZero));
  plan.stacks.find((s) => s.id === 'B4').rows[0].push({ game: boxZero });
  plan.cupboard = plan.cupboard.filter((c) => c.game !== boxZero);
  assert.ok(store.validate({ app: 'shelp', schema: 1, plan }).some((p) => p.includes('no box size')));
  assert.throws(() => store.replacePlan(plan), /no box size/);
  const full = { app: 'shelp', schema: 1, games: structuredClone(seedV1.games), plan };
  assert.ok(validateData(full).some((p) => p.includes('no box size')));
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
  assert.equal(store.locate2(nid).kind, 'board');
  store.removeGame(id('Lairs'));
  assert.equal(store.locate2(id('Lairs: Box Zero')).kind, 'cupboard');
});

test('export → import round trip, and plan-only import', async () => {
  await fresh();
  store.moveToCupboard(id('Azul'), 'x');
  const backup = store.exportData();
  await fresh();
  assert.equal(store.importData(backup), 'all');
  assert.equal(store.locate2(id('Azul')).kind, 'cupboard');

  const planOnly = { app: 'shelp', schema: 1, plan: structuredClone(seedV1.plan) };
  assert.equal(store.importData(planOnly), 'plan');
  assert.equal(store.locate2(id('Azul')).stackId, 'B2');

  const bad = { app: 'shelp', schema: 1, plan: { ...structuredClone(seedV1.plan), cupboard: [{ game: 'g999', reason: '' }] } };
  assert.ok(store.validate(bad).some((p) => p.includes('g999')));
  assert.throws(() => store.importData(bad), /g999/);
});

test('saved data is used on the next start; broken data falls back to the seed', async () => {
  const storage = await fresh();
  store.moveToCupboard(id('Azul'), 'kept');
  await store.init({ seed, storage });
  assert.equal(store.locate2(id('Azul')).reason, 'kept');

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
  assert.equal(describeLocation2(store.locate2(id('Tokaido: Deluxe Edition')), title), 'Middle shelf · stack M4 · on the shelf · 1 box on top');
  assert.match(describeLocation2(store.locate2(id('Lairs: Box Zero')), title), /^Inside the Lairs box \(Bottom shelf · stack B4/);
});

test('shelf helpers', () => {
  assert.equal(bracketLimit('middle', 36), 30.5);
  assert.equal(bracketLimit('bottom', 0), 37.5);
  assert.ok(isEasy('top', 0, 23));
  assert.ok(!isEasy('top', 36.5, 28));
  assert.ok(!isEasy('middle', 0, 10));
});

// ---------------------------------------------------------------- saved versions (D6)

test('saved versions: save, list, get, rename, delete; not undo steps', async () => {
  await fresh();
  const events = [];
  const off = on('store:changed', (d) => events.push(d));
  const v1 = store.saveVersion('  Before   the top shelf ');
  store.moveToCupboard(id('Azul'), 'x');
  const v2 = store.saveVersion('After Azul');
  off();
  assert.deepEqual([v1, v2], ['v1', 'v2']);
  const list = store.listVersions();
  assert.deepEqual(list.map((v) => v.name), ['After Azul', 'Before the top shelf']); // newest first
  assert.equal(list[0].games, 204);
  assert.equal(list[0].stacks, store.getPlan2().stacks.length);
  assert.ok(Object.isFrozen(list) && Object.isFrozen(list[0]));
  assert.equal(events.filter((e) => e.versions).length, 2);
  assert.equal(store.getVersion(v1).plan.cupboard.some((c) => c.game === id('Azul')), false);
  assert.equal(store.getVersion(v2).plan.cupboard.some((c) => c.game === id('Azul')), true);
  assert.ok(Object.isFrozen(store.getVersion(v1).plan.stacks[0]));
  assert.equal(store.getVersion('nope'), null);

  store.renameVersion(v1, 'Start');
  assert.equal(store.getVersion(v1).name, 'Start');
  store.deleteVersion(v2);
  assert.deepEqual(store.listVersions().map((v) => v.id), ['v1']);
  // only the cupboard move is an undo step
  assert.equal(store.undo(), true);
  assert.equal(store.canUndo(), false);
  assert.throws(() => store.renameVersion('v9', 'x'), /no such saved version/);
});

test('saved versions: names, the limit of 10, not inside preview or batch', async () => {
  await fresh();
  assert.throws(() => store.saveVersion('   '), /Give the version a name/);
  assert.throws(() => store.saveVersion('x'.repeat(61)), /at most 60/);
  for (let i = 1; i <= store.MAX_VERSIONS; i++) store.saveVersion(`V${i}`);
  assert.throws(() => store.saveVersion('one more'), /10 saved versions is the most/);
  store.deleteVersion('v3');
  assert.equal(store.saveVersion('again'), 'v11');
  assert.throws(() => store.batch(() => store.saveVersion('in batch')), /cannot run inside preview\(\) or batch\(\)/);
  const p = store.preview(() => store.deleteVersion('v1'));
  assert.match(p.error.message, /cannot run inside/);
  assert.equal(store.listVersions().length, 10);
});

test('saved versions: switching to one is one undo step and keeps metadata', async () => {
  await fresh();
  const before = store.exportData();
  const v = store.saveVersion('Start');
  store.batch(() => {
    store.moveToBoard(id('Azul'));
    store.updateGame(id('Azul'), { notes: 'changed' });
  });
  store.setMeta('lastImport', { at: 'today' });
  store.restoreVersion(v);
  assert.deepEqual(store.exportData().plan, before.plan);
  assert.equal(store.getGame(id('Azul')).notes, before.games.find((g) => g.id === id('Azul')).notes);
  assert.deepEqual(store.getMeta().lastImport, { at: 'today' });
  store.undo();
  assert.equal(store.locate2(id('Azul')).kind, 'board');
  assert.equal(store.getGame(id('Azul')).notes, 'changed');
  // restoreVersion may run inside preview (it only changes games and plan)
  const p = store.preview(() => store.restoreVersion(v));
  assert.equal(p.error, null);
  assert.equal(store.locate2(id('Azul')).kind, 'board');
});

test('saved versions persist; broken ones are left out', async () => {
  const storage = await fresh();
  store.saveVersion('Kept');
  await store.init({ seed, storage });
  assert.deepEqual(store.listVersions().map((v) => v.name), ['Kept']);

  const good = JSON.parse(storage.getItem(store.VERSIONS_KEY))[0];
  const mixed = memoryStorage({ [store.VERSIONS_KEY]: JSON.stringify([good, { id: 'v2', name: 'Bad', savedAt: 'x', games: [], plan: {} }]) });
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a);
  try {
    await store.init({ seed, storage: mixed });
  } finally {
    console.error = orig;
  }
  assert.deepEqual(store.listVersions().map((v) => v.name), ['Kept']);
  assert.equal(errors.length, 1);
});

test('backups carry saved versions; importing replaces them only when the file has them', async () => {
  await fresh();
  assert.equal('versions' in store.exportData(), false); // none saved: no field
  store.saveVersion('A');
  store.saveVersion('B');
  const backup = store.exportData();
  assert.equal(backup.versions.length, 2);
  assert.deepEqual(store.validate(backup), []);

  store.deleteVersion('v1');
  store.deleteVersion('v2');
  store.saveVersion('Local');
  store.importData(backup);
  assert.deepEqual(store.listVersions().map((v) => v.name), ['B', 'A']);

  // a backup without versions (older file) and a plan-only file leave them alone
  const { versions, ...older } = backup; // eslint-disable-line no-unused-vars
  store.importData(older);
  store.importData({ app: 'shelp', schema: 2, plan: backup.plan });
  assert.equal(store.listVersions().length, 2);

  // a broken version makes the whole file invalid; versions in a plan-only file are refused
  const bad = structuredClone(backup);
  bad.versions[0].plan.stacks[0].boxes[0].game = 'g999';
  assert.match(store.validate(bad).join('\n'), /saved version "A"/);
  assert.match(store.validate({ app: 'shelp', schema: 2, plan: backup.plan, versions: [] }).join('\n'), /only be in a full backup/);
  assert.throws(() => store.importData(bad), /saved version "A"/);
  assert.equal(store.listVersions().length, 2);
});

test('family (B2): every game has one; cleaned, letter case joins an existing family, old files load', async () => {
  await fresh();
  assert.ok(store.getGames().every((g) => g.family === null));
  assert.deepEqual(store.getFamilies(), []);
  const azul = id('Azul');
  const kids = id('Azul Kids');
  store.updateGame(azul, { family: '  Azul  ' });
  store.updateGame(kids, { family: 'azul' });
  assert.equal(store.getGame(kids).family, 'Azul', 'joins the existing spelling');
  assert.deepEqual(store.getFamilies(), [{ name: 'Azul', ids: [azul, kids] }]);
  assert.ok(Object.isFrozen(store.getFamilies()[0].ids));
  store.updateGame(kids, { family: '   ' });
  assert.equal(store.getGame(kids).family, null);
  assert.throws(() => store.updateGame(azul, { family: 'x'.repeat(41) }), /family/);
  assert.throws(() => store.updateGame(azul, { family: 7 }), /family/);
  const added = store.addGame({ title: 'Azul Mini', family: 'AZUL' });
  assert.equal(store.getGame(added).family, 'Azul');
  // a backup from before families: no `family` key → null
  const old = store.exportData();
  for (const g of old.games) delete g.family;
  delete old.versions;
  store.importData(old);
  assert.ok(store.getGames().every((g) => g.family === null));
  assert.deepEqual(validateData(old), []);
});

test('renameFamily: one undo step, merges, case fix, null unlinks', async () => {
  await fresh();
  const [a, b, c] = [id('Azul'), id('Azul Kids'), id('Lairs')];
  store.batch(() => {
    store.updateGame(a, { family: 'azul' });
    store.updateGame(b, { family: 'azul' });
    store.updateGame(c, { family: 'Lairs' });
  });
  assert.equal(store.renameFamily('azul', 'Azul'), 2, 'a case fix renames every member');
  assert.deepEqual(store.getFamilies().map((f) => f.name), ['Azul', 'Lairs']);
  store.undo();
  assert.equal(store.getGame(a).family, 'azul');
  store.redo();
  assert.equal(store.renameFamily('Lairs', 'AZUL'), 1);
  assert.deepEqual(store.getFamilies(), [{ name: 'Azul', ids: [a, b, c].sort((x, y) => store.getGames().findIndex((g) => g.id === x) - store.getGames().findIndex((g) => g.id === y)) }]);
  assert.equal(store.renameFamily('Azul', null), 3);
  assert.deepEqual(store.getFamilies(), []);
  assert.throws(() => store.renameFamily('Nope', 'X'), /No game is in the family/);
});

test('joinStacks: two neighbours become one, every box stays put; one undo step; refusals', async () => {
  await fresh();
  const { layoutStack2 } = await import('../js/core/geometry.js');
  const where = (st) => {
    const lay = layoutStack2(st, store.getGame);
    return new Map(lay.boxes.map((b) => [b.gameId, [Math.round((st.x + b.x) * 100) / 100, b.y, b.row]]));
  };
  const before = JSON.stringify(store.exportData().plan);
  const placed = new Map([...where(store.getStack2('M1')), ...where(store.getStack2('M2'))]);
  const notes = [...(store.getStack2('M1').notes ?? []), ...(store.getStack2('M2').notes ?? [])];
  assert.equal(store.joinStacks('M2', 'M1'), 'M1', 'the left one keeps its id, in either order');
  assert.equal(store.getStack2('M2'), undefined);
  const joined = store.getStack2('M1');
  assert.equal(joined.x, 0.2);
  assert.deepEqual(where(joined), placed, 'every box keeps its place on the shelf, height and row');
  assert.deepEqual(joined.notes ?? [], notes);
  assert.equal(store.locate2(id('Port Royal')).stackId, 'M1');
  store.undo();
  assert.equal(JSON.stringify(store.exportData().plan), before, 'one undo step');
  assert.throws(() => store.joinStacks('M1', 'M3'), /M2 is between M1 and M3/);
  assert.throws(() => store.joinStacks('M3', 'M4'), /topper/);
  assert.throws(() => store.joinStacks('M7', 'B1'), /different shelves/);
  assert.throws(() => store.joinStacks('M1', 'M1'), /itself/);
  store.moveStack('M2', 20);
  assert.throws(() => store.joinStacks('M1', 'M2'), /overlap/);
  // it works inside preview too (Bruce's confirmation)
  store.undo();
  const p = store.preview(() => store.joinStacks('M1', 'M2'));
  assert.equal(p.error, null);
  assert.equal(p.plan.stacks.some((s) => s.id === 'M2'), false);
  assert.equal(JSON.stringify(store.exportData().plan), before);
});

test('a bridge across two joined stacks starts right of the boxes on its left support', async () => {
  await fresh();
  const { layoutStack2 } = await import('../js/core/geometry.js');
  // like Adam's plan: M1's pile ends just before M2, Csúcstámadás with Műgyűjtők társasága on it, SETI: Space Agencies open
  store.moveStack('M1', 10.2);
  store.moveToBoard(id('Port Royal'));
  const csucs = id('Csúcstámadás (Peaks)');
  const mugy = id('Műgyűjtők társasága');
  const seti = id('SETI: Space Agencies');
  store.joinStacks('M1', 'M2');
  const game = id('Halmazállapot'); // 12.7 × 12.7, flat
  store.placeBox(game, { stackId: 'M1', on: [csucs, seti], up: 's', rot: false });
  const lay = layoutStack2(store.getStack2('M1'), store.getGame);
  const at = (g) => lay.boxes.find((b) => b.gameId === g);
  assert.ok(at(game).x >= at(mugy).x + at(mugy).w - 1e-6, 'starts right of Műgyűjtők társasága');
  assert.ok(at(game).x < at(csucs).x + at(csucs).w, 'still rests on Csúcstámadás');
  assert.ok(at(game).x + at(game).w > at(seti).x, 'and reaches SETI: Space Agencies');
  assert.equal(at(game).y, Math.max(at(csucs).y + at(csucs).h, at(seti).y + at(seti).h), 'on the higher of the two');
});
