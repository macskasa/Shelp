// Saved versions (Part C, D6): wording and rules. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import {
  NAME_MAX, stamp, defaultName, formatSaved, describeVersion, nameProblem, autoSaveName, switchQuestion, hasRoom,
} from '../js/versions/logic.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('the name limit is the store limit', () => {
  assert.equal(NAME_MAX, 60);
});

test('stamp and defaultName: "Version 27 Nov 10:15", local time, zero padded', () => {
  assert.equal(stamp(new Date(2026, 10, 27, 10, 15)), '27 Nov 10:15');
  assert.equal(defaultName(new Date(2026, 10, 27, 10, 15)), 'Version 27 Nov 10:15');
  assert.equal(defaultName(new Date(2026, 0, 3, 7, 5)), 'Version 3 Jan 07:05');
  assert.equal(defaultName(new Date(2026, 11, 31, 23, 59)), 'Version 31 Dec 23:59');
});

test('formatSaved: the year only when it is not this year, rubbish gives nothing', () => {
  const now = new Date(2026, 10, 27, 12, 0);
  assert.equal(formatSaved(new Date(2026, 9, 2, 9, 30).toISOString(), now), '2 Oct 09:30');
  assert.equal(formatSaved(new Date(2025, 9, 2, 9, 30).toISOString(), now), '2 Oct 2025 09:30');
  assert.equal(formatSaved('not a date', now), '');
});

test('describeVersion: "204 games · 34 stacks", singular too', () => {
  assert.equal(describeVersion({ games: 204, stacks: 34 }), '204 games · 34 stacks');
  assert.equal(describeVersion({ games: 1, stacks: 1 }), '1 game · 1 stack');
  assert.equal(describeVersion({ games: 0, stacks: 0 }), '0 games · 0 stacks');
});

test('nameProblem: same rules as the store (1–60 characters after trimming)', () => {
  assert.equal(nameProblem('Before top shelf'), null);
  assert.equal(nameProblem('x'.repeat(60)), null);
  assert.match(nameProblem('x'.repeat(61)), /at most 60/);
  assert.match(nameProblem(''), /name/);
  assert.match(nameProblem('   \n '), /name/);
  assert.match(nameProblem(null), /name/);
  assert.equal(nameProblem('  a   b  '), null);
});

test('autoSaveName: "Before switching to “X”", always a valid name', () => {
  assert.equal(autoSaveName('Before top shelf'), 'Before switching to “Before top shelf”');
  const long = autoSaveName('y'.repeat(60));
  assert.ok(long.length <= NAME_MAX, String(long.length));
  assert.equal(nameProblem(long), null);
  assert.ok(long.endsWith('…”'));
});

test('switchQuestion: the sentence from the brief', () => {
  assert.equal(switchQuestion('Before top shelf'), 'This replaces your games and shelf plan with “Before top shelf”. You can undo it.');
});

test('hasRoom: ten is the most', () => {
  const list = (n) => Array.from({ length: n }, (_, i) => ({ id: `v${i + 1}` }));
  assert.equal(hasRoom(list(0), 10), true);
  assert.equal(hasRoom(list(9), 10), true);
  assert.equal(hasRoom(list(10), 10), false);
});

test('with the real store: save, list, switch (one undo step), rename, delete, and the limit', async () => {
  await store.init({ seed, storage: memory() });
  const first = store.getGames()[0];
  const before = describeVersion(store.listVersions().at(0) ?? { games: 0, stacks: 0 });
  assert.equal(before, '0 games · 0 stacks');

  const id = store.saveVersion(defaultName(new Date(2026, 10, 27, 10, 15)));
  assert.deepEqual(store.listVersions().map((v) => v.name), ['Version 27 Nov 10:15']);
  assert.equal(describeVersion(store.listVersions()[0]), `${seed.games.length} games · ${seed.plan.stacks.length} stacks`);

  store.updateGame(first.id, { title: 'Átnevezett' });
  assert.equal(store.getGame(first.id).title, 'Átnevezett');
  // switching to the saved version: the current state is saved first (as the panel does), then it is one undo step
  store.saveVersion(autoSaveName('Version 27 Nov 10:15'));
  store.restoreVersion(id);
  assert.equal(store.getGame(first.id).title, first.title);
  assert.equal(store.listVersions().length, 2);
  assert.ok(store.undo(), 'one Undo goes back');
  assert.equal(store.getGame(first.id).title, 'Átnevezett');
  assert.equal(store.listVersions().length, 2, 'the saved versions are not touched by Undo');

  store.renameVersion(id, '  Before   top shelf ');
  assert.equal(store.getVersion(id).name, 'Before top shelf');
  store.deleteVersion(id);
  assert.equal(store.listVersions().length, 1);

  // the limit: fill up to ten; the panel disables saving and shows "Delete one to save another."
  while (store.listVersions().length < store.MAX_VERSIONS) store.saveVersion(`v ${store.listVersions().length}`);
  assert.equal(hasRoom(store.listVersions(), store.MAX_VERSIONS), false);
  assert.throws(() => store.saveVersion('one more'), /Delete one to save another/);
});
