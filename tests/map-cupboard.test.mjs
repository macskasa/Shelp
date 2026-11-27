// Part B cupboard tests (stories C6, B2.3 – schema 2). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { offShelf, stackChoices } from '../js/map/cupboard.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const lists = () => offShelf(store.getGames(), store.locate2, store.getBoard(), getGame);

test('the cupboard: 15 games with their reasons, in title order; the board is empty in the seed', () => {
  const { cupboard, board } = lists();
  assert.equal(cupboard.length, 15);
  assert.equal(board.length, 0);
  assert.equal(cupboard.find((c) => c.game.id === 'g028').reason, 'No room – the bulkiest box (43.5 cm wide)');
  const titles = cupboard.map((c) => c.game.title);
  assert.deepEqual(titles, store.getGames().filter((g) => titles.includes(g.title)).map((g) => g.title));
});

test('the board, in board order (store.getBoard)', () => {
  const { board } = offShelf(store.getGames(), store.locate2, ['g028', 'g001'], getGame);
  assert.deepEqual(board.map((b) => b.game.id), ['g028', 'g001']);
  assert.deepEqual(offShelf([], store.locate2, ['nope'], getGame).board, [], 'unknown ids are skipped');
});

test('stack choices: grouped by shelf in drawing order, left to right, with height and limit', () => {
  const groups = stackChoices(store.getPlan2(), getGame);
  assert.deepEqual(groups.map((g) => g.label), [
    'Top shelf', 'Middle shelf', 'Bottom shelf',
    'Under the stairs – card games', 'Under the stairs – tall part', 'Under the stairs – tall gap', 'Narrow shelf',
  ]);
  assert.deepEqual(groups[2].stacks.map((s) => s.id), ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']);
  assert.deepEqual(groups[2].stacks[2], { id: 'B3', height: 27.7, limit: 36.5, topper: null, rows: 1 });
  const m3 = groups[1].stacks.find((s) => s.id === 'M3');
  assert.deepEqual([m3.height, m3.limit, m3.topper], [31.8, 37.5, 'Bonsai'], 'a topper may reach the shelf above');
  assert.equal(groups[0].stacks[0].rows, 2, 'T1 is 2 deep');
});
