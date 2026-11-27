// BGG import: parsing, matching and applying, against the real sample export. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { parseBggCsv, planImport, diffGame, newGameFields, afterImportHints } from '../js/io/bgg.js';
import { applyImport } from '../js/io/apply.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const csv = readFileSync(new URL('./fixtures/bgg-sample.csv', import.meta.url), 'utf8');
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const fresh = () => store.init({ seed, storage: memoryStorage() });
const planNow = () => planImport(parseBggCsv(csv).rows, store.getGames(), store.getMeta());
const bggId = (id) => store.getGame(id).bggId;
const byTitle = (t) => store.getGames().find((g) => g.title === t);

test('the sample export is read: 14 owned rows with the columns we need', () => {
  const { rows, notOwned } = parseBggCsv(csv);
  assert.equal(rows.length, 14);
  assert.equal(notOwned, 0);
  const lairs = rows.find((r) => r.bggId === 404883);
  assert.deepEqual(lairs, {
    bggId: 404883, name: 'Lairs', type: 'base',
    players: { min: 2, max: 2 }, time: { min: 30, max: 60 }, age: '8+',
  });
  assert.equal(rows.find((r) => r.bggId === 294345).type, 'expansion');
  // BGG writes 0 and an empty age when it knows nothing: that is "unknown", not a value
  const boxZero = rows.find((r) => r.bggId === 478119);
  assert.equal(boxZero.time, null);
  assert.equal(boxZero.age, null);
});

test('only own = 1 counts, duplicates collapse, other files are refused', () => {
  const header = 'objectname,objectid,own,itemtype,minplayers,maxplayers,minplaytime,maxplaytime,bggrecagerange\n';
  const text = `${header}A,1,1,standalone,2,4,30,60,8+\nB,2,0,standalone,2,4,30,60,8+\nA again,1,1,standalone,1,1,1,1,1+\n`;
  const { rows, notOwned } = parseBggCsv(text);
  assert.deepEqual(rows.map((r) => r.name), ['A']);
  assert.equal(notOwned, 1);
  assert.throws(() => parseBggCsv('name,price\nx,1\n'), /missing column: objectid, objectname, own/);
  assert.throws(() => parseBggCsv(''), /empty/);
});

test('plan: 12 matches, 2 new, nothing invented', async () => {
  await fresh();
  const plan = planNow();
  assert.equal(plan.updates.length + plan.unchanged, 12);
  assert.deepEqual(plan.fresh.map((r) => r.name), ['Carcassonne', 'Castle Combo: Out of the Oubliette!']);
  assert.deepEqual(plan.ignored, []);
  // games marked as in BGG but not in this (small) file
  assert.equal(plan.missing.length, 195 - 12);
  assert.ok(plan.missing.every((m) => store.getGame(m.id).inBgg));
  // games with no BGG id (Ethiq…) are never matched and never "missing"
  assert.ok(!plan.missing.some((m) => store.getGame(m.id).bggId == null));
});

test('matching only touches bggName, type, players, time, age (if empty) and inBgg', () => {
  const game = {
    id: 'g1', title: 'Azul: Kristálymozaik', bggId: 294345, bggName: 'old', type: 'base', dims: [1, 2, 3],
    sizeSource: 'x', players: { min: 2, max: 2 }, time: null, age: '10+', categories: ['popular'], inBgg: false, notes: 'n',
  };
  const row = { bggId: 294345, name: 'Azul: Crystal Mosaic', type: 'expansion', players: { min: 2, max: 4 }, time: { min: 30, max: 45 }, age: '8+' };
  const { patch } = diffGame(game, row);
  assert.deepEqual(Object.keys(patch).sort(), ['bggName', 'inBgg', 'players', 'time', 'type']);
  assert.equal('age' in patch, false, 'an age that is already there stays');
  assert.equal('title' in patch, false);
});

test('a new game: BGG name as title, unplaced, Duo for 2-player games', () => {
  const [carcassonne, castle] = planNow().fresh;
  assert.deepEqual(newGameFields(carcassonne).categories, []);
  assert.equal(newGameFields(carcassonne).title, 'Carcassonne');
  assert.equal(newGameFields(castle).type, 'expansion');
  assert.deepEqual(newGameFields({ bggId: 1, name: 'Duel', type: null, players: { min: 2, max: 2 }, time: null, age: null }).categories, ['duo']);
});

test('apply: updates, adds, remembers ignored, keeps titles and the plan', async () => {
  await fresh();
  const before = store.exportData();
  const plan = planNow();
  const result = applyImport(plan, { addIds: [822] }, new Date('2026-11-27T10:00:00Z'));
  assert.equal(result.added, 1);
  assert.equal(result.deleted, 0);

  const after = store.exportData();
  assert.deepEqual(after.plan, before.plan, 'the plan is untouched');
  assert.equal(after.games.length, before.games.length + 1);
  for (const g of before.games) {
    const now = after.games.find((x) => x.id === g.id);
    assert.equal(now.title, g.title);
    assert.deepEqual(now.dims, g.dims);
    assert.deepEqual(now.categories, g.categories);
    assert.equal(now.notes, g.notes);
  }
  const carcassonne = byTitle('Carcassonne');
  assert.equal(store.locate(carcassonne.id).kind, 'unplaced');
  assert.equal(carcassonne.inBgg, true);
  assert.deepEqual(store.getMeta().bggIgnored, [448182], 'the unticked one is remembered');
  assert.equal(store.getMeta().lastImport, '2026-11-27T10:00:00.000Z');
});

test('acceptance: importing the fixture twice changes nothing the second time', async () => {
  await fresh();
  applyImport(planNow(), { addIds: [822] });
  const afterFirst = store.exportData();

  const plan2 = planNow();
  assert.equal(plan2.updates.length, 0);
  assert.equal(plan2.fresh.length, 0, 'Carcassonne now matches, Castle Combo is ignored');
  assert.deepEqual(plan2.ignored.map((r) => r.bggId), [448182]);
  applyImport(plan2, {}, new Date('2030-01-01T00:00:00Z'));
  const afterSecond = store.exportData();

  delete afterFirst.meta.lastImport;
  delete afterSecond.meta.lastImport;
  delete afterFirst.exportedAt;
  delete afterSecond.exportedAt;
  assert.deepEqual(afterSecond, afterFirst);
});

test('an ignored game can be added later', async () => {
  await fresh();
  applyImport(planNow(), {});
  assert.deepEqual(store.getMeta().bggIgnored, [822, 448182]);
  const plan = planNow();
  assert.deepEqual(plan.ignored.map((r) => r.name), ['Carcassonne', 'Castle Combo: Out of the Oubliette!']);
  applyImport(plan, { addIds: [822] });
  assert.deepEqual(store.getMeta().bggIgnored, [448182]);
  assert.ok(byTitle('Carcassonne'));
});

test('missing games: nothing happens without a choice; keep and delete do what they say', async () => {
  await fresh();
  const plan = planNow();
  const [a, b, c] = plan.missing;

  applyImport(plan, {});
  for (const m of plan.missing) assert.equal(store.getGame(m.id).inBgg, true, 'undecided = untouched');

  applyImport(planNow(), { keepIds: [a.id], deleteIds: [b.id] });
  assert.equal(store.getGame(a.id).inBgg, false);
  assert.equal(store.getGame(b.id), undefined);
  assert.equal(store.getGame(c.id).inBgg, true);
  // a kept game is no longer "missing" next time
  assert.ok(!planNow().missing.some((m) => m.id === a.id));
});

test('deleting a host moves the games inside it to the cupboard', async () => {
  await fresh();
  const hitster = byTitle('Hitster – Magyar kiadás');
  const inside = Object.entries(store.getPlan().inside).filter(([, host]) => host === hitster.id).map(([id]) => id);
  assert.ok(inside.length > 0);
  const plan = { ...planNow(), updates: [], fresh: [], ignored: [] };
  applyImport(plan, { deleteIds: [hitster.id] });
  assert.equal(store.getGame(hitster.id), undefined);
  for (const id of inside) assert.equal(store.locate(id).kind, 'cupboard');
});

test('one batch: a failing change rolls everything back', async () => {
  await fresh();
  const before = store.exportData();
  const plan = planNow();
  assert.throws(() => applyImport(plan, { keepIds: ['g999'] }));
  const after = store.exportData();
  delete before.exportedAt;
  delete after.exportedAt;
  assert.deepEqual(after, before);
});

test('after adding games, the done message says what is left to do', () => {
  assert.deepEqual(afterImportHints([]), []);
  const base = { bggId: 1, name: 'A', type: 'base' };
  const exp = { bggId: 2, name: 'B', type: 'expansion' };
  assert.equal(afterImportHints([base]).length, 1);
  assert.match(afterImportHints([base])[0], /rename it or set its size/);
  assert.match(afterImportHints([base, exp])[1], /^1 of them is an expansion.*Stored inside/);
  assert.match(afterImportHints([exp, { ...exp, bggId: 3 }])[1], /^All of them are expansions/);
});
