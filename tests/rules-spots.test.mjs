// checkSpots: every spot × way up on one stack (part-a7). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { checkPlan2, checkSpots, reachFrom } from '../js/rules/index.js';
import { spotChoices, moveFn, newProblems } from '../js/map/spots.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
await store.init({ seed, storage: memoryStorage() });
// a small game that fits on top of the M2 pile (nothing of that size is off the shelves in the seed); it starts on the board
const smallId = store.addGame({ title: 'Tiny Test Game', dims: [4, 12, 15], pizza: true });
const plan = store.getPlan2();
const games = store.getGames();
const getGame = (id) => store.getGame(id);
const unplaced = games.filter((g) => ['cupboard', 'board'].includes(store.locate2(g.id)?.kind)).map((g) => g.id); // not on a shelf
const labelOf = (spots, run) => spots.find((s) => s.run === run).label;

// a small game from the board that fits on top of the M2 pile; the stack it goes to
const small = games.find((g) => g.id === smallId);
const m2 = plan.stacks.find((s) => s.id === 'M2');
const spots = spotChoices(m2, getGame);
const runs = spots.map((s) => s.run);

test('M2: one result per run, in order; every way has block and warn lists', () => {
  const res = checkSpots(plan, games, small.id, runs);
  assert.equal(res.length, runs.length);
  for (const r of res) {
    assert.ok(r.ways.length > 0);
    for (const w of r.ways) assert.ok(Array.isArray(w.block) && Array.isArray(w.warn) && 'up' in w && 'rot' in w);
    if (r.best) assert.ok(r.ways.includes(r.best) && r.best.block.length === 0);
    else assert.ok(r.ways.every((w) => w.block.length > 0));
  }
});

test('M2: on top of Port Royal works; on top of Scrabble Original, left of Kerge futam does not', () => {
  const res = checkSpots(plan, games, small.id, runs);
  const at = (label) => res[spots.findIndex((s) => s.label === label)];
  assert.ok(at('On top of Port Royal').best, 'a best way on top of Port Royal');
  const bad = at('On top of Scrabble Original, left of Kerge futam');
  assert.equal(bad.best, null);
  assert.ok(bad.ways.every((w) => w.block.length > 0 && w.block.every((b) => typeof b.rule === 'string')));
});

test('ways: a pizza game lies flat only; no size gives none; equal sizes show once', () => {
  const flatGame = { id: 'f', title: 'F', dims: [5, 20, 25], pizza: true };
  const res = checkSpots(plan, [...games, flatGame], 'f', runs.slice(0, 1))[0];
  assert.deepEqual(res.ways.map((w) => [w.up, w.rot]), [['s', false], ['s', true]]);
  const cube = { id: 'c', title: 'C', dims: [10, 10, 10], pizza: false };
  assert.deepEqual(checkSpots(plan, [...games, cube], 'c', runs.slice(0, 1))[0].ways.map((w) => [w.up, w.rot]), [['s', false], ['m', false], ['l', false]]); // turning a square base changes nothing
  const none = { id: 'n', title: 'N', dims: null, pizza: true };
  assert.deepEqual(checkSpots(plan, [...games, none], 'n', runs.slice(0, 2)), [{ ways: [], best: null }, { ways: [], best: null }]);
  assert.deepEqual(checkSpots(plan, games, small.id, []), []);
});

test('the answer agrees with store.preview + checkPlan2 for a sample of runs and ways', () => {
  const before = JSON.stringify(store.exportData().plan);
  const dig = (ws) => ws.map((w) => `${w.rule}|${w.stackId}|${w.gameId}|${w.otherStackId}|${w.family ?? ''}`).sort();
  const res = checkSpots(plan, games, small.id, runs);
  let checked = 0;
  spots.forEach((spot, i) => {
    if (i % 2) return;
    for (const way of res[i].ways) {
      const p = store.preview(moveFn(store, small.id, spot, { up: way.up, rot: way.rot }));
      if (p.error) { assert.ok(way.block.length > 0, `${spot.label}: preview refuses, checkSpots does not`); continue; }
      const { block, warn } = newProblems(plan, p.plan, p.games ? (id) => p.games.find((g) => g.id === id) : getGame);
      assert.deepEqual(dig(way.block), dig(block), `${spot.label} ${way.up}${way.rot}: block`);
      assert.deepEqual(dig(way.warn), dig(warn), `${spot.label} ${way.up}${way.rot}: warn`);
      checked++;
    }
  });
  assert.ok(checked > 10);
  assert.equal(JSON.stringify(store.exportData().plan), before);
  assert.equal(checkPlan2(plan, getGame).length, 0);
});

test('a game already on the stack: the runs are for the stack without it', () => {
  const inM2 = m2.boxes[m2.boxes.length - 1].game; // Port Royal, on top
  const without = structuredClone(m2);
  without.boxes = without.boxes.filter((b) => b.game !== inM2);
  const rs = spotChoices(without, getGame).map((s) => s.run);
  const res = checkSpots(plan, games, inM2, rs);
  assert.equal(res.length, rs.length);
  assert.ok(res.some((r) => r.best));
});

test('speed: every run × way on the tallest seed piles in under 50 ms (best of 3)', () => {
  const tall = [...plan.stacks].sort((a, b) => b.boxes.length - a.boxes.length).slice(0, 3);
  const game = games.find((g) => unplaced.includes(g.id) && g.dims && !g.pizza) ?? small; // up to six ways
  for (const st of tall) {
    const rs = spotChoices(st, getGame).map((s) => s.run);
    checkSpots(plan, games, game.id, rs); // warm up
    let min = Infinity;
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      checkSpots(plan, games, game.id, rs);
      min = Math.min(min, performance.now() - t);
    }
    if (process.env.SUGGEST_TIMING) console.log(`${st.id}: ${rs.length} runs, ${min.toFixed(1)} ms`);
    assert.ok(min < 50, `${st.id} took ${min.toFixed(0)} ms`);
  }
});

test('reach text says the real count; the score stays capped at 3 boxes', () => {
  const r = reachFrom({ easy: true, row: 0, onTop: 4 });
  assert.equal(r.text, '4 boxes on top');
  assert.equal(r.score, 3);
  assert.deepEqual(r.parts, ['4 boxes on top']);
  assert.equal(reachFrom({ easy: false, row: 1, onTop: 5 }).text, 'Hard-to-reach spot · Back row · 5 boxes on top');
  assert.equal(reachFrom({ easy: false, row: 1, onTop: 5 }).score, 9);
});
