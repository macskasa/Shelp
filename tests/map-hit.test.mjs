// Part B: wider tap targets for empty stacks (part-b4 item 3). Run: node --test --test-reporter=dot tests/map*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { buildScene, SPACING } from '../js/map/scene.js';
import { tapTarget } from '../js/map/placing.js';
import { emptyRooms, hitSpan, MIN_HIT_PX } from '../js/map/hit.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: got ${a}, expected ${b}`);

const zone = { x: 0, length: 100, overhang: 0 };
const st = (x, w, empty = false) => ({ x, w, empty });

test('emptyRooms: up to the neighbours, halfway to an empty one, else the shelf ends', () => {
  const a = st(10, 20);
  const e1 = st(40, 3, true);
  const e2 = st(50, 3, true);
  const b = st(70, 20);
  const rooms = emptyRooms([b, e2, a, e1], zone);
  assert.deepEqual(rooms.get(e1), { left: 30, right: (43 + 50) / 2 });
  assert.deepEqual(rooms.get(e2), { left: (43 + 50) / 2, right: 70 });
  assert.equal(rooms.has(a), false, 'only empty stacks');
  const lone = st(0, 3, true);
  assert.deepEqual(emptyRooms([lone], { x: 5, length: 50, overhang: 4 }).get(lone), { left: 0, right: 59 }, 'never smaller than itself');
});

test('hitSpan: 40 px on screen, centred, as far as the room allows; a stack with boxes keeps its column', () => {
  const e = { ...st(40, 3, true), room: { left: 30, right: 60 } };
  const k = 1.8; // a phone's fit zoom
  const want = MIN_HIT_PX / k;
  const span = hitSpan(e, k);
  near(span.w, want, 'width');
  near(span.x, 41.5 - want / 2, 'centred');
  // a wider id label wins
  near(hitSpan(e, 4, 60).w, 15, 'label width');
  // next to a neighbour on the left: shifted right, not over it
  const tight = { ...st(31, 3, true), room: { left: 30, right: 60 } };
  near(hitSpan(tight, k).x, 30, 'kept off the left neighbour');
  // no room: the whole gap
  assert.deepEqual(hitSpan({ ...e, room: { left: 38, right: 46 } }, k), { x: 38, w: 8 });
  // zoomed in, 3 cm is wider than 40 px
  assert.deepEqual(hitSpan(e, 20), { x: 40, w: 3 });
  assert.deepEqual(hitSpan(st(10, 20), k), { x: 10, w: 20 });
  assert.deepEqual(hitSpan(st(10, 1), k), { x: 10, w: 2 }, 'at least 2 cm');
});

test('an empty stack in the seed: a tap 5 cm beside it hits it at phone zoom, not when zoomed in', () => {
  const id = store.createStack('middle', { x: 30.5 }); // in the 10 cm gap between M1 and M2
  try {
    const scene = buildScene(store.getPlan2(), store.getGame);
    const e = scene.stacks.find((s) => s.id === id);
    assert.equal(e.w, SPACING.emptyW);
    assert.ok(e.room.left <= e.x && e.room.right >= e.x + e.w);
    const z = scene.zones.find((x) => x.id === 'middle');
    const pt = { x: e.x + e.w + 5, y: z.top + 5 };
    // the room must reach that far for the test to mean something
    assert.ok(e.room.right > pt.x, `room right ${e.room.right}`);
    assert.deepEqual(tapTarget(scene, pt, 1.8), { kind: 'stack', stackId: id });
    assert.equal(tapTarget(scene, pt, 20).kind, 'empty');
    assert.equal(tapTarget(scene, pt).kind, 'empty', 'without a zoom: its own 3 cm');
  } finally {
    store.removeStack(id);
  }
});
