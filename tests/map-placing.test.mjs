// Part B placing mode + board strip (Phase C items 3 and 2). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { suggestSpots } from '../js/rules/index.js';
import { buildScene } from '../js/map/scene.js';
import { spotChoices, orientationChoices } from '../js/map/spots.js';
import {
  placingFor, hashAfter, toDrawing, tapTarget, topSuggestions, chipText, presetFor, boardChips, SUGGESTIONS,
} from '../js/map/placing.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const byTitle = (t) => store.getGames().find((g) => g.title === t).id;

test('placing mode from the route: ?pick=<id> enters it, anything else does not', () => {
  const ark = byTitle('Ark Nova');
  assert.deepEqual(placingFor({ pick: ark }, getGame), { gameId: ark });
  assert.equal(placingFor({}, getGame), null);
  assert.equal(placingFor({ game: ark }, getGame), null, '?game= only highlights');
  assert.equal(placingFor(null, getGame), null);
  assert.deepEqual(placingFor({ pick: 'nope' }, getGame), { error: 'There is no such game' });
  const sizeless = { id: 'x', title: 'Mystery', dims: null };
  assert.match(placingFor({ pick: 'x' }, (id) => (id === 'x' ? sizeless : null)).error, /^Mystery has no box size yet/);
});

test('leaving placing mode: the placed game is shown, Cancel goes to the plain map', () => {
  assert.equal(hashAfter('placed', 'g013'), '#/map?game=g013');
  assert.equal(hashAfter('cancel', 'g013'), '#/map');
  assert.equal(hashAfter('placed', null), '#/map');
  // neither address enters placing mode again (Back over it, or a reload)
  for (const hash of [hashAfter('placed', 'g013'), hashAfter('cancel', 'g013')]) {
    const params = Object.fromEntries(new URLSearchParams(hash.split('?')[1] ?? ''));
    assert.equal(placingFor(params, getGame), null, hash);
  }
});

test('a tap: frame px → drawing cm, then a stack, an empty shelf spot or nothing', () => {
  assert.deepEqual(toDrawing({ x: 10, y: 20, k: 2 }, 40, 6), { x: 30, y: 23 });
  const scene = buildScene(store.getPlan2(), getGame);
  const st = scene.stacks.find((s) => s.id === 'B3');
  const zone = (id) => scene.zones.find((z) => z.id === id);
  // on a box, in the empty air above the stack, and on its id under the floor: all the stack
  assert.deepEqual(tapTarget(scene, { x: st.x + st.w / 2, y: st.floor - 1 }), { kind: 'stack', stackId: 'B3' });
  assert.deepEqual(tapTarget(scene, { x: st.x + st.w / 2, y: zone('bottom').top + 0.5 }), { kind: 'stack', stackId: 'B3' });
  assert.deepEqual(tapTarget(scene, { x: st.x + st.w / 2, y: st.label.y }), { kind: 'stack', stackId: 'B3' });
  // a gap between two neighbouring stacks is empty shelf
  const pairs = scene.stacks.flatMap((a) => scene.stacks.filter((b) => b.zone === a.zone && b.x > a.x).map((b) => [a, b]));
  const [a, b] = pairs.find(([p, q]) => q.x - (p.x + Math.max(p.w, 2)) > 2 && !scene.stacks.some((o) => o.zone === p.zone && o.x > p.x && o.x < q.x));
  const mid = (a.x + Math.max(a.w, 2) + b.x) / 2;
  const hit = tapTarget(scene, { x: mid, y: a.floor - 2 });
  assert.equal(hit.kind, 'empty');
  assert.equal(hit.zone, a.zone);
  assert.equal(hit.x, Math.round((mid - zone(a.zone).x) * 10) / 10);
  // the overhang past the wall end is shelf too; the band title and the margin are nothing
  const end = (z) => z.x + z.length + z.overhang - 0.5;
  const free = scene.zones.find((z) => z.overhang && !scene.stacks.some((s) => s.zone === z.id && s.x + Math.max(s.w, 2) >= end(z)));
  assert.deepEqual(tapTarget(scene, { x: end(free), y: free.top + 1 }), { kind: 'empty', zone: free.id, x: free.length + free.overhang - 0.5 });
  assert.equal(tapTarget(scene, { x: scene.labels[0].x + 5, y: scene.labels[0].y }), null);
  assert.equal(tapTarget(scene, { x: 0.5, y: 0.5 }), null);
});

test('suggestions: the first three, on a stack or a new stack, with short chip labels', () => {
  const spots = [
    { kind: 'new-stack', zone: 'narrow', x: 70, text: 'Narrow shelf · new stack at 70 cm' },
    { kind: 'stack', target: { stackId: 'B3' }, text: 'Bottom shelf · stack B3 · on Takenokolor · flat' },
    { kind: 'stack', target: { stackId: 'T1' }, text: 'Top shelf · stack T1 · back row · on the shelf, left of Imagine · on its side' },
    { kind: 'stack', target: { stackId: 'M4' }, text: 'Middle shelf · stack M4 · across A and B · flat, long side out' },
    { kind: 'stack', target: { stackId: 'M5' }, text: 'Middle shelf · stack M5 · on X · flat' },
  ];
  const top = topSuggestions(spots);
  assert.equal(SUGGESTIONS, 3);
  assert.deepEqual(top.map((s) => s.target?.stackId ?? s.kind), ['new-stack', 'B3', 'T1'], "in Stephen's order (item 5)");
  assert.deepEqual(top.map(chipText), [
    'Narrow shelf · new stack at 70 cm',
    'B3 · on Takenokolor',
    'T1 · back row · on the shelf, left of Imagine · on its side',
  ]);
  assert.equal(chipText({ text: 'Narrow shelf · new stack at 70 cm · on its side' }), 'Narrow shelf · new stack at 70 cm · on its side');
  assert.equal(topSuggestions([{ kind: 'other' }]).length, 0);
  assert.deepEqual(topSuggestions(null), []);
  // Stephen's real suggestions for the v5 plan
  const ark = byTitle('Ark Nova');
  const real = topSuggestions(suggestSpots(store.getPlan2(), store.getGames(), ark, { limit: 12 }));
  assert.ok(real.length > 0 && real.length <= 3);
  for (const s of real) assert.match(chipText(s), s.kind === 'stack' ? /^[A-Z]\d+ · / : /new stack at/);
});

test('a suggestion → the spot sheet preset: spot and way up', () => {
  const ark = getGame(byTitle('Ark Nova'));
  const plan = store.getPlan2();
  const orients = orientationChoices(ark);
  for (const s of topSuggestions(suggestSpots(plan, store.getGames(), ark.id, { limit: 12 })).filter((x) => x.kind === 'stack')) {
    const t = s.target;
    const stack = plan.stacks.find((x) => x.id === t.stackId);
    const spots = spotChoices(stack, getGame, { row: t.row });
    const p = presetFor(spots, orients, ark, t, s.text);
    const chosen = p.spots[p.spot];
    assert.equal(chosen.run.fn, 'placeBox');
    assert.equal(chosen.run.target.row, t.row);
    assert.deepEqual([...chosen.run.target.on].sort(), [...t.on].sort());
    assert.equal(chosen.run.target.index ?? 0, t.index ?? 0);
    assert.equal(orients[p.orient].up, t.up);
  }
});

test('preset: matches by surface and place, by size for the way up, and adds a spot the sheet lacks', () => {
  const game = { id: 'g', title: 'G', dims: [5, 20, 30], pizza: false };
  const orients = orientationChoices(game);
  const spots = [
    { key: 'shelf:0', kind: 'shelf', label: 'On the shelf', run: { fn: 'placeBox', target: { stackId: 'S', row: 0, on: [], index: 0 } } },
    { key: 'on:a:0', kind: 'on', label: 'On top of A', run: { fn: 'placeBox', target: { stackId: 'S', row: 0, on: ['a'], index: 0 } } },
    { key: 'across:a:b', kind: 'across', label: 'Across A and B', run: { fn: 'placeBox', target: { stackId: 'S', row: 0, on: ['a', 'b'] } } },
    { key: 'under:a', kind: 'under', label: 'Under A', run: { fn: 'placeUnder', targets: ['a'] } },
  ];
  let p = presetFor(spots, orients, game, { stackId: 'S', row: 0, on: ['a'], index: 0, up: 'l', rot: true });
  assert.equal(p.spots, spots);
  assert.equal(p.spot, 1);
  assert.deepEqual([orients[p.orient].up, orients[p.orient].rot], ['l', true]);
  // a bridge: the order of its supports doesn't matter, and no index means the first place
  p = presetFor(spots, orients, game, { stackId: 'S', row: 0, on: ['b', 'a'], index: 0, up: 's', rot: false });
  assert.equal(p.spot, 2);
  assert.equal(p.orient, 0);
  // beside a box already on A: the sheet has no such spot, so the suggestion comes first
  p = presetFor(spots, orients, game, { stackId: 'S', row: 0, on: ['a'], index: 1, up: 's', rot: false }, 'Bottom shelf · stack S · on A, right of C');
  assert.equal(p.spots.length, spots.length + 1);
  assert.equal(p.spot, 0);
  assert.deepEqual(p.spots[0], { key: 'suggested', kind: 'on', label: 'Bottom shelf · stack S · on A, right of C', run: { fn: 'placeBox', target: { stackId: 'S', row: 0, on: ['a'], index: 1 } } });
  // a square box: turned or not is one option, so a turned suggestion picks it
  const square = { id: 'q', title: 'Q', dims: [5, 30, 30], pizza: true };
  const sq = orientationChoices(square);
  assert.equal(sq.length, 1);
  assert.equal(presetFor(spots, sq, square, { stackId: 'S', row: 0, on: [], index: 0, up: 's', rot: true }).orient, 0);
});

test('the board strip: the board in order, with category colours, unknown ids skipped', () => {
  assert.deepEqual(boardChips([], getGame), []);
  const ark = byTitle('Ark Nova');
  const azul = byTitle('Azul');
  const chips = boardChips([azul, 'nope', ark], getGame);
  assert.deepEqual(chips.map((c) => c.title), ['Azul', 'Ark Nova']);
  assert.ok(chips.every((c) => c.colors.length >= 1));
  // after "To the board" the game is a chip; Undo takes it away again
  store.moveToBoard(ark);
  assert.deepEqual(boardChips(store.getBoard(), getGame).map((c) => c.id), [ark]);
  store.undo();
  assert.deepEqual(boardChips(store.getBoard(), getGame), []);
});
