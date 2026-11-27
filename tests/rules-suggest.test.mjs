// D4: suggest a spot. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { checkPlan2, blocking, suggestSpots } from '../js/rules/index.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- hand-made worlds

const mk = (id, dims, extra = {}) => ({ id, title: id.toUpperCase(), dims, pizza: true, ...extra });
const box = (game, { row = 0, x = 0, up = 's', rot = false, on = [] } = {}) => ({ game, row, x, up, rot, on });
const stack = (id, zone, x, boxes) => ({ id, zone, x, boxes });
const planOf = (stacks) => ({ name: 't', stacks, cupboard: [], inside: {}, board: [] });
const flat = (id) => mk(id, [7, 30, 37]); // 30 wide, 37 deep, 7 high lying flat
const small = mk('g', [5, 20, 25]); // the game to place: 20 wide, 25 deep, 5 high

test('a game without a box size has no spot; a giant game has none either', () => {
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')])]);
  const games = [flat('a1'), mk('nosize', null), mk('giant', [50, 60, 70], { pizza: false })];
  assert.deepEqual(suggestSpots(plan, games, 'nosize'), []);
  assert.deepEqual(suggestSpots(plan, games, 'giant'), []); // taller than every shelf in every way up
  assert.deepEqual(suggestSpots(plan, games, 'unknown'), []);
});

test('spots on an existing stack: the shelf floor, on top of a box; texts and shapes', () => {
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')])]);
  const spots = suggestSpots(plan, [flat('a1'), small], 'g', { limit: 100 });
  const onTop = spots.find((s) => s.kind === 'stack' && s.target.on.length === 1);
  assert.deepEqual(onTop.target, { stackId: 'A', row: 0, on: ['a1'], index: 0, up: 's', rot: false });
  assert.equal(onTop.text, 'Bottom shelf · stack A · on A1 · flat');
  assert.deepEqual(onTop.warnings, []);
  const left = spots.find((s) => s.kind === 'stack' && s.target.on.length === 0 && s.target.row === 0 && s.target.index === 0 && !s.target.rot);
  assert.equal(left.text, 'Bottom shelf · stack A · on the shelf, left of A1 · flat');
  const right = spots.find((s) => s.kind === 'stack' && s.target.on.length === 0 && s.target.row === 0 && s.target.index === 1 && !s.target.rot);
  assert.equal(right.text, 'Bottom shelf · stack A · on the shelf, right of A1 · flat');
  const back = spots.find((s) => s.kind === 'stack' && s.target.row === 1 && !s.target.rot);
  assert.match(back.text, /^Bottom shelf · stack A · back row · on the shelf · flat$/);
  assert.deepEqual(back.warnings.map((w) => w.rule), ['depth']); // 37 + 25 deep on a shelf of 38
  assert.ok(spots.every((s) => s.warnings.every((w) => w.severity === 'warn')));
});

test('a pizza game is only suggested flat; any other game in every way up', () => {
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')])]);
  const pizza = suggestSpots(plan, [flat('a1'), small], 'g', { limit: 500 });
  assert.ok(pizza.every((s) => (s.target?.up ?? s.up) === 's'));
  assert.ok(pizza.some((s) => (s.target?.rot ?? s.rot) === true), 'a quarter turn is fine');
  const other = suggestSpots(plan, [flat('a1'), mk('g', [5, 20, 25], { pizza: false })], 'g', { limit: 500 });
  assert.deepEqual([...new Set(other.map((s) => s.target?.up ?? s.up))].sort(), ['l', 'm', 's']);
});

test('only spots without a new block: a floor spot that would run into the next stack is left out', () => {
  // two stacks touch: A 0.2 – 30.2, B 30.2 – 60.2. A game 20 wide on A's floor would reach 50.2: overlap.
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')]), stack('B', 'bottom', 30.2, [box('b1')])]);
  const spots = suggestSpots(plan, [flat('a1'), flat('b1'), small], 'g', { limit: 500 });
  const inA = spots.filter((s) => s.kind === 'stack' && s.target.stackId === 'A');
  assert.ok(inA.length > 0);
  assert.ok(inA.every((s) => s.target.on.length === 1 || s.target.row === 1), 'on top of its box or behind it, never beside it');
  assert.ok(spots.some((s) => s.kind === 'stack' && s.target.stackId === 'B' && s.target.on.length === 0 && s.target.row === 0), 'B has free space to its right');
  // and the whole result passes the rules
  for (const s of spots) assert.equal(s.warnings.filter((w) => w.severity === 'block').length, 0);
});

test('warnings are the new ones only: an old warning of the stack is not blamed on the new spot', () => {
  // top shelf (40 high, 38 usable): a pile of 6 × 6.5 = 39 cm already warns about its height
  const pile = Array.from({ length: 6 }, (_, i) => box(`p${i}`, { on: i ? [`p${i - 1}`] : [] }));
  const games = [...pile.map((b) => mk(b.game, [6.5, 30, 37])), small];
  const plan = planOf([stack('H', 'top', 0, pile)]);
  assert.deepEqual(checkPlan2(plan, (id) => games.find((g) => g.id === id)).map((w) => w.rule), ['height']);
  const spots = suggestSpots(plan, games, 'g', { limit: 500 });
  const beside = spots.find((s) => s.kind === 'stack' && s.target.stackId === 'H' && s.target.on.length === 0 && s.target.row === 0 && s.target.index === 0 && !s.target.rot);
  assert.deepEqual(beside.warnings, [], 'the height warning was there before');
  assert.ok(!spots.some((s) => s.kind === 'stack' && s.target.on.includes('p5')), 'on top of the pile would pass the 40 cm of the shelf');
});

test('bridges: across two neighbours whose tops are level, not when they differ by more than 0.5 cm', () => {
  const level = planOf([stack('A', 'bottom', 0.2, [box('a1'), box('a2', { x: 15 })])]);
  const wide = mk('g', [3, 30, 37]);
  const games = [mk('a1', [7, 15, 37]), mk('a2', [7.4, 15, 37]), wide];
  const across = suggestSpots(level, games, 'g', { limit: 500 }).find((s) => s.kind === 'stack' && s.target.on.length === 2);
  assert.deepEqual(across.target.on, ['a1', 'a2']);
  assert.equal(across.text, 'Bottom shelf · stack A · across A1 and A2 · flat');
  assert.deepEqual(across.warnings, []);
  const tilted = planOf([stack('A', 'bottom', 0.2, [box('a1'), box('a2', { x: 15 })])]);
  const games2 = [mk('a1', [7, 15, 37]), mk('a2', [8, 15, 37]), wide];
  assert.ok(!suggestSpots(tilted, games2, 'g', { limit: 500 }).some((s) => s.kind === 'stack' && s.target.on.length === 2));
});

test('new stacks: at the left end of a gap where the box fits, with the text of the brief', () => {
  const plan = planOf([stack('N1', 'narrow', 0, [box('n1')])]);
  const games = [mk('n1', [5, 40, 45]), small]; // 40 wide: the narrow shelf (80) has a gap from 40 to 80
  const spots = suggestSpots(plan, games, 'g', { limit: 500 });
  const narrow = spots.filter((s) => s.kind === 'new-stack' && s.zone === 'narrow');
  assert.deepEqual(narrow.map((s) => [s.x, s.up, s.rot]).sort((a, b) => a[0] - b[0] || a[2] - b[2]), [[40, 's', false], [40, 's', true]]);
  assert.equal(narrow.find((s) => !s.rot).text, 'Narrow shelf · new stack at 40 cm');
  // a box 45 wide does not fit into the 40 cm gap, so it gets no new stack there
  const wideGame = mk('g', [5, 45, 50]);
  assert.ok(!suggestSpots(plan, [mk('n1', [5, 40, 45]), wideGame], 'g', { limit: 500 }).some((s) => s.kind === 'new-stack' && s.zone === 'narrow'));
});

test('new stacks: a gap that starts at a joint also gets a spot 0.2 cm further on, which clears the bracket', () => {
  // bottom shelf: a stack from 0.2 to 60.0. A game 33 cm high and 37 deep would cross the joint at 60, where 31.5 cm is the most.
  const plan = planOf([stack('B1', 'bottom', 0.2, [box('b1'), box('b2', { x: 29.9 })])]);
  const games = [mk('b1', [7, 29.9, 37]), mk('b2', [7, 29.9, 37]), mk('g', [15, 33, 37], { pizza: false })];
  const fresh = suggestSpots(plan, games, 'g', { limit: 1000 }).filter((s) => s.kind === 'new-stack' && s.zone === 'bottom' && s.up === 'm' && !s.rot);
  const at60 = fresh.find((s) => Math.abs(s.x - 60) < 1e-9);
  const clear = fresh.find((s) => Math.abs(s.x - 60.2) < 1e-9);
  assert.ok(at60 && clear, 'both 60 and 60.2 are tried');
  assert.deepEqual(at60.warnings.map((w) => w.rule), ['bracket']);
  assert.match(at60.warnings[0].message, /GAME|G reaches 33 cm there, but 31\.5 cm is the most/);
  assert.deepEqual(clear.warnings, []);
  assert.ok(fresh.indexOf(clear) < fresh.indexOf(at60), 'the clean spot ranks first');
});

test('ranking: no new warnings first, easy to reach before hard, an existing stack before a new one', () => {
  // the bottom shelf is easy everywhere; the top shelf only 0 – 44 (hard from x = 100)
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')]), stack('H', 'top', 100, [box('h1')])]);
  const spots = suggestSpots(plan, [flat('a1'), flat('h1'), small], 'g', { limit: 1000 });
  const w = (s) => s.warnings.length;
  for (let i = 1; i < spots.length; i++) assert.ok(w(spots[i - 1]) <= w(spots[i]), 'fewer warnings first');
  assert.equal(spots[0].kind, 'stack');
  assert.equal(spots[0].target.stackId, 'A');
  const firstNew = spots.findIndex((s) => s.kind === 'new-stack' && w(s) === 0);
  const firstHard = spots.findIndex((s) => s.kind === 'stack' && s.target.stackId === 'H' && w(s) === 0);
  assert.ok(firstNew >= 0 && firstHard >= 0);
  assert.ok(firstNew < firstHard, 'an easy new stack beats a spot on a stack that is hard to reach');
  const firstOnA = spots.findIndex((s) => s.kind === 'stack' && s.target.stackId === 'A' && w(s) === 0);
  assert.ok(firstOnA < firstNew, 'an existing stack beats a new stack');
});

test('ranking: least extra shelf length – on top within the 1 cm rule beats a new stack and a spot beside other boxes', () => {
  // a game 31 wide on a box 30 wide: 1 cm over, and the stack gets 1 cm longer. Beside it or in a free gap it would cost 31 cm.
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')])]);
  const spots = suggestSpots(plan, [flat('a1'), mk('g', [5, 31, 37])], 'g', { limit: 1000 });
  assert.deepEqual(spots[0].target, { stackId: 'A', row: 0, on: ['a1'], index: 0, up: 's', rot: false });
  assert.deepEqual(spots[0].warnings, [], 'within the 1 cm rule');
  const aside = spots.findIndex((s) => s.kind === 'stack' && s.target.on.length === 0 && s.target.row === 0 && s.warnings.length === 0);
  const fresh = spots.findIndex((s) => s.kind === 'new-stack' && s.warnings.length === 0);
  assert.ok(aside > 0 && fresh > 0);
});

test('ranking: a spot beside other boxes costs shelf length like a new stack, so an existing stack comes first', () => {
  // the box is 36 cm high, so nothing fits on top of it (38.5 cm shelf): only beside it or in a free gap, 20 cm either way
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')])]);
  const spots = suggestSpots(plan, [mk('a1', [36, 37, 38]), small], 'g', { limit: 1000 });
  assert.ok(!spots.some((s) => s.kind === 'stack' && s.target.on.length));
  assert.equal(spots[0].kind, 'stack');
  assert.equal(spots[0].target.on.length, 0);
  const firstNew = spots.findIndex((s) => s.kind === 'new-stack');
  const lastBeside = spots.map((s, i) => (s.kind === 'stack' && s.warnings.length === 0 ? i : -1)).reduce((m, i) => Math.max(m, i), -1);
  assert.ok(firstNew > spots.findIndex((s) => s.kind === 'stack'), 'an existing stack before a new one');
  assert.ok(lastBeside >= 0);
});

test('ranking: with the same extra length, less overhang first', () => {
  // two boxes side by side, 30 and 31 wide. A game 31 wide on the second sticks out 0 cm, on the first 1 cm; the stack stays 61 cm long.
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1'), box('a2', { x: 30 })])]);
  const games = [flat('a1'), mk('a2', [7, 31, 37]), mk('g', [5, 31, 37])];
  const spots = suggestSpots(plan, games, 'g', { limit: 1000 }).filter((s) => s.kind === 'stack' && s.target.on.length === 1 && !s.target.rot);
  assert.deepEqual(spots.slice(0, 2).map((s) => s.target.on), [['a2'], ['a1']]);
});

test('ranking: with the same overhang, the lower stack first', () => {
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')]), stack('B', 'bottom', 40, [box('b1'), box('b2', { on: ['b1'] })])]);
  const spots = suggestSpots(plan, [flat('a1'), flat('b1'), flat('b2'), small], 'g', { limit: 1000 })
    .filter((s) => s.kind === 'stack' && s.target.on.length === 1 && !s.target.rot && s.warnings.length === 0);
  assert.deepEqual(spots.slice(0, 2).map((s) => s.target.on), [['a1'], ['b2']]); // a stack of 12 cm before a stack of 19 cm
});

test('ranking: with everything else the same, the least turned first, then flat before on its side', () => {
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')])]);
  const onTop = suggestSpots(plan, [flat('a1'), small], 'g', { limit: 1000 }).filter((s) => s.kind === 'stack' && s.target.on.length === 1);
  assert.deepEqual(onTop.slice(0, 2).map((s) => s.target.rot), [false, true]);
  const loose = suggestSpots(plan, [flat('a1'), mk('g', [5, 20, 25], { pizza: false })], 'g', { limit: 1000 })
    .filter((s) => s.kind === 'stack' && s.target.on.length === 1 && s.warnings.length === 0);
  const order = loose.map((s) => `${s.target.up}${s.target.rot ? 'R' : ''}`);
  assert.ok(order.indexOf('s') < order.indexOf('sR') && order.indexOf('sR') < order.indexOf('m'), order.join(' '));
});

test('the exact place a game has now is not suggested; turning it in place is', () => {
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1'), box('g', { x: 30 })])]);
  const games = [flat('a1'), small];
  const spots = suggestSpots(plan, games, 'g', { limit: 1000 });
  const same = (s) => s.kind === 'stack' && s.target.stackId === 'A' && s.target.row === 0 && s.target.on.length === 0 && s.target.index === 1 && s.target.up === 's';
  assert.ok(!spots.some((s) => same(s) && !s.target.rot), 'where it lies now');
  assert.ok(spots.some((s) => same(s) && s.target.rot), 'turned a quarter, in the same place');
});

// ---------------------------------------------------------------- the seed plan

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const fresh = () => store.init({ seed, storage: memoryStorage() });
const keyOf = (w) => `${w.rule}|${w.stackId}|${w.gameId}|${w.otherStackId}|${w.rule === 'bracket' ? w.message : ''}`;

test('seed: suggestions take a median under 200 ms and at most 400 ms for the slowest game, and nothing in the store changes', async () => {
  await fresh();
  const plan = store.getPlan2();
  const games = store.getGames();
  const before = JSON.stringify(store.exportData().plan);
  for (const g of games.slice(0, 10)) suggestSpots(plan, games, g.id); // warm up the JIT: the first game measured used to look slow on CI
  const best = []; // each game's best of 3 runs: one noisy run (scheduling, garbage collection) cannot fail the test
  for (const g of games) {
    let min = Infinity;
    for (let run = 0; run < 3; run++) {
      const t = performance.now();
      suggestSpots(plan, games, g.id);
      min = Math.min(min, performance.now() - t);
    }
    best.push({ title: g.title, ms: min });
  }
  best.sort((x, y) => x.ms - y.ms);
  const median = best[best.length >> 1].ms;
  const slowest = best[best.length - 1];
  if (process.env.SUGGEST_TIMING) console.log(`median ${median.toFixed(1)} ms, slowest ${slowest.ms.toFixed(1)} ms (${slowest.title})`);
  // The 200 ms target holds for the typical game; the slowest one gets 2x headroom. On a fast machine neither limit fails; on a slow runner the slowest-game limit is the one that does.
  assert.ok(median < 200, `median game took ${median.toFixed(0)} ms`);
  assert.ok(slowest.ms < 400, `${slowest.title} took ${slowest.ms.toFixed(0)} ms`);
  assert.equal(JSON.stringify(store.exportData().plan), before);
});

test('seed: a game on a shelf, a game in the cupboard, a game inside a box and a game on the board all get spots', async () => {
  await fresh();
  const games = store.getGames();
  const byTitle = (t) => games.find((g) => g.title === t);
  const lairs = byTitle('Lairs');
  const box0 = games.find((g) => store.locate2(g.id).kind === 'inside' && g.dims); // stored inside another box
  const cup = games.find((g) => store.locate2(g.id).kind === 'cupboard');
  const added = store.addGame({ title: 'Fantasy Fluxx 2', dims: [2.8, 9.4, 12.4] });
  for (const g of [lairs, box0, cup, store.getGame(added)]) {
    const spots = suggestSpots(store.getPlan2(), store.getGames(), g.id);
    assert.ok(spots.length > 0, `${g.title} has spots`);
    assert.ok(spots.length <= 5);
  }
  assert.equal(suggestSpots(store.getPlan2(), store.getGames(), lairs.id, { limit: 2 }).length, 2);
});

test('seed: the store accepts every suggestion, and it adds no blocking problem and no warning the spot did not announce', async () => {
  await fresh();
  const games = store.getGames();
  const before = checkPlan2(store.getPlan2(), store.getGame);
  assert.deepEqual(before, []);
  let checked = 0;
  for (let i = 0; i < games.length; i += 7) { // every seventh game keeps the test quick
    const g = games[i];
    for (const s of suggestSpots(store.getPlan2(), store.getGames(), g.id)) {
      const run = s.kind === 'stack'
        ? () => store.placeBox(g.id, s.target)
        : () => store.batch(() => {
          const id = store.createStack(s.zone, { x: s.x });
          store.placeBox(g.id, { stackId: id, row: 0, on: [], index: 0, up: s.up, rot: s.rot });
        });
      const r = store.preview(run);
      assert.equal(r.error, null, `${g.title}: ${s.text}`);
      const after = checkPlan2(r.plan, (id) => r.games.find((x) => x.id === id));
      assert.deepEqual(blocking(after), [], `${g.title}: ${s.text}`);
      const announced = new Set(s.warnings.map(keyOf));
      for (const w of after) assert.ok(announced.has(keyOf(w)), `${g.title}: ${s.text}: unannounced ${w.rule} on ${w.stackId}`);
      checked++;
    }
  }
  assert.ok(checked > 100, `${checked} suggestions checked`);
});

// ---------------------------------------------------------------- families (B2)

test('a family member is suggested on or beside its family, and a spread-out spot carries the family warning', () => {
  const plan = planOf([
    stack('B1', 'bottom', 0.2, [box('a1')]),
    stack('B2', 'bottom', 40, [box('x1')]),
    stack('B3', 'bottom', 80, [box('x2')]),
    stack('T1', 'top', 0.2, [box('a2')]),
  ]);
  const games = [flat('a1'), flat('a2'), flat('x1'), flat('x2'), { ...small, family: 'Azul' }]
    .map((g) => (['a1', 'a2'].includes(g.id) ? { ...g, family: 'Azul' } : g));
  const spots = suggestSpots(plan, games, 'g', { limit: 200 });
  assert.ok(spots.length);
  const first = spots[0];
  const stackOf = (s) => (s.kind === 'stack' ? s.target.stackId : null);
  // Azul is at B1 and T1 (already spread): the first spot has no new warning and sits on a member stack
  assert.deepEqual(first.warnings, []);
  assert.ok(['B1', 'T1'].includes(stackOf(first)), first.text);

  // a family on B1 only: a spot in the middle of B1..B3 would spread it
  const plan2 = planOf([stack('B1', 'bottom', 0.2, [box('a1')]), stack('B2', 'bottom', 40, [box('x1')]), stack('B3', 'bottom', 80, [box('x2')])]);
  const g2 = [{ ...flat('a1'), family: 'Azul' }, flat('x1'), flat('x2'), { ...small, family: 'Azul' }];
  const all = suggestSpots(plan2, g2, 'g', { limit: 500 });
  const near = all[0];
  assert.deepEqual(near.warnings, []);
  assert.equal(stackOf(near), 'B1');
  const onB3 = all.find((s) => stackOf(s) === 'B3');
  assert.deepEqual(onB3.warnings.map((w) => w.rule), ['family']);
  assert.equal(onB3.warnings[0].family, 'Azul');
  assert.ok(all.indexOf(onB3) > all.indexOf(near));
  // beside the family comes before further away: B2 (next to B1) ranks before a new far stack
  const beside = all.findIndex((s) => stackOf(s) === 'B2' && s.warnings.length === 0);
  assert.ok(beside < 0 || beside < all.findIndex((s) => s.kind === 'new-stack' && s.zone === 'bottom' && s.x > 100));
});

test('a game without a family, or whose family has no other member on a shelf, is not affected', () => {
  const plan = planOf([stack('A', 'bottom', 0.2, [box('a1')]), stack('B', 'top', 0.2, [box('a2')])]);
  const plain = suggestSpots(plan, [flat('a1'), flat('a2'), small], 'g', { limit: 5 });
  const lone = suggestSpots(plan, [flat('a1'), flat('a2'), { ...small, family: 'Solo' }], 'g', { limit: 5 });
  assert.deepEqual(lone, plain);
});

// ---------------------------------------------------------------- reach (#48)

test('reach: a front-row spot beats a back-row one even when the back row costs no shelf length', () => {
  const thin = (id) => mk(id, [7, 20, 10]); // 20 wide, 10 deep: a second row of 12 deep fits on the top shelf
  const g = mk('g', [3, 20, 12]);
  const plan = planOf([stack('A', 'top', 0.2, [box('a1')])]);
  const spots = suggestSpots(plan, [thin('a1'), g], 'g', { limit: 200 }).filter((s) => s.kind === 'stack' && s.target.stackId === 'A');
  const back = spots.filter((s) => s.target.row === 1 && !s.warnings.length);
  assert.ok(back.length, 'a warning-free back-row spot exists');
  const firstFront = spots.findIndex((s) => s.target.row === 0 && s.target.on.length === 0 && !s.warnings.length);
  assert.ok(firstFront >= 0 && firstFront < spots.indexOf(back[0]));
  assert.equal(suggestSpots(plan, [thin('a1'), g], 'g', { limit: 1 })[0].target?.row ?? 0, 0);
});

test('reach: an easy zone beats a hard one', () => {
  const g = mk('g', [3, 20, 12]);
  const plan = planOf([stack('M', 'middle', 0.2, [box('m1')])]); // the middle shelf is hard to reach at 0.2 cm
  const top = suggestSpots(plan, [mk('m1', [7, 20, 10]), g], 'g', { limit: 1 })[0];
  assert.ok(top.kind === 'new-stack' && top.zone !== 'middle', 'a new stack in an easy zone beats a hard-to-reach spot');
});
