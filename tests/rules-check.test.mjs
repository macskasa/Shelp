// Rule checker. Every rule is broken on purpose and must give exactly that warning. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkStack, checkPlan, RULES } from '../js/rules/index.js';
import { ZONES, bracketLimit } from '../js/core/shelves.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

// Test games with exact sizes. Flat, dims [s, m, l]: width m, depth l, height s.
const GAMES = new Map(Object.entries({
  a: [5, 20, 20], b: [5, 21, 21], c: [5, 22.5, 22.5], d: [5, 10, 21], e: [5, 11.5, 21],
  s5: [5, 20, 30], // 5 high, 20 wide, 30 deep
  sm1: [5, 10, 12], sm2: [5, 13, 14], d185: [5, 10, 18.5], d186: [5, 10, 18.6],
  card: [2, 6, 9], tall: [6, 15, 46], bigtall: [6, 15, 41],
  none: null,
}).map(([id, dims]) => [id, { id, title: id.toUpperCase(), dims }]));
const getGame = (id) => GAMES.get(id);

const flat = (...ids) => ids.map((game) => ({ game }));
const stack = (zone, x, rows, extra = {}) => ({ id: 'X1', zone, x, orientation: 'flat', rows, ...extra });
const rules = (warnings) => warnings.map((w) => w.rule);

test('acceptance: the v5 seed plan has 0 warnings', () => {
  const games = new Map(seed.games.map((g) => [g.id, g]));
  assert.deepEqual(checkPlan(seed.plan, (id) => games.get(id)), []);
});

test('a fine stack gives no warnings and warnings have the documented shape', () => {
  assert.deepEqual(checkStack(stack('bottom', 0.2, [flat('a', 'a', 'b')]), getGame), []);
  const [w] = checkStack(stack('bottom', 0.2, [flat('a', 'c')]), getGame);
  assert.deepEqual(Object.keys(w).sort(), ['gameId', 'message', 'rule', 'stackId']);
  assert.ok(RULES.includes(w.rule));
});

test('1 size-missing: one warning for the box, and its guessed size is not compared', () => {
  const w = checkStack(stack('bottom', 0.2, [flat('a', 'none', 'c')]), getGame);
  assert.deepEqual(w.map((x) => [x.rule, x.gameId]), [['size-missing', 'none']]);
  assert.match(w[0].message, /NONE has no box size/);
});

test('2 stacking: more than 1 cm wider or deeper than the level under it', () => {
  // c is 22.5 × 22.5 on a (20 × 20): 2.5 cm wider and deeper
  const w = checkStack(stack('bottom', 0.2, [flat('a', 'c')]), getGame);
  assert.deepEqual(w.map((x) => [x.rule, x.gameId]), [['stacking', 'c']]);
  assert.match(w[0].message, /^C \(22\.5 × 22\.5\) is more than 1 cm wider or deeper than A \(20 × 20\) under it\.$/);
  // exactly 1 cm is allowed (b is 21 × 21)
  assert.deepEqual(checkStack(stack('bottom', 0.2, [flat('a', 'b')]), getGame), []);
  // only one direction too big is enough: deeper only
  assert.deepEqual(rules(checkStack(stack('bottom', 0.2, [flat('d', 'e')]), getGame)), ['stacking']);
});

test('2 stacking: a side-by-side level counts as the sum of the widths, and each row is on its own', () => {
  // d + e side by side = 21.5 wide, 21 deep, on b (21 × 21): 0.5 wider, fine. On a (20 × 20): 1.5 wider, too much.
  const level = [{ side: [{ game: 'd' }, { game: 'e' }] }];
  assert.deepEqual(checkStack(stack('bottom', 0.2, [[{ game: 'b' }, ...level]]), getGame), []);
  const w = checkStack(stack('bottom', 0.2, [[{ game: 'a' }, ...level]]), getGame);
  assert.deepEqual(rules(w), ['stacking']);
  assert.match(w[0].message, /^D \+ E \(21\.5 × 21\)/);
  // two rows: the front row does not count as "under" the back row (sm2 is 3 cm wider than sm1)
  assert.deepEqual(checkStack(stack('bottom', 0.2, [flat('sm1'), flat('sm2')]), getGame), []);
});

test('3 height: usable height, and a topper may go to 0.5 cm below the shelf above', () => {
  // top shelf: usable 38, height 40. 8 boxes of 5 cm = 40
  const tooHigh = checkStack(stack('top', 0, [flat(...Array(8).fill('a'))]), getGame);
  assert.deepEqual(rules(tooHigh), ['height']);
  assert.match(tooHigh[0].message, /Stack X1 is 40 cm tall, but the Top shelf allows 38 cm\./);
  // 7 boxes (35 cm) + a 4.4 cm topper = 39.4: over 38 but within 39.5
  const topper = (h) => ({ topper: { label: 'LEGO castle', w: 15, h } });
  assert.deepEqual(checkStack(stack('top', 0, [flat(...Array(7).fill('a'))], topper(4.4)), getGame), []);
  assert.deepEqual(rules(checkStack(stack('top', 0, [flat(...Array(7).fill('a'))], topper(4.6)), getGame)), ['height']);
});

test('4 bracket: a tall stack across a joint', () => {
  // middle shelf, 20 × 30 footprint, 7 × 5 = 35 cm: usable is 35.5, but over a bracket only 31.5 is allowed
  const seven = flat(...Array(7).fill('s5'));
  assert.equal(bracketLimit('middle', 30), 31.5);
  const w = checkStack(stack('middle', 130, [seven]), getGame); // 130–150 crosses the joint at 140
  assert.deepEqual(rules(w), ['bracket']);
  assert.match(w[0].message, /crosses the bracket at 140 cm/);
  // the same stack away from every bracket is fine, and so is one that starts right after the bracket
  assert.deepEqual(checkStack(stack('middle', 100, [seven]), getGame), []);
  assert.deepEqual(checkStack(stack('middle', 140.2, [seven]), getGame), []);
  // ending right before the bracket is fine too
  assert.deepEqual(checkStack(stack('middle', 119.8, [seven]), getGame), []);
  // a low stack may cross
  assert.deepEqual(checkStack(stack('middle', 130, [flat('s5', 's5', 's5')]), getGame), []);
  // the top shelf has no brackets
  assert.deepEqual(checkStack(stack('top', 130, [seven]), getGame), []);
});

test('5 length: not past the wall end plus the 8 cm overhang', () => {
  const w = checkStack(stack('bottom', 190, [flat('a')]), getGame); // 190 + 20 = 210 > 208
  assert.deepEqual(rules(w), ['length']);
  assert.match(w[0].message, /reaches 210 cm, but the Bottom shelf ends at 208 cm/);
  assert.deepEqual(checkStack(stack('bottom', 188, [flat('a')]), getGame), []); // exactly 208
  // no overhang on the narrow shelf: 80
  assert.deepEqual(rules(checkStack(stack('narrow', 70, [flat('a')]), getGame)), ['length']);
});

test('6 overlap: two stacks at the same x, and a stack starting inside the one before', () => {
  const a = { ...stack('bottom', 10, [flat('a')]), id: 'B1' };
  const b = { ...stack('bottom', 10, [flat('b')]), id: 'B2' };
  const plan = { stacks: [a, b] };
  const w = checkPlan(plan, getGame);
  assert.deepEqual(w.map((x) => [x.stackId, x.rule]), [['B2', 'overlap']]);
  assert.match(w[0].message, /Stack B2 starts at 10 cm, but stack B1 still takes space until 30 cm\./);
  assert.deepEqual(checkStack(b, getGame), [], 'checkStack alone does not know the other stacks');
  // touching is fine, starting 0.5 cm early is not, and the order in the plan does not matter
  const next = (x) => ({ ...stack('bottom', x, [flat('b')]), id: 'B2' });
  assert.deepEqual(checkPlan({ stacks: [next(30), a] }, getGame), []);
  assert.deepEqual(rules(checkPlan({ stacks: [next(29.5), a] }, getGame)), ['overlap']);
  // the same x in different zones is fine
  assert.deepEqual(checkPlan({ stacks: [a, { ...b, zone: 'middle' }] }, getGame), []);
  // a long stack still counts for stacks behind a shorter one that starts inside it
  const long = { ...stack('bottom', 0, [[{ game: 'a' }]]), id: 'L1', rows: [[{ side: [{ game: 'a' }, { game: 'a' }, { game: 'a' }] }]] }; // 60 wide
  const inner = { ...stack('bottom', 5, [flat('d')]), id: 'L2' }; // 5–15
  const third = { ...stack('bottom', 40, [flat('d')]), id: 'L3' }; // starts after L2 but inside L1
  assert.deepEqual(checkPlan({ stacks: [long, inner, third] }, getGame).map((x) => x.stackId), ['L2', 'L3']);
});

test('7 depth: at most the shelf depth plus 0.5 cm, except one standing box (KLASK)', () => {
  // two rows of 20 deep = 40 > 38.5, bottom shelf is easy to reach so only depth fires
  const w = checkStack(stack('bottom', 0.2, [flat('a'), flat('a')]), getGame);
  assert.deepEqual(rules(w), ['depth']);
  assert.match(w[0].message, /40 cm deep, but the Bottom shelf is 38 cm deep \(up to 38\.5 cm is allowed\)/);
  // 20 + 18.5 = 38.5 is exactly allowed, 20 + 18.6 is not
  assert.deepEqual(checkStack(stack('bottom', 0.2, [flat('a'), flat('d185')]), getGame), []);
  assert.deepEqual(rules(checkStack(stack('bottom', 0.2, [flat('a'), flat('d186')]), getGame)), ['depth']);
});

test('7 depth: a single standing box may stick out', () => {
  const klask = stack('top', 190, [[{ game: 'tall' }]], { orientation: 'standing' }); // 6 wide, 46 deep, 15 high
  assert.deepEqual(checkStack(klask, getGame), []);
  const two = stack('top', 150, [[{ game: 'tall' }, { game: 'tall' }]], { orientation: 'standing' });
  assert.deepEqual(rules(checkStack(two, getGame)), ['depth', 'standing']);
});

test('8 two-deep: only where the whole span is easy to reach', () => {
  const shallow = (x) => stack('top', x, [[{ game: 'card' }], [{ game: 'card' }]]);
  assert.deepEqual(checkStack(shallow(0), getGame), []);
  const w = checkStack(shallow(100), getGame);
  assert.deepEqual(rules(w), ['two-deep']);
  assert.match(w[0].message, /two rows deep, but 100–.* cm on the Top shelf is hard to reach/);
  // the span must fit inside the easy range 0–44: 40 + 9 wide = 49
  assert.deepEqual(rules(checkStack(shallow(40), getGame)), ['two-deep']);
  // the bottom shelf is easy everywhere, the middle shelf nowhere
  assert.deepEqual(checkStack({ ...shallow(100), zone: 'bottom' }, getGame), []);
  assert.deepEqual(rules(checkStack({ ...shallow(100), zone: 'middle' }, getGame)), ['two-deep']);
});

test('9 standing: only the card-game shelf, or a single box', () => {
  // flat stack in the card-game part under the stairs
  const flatCards = stack('under-cards', 0, [flat('card', 'card')]);
  const w = checkStack(flatCards, getGame);
  assert.deepEqual(rules(w), ['standing']);
  assert.match(w[0].message, /lies flat, but the Under the stairs – card games/);
  // a standing stack with several boxes elsewhere
  const standingTwo = stack('bottom', 0.2, [[{ game: 'card' }, { game: 'card' }]], { orientation: 'standing' });
  assert.deepEqual(rules(checkStack(standingTwo, getGame)), ['standing']);
  // fine: standing cards under the stairs, and a single standing box (Ice Cool) elsewhere
  assert.deepEqual(checkStack(stack('under-cards', 0, [[{ game: 'card' }, { game: 'card' }]], { orientation: 'standing' }), getGame), []);
  assert.deepEqual(checkStack(stack('under-gap', 1.5, [[{ game: 'bigtall' }]], { orientation: 'standing' }), getGame), []);
});

test('an unknown zone or game does not crash the checker', () => {
  assert.deepEqual(checkStack(stack('nowhere', 0, [flat('a')]), getGame), []);
  assert.deepEqual(rules(checkStack(stack('bottom', 0.2, [flat('ghost')]), getGame)), ['size-missing']);
});

test('zone numbers the tests rely on', () => {
  assert.equal(ZONES.top.usable, 38);
  assert.equal(ZONES.top.height, 40);
  assert.equal(ZONES.bottom.length + ZONES.bottom.overhang, 208);
});
