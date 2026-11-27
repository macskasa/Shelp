// Rule checker v2 (schema 2): one test per rule, plus the upgraded seed. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { checkStack2, checkPlan2, RULES2, SEVERITY, blocking, forStack, groupWarnings, boardLine } from '../js/rules/index.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- helpers

const games = new Map();
const getGame = (id) => games.get(id);
/** dims are [smallest, middle, biggest]. Lying flat (up 's'), w = the middle side, d = the biggest, h = the smallest. */
function game(id, dims, extra = {}) {
  games.set(id, { id, title: id.toUpperCase(), dims, pizza: true, ...extra });
  return id;
}
const box = (id, { row = 0, x = 0, up = 's', rot = false, on = [] } = {}) => ({ game: id, row, x, up, rot, on });
const stack = (id, zone, x, boxes, extra = {}) => ({ id, zone, x, boxes, ...extra });
/** n identical flat boxes, 30 wide, 37 deep and h high, piled up. */
function pile(prefix, n, h) {
  return Array.from({ length: n }, (_, i) => {
    const id = game(`${prefix}${i}`, [h, 30, 37]);
    return box(id, { on: i ? [`${prefix}${i - 1}`] : [] });
  });
}
const rules = (list) => list.map((w) => w.rule);
const only = (list, rule) => list.filter((w) => w.rule === rule);

// ---------------------------------------------------------------- the seed

test('checkPlan2 on the upgraded seed: no problems at all', async () => {
  const m = new Map();
  await store.init({ seed, storage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } });
  assert.deepEqual(checkPlan2(store.getPlan2(), store.getGame), []);
});

test('a good stack gives nothing; every warning has the full shape', () => {
  assert.deepEqual(checkStack2(stack('A', 'bottom', 0.2, pile('ok', 3, 7)), getGame), []);
  const w = checkStack2(stack('A', 'top', 190, pile('sh', 2, 7)), getGame);
  assert.ok(w.length);
  for (const x of w) {
    assert.deepEqual(Object.keys(x).sort(), ['gameId', 'message', 'otherStackId', 'rule', 'severity', 'stackId']);
    assert.equal(x.severity, SEVERITY[x.rule]);
    assert.ok(x.message.length > 10);
  }
});

test('RULES2 lists the twelve rules, six of them blocking', () => {
  assert.equal(RULES2.length, 12);
  assert.deepEqual(RULES2.filter((r) => SEVERITY[r] === 'block'),
    ['size-missing', 'pizza', 'overlap', 'length', 'shelf-height', 'bridge-level']);
});

// ---------------------------------------------------------------- blocks

test('size-missing (block): a game without a box size on a stack', () => {
  const id = game('nosize', null);
  const w = checkStack2(stack('A', 'bottom', 0.2, [box(id)]), getGame);
  assert.deepEqual(rules(w), ['size-missing']);
  assert.equal(w[0].severity, 'block');
  assert.equal(w[0].gameId, id);
});

test('pizza (block): a pizza game that stands; a game that is not pizza may', () => {
  const p = game('pz', [5, 30, 37]);
  const n = game('np', [5, 30, 37], { pizza: false });
  const bad = checkStack2(stack('A', 'bottom', 0.2, [box(p, { up: 'm' })]), getGame);
  assert.deepEqual(rules(bad), ['pizza']);
  assert.equal(bad[0].severity, 'block');
  assert.equal(bad[0].gameId, p);
  assert.deepEqual(checkStack2(stack('B', 'bottom', 0.2, [box(n, { up: 'm' })]), getGame), []);
  // a quarter turn (rot) is fine for a pizza game
  assert.deepEqual(checkStack2(stack('C', 'bottom', 0.2, [box(p, { rot: true })]), getGame), []);
});

test('overlap (block): two stacks in one zone, with otherStackId; the other zone or an exact fit is fine', () => {
  const a = stack('A', 'bottom', 0, pile('oa', 1, 7)); // 0 – 30
  const b = stack('B', 'bottom', 20, pile('ob', 1, 7)); // 20 – 50
  const w = checkPlan2({ stacks: [a, b] }, getGame);
  assert.deepEqual(rules(w), ['overlap']);
  assert.equal(w[0].severity, 'block');
  assert.equal(w[0].stackId, 'B');
  assert.equal(w[0].otherStackId, 'A');
  assert.equal(w[0].gameId, null);
  // both stacks can show it
  assert.equal(forStack(w, 'A').length, 1);
  assert.equal(forStack(w, 'B').length, 1);
  assert.equal(forStack(w, 'C').length, 0);
  // touching is fine, and so is another zone
  assert.deepEqual(checkPlan2({ stacks: [a, stack('B', 'bottom', 30, pile('oc', 1, 7))] }, getGame), []);
  assert.deepEqual(checkPlan2({ stacks: [a, stack('B', 'middle', 20, pile('od', 1, 7))] }, getGame), []);
});

test('overlap: a long stack over two others gives one warning per pair, and plan order is kept', () => {
  const long = stack('L', 'bottom', 0, [box(game('lw', [7, 37, 100]), { rot: true })]); // 100 wide, 37 deep: 0 – 100
  const s1 = stack('S1', 'bottom', 10, pile('o1', 1, 7));
  const s2 = stack('S2', 'bottom', 50, pile('o2', 1, 7));
  const w = checkPlan2({ stacks: [long, s1, s2] }, getGame);
  assert.deepEqual(w.map((x) => [x.stackId, x.otherStackId]), [['S1', 'L'], ['S2', 'L']]);
  assert.equal(only(w, 'overlap').length, 2); // S1 and S2 (10–40, 50–80) do not touch each other
});

test('length (block): past the wall end plus the 8 cm overhang', () => {
  // top shelf: 200 + 8
  assert.deepEqual(checkStack2(stack('A', 'top', 178, pile('l1', 1, 7)), getGame), []); // ends at exactly 208
  const w = checkStack2(stack('B', 'top', 180, pile('l2', 1, 7)), getGame); // ends at 210
  assert.deepEqual(rules(w), ['length']);
  assert.equal(w[0].severity, 'block');
});

test('shelf-height (block): taller than the shelf gap, with or without a topper; no second height warning', () => {
  // top shelf: 40 high, 38 usable
  const w = checkStack2(stack('A', 'top', 0, pile('h1', 6, 7)), getGame); // 42
  assert.deepEqual(rules(w), ['shelf-height']);
  assert.equal(w[0].severity, 'block');
  const t = checkStack2(stack('B', 'top', 0, pile('h2', 5, 7), { topper: { label: 'castle', w: 30, h: 6 } }), getGame); // 35 + 6 = 41
  assert.deepEqual(rules(t), ['shelf-height']);
  assert.match(t[0].message, /castle/);
});

test('bridge-level (block): the two supports differ in height by more than 0.5 cm', () => {
  const s1 = game('bl1', [7, 15, 37]);
  const s2 = game('bl2', [8, 15, 37]); // 1 cm higher
  const s3 = game('bl3', [7.4, 15, 37]); // 0.4 cm higher
  const br = game('blb', [7, 30, 37]);
  const bad = checkStack2(stack('A', 'bottom', 0, [box(s1), box(s2, { x: 15 }), box(br, { on: [s1, s2] })]), getGame);
  assert.deepEqual(rules(bad), ['bridge-level']);
  assert.equal(bad[0].severity, 'block');
  assert.equal(bad[0].gameId, br);
  const ok = checkStack2(stack('B', 'bottom', 0, [box(s1), box(s3, { x: 15 }), box(br, { on: [s1, s3] })]), getGame);
  assert.deepEqual(ok, []);
});

// ---------------------------------------------------------------- warnings

test('height (warn): above the usable height but within the shelf; a topper may reach 0.5 cm below the shelf', () => {
  // top shelf: 40 high, 38 usable
  const w = checkStack2(stack('A', 'top', 0, pile('u1', 6, 6.5)), getGame); // 39
  assert.deepEqual(rules(w), ['height']);
  assert.equal(w[0].severity, 'warn');
  assert.deepEqual(checkStack2(stack('B', 'top', 0, pile('u2', 5, 7.5)), getGame), []); // 37.5
  // castle: 33 + 6 = 39 is fine (limit 39.5), 33 + 7 = 40 warns, but is not yet taller than the shelf
  const ok = checkStack2(stack('C', 'top', 0, pile('u3', 3, 11), { topper: { label: 'castle', w: 30, h: 6 } }), getGame);
  assert.deepEqual(ok, []);
  const warn = checkStack2(stack('D', 'top', 0, pile('u4', 3, 11), { topper: { label: 'castle', w: 30, h: 7 } }), getGame);
  assert.deepEqual(rules(warn), ['height']);
  assert.match(warn[0].message, /39\.5/);
});

test('bracket (warn): too high where the stack crosses a bracket, fine right after it', () => {
  // bottom shelf: height 38.5, bracket at 60; a stack 37 cm deep may be 31.5 cm high there
  const high = checkStack2(stack('A', 'bottom', 50, pile('b1', 3, 11)), getGame); // 33 cm, crosses 60
  assert.deepEqual(rules(high), ['bracket']);
  assert.equal(high[0].severity, 'warn');
  assert.deepEqual(checkStack2(stack('B', 'bottom', 50, pile('b2', 3, 10)), getGame), []); // 30 cm
  assert.deepEqual(checkStack2(stack('C', 'bottom', 60.2, pile('b3', 3, 11)), getGame), []); // starts after the bracket
});

test('stacking (warn): more than 1 cm over the box below, along the shelf or in depth', () => {
  const base = game('s0', [7, 30, 37]);
  const wide = game('s1', [7, 31.5, 37]);
  const fine = game('s2', [7, 31, 37]);
  const deep = game('s3', [7, 30, 38.5]);
  const w = checkStack2(stack('A', 'bottom', 0, [box(base), box(wide, { on: [base] })]), getGame);
  assert.deepEqual(rules(w), ['stacking']);
  assert.equal(w[0].severity, 'warn');
  assert.equal(w[0].gameId, wide);
  assert.deepEqual(checkStack2(stack('B', 'bottom', 0, [box(base), box(fine, { on: [base] })]), getGame), []);
  const d = checkStack2(stack('C', 'bottom', 0, [box(base), box(deep, { on: [base] })]), getGame);
  assert.deepEqual(rules(d), ['stacking']); // 38.5 deep is within the shelf + 0.5, so no depth warning
  assert.match(d[0].message, /at the back/);
});

test('stacking: boxes side by side on one box count together, and a box hanging off the side counts', () => {
  const base = game('t0', [7, 30, 37]);
  const a = game('t1', [5, 15, 20]);
  const b = game('t2', [5, 15.5, 20]);
  const c = game('t3', [5, 16, 20]);
  const small = game('t4', [5, 10, 20]);
  // 15 + 15.5 = 30.5 on 30: fine. 15 + 16 = 31 is exactly 1 cm: fine. 16 + 16 = 32: warns.
  const ok = stack('A', 'bottom', 0, [box(base), box(a, { on: [base] }), box(b, { x: 15, on: [base] })]);
  assert.deepEqual(checkStack2(ok, getGame), []);
  const edge = stack('B', 'bottom', 0, [box(base), box(a, { on: [base] }), box(c, { x: 15, on: [base] })]);
  assert.deepEqual(checkStack2(edge, getGame), []);
  const bad = stack('C', 'bottom', 0, [box(base), box(c, { on: [base] }), box(game('t5', [5, 16, 20]), { x: 16, on: [base] })]);
  assert.deepEqual(rules(checkStack2(bad, getGame)), ['stacking']);
  // narrow, but 5 cm over the right edge
  const off = stack('D', 'bottom', 0, [box(base), box(small, { x: 25, on: [base] })]);
  assert.deepEqual(rules(checkStack2(off, getGame)), ['stacking']);
});

test('stacking: a bridge is measured from the outer edges of its two supports', () => {
  const s1 = game('sb1', [7, 15, 37]);
  const s2 = game('sb2', [7, 15, 37]);
  const fits = game('sb3', [7, 31, 37]); // span 30, 1 cm over: fine
  const wide = game('sb4', [7, 33, 37]); // 3 cm over
  const supports = [box(s1), box(s2, { x: 15 })];
  assert.deepEqual(checkStack2(stack('A', 'bottom', 0, [...supports, box(fits, { on: [s1, s2] })]), getGame), []);
  const w = checkStack2(stack('B', 'bottom', 0, [...supports, box(wide, { on: [s1, s2] })]), getGame);
  assert.deepEqual(rules(w), ['stacking']);
  assert.match(w[0].message, /SB1 and SB2/);
});

test('depth (warn): deeper than the shelf + 0.5 cm; one standing box (like KLASK) may stick out', () => {
  const deep = game('d1', [7, 30, 40]);
  const w = checkStack2(stack('A', 'bottom', 0, [box(deep)]), getGame);
  assert.deepEqual(rules(w), ['depth']);
  assert.equal(w[0].severity, 'warn');
  // KLASK: 15 × 37 × 46 standing on its side, alone
  const klask = game('d2', [15, 37, 46], { pizza: false });
  assert.deepEqual(checkStack2(stack('B', 'top', 193, [box(klask, { up: 'm' })]), getGame), []);
  // two standing boxes are not exempt
  const two = checkStack2(stack('C', 'top', 100, [box(klask, { up: 'm' }), box(game('d3', [15, 37, 46], { pizza: false }), { up: 'm', x: 15 })]), getGame);
  assert.deepEqual(rules(two), ['depth']);
});

test('two-deep (warn): two rows only where it is easy to reach', () => {
  const rows = (prefix) => [box(game(`${prefix}1`, [7, 15, 18])), box(game(`${prefix}2`, [7, 15, 17]), { row: 1 })];
  const hard = checkStack2(stack('A', 'top', 100, rows('r1')), getGame); // top shelf: easy only at 0–44
  assert.deepEqual(rules(hard), ['two-deep']);
  assert.equal(hard[0].severity, 'warn');
  assert.deepEqual(checkStack2(stack('B', 'top', 5, rows('r2')), getGame), []);
  assert.deepEqual(checkStack2(stack('C', 'bottom', 100, rows('r3')), getGame), []); // the whole bottom shelf is easy
  assert.deepEqual(rules(checkStack2(stack('D', 'middle', 5, rows('r4')), getGame)), ['two-deep']); // nothing is easy
});

test('bridge-support (warn): the centre must be over the supports and the gap at most a third of the width', () => {
  const s1 = game('bs1', [7, 10, 37]);
  const s2 = game('bs2', [7, 10, 37]);
  const br = game('bs3', [7, 30, 37]); // a third of 30 = 10
  const ok = stack('A', 'bottom', 0, [box(s1), box(s2, { x: 20 }), box(br, { on: [s1, s2] })]); // gap 10
  assert.deepEqual(checkStack2(ok, getGame), []);
  const gap = stack('B', 'bottom', 0, [box(s1), box(s2, { x: 21 }), box(br, { on: [s1, s2] })]); // gap 11
  const g = checkStack2(gap, getGame);
  assert.deepEqual(rules(g), ['bridge-support']);
  assert.equal(g[0].severity, 'warn');
  assert.equal(g[0].gameId, br);
  assert.match(g[0].message, /gap/);
  // the centre (x 30 + 15 = 45) is far right of supports that span 0 – 20
  const off = stack('C', 'bottom', 0, [box(s1), box(s2, { x: 10 }), box(br, { x: 30, on: [s1, s2] })]);
  const o = checkStack2(off, getGame).filter((w) => w.rule === 'bridge-support');
  assert.equal(o.length, 1);
  assert.match(o[0].message, /centre/);
});

test('a bridge that fits like a brick in a wall gives no warnings', () => {
  const s1 = game('w1', [7, 15, 37]);
  const s2 = game('w2', [7, 15, 37]);
  const br = game('w3', [7, 30, 37]);
  assert.deepEqual(checkStack2(stack('A', 'bottom', 0, [box(s1), box(s2, { x: 15 }), box(br, { on: [s1, s2] })]), getGame), []);
});

// ---------------------------------------------------------------- the plan, the card

test('checkPlan2: blocks come before warnings within a stack, stacks stay in plan order', () => {
  const nosize = game('o1', null);
  const t = [box(game('o2', [7, 15, 18])), box(game('o3', [7, 15, 17]), { row: 1 })];
  const w = checkPlan2({ stacks: [stack('X', 'middle', 100, [box(nosize), ...t]), stack('Y', 'bottom', 0, pile('o4', 1, 7))] }, getGame);
  assert.deepEqual(w.map((x) => [x.stackId, x.rule, x.severity]), [['X', 'size-missing', 'block'], ['X', 'two-deep', 'warn']]);
  assert.equal(blocking(w).length, 1);
});

test('groupWarnings: Must fix and Warnings, grouped by stack', () => {
  const nosize = game('g1', null);
  const w = checkPlan2({
    stacks: [
      stack('A', 'top', 100, [box(nosize), box(game('g2', [7, 15, 18]), { row: 1 })]),
      stack('B', 'top', 150, [box(game('g3', [7, 15, 18])), box(game('g4', [7, 15, 17]), { row: 1 })]),
    ],
  }, getGame);
  const g = groupWarnings(w);
  assert.deepEqual(g.block.map((x) => [x.stackId, x.list.length]), [['A', 1]]);
  assert.deepEqual(g.warn.map((x) => [x.stackId, x.list.length]), [['A', 1], ['B', 1]]);
  assert.deepEqual(groupWarnings([]), { block: [], warn: [] });
});

test('boardLine', () => {
  assert.equal(boardLine(0), '');
  assert.equal(boardLine(1), '1 game is on the board');
  assert.equal(boardLine(3), '3 games are on the board');
});
