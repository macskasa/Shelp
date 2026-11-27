// Backup, restore, plan import. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { backupFileName, readJson, problemLines, importKind, describeImport } from '../js/io/backup.js';
import { localDate, when } from '../js/io/time.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const fresh = () => store.init({ seed, storage: memoryStorage() });
const stripTime = (o) => { const c = structuredClone(o); delete c.exportedAt; return c; };

test('file name and dates use the local date', () => {
  const d = new Date(2026, 10, 27, 0, 41); // 27 Nov 2026, 00:41 local time
  assert.equal(backupFileName(d), 'shelp-backup-2026-11-27.json');
  assert.equal(localDate(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(when(new Date(2026, 10, 27, 9, 5).toISOString()), '2026-11-27 09:05');
  assert.equal(when(null), null);
  assert.equal(when('garbage'), null);
});

test('readJson: BOM is fine, junk gives a readable error', () => {
  assert.deepEqual(readJson('﻿{"a":1}'), { a: 1 });
  assert.throws(() => readJson('not json'), /not valid JSON/);
  assert.throws(() => readJson(''), /not valid JSON/);
});

test('acceptance: backup, clear everything, restore gives back the same data', async () => {
  await fresh();
  // make some changes the seed does not have
  const ark = store.getGames().find((g) => g.title === 'Ark Nova');
  store.updateGame(ark.id, { dims: [7, 30, 37.5], notes: 'my note', categories: ['popular', 'coop'] });
  store.addGame({ title: 'Carcassonne', bggId: 822, inBgg: true });
  store.moveToCupboard(store.getGames().find((g) => g.title === 'Azul').id, 'tested');
  store.setMeta('lastBackup', '2026-11-27T10:00:00.000Z');
  const file = JSON.stringify(store.exportData(), null, 2);
  const before = stripTime(store.exportData());

  await fresh(); // like localStorage.clear() and a reload: back to the seed
  assert.notDeepEqual(stripTime(store.exportData()), before);

  const kind = store.importData(readJson(file));
  assert.equal(kind, 'all');
  assert.deepEqual(stripTime(store.exportData()), before);
  assert.equal(store.getMeta().lastBackup, '2026-11-27T10:00:00.000Z');
});

test('acceptance: a plan file made in chat imports and leaves the games alone', async () => {
  await fresh();
  const gamesBefore = structuredClone(store.getGames());
  const plan = structuredClone(seed.plan);
  plan.name = 'v6 – test';
  plan.cupboard = [];
  const file = { app: 'shelp', schema: 1, plan };
  assert.deepEqual(store.validate(file), []);
  assert.equal(importKind(file), 'plan');
  assert.equal(store.importData(file), 'plan');
  assert.equal(store.getPlan().name, 'v6 – test');
  assert.deepEqual(store.getGames(), gamesBefore);
});

test('problems: a bad file is rejected before anything changes, and the list can be cut at 20', async () => {
  await fresh();
  const before = stripTime(store.exportData());
  const bad = { app: 'shelp', schema: 1, plan: { name: 'x', stacks: [], cupboard: [{ game: 'g999', reason: '' }], inside: {} } };
  const problems = store.validate(bad);
  assert.ok(problems.length > 0);
  assert.match(problems[0], /g999/);
  assert.throws(() => store.importData(bad));
  assert.deepEqual(stripTime(store.exportData()), before);

  assert.ok(store.validate({ hello: 'world' }).length > 0);
  assert.deepEqual(store.validate([]), ['not a JSON object']);
  const many = Array.from({ length: 27 }, (_, i) => `problem ${i}`);
  const { shown, more } = problemLines(many);
  assert.equal(shown.length, 20);
  assert.equal(more, 7);
  assert.deepEqual(problemLines(['a']), { shown: ['a'], more: 0 });
});

test('describeImport tells what will happen', async () => {
  await fresh();
  const current = { games: 204, stacks: store.getPlan().stacks.length, planName: store.getPlan().name };

  const full = describeImport({ ...structuredClone(seed), exportedAt: new Date(2026, 10, 27, 9, 5).toISOString() }, current);
  assert.equal(full.kind, 'all');
  assert.match(full.lines[0], /Backup made 2026-11-27 09:05/);
  assert.match(full.lines[0], /204 games/);
  assert.match(full.lines[1], /replaces everything/);

  const planOnly = describeImport({ app: 'shelp', schema: 1, plan: { name: 'v6', stacks: [{}, {}], cupboard: [{}] } }, current);
  assert.equal(planOnly.kind, 'plan');
  assert.match(planOnly.lines[0], /“v6” with 2 stacks and 1 game in the cupboard/);
  assert.match(planOnly.lines[1], /games, sizes and categories stay/);
});

test('reset to the original data', async () => {
  await fresh();
  store.updateGame(store.getGames()[0].id, { notes: 'changed' });
  store.setMeta('lastBackup', 'x');
  await store.resetToSeed();
  assert.equal(store.getGames().length, 204);
  assert.ok(store.getGames().every((g) => g.notes !== 'changed'));
  assert.equal(store.getMeta().lastBackup, undefined);
});
