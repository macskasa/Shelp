// Easy to reach, box by box (#48). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { reachOf, reachAll, reachFrom, checkPlan2 } from '../js/rules/index.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
await store.init({ seed, storage: memoryStorage() });
const plan = store.getPlan2();
const getGame = (id) => store.getGame(id);
const stackBoxes = (id) => plan.stacks.find((s) => s.id === id).boxes;
const text = (id) => reachOf(plan, getGame, id)?.text;

test('reachFrom: the score adds up, boxes on top are capped at 3, the text lists the parts', () => {
  assert.deepEqual(reachFrom({ easy: true, row: 0, onTop: 0 }), { score: 0, parts: [], text: 'Easy to reach' });
  assert.deepEqual(reachFrom({ easy: true, row: 1, onTop: 2 }), { score: 4, parts: ['back row', '2 boxes on top'], text: 'Back row · 2 boxes on top' });
  assert.deepEqual(reachFrom({ easy: false, row: 0, onTop: 1 }), { score: 5, parts: ['hard spot', '1 box on top'], text: 'Hard-to-reach spot · 1 box on top' });
  assert.equal(reachFrom({ easy: false, row: 1, onTop: 9 }).score, 4 + 2 + 3);
  assert.equal(reachFrom({ easy: true, row: 0, onTop: 9 }).text, '9 boxes on top'); // the text says the real count, the score stops at 3
  assert.equal(reachFrom({ easy: true, row: 0, onTop: 9 }).score, 3);
});

test('seed: the top of a bottom-shelf pile is easy, the box under it has 1 box on top', () => {
  const b3 = stackBoxes('B3');
  const top = b3.find((b) => b.game === 'g035');
  assert.equal(text(top.game), 'Easy to reach');
  assert.equal(reachOf(plan, getGame, top.game).score, 0);
  assert.equal(text(b3.find((b) => b.game === 'g177').game), '2 boxes on top'); // two side by side rest on it
  assert.match(text('g101'), /^\d+ boxes on top$/); // 3 or more above it: the real count
  assert.ok(reachOf(plan, getGame, 'g101').score <= 3); // the score is capped
});

test('seed: back row, hard spot, and a topper counts as a box on top', () => {
  assert.equal(text('g172'), 'Back row'); // top of the back row of T1
  assert.equal(text('g132'), 'Back row · 1 box on top');
  assert.match(text('g157'), /^Hard-to-reach spot · 2 boxes on top$/); // M3, middle shelf, the Bonsai on top of the pile
  assert.equal(text('g184'), 'Hard-to-reach spot · 1 box on top'); // only the Bonsai
});

test('seed: a game inside its base counts as the base; board, cupboard and unknown ids have none', () => {
  assert.equal(text('g100'), text('g098'));
  assert.equal(reachOf(plan, getGame, 'nope'), null);
  const cupboard = plan.cupboard[0]?.game;
  if (cupboard) assert.equal(reachOf(plan, getGame, cupboard), null);
  const onBoard = structuredClone(plan);
  onBoard.board = [{ game: 'g035' }];
  onBoard.stacks.find((s) => s.id === 'B3').boxes = onBoard.stacks.find((s) => s.id === 'B3').boxes.filter((b) => b.game !== 'g035');
  assert.equal(reachOf(onBoard, getGame, 'g035'), null);
});

test('reachAll agrees with reachOf for every game, and the seed still has no problems', () => {
  const all = reachAll(plan, getGame);
  assert.ok(all.size > 100);
  for (const [id, r] of all) assert.deepEqual(r, reachOf(plan, getGame, id), id);
  assert.deepEqual(checkPlan2(plan, getGame), []);
});
