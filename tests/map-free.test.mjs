// Part B: free space on the map (part-b7). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { freeSpace } from '../js/core/space.js';
import { buildScene } from '../js/map/scene.js';
import {
  freeBands, fitLabel, labelRect, bandAt, bandLine, pushForStack, pushForBand, pushLabel, wallEndX, preferWall, GAP_H,
  parseFreeParam, freeHash, newStackAt, placeLabels,
} from '../js/map/free-layer.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });

const byTitle = (t) => store.getGames().find((g) => g.title === t).id;
const units = () => freeSpace(store.getPlan2(), store.getGame);
const scene = () => buildScene(store.getPlan2(), store.getGame);
const bands = () => freeBands(units(), scene());
const zoneOf = (id) => scene().zones.find((z) => z.id === id);
const measure = (t) => t.length * 6; // 6 px per character

test('the standing bands beside KLASK (T8) and M6 (M5), placed in the drawing', () => {
  const all = bands();
  const t8 = all.find((b) => b.kind === 'standing' && b.stackIds.includes('T8'));
  assert.equal(t8.text, '4.3 wide');
  const top = zoneOf('top');
  assert.deepEqual(t8.air, { x: top.x + 188.7, y: Math.round((top.floor - 6.2 - 31.8) * 100) / 100, w: 4.3, h: 31.8 });
  assert.equal(t8.rest.y, Math.round((top.floor - 6.2) * 100) / 100, 'the rest line sits on the surface');
  assert.equal(bandLine(t8, store.getPlan2(), store.getGame).text,
    'On T8: standing room 4.3 cm wide · 31.8 cm high · rests on Anachrony: A jövő útjai');
  const m5 = all.find((b) => b.kind === 'standing' && b.stackIds.includes('M5') && b.slot.h === 29.5);
  assert.equal(m5.text, '6.5 wide');
  assert.match(bandLine(m5, store.getPlan2(), store.getGame).text, /^On M5: standing room 6\.5 cm wide · 29\.5 cm high · rests on Thunder Road/);
  const top2 = all.find((b) => b.kind === 'top' && b.stackIds[0] === 'T2');
  assert.equal(top2.text, '16.5 × 8.5');
});

test('the bottom shelf gap at 58.6: a hatched band on the floor, its whole column is the tap area', () => {
  const gap = bands().find((b) => b.kind === 'gap' && b.zone === 'bottom' && b.gap.x === 58.6);
  const z = zoneOf('bottom');
  assert.equal(gap.text, '1.4 cm');
  assert.deepEqual(gap.air, { x: z.x + 58.6, y: Math.round((z.floor - GAP_H) * 100) / 100, w: 1.4, h: GAP_H });
  assert.deepEqual([gap.hit.y, gap.hit.h], [z.top, z.height]);
  assert.equal(bandLine(gap, store.getPlan2(), store.getGame).text, 'Bottom shelf · left: empty floor 1.4 cm wide · at 58.6 cm');
  assert.equal(pushForBand(units(), gap), null, 'the left unit has no push');
  // a tap near it (within the tolerance) finds it; far away nothing
  assert.equal(bandAt([gap], { x: gap.hit.x - 1, y: z.floor - 5 }, 2), gap);
  assert.equal(bandAt([gap], { x: gap.hit.x - 5, y: z.floor - 5 }, 2), null);
});

test('labels only where they fit: across, up a narrow band, or not at all', () => {
  const t8 = bands().find((b) => b.kind === 'standing' && b.stackIds.includes('T8'));
  // 4.3 × 31.8 cm, "4.3 wide" = 48 + 8 px: up the band from k 1.8 once the width holds a line (13 px)
  assert.equal(fitLabel(t8.air, t8.text, 1.8, measure), null, 'phone at full width: hidden');
  assert.equal(fitLabel(t8.air, t8.text, 4, measure).vertical, true);
  assert.equal(fitLabel(t8.air, t8.text, 14, measure).vertical, false, 'zoomed in: across');
  const gap = bands().find((b) => b.kind === 'gap' && b.gap.x === 58.6);
  assert.equal(fitLabel(labelRect(gap), gap.text, 4, measure), null, 'a 1.4 cm gap at 4 px/cm');
  assert.ok(fitLabel(labelRect(gap), gap.text, 10, measure));
});

test('placeLabels: overlapping labels are left out, the smaller band wins', () => {
  const band = (key, x, y, w, h) => ({ key, kind: 'top', air: { x, y, w, h }, text: '10 × 10' });
  const small = band('small', 0, 0, 20, 10);
  const big = band('big', 0, 0, 40, 10); // its label sits at x 20, over the small one's at x 10
  const apart = band('apart', 100, 0, 20, 10);
  const placed = placeLabels([big, small, apart], 5, measure);
  assert.deepEqual([...placed.keys()].sort(), ['apart', 'small']);
  assert.equal(placeLabels(bands(), 1.8, measure).size < bands().length, true);
});

test('a tap picks the smallest band it is in', () => {
  const all = bands();
  const t8 = all.find((b) => b.kind === 'standing' && b.stackIds.includes('T8'));
  const pt = { x: t8.air.x + 1, y: t8.air.y + 10 };
  assert.equal(bandAt(all, pt), t8);
  // at its very top, T9's thin room on top (1 cm high) is smaller still
  assert.equal(bandAt(all, { x: t8.air.x + 1, y: t8.air.y + 0.5 }).stackIds[0], 'T9');
});

test('a hand-made plan with one surface across M1 and M2: the Join text', () => {
  const games = { a: { id: 'a', title: 'Alpha', dims: [7, 30, 30] }, b: { id: 'b', title: 'Beta', dims: [6.6, 18, 18] } };
  const getGame = (id) => games[id];
  const plan = {
    stacks: [
      { id: 'M2', zone: 'middle', x: 40.2, boxes: [{ game: 'b', row: 0, x: 0, up: 's', rot: false, on: [] }] },
      { id: 'M1', zone: 'middle', x: 10, boxes: [{ game: 'a', row: 0, x: 0, up: 's', rot: false, on: [] }] },
    ],
    board: [], cupboard: [],
  };
  const all = freeBands(freeSpace(plan, getGame), buildScene(plan, getGame));
  const across = all.find((b) => b.stackIds.length === 2);
  const line = bandLine(across, plan, getGame);
  assert.deepEqual(line.join, ['M1', 'M2']);
  assert.match(line.text, /^Across M1 and M2: room on top [\d.]+ cm wide · [\d.]+ cm high · rests on Alpha and Beta · 0\.4 cm tilt · join them to rest a box across both$/);
  // one stack: no join
  const t2 = bands().find((b) => b.kind === 'top' && b.stackIds[0] === 'T2');
  assert.equal(bandLine(t2, store.getPlan2(), store.getGame).join, null);
});

test('which stacks get Push to the wall: M7, M6, B8, B7; none on the top shelf', () => {
  const u = units();
  for (const id of ['M7', 'M6']) assert.equal(pushLabel(pushForStack(u, id)), 'Push to the wall (+2.5 cm)');
  for (const id of ['B8', 'B7']) assert.equal(pushLabel(pushForStack(u, id)), 'Push to the wall (+3.8 cm)');
  for (const id of ['T7', 'T8', 'T9', 'M5', 'M1', 'B6']) assert.equal(pushForStack(u, id), null, id);
  const gap = freeBands(u, scene()).find((b) => b.kind === 'gap' && b.unit === 'middle-3');
  assert.equal(pushForBand(u, gap).zone, 'middle');
});

test('new stacks at the wall end: only when the tapped gap runs to it', () => {
  const plan = store.getPlan2();
  // the 2.5 cm gap after M7 on the middle shelf runs to 208
  assert.equal(wallEndX(plan, store.getGame, 'middle', 206, 2), 206);
  assert.equal(wallEndX(plan, store.getGame, 'middle', 30.5, 5), null, 'the gap in the left unit ends at M2');
  assert.equal(wallEndX(plan, store.getGame, 'middle', 206, 3), null, 'too wide for the gap');
  assert.equal(wallEndX(plan, store.getGame, 'narrow', 79.5, 0.5), null, 'only the wall shelves');
  const empty = { stacks: [], board: [], cupboard: [] };
  assert.equal(wallEndX(empty, store.getGame, 'bottom', 120, 30), 178);
});

test('preferWall: the wall end unless it adds a rule problem', () => {
  const p = (rule, gameId = 'g1') => ({ rule, gameId, severity: 'warn' });
  assert.equal(preferWall({ block: [], warn: [] }, { block: [], warn: [] }), true);
  assert.equal(preferWall({ block: [], warn: [p('reach')] }, { block: [], warn: [p('reach')] }), true);
  assert.equal(preferWall({ block: [], warn: [] }, { block: [], warn: [p('bracket')] }), false);
  assert.equal(preferWall({ block: [], warn: [] }, { error: new Error('x'), block: [], warn: [] }), false);
});

test('the route keeps free=1', () => {
  assert.equal(parseFreeParam({ free: '1' }), true);
  assert.equal(parseFreeParam({}), false);
  assert.equal(freeHash({ game: 'g1' }, true), '#/map?game=g1&free=1');
  assert.equal(freeHash({ game: 'g1', free: '1' }, false), '#/map?game=g1');
  assert.equal(freeHash({}, true), '#/map?free=1');
});

test('newStackAt: against the wall end when the gap runs to it, else where it was', async () => {
  const { orientationChoices } = await import('../js/map/spots.js');
  const { fitNewStack } = await import('../js/map/stacks.js');
  store.removeStack('B8'); // the bottom shelf is empty from B7's end to 208
  try {
    const plan = store.getPlan2();
    const b7 = plan.stacks.find((s) => s.id === 'B7');
    const id = byTitle('Lairs');
    const o = orientationChoices(store.getGame(id))[0];
    const x = Math.ceil(b7.x + 30);
    const at = newStackAt(store, id, 'bottom', x, o);
    assert.notEqual(at, fitNewStack(plan, store.getGame, 'bottom', x, o.w));
    assert.equal(Math.round((at + o.w) * 100) / 100, 208, 'its box ends at the wall end');
    // the left unit's gap ends at a stack: unchanged
    assert.equal(newStackAt(store, id, 'middle', 31, { ...o, w: 5 }), fitNewStack(plan, store.getGame, 'middle', 31, 5));
  } finally {
    store.undo();
  }
  assert.ok(store.getStack2('B8'));
});
