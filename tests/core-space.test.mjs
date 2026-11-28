// Core tests for js/core/space.js (D3 free space). Owner: Tony (lead).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN_GAP, MIN_REST, TILT, UNITS, emptyStretches, freeSpace, zoneSlots } from '../js/core/space.js';
import { ZONES } from '../js/core/shelves.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const byId = new Map(seed.games.map((g) => [g.id, g]));
const getGame = (id) => byId.get(id);
const unit = (list, id) => list.find((u) => u.id === id);

test('units: 60 | 80 | 60 per wall shelf, then under the stairs and the narrow shelf', () => {
  assert.deepEqual(UNITS.map((u) => u.id), [
    'top-1', 'top-2', 'top-3', 'middle-1', 'middle-2', 'middle-3', 'bottom-1', 'bottom-2', 'bottom-3',
    'under-cards', 'under-tall', 'under-gap', 'narrow',
  ]);
  assert.deepEqual(UNITS.slice(0, 3).map((u) => [u.x0, u.x1, u.length, u.end]), [[0, 60, 60, 60], [60, 140, 80, 140], [140, 200, 60, 208]]);
  assert.equal(unit(UNITS, 'bottom-2').label, 'Bottom shelf · middle');
  assert.equal(unit(UNITS, 'middle-1').height, 35.5);
  assert.equal(unit(UNITS, 'under-gap').approximate, true);
  assert.ok(Object.isFrozen(UNITS) && Object.isFrozen(UNITS[0]));
});

test('an empty plan: every unit is free to its end, no room figure', () => {
  const list = freeSpace({ stacks: [{ id: 'B9', zone: 'bottom', x: 10, boxes: [] }] }, getGame);
  for (const u of list) {
    assert.equal(u.free, u.end - u.x0, u.id);
    assert.equal(u.widest, u.free);
    assert.deepEqual(u.stacks, []);
    assert.deepEqual(u.slots, []);
    assert.deepEqual(u.standing, []);
    assert.equal(u.room, null);
  }
});

test('the v5 plan: gaps, a stack across a joint in both units, room above the stacks', () => {
  const list = freeSpace(seed.plan, getGame);
  assert.deepEqual(unit(list, 'middle-1').gaps, [{ x: 30.2, w: 10 }]);
  assert.equal(unit(list, 'middle-1').free, 10);
  assert.equal(unit(list, 'middle-1').room.stackId, 'M2');
  assert.equal(unit(list, 'middle-1').room.h, 4.1);
  assert.deepEqual(unit(list, 'top-1').gaps, [], 'full; the 0.2 cm before T1 is not a gap');
  assert.ok(unit(list, 'top-1').stacks.some((s) => s.id === 'T3') && unit(list, 'top-2').stacks.some((s) => s.id === 'T3'));
  assert.deepEqual(unit(list, 'under-gap').gaps, [{ x: 0, w: 1.5 }, { x: 7.5, w: 1.5 }]);
  assert.equal(unit(list, 'under-gap').widest, 1.5);
  assert.deepEqual(unit(list, 'bottom-3').gaps, [{ x: 204.2, w: 3.8 }], 'the wall unit counts the overhang');
  const t7 = unit(list, 'top-3').stacks.find((s) => s.id === 'T7');
  assert.equal(t7.room, 0, 'the castle reaches above the usable height: no room, never negative');
  for (const u of list) {
    assert.ok(u.gaps.every((g) => g.w >= MIN_GAP && g.x >= u.x0 && g.x + g.w <= u.end + 1e-9), u.id);
    assert.ok(u.stacks.every((s) => s.room >= 0 && s.room <= u.height), u.id);
  }
});

test('emptyStretches: overlapping and unsorted spans, a span past the end', () => {
  assert.deepEqual(emptyStretches([{ x0: 50, x1: 70 }, { x0: 10, x1: 20 }, { x0: 15, x1: 30 }], 100),
    [{ x0: 0, x1: 10 }, { x0: 30, x1: 50 }, { x0: 70, x1: 100 }]);
  assert.deepEqual(emptyStretches([{ x0: 0, x1: 120 }], 100), []);
  assert.deepEqual(emptyStretches([], 9), [{ x0: 0, x1: 9 }]);
});

test('slots: the air above a stack top reaches over lower neighbours, up to a taller box or a bracket', () => {
  const list = freeSpace(seed.plan, getGame);
  const portRoyal = seed.games.find((g) => g.title === 'Port Royal').id;
  // M2 (40.2–59.8, 31.4 high): from M1's narrower top box (ends at 27.1) to the bracket at 60 cm
  assert.deepEqual(unit(list, 'middle-1').room, {
    kind: 'top', stackId: 'M2', stackIds: ['M2'], y: 31.4, h: 4.1, x: 27.1, w: 32.7, d: 38, row: null, rest: { x: 40.2, w: 12.7, d: 17.7 }, tilt: 0, on: [portRoyal],
  });
  assert.deepEqual(unit(list, 'middle-1').stacks.find((s) => s.id === 'M2').slot, unit(list, 'middle-1').room);
  assert.equal(unit(list, 'middle-1').stacks.find((s) => s.id === 'M1').slot, null, 'M1 reaches the usable height');
  // two boxes side by side at the top make one surface (B3: Compile + Kontroll)
  const b3 = unit(list, 'bottom-2').slots.find((s) => s.stackId === 'B3');
  assert.equal(b3.on.length, 2);
  assert.equal(b3.rest.w, 16.6);
  // the top shelf has no brackets: T3's air runs from the shelf's left end
  assert.equal(unit(list, 'top-1').slots.find((s) => s.stackId === 'T3').x, 0);
  // a topper covering the top box: no top slot (M3 bonsai, M4 castle)
  assert.ok(!unit(list, 'middle-2').slots.some((s) => s.kind === 'top' && (s.stackId === 'M3' || s.stackId === 'M4')));
  for (const u of list) {
    assert.ok(u.slots.every((s) => s.kind === 'top') && u.standing.every((s) => s.kind === 'standing'), u.id);
    for (const s of [...u.slots, ...u.standing]) {
      assert.ok(s.rest.w >= MIN_REST && s.rest.x >= s.x - 1e-9 && s.rest.x + s.rest.w <= s.x + s.w + 1e-9, `${u.id} ${s.stackId}`);
      assert.ok(s.h >= 1 && s.y + s.h <= u.height + 1e-9, `${u.id} ${s.stackId}`);
      assert.ok(s.tilt >= 0 && s.tilt <= TILT + 1e-9 && s.stackIds.includes(s.stackId), `${u.id} ${s.stackId}`);
    }
    const open = u.slots.filter((s) => s.row !== 0);
    assert.deepEqual(open.map((s) => s.h), [...open.map((s) => s.h)].sort((a, b) => b - a), `${u.id}: most height first`);
    assert.deepEqual(u.slots.slice(0, open.length), open, `${u.id}: open front-row tops come last`);
    assert.equal(u.room, u.slots[0] ?? null, `${u.id}: room is the best top slot`);
  }
});

test('standing spaces (#88): the open edge of a box beside something taller', () => {
  const list = freeSpace(seed.plan, getGame);
  const title = (id) => getGame(id).title;
  // Anachrony (T8, 6.2 cm) next to KLASK standing in T9: 4.3 cm wide, 31.8 cm high
  const anachrony = unit(list, 'top-3').standing.find((s) => s.stackId === 'T8');
  assert.match(title(anachrony.on[0]), /^Anachrony/);
  assert.deepEqual([anachrony.x, anachrony.w, anachrony.h], [188.7, 4.3, 31.8]);
  // Thunder Road (M5, 6 cm) next to M6: 6.5 cm wide, 29.5 cm high
  const thunder = unit(list, 'middle-3').standing.find((s) => s.stackId === 'M5' && s.y === 6);
  assert.match(title(thunder.on[0]), /^Thunder Road/);
  assert.deepEqual([thunder.x, thunder.w, thunder.h], [145.9, 6.5, 29.5]);
});

test('tilt (#89): neighbouring surfaces within 0.5 cm make one, never across a bracket', () => {
  const box = (stackId, gameId, x0, x1, top) => ({ stackId, gameId, x0, x1, top });
  const middle = ZONES.middle; // brackets at 0, 60, 140, 200
  // Adam's M1 / M2: an open edge of 2.8 cm at 28.1, then 0.5 cm air, then M2's top at 27.7
  const pieces = [box('M1', 'a', 10, 39.7, 28.1), box('M1', 'b', 10, 36.9, 35.5), box('M2', 'c', 40.2, 58.6, 27.7)];
  const [s] = zoneSlots(middle, pieces);
  assert.deepEqual([s.kind, s.stackId, s.stackIds, s.y, s.tilt, s.rest, s.x, s.w], ['top', 'M2', ['M1', 'M2'], 28.1, 0.4, { x: 36.9, w: 21.7, d: 38 }, 36.9, 22.9]);
  assert.deepEqual(s.on, ['a', 'c']);
  // 0.6 cm apart: two surfaces, and the higher one is a wall for the lower one
  const apart = zoneSlots(middle, [box('M1', 'a', 10, 39.7, 28.3), box('M1', 'b', 10, 36.9, 35.5), box('M2', 'c', 40.2, 58.6, 27.7)]);
  assert.equal(apart.length, 2);
  assert.equal(apart.find((x) => x.stackId === 'M2').x, 39.7);
  // a bracket between two level tops (at 60 cm): two surfaces
  const bracket = zoneSlots(middle, [box('M2', 'c', 45, 59.8, 20), box('M3', 'd', 60.2, 75, 20)]);
  assert.equal(bracket.length, 2);
});
