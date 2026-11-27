// Part B only the spots that work (part-b5). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { checkSpots } from '../js/rules/index.js';
import { spotChoices, orientationChoices, moveFn, newProblems } from '../js/map/spots.js';
import { presetFor } from '../js/map/placing.js';
import { sortSpots, workingWays, blockReason, blockedLinkText, nothingFitsText, newStackWays, orientIndex } from '../js/map/working.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
// a small pizza game on the board that fits on top of the M2 pile, and a big one that fits nowhere on it
const small = store.addGame({ title: 'Tiny Test Game', dims: [4, 12, 15], pizza: true });
const huge = store.addGame({ title: 'Huge Test Game', dims: [40, 60, 60], pizza: false });
const games = store.getGames();
const plan = store.getPlan2();

const sheet = (gameId, stackId, opts = {}) => {
  const spots = spotChoices(plan.stacks.find((s) => s.id === stackId), getGame, opts);
  const checks = checkSpots(plan, games, gameId, spots.map((s) => s.run));
  return { spots, checks, ...sortSpots(spots, checks, { stackId }) };
};

test('M2 (six-box pile): only working spots, fewer than all, no warnings first; the rest blocked with a reason', () => {
  const s = sheet(small, 'M2');
  assert.ok(s.spots.length >= 15, `M2 has many spots (${s.spots.length})`);
  assert.ok(s.working.length > 0 && s.working.length < s.spots.length);
  assert.equal(s.working.length + s.blocked.length, s.spots.length);
  assert.ok(s.working.every((x) => x.check.best), 'every listed spot has a best way');
  assert.ok(s.blocked.every((x) => !s.checks[x.i].best && x.reason), 'every hidden spot has no best way and a reason');
  const warns = s.working.map((x) => x.check.best.warn.length);
  assert.deepEqual(warns, [...warns].sort((a, b) => a - b), 'no warnings first, then more');
  assert.ok(s.working.some((x) => x.spot.label === 'On top of Port Royal'));
  assert.ok(s.blocked.some((x) => x.spot.label === 'On top of Scrabble Original, left of Kerge futam'));
  // the same warning count keeps the order of spotChoices
  for (let k = 1; k < s.working.length; k++) {
    const a = s.working[k - 1];
    const b = s.working[k];
    if (a.check.best.warn.length === b.check.best.warn.length) assert.ok(a.i < b.i);
  }
});

test('every listed spot and its best way passes the real check (store.preview + newProblems)', () => {
  const s = sheet(small, 'M2');
  const orients = orientationChoices(getGame(small));
  for (const { spot, check } of s.working) {
    const o = orients[orientIndex(orients, check.best)];
    const p = store.preview(moveFn(store, small, spot, o));
    assert.equal(p.error, null, spot.label);
    assert.equal(newProblems(store.getPlan2(), p.plan, getGame).block.length, 0, spot.label);
  }
});

test('nothing fits: a box taller than every shelf gives no working spot', () => {
  const s = sheet(huge, 'M4');
  assert.equal(s.working.length, 0);
  assert.equal(s.blocked.length, s.spots.length);
  assert.equal(nothingFitsText('M4'), 'Nothing fits on M4');
  assert.match(blockedLinkText(s.blocked.length), /^Show \d+ blocked spots$/);
});

test('a preset spot (a suggestion) stays listed first, even before warning-free ones', () => {
  const spots = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  const ok = (warn) => ({ ways: [{ up: 's', rot: false, block: [], warn }], best: { up: 's', rot: false, block: [], warn } });
  const checks = [ok([]), ok([{ rule: 'height' }]), { ways: [], best: null }];
  assert.deepEqual(sortSpots(spots, checks).working.map((x) => x.spot.key), ['a', 'b']);
  assert.deepEqual(sortSpots(spots, checks, { keep: 1 }).working.map((x) => x.spot.key), ['b', 'a']);
  assert.deepEqual(sortSpots(spots, checks, { keep: 2 }).working.map((x) => x.spot.key), ['c', 'a', 'b']);
  assert.equal(sortSpots(spots, checks, { keep: 2 }).blocked.length, 0);
  // a real suggestion on M2 comes through presetFor and is a working spot
  const m2 = plan.stacks.find((s) => s.id === 'M2');
  const orients = orientationChoices(getGame(small));
  const top = m2.boxes.find((b) => !m2.boxes.some((o) => o.on.includes(b.game))).game;
  const p = presetFor(spotChoices(m2, getGame), orients, getGame(small), { stackId: 'M2', row: 0, on: [top], index: 0, up: 's', rot: true });
  const c = checkSpots(plan, games, small, p.spots.map((s) => s.run));
  const v = sortSpots(p.spots, c, { keep: p.spot, stackId: 'M2' });
  assert.equal(v.working[0].i, p.spot);
  assert.equal(workingWays(c[p.spot], orients, { prefer: p.orient }).chosen, p.orient);
});

test('ways up: only those without a block, best preselected, a preferred one wins', () => {
  const orients = orientationChoices({ dims: [15, 37, 46], pizza: false }); // 6 ways
  const way = (up, rot, block = []) => ({ up, rot, block, warn: [] });
  const check = {
    ways: [way('s', false, [{ rule: 'shelf-height' }]), way('s', true), way('m', false), way('m', true, [{ rule: 'length' }]), way('l', false, [{ rule: 'x' }]), way('l', true, [{ rule: 'x' }])],
    best: way('m', false),
  };
  assert.deepEqual(workingWays(check, orients), { list: [1, 2], chosen: 2 });
  assert.deepEqual(workingWays(check, orients, { prefer: 1 }), { list: [1, 2], chosen: 1 });
  assert.deepEqual(workingWays({ ways: [way('s', false)], best: way('s', false) }, orients), { list: [0], chosen: 0 }, 'one way: shown as text');
  assert.deepEqual(workingWays({ ways: check.ways.map((w) => ({ ...w, block: [{ rule: 'x' }] })), best: null }, orients), { list: [], chosen: -1 });
});

test('blocked reasons are short; an overlap names the other stack; the link text counts', () => {
  assert.equal(blockReason({ rule: 'shelf-height', message: 'long' }), 'Too tall for the shelf here');
  assert.equal(blockReason({ rule: 'length' }), 'Goes past the end of the shelf');
  assert.equal(blockReason({ rule: 'overlap', stackId: 'M2', otherStackId: 'M3' }, 'M2'), 'Runs into stack M3');
  assert.equal(blockReason({ rule: 'overlap', stackId: 'M1', otherStackId: 'M2' }, 'M2'), 'Runs into stack M1');
  assert.match(blockReason({ rule: 'bridge-level' }), /tilt/);
  assert.equal(blockReason({ rule: 'new-rule', message: 'Something else.' }), 'Something else.');
  assert.equal(blockReason(undefined), 'Can’t go here');
  assert.equal(blockedLinkText(0), null);
  assert.equal(blockedLinkText(1), 'Show 1 blocked spot');
  assert.equal(blockedLinkText(12), 'Show 12 blocked spots');
  assert.equal(blockedLinkText(12, true), 'Hide blocked spots');
});

test('New stack here: only ways without a block; none: the reason and no way', () => {
  const orients = orientationChoices({ dims: [15, 37, 46], pizza: false });
  const ok = { error: null, block: [], warn: [], result: 'B9' };
  const tall = { error: null, block: [{ rule: 'shelf-height', stackId: 'B9' }], warn: [], result: 'B9' };
  const r = newStackWays(orients, (o) => (o.up === 'l' ? tall : ok), { prefer: 4 });
  assert.deepEqual(r.list, [0, 1, 2, 3]);
  assert.equal(r.chosen, 0, 'a blocked preferred way is not chosen');
  assert.equal(r.reason, null);
  assert.equal(newStackWays(orients, () => ok, { prefer: 3 }).chosen, 3);
  const none = newStackWays(orients, () => tall);
  assert.deepEqual([none.list, none.chosen, none.reason], [[], -1, 'Too tall for the shelf here']);
  const refused = newStackWays(orients.slice(0, 1), () => ({ error: new Error('No room'), block: [], warn: [] }));
  assert.equal(refused.reason, 'No room');
});
