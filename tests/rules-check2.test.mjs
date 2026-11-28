// Rule checker v2 (schema 2): one test per rule, plus the upgraded seed. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutStack2 } from '../js/core/geometry.js';
import * as store from '../js/core/store.js';
import { checkStack2, checkPlan2, overlapsWith, RULES2, SEVERITY, blocking, forStack, groupWarnings, boardLine } from '../js/rules/index.js';

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

test('RULES2 lists the fourteen rules, seven of them blocking', () => {
  assert.equal(RULES2.length, 14);
  assert.deepEqual(RULES2.filter((r) => SEVERITY[r] === 'block'),
    ['size-missing', 'pizza', 'overlap', 'box-overlap', 'length', 'shelf-height', 'bridge-level']);
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

test('overlapsWith: the overlaps of one stack with the others of its shelf, like checkPlan2 finds them', () => {
  const a = stack('A', 'bottom', 0, pile('ow1', 1, 7)); // 0 – 30
  const b = stack('B', 'bottom', 20, pile('ow2', 1, 7)); // 20 – 50
  const c = stack('C', 'bottom', 60, pile('ow3', 1, 7)); // 60 – 90
  const others = [{ st: a, end: 30 }, { st: c, end: 90 }];
  const w = overlapsWith(b, 50, others);
  assert.deepEqual(w.map((x) => [x.stackId, x.otherStackId, x.rule, x.severity]), [['B', 'A', 'overlap', 'block']]);
  assert.deepEqual(w, checkPlan2({ stacks: [a, b, c] }, getGame));
  assert.deepEqual(overlapsWith(b, 50, [{ st: b, end: 50 }]), [], 'never against itself');
  const early = overlapsWith(stack('E', 'bottom', 10, []), 25, [{ st: a, end: 30 }]);
  assert.deepEqual(early.map((x) => [x.stackId, x.otherStackId]), [['E', 'A']], 'the stack that starts later carries the warning');
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

test('bracket: a tall pile beside a joint is fine when only a low box crosses it', () => {
  // bottom shelf, bracket at 60. Tall pile 40 – 55 (33 cm, over the 31.5 allowed), low box 55 – 85 crosses the joint.
  const tall = [0, 1, 2].map((i) => game(`bt${i}`, [11, 15, 37]));
  const low = game('bt9', [7, 30, 37]);
  const boxes = [box(tall[0]), box(tall[1], { on: [tall[0]] }), box(tall[2], { on: [tall[1]] }), box(low, { x: 15 })];
  assert.deepEqual(checkStack2(stack('A', 'bottom', 40, boxes), getGame), []);
});

test('bracket: a high box that crosses the joint gives one warning that names it', () => {
  const tall = [0, 1, 2].map((i) => game(`bh${i}`, [11, 15, 37]));
  const low = game('bh9', [7, 30, 37]);
  const boxes = [box(tall[0]), box(tall[1], { on: [tall[0]] }), box(tall[2], { on: [tall[1]] }), box(low, { x: 15 })];
  const w = checkStack2(stack('A', 'bottom', 50, boxes), getGame); // the pile now covers 50 – 65
  assert.deepEqual(rules(w), ['bracket']);
  assert.equal(w[0].severity, 'warn');
  assert.equal(w[0].gameId, 'bh2'); // only the top box of the pile is too high
  assert.equal(w[0].message, 'Stack A crosses the bracket at 60 cm: BH2 reaches 33 cm there, but 31.5 cm is the most for its depth.');
});

test('bracket: several boxes too high are named in one warning', () => {
  const a = game('bm0', [15, 33, 37], { pizza: false }); // on its side: 15 wide, 37 deep, 33 high
  const b = game('bm1', [15, 34, 37], { pizza: false });
  const w = checkStack2(stack('A', 'bottom', 45, [box(a, { up: 'm' }), box(b, { up: 'm', x: 15 })]), getGame); // 45 – 60 and 60 – 75, both touch the joint
  assert.deepEqual(rules(w), ['bracket']);
  assert.equal(w[0].gameId, null);
  assert.match(w[0].message, /BM0 reaches 33 cm there.*; BM1 reaches 34 cm there/);
});

test('bracket: a back-row box counts with its back edge', () => {
  // bottom shelf, bracket at 60. A box 33 cm high and 17 deep: alone in the front row it may be 34.7 cm high there,
  // behind a front box (18 deep) it reaches 35 cm back, where only 31.7 cm is allowed.
  const front = game('br0', [7, 15, 18]);
  const tall = game('br1', [15, 17, 33], { pizza: false });
  const alone = checkStack2(stack('A', 'bottom', 50, [box(tall, { up: 'l' })]), getGame);
  assert.deepEqual(alone, []);
  const behind = checkStack2(stack('B', 'bottom', 50, [box(front), box(tall, { up: 'l', row: 1 })]), getGame);
  assert.deepEqual(rules(behind), ['bracket']);
  assert.equal(behind[0].gameId, 'br1');
  assert.match(behind[0].message, /BR1 reaches 33 cm there, but 31\.7 cm is the most/);
});

test('bracket: a topper that crosses a joint counts with the stack depth; one beside it does not', () => {
  // bottom shelf, bracket at 60. 20 cm of pile and a 13 cm topper = 33 cm, 31.5 allowed for a stack 37 deep.
  const crossing = stack('A', 'bottom', 45, pile('bp', 1, 20), { topper: { label: 'castle', w: 20, h: 13 } }); // topper 50 – 70
  const w = checkStack2(crossing, getGame);
  assert.deepEqual(rules(w), ['bracket']);
  assert.equal(w[0].gameId, null);
  assert.match(w[0].message, /the castle reaches 33 cm there, but 31\.5 cm is the most for the stack's depth/);
  // the same stack with a narrow topper that stays right of the joint: the low pile crosses it, the topper does not
  const beside = stack('B', 'bottom', 55, pile('bq', 1, 20), { topper: { label: 'castle', w: 10, h: 13 } }); // topper 65 – 75
  assert.deepEqual(checkStack2(beside, getGame), []);
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

// ---------------------------------------------------------------- box-overlap

test('box-overlap (block): a second box at the same x on one support takes the same place', () => {
  const a = game('bo1', [7, 20, 37]);
  const b = game('bo2', [7, 20, 37]);
  const c = game('bo3', [7, 20, 37]);
  const bad = checkStack2(stack('A', 'bottom', 0, [box(a), box(b, { on: [a] }), box(c, { on: [a] })]), getGame);
  assert.deepEqual(rules(bad), ['box-overlap']);
  assert.equal(bad[0].severity, 'block');
  assert.ok([b, c].includes(bad[0].gameId));
  assert.match(bad[0].message, /^BO[23] and BO[23] take the same place in stack A\.$/);
});

test('box-overlap: the higher box is named, a bridge pushed into its neighbours is caught', () => {
  const s1 = game('bq1', [7, 15, 37]);
  const s2 = game('bq2', [7, 15, 37]);
  const rest = game('bq3', [7, 15, 37]);
  const br = game('bq4', [7, 30, 37]);
  // rest sits on s1 at x 0; the bridge over s1 + s2 also starts at x 0, so it lands inside rest
  const bad = only(checkStack2(stack('A', 'bottom', 0, [box(s1), box(s2, { x: 15 }), box(rest, { on: [s1] }), box(br, { on: [s1, s2] })]), getGame), 'box-overlap');
  assert.equal(bad.length, 1);
  assert.ok([rest, br].includes(bad[0].gameId));
  assert.match(bad[0].message, /BQ3/);
  assert.match(bad[0].message, /BQ4/);
});

test('box-overlap: touching boxes, a box on its support, a bridge on two supports and two rows give nothing', () => {
  const a = game('bt1', [7, 15, 37]);
  const b = game('bt2', [7, 15, 37]);
  const on = game('bt3', [7, 15, 37]);
  const br = game('bt4', [7, 30, 37]);
  assert.deepEqual(only(checkStack2(stack('A', 'bottom', 0, [box(a), box(b, { x: 15 })]), getGame), 'box-overlap'), []);
  assert.deepEqual(only(checkStack2(stack('B', 'bottom', 0, [box(a), box(on, { on: [a] })]), getGame), 'box-overlap'), []);
  assert.deepEqual(only(checkStack2(stack('C', 'bottom', 0, [box(a), box(b, { x: 15 }), box(br, { on: [a, b] })]), getGame), 'box-overlap'), []);
  assert.deepEqual(only(checkStack2(stack('D', 'bottom', 0, [box(a), box(b, { row: 1 })]), getGame), 'box-overlap'), []);
});

test('box-overlap: a topper standing on the pile overlaps only air', () => {
  const a = game('bp1', [7, 20, 37]);
  const ok = stack('A', 'bottom', 0, [box(a)], { topper: { label: 'castle', w: 10, h: 10 } });
  assert.deepEqual(only(checkStack2(ok, getGame), 'box-overlap'), []);
  // a topper sunk into the box (a hand-made layout) counts
  const layout = layoutStack2(ok, getGame);
  layout.topper = { ...layout.topper, y: layout.topper.y - 3 };
  const bad = only(checkStack2(ok, getGame, layout), 'box-overlap');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].gameId, a);
  assert.match(bad[0].message, /castle/);
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

// ---------------------------------------------------------------- family (B2)

test('family (warn): the seed with every suggested family linked has none', async () => {
  const { suggestFamilies } = await import('../js/game/family.js');
  const m = new Map();
  await store.init({ seed, storage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } });
  store.batch(() => { for (const f of suggestFamilies(store.getGames())) for (const id of f.ids) store.updateGame(id, { family: f.name }); });
  assert.ok(store.getFamilies().length >= 20);
  assert.deepEqual(only(checkPlan2(store.getPlan2(), store.getGame), 'family'), []);
});

/** A world with one-box stacks: each [id, zone, x, familyOfItsGame]. */
function famWorld(list, extra = {}) {
  games.clear();
  const stacks = list.map(([id, zone, x, family]) => {
    const g = game(`g${id}`, [7, 30, 37], { family });
    return stack(id, zone, x, family === undefined ? [] : [box(g)]);
  });
  return { stacks, cupboard: [], inside: {}, board: [], ...extra };
}

test('family (warn): next to each other on one shelf is fine, so is one stack', () => {
  const plan = famWorld([['B1', 'bottom', 0.2, 'Azul'], ['B2', 'bottom', 40, 'Azul'], ['B3', 'bottom', 80, 'Root']]);
  assert.deepEqual(only(checkPlan2(plan, getGame), 'family'), []);
  const one = famWorld([['B1', 'bottom', 0.2, 'Azul']]);
  one.stacks[0].boxes.push(box(game('gx', [7, 30, 37], { family: 'Azul' }), { on: ['gB1'] }));
  assert.deepEqual(only(checkPlan2(one, getGame), 'family'), []);
});

test('family (warn): another shelf gives one warning naming both stacks', () => {
  const plan = famWorld([['T1', 'top', 0.2, 'Azul'], ['B1', 'bottom', 0.2, 'Azul'], ['B2', 'bottom', 40, 'Azul']]);
  const w = only(checkPlan2(plan, getGame), 'family');
  assert.equal(w.length, 1);
  assert.deepEqual(w[0], {
    rule: 'family', severity: 'warn', family: 'Azul', stackId: 'T1', stackIds: ['T1', 'B1', 'B2'], gameId: null, otherStackId: null,
    message: 'The Azul family is spread out: T1, B1 and B2. Keep a family on one shelf, next to each other.',
  });
  assert.equal(forStack([w[0]], 'B2').length, 1, 'forStack matches stackIds');
  assert.equal(forStack([w[0]], 'B9').length, 0);
});

test('family (warn): a stack with boxes between gives one, an empty stack between gives none', () => {
  const between = famWorld([['B1', 'bottom', 0.2, 'Azul'], ['B2', 'bottom', 40, 'Root'], ['B3', 'bottom', 80, 'Azul']]);
  assert.equal(only(checkPlan2(between, getGame), 'family').length, 1);
  const empty = famWorld([['B1', 'bottom', 0.2, 'Azul'], ['B2', 'bottom', 40, undefined], ['B3', 'bottom', 80, 'Azul']]);
  assert.deepEqual(only(checkPlan2(empty, getGame), 'family'), []);
  const grouped = groupWarnings(only(checkPlan2(between, getGame), 'family'));
  assert.equal(grouped.warn.length, 1);
});

test('family (warn): an expansion inside its host counts at the host; board and cupboard are ignored', () => {
  const plan = famWorld([['B1', 'bottom', 0.2, 'Azul'], ['B2', 'bottom', 40, 'Root'], ['B3', 'bottom', 80, 'Root']]);
  game('exp', [3, 10, 10], { family: 'Azul' });
  game('away', [3, 10, 10], { family: 'Azul' });
  game('cup', [3, 10, 10], { family: 'Azul' });
  plan.inside = { exp: 'gB3' }; // Azul at B1 and (inside) B3, Root between
  assert.equal(only(checkPlan2(plan, getGame), 'family').length, 1);
  plan.inside = { exp: 'gB1' }; // the same stack as the host: fine
  plan.board = [{ game: 'away' }];
  plan.cupboard = [{ game: 'cup', reason: 'x' }];
  assert.deepEqual(only(checkPlan2(plan, getGame), 'family'), []);
  plan.inside = { exp: 'hostOnBoard' }; // host not on a shelf: ignored
  game('hostOnBoard', [3, 10, 10]);
  assert.deepEqual(only(checkPlan2(plan, getGame), 'family'), []);
});
