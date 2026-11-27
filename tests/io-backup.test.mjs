// Backup, restore, plan import. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { backupFileName, readJson, problemLines, importKind, describeImport, reviewImport, refusalText } from '../js/io/backup.js';
import { layoutStack2 } from '../js/core/geometry.js';
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
  const file = { app: 'shelp', schema: seed.schema, plan };
  assert.deepEqual(store.validate(file), []);
  assert.equal(importKind(file), 'plan');
  assert.equal(store.importData(file), 'plan');
  assert.equal(store.getPlan2().name, 'v6 – test');
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
  const current = { games: 204, stacks: store.getPlan2().stacks.length, planName: store.getPlan2().name };

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

// ---------------------------------------------------------------- the shelf rules on an import (schema 2)

/** A v2 backup of the current data, with a topper on the first top-shelf stack that is low enough. */
function withTopper(extra) {
  const file = store.exportData();
  const stack = file.plan.stacks.find((s) => s.zone === 'top' && layoutStack2(s, store.getGame).h < 30);
  const h = layoutStack2(stack, store.getGame).h;
  stack.topper = { label: 'castle', w: 10, h: extra - h }; // the whole stack is `extra` cm tall
  return { file, stack };
}

test('review: the seed, a v2 backup and a v1 plan file all pass the shelf rules', async () => {
  await fresh();
  const none = { blocks: [], warnings: [] };
  assert.deepEqual(reviewImport(seed, store.getGames()), none);
  assert.deepEqual(reviewImport(store.exportData(), store.getGames()), none);
  assert.deepEqual(reviewImport({ app: 'shelp', schema: seed.schema, plan: seed.plan }, store.getGames()), none);
});

test('review: blocking problems are found, and store.validate alone would let them through', async () => {
  await fresh();
  const { file } = withTopper(41); // the top shelf is 40 cm high
  const [a, b] = file.plan.stacks.filter((s) => s.zone === 'middle');
  b.x = a.x; // two stacks on the same spot
  assert.deepEqual(store.validate(file), [], 'the schema check does not know the shelf rules');
  const { blocks, warnings } = reviewImport(file, store.getGames());
  assert.deepEqual(blocks.map((w) => w.rule).sort(), ['overlap', 'shelf-height']);
  assert.ok(blocks.every((w) => w.severity === 'block'));
  assert.deepEqual(warnings, []);
  assert.match(refusalText(blocks), /breaks 2 rules that the shelves never allow/);
  assert.match(refusalText(blocks.slice(0, 1)), /breaks a rule/);
  assert.match(refusalText(blocks), /Nothing was changed/);
});

test('review: a plan-only file is checked against the games you have now', async () => {
  await fresh();
  const { file } = withTopper(41);
  const planOnly = { app: 'shelp', schema: 2, plan: file.plan };
  assert.deepEqual(reviewImport(planOnly, store.getGames()).blocks.map((w) => w.rule), ['shelf-height']);
});

test('review: warnings are listed in the confirmation and do not stop the import', async () => {
  await fresh();
  const { file, stack } = withTopper(39.8); // above the 39.5 a topper may reach, below the 40 of the shelf
  const review = reviewImport(file, store.getGames());
  assert.deepEqual(review.blocks, []);
  assert.deepEqual(review.warnings.map((w) => [w.rule, w.stackId]), [['height', stack.id]]);

  const current = { games: 204, stacks: 33, planName: 'v5' };
  const info = describeImport(file, current, review);
  assert.match(info.lines.at(-1), /found 1 warning in this plan\. They do not stop the import/);
  assert.deepEqual(info.items, [review.warnings[0].message]);
  assert.equal(store.importData(file), 'all');
  assert.equal(store.getStack2(stack.id).topper.label, 'castle');
});

test('describeImport: no warnings, no extra lines; many warnings are cut after 8', async () => {
  const current = { games: 1, stacks: 1, planName: 'x' };
  const file = { app: 'shelp', schema: 2, plan: { name: 'x', stacks: [], cupboard: [] } };
  const quiet = describeImport(file, current);
  assert.deepEqual(quiet.items, []);
  assert.equal(quiet.lines.length, 2);
  const loud = describeImport(file, current, { warnings: Array.from({ length: 11 }, (_, i) => ({ message: `warning ${i}` })) });
  assert.match(loud.lines.at(-1), /found 11 warnings/);
  assert.equal(loud.items.length, 9);
  assert.equal(loud.items.at(-1), '…and 3 more.');
});
