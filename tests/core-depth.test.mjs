// Depth in free space (#93): the room behind a stack, and open front-row tops in front of a taller back row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN_BEHIND, freeSpace, zoneSlots } from '../js/core/space.js';
import { ZONES } from '../js/core/shelves.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const byId = new Map(seed.games.map((g) => [g.id, g]));
const getGame = (id) => byId.get(id);
const list = freeSpace(seed.plan, getGame);
const unit = (id) => list.find((u) => u.id === id);
const titleOf = (id) => byId.get(id).title;

test('behind: the floor behind a stack of one row, with its depth and whether two rows are easy there', () => {
  assert.equal(MIN_BEHIND, 5);
  assert.deepEqual(unit('bottom-2').behind, [{ kind: 'behind', stackId: 'B3', x: 60.2, w: 24, z: 24, d: 14, h: 36.5, easy: true }]);
  assert.deepEqual(unit('top-1').behind.map((b) => [b.stackId, b.w, b.d, b.easy]), [['T2', 13.5, 8, true], ['T3', 28, 10, false]]);
  assert.deepEqual(unit('narrow').behind.map((b) => [b.stackId, b.w, b.d]), [['N3', 18, 20], ['N4', 13, 20], ['N2', 18.5, 11.6], ['N1', 20.5, 10]]);
  assert.equal(unit('narrow').approximate, true);
  const all = list.flatMap((u) => u.behind);
  assert.ok(!all.some((b) => ['L1', 'B6'].includes(b.stackId)), 'stacks with two rows have none');
  assert.ok(all.every((b) => b.d >= MIN_BEHIND && b.z + b.d === 38), 'z + d is the shelf depth (38 everywhere)');
});

test('behind: cut at a bracket, each part in its own unit', () => {
  const games = new Map([['w', { id: 'w', dims: [5, 15, 30] }]]); // turned long side out: 30 wide, 15 deep
  const plan = { stacks: [{ id: 'M1', zone: 'middle', x: 45, boxes: [{ game: 'w', row: 0, x: 0, up: 's', rot: true, on: [] }] }] };
  const units = freeSpace(plan, (id) => games.get(id));
  const m1 = units.find((u) => u.id === 'middle-1').behind;
  const m2 = units.find((u) => u.id === 'middle-2').behind;
  assert.deepEqual([m1, m2].map((l) => l.map((b) => [b.x, b.w, b.z, b.d, b.easy])), [[[45, 14.8, 15, 23, false]], [[60.2, 14.8, 15, 23, false]]]);
});

test('an open front-row top in front of a taller back row: its own slot, row 0, as deep as the air in front of the back row', () => {
  const b6 = unit('bottom-2').slots.find((s) => s.row === 0);
  assert.deepEqual([b6.kind, b6.stackId, b6.on.map(titleOf), b6.y, b6.h, b6.rest.w, b6.d, b6.rest.d], ['top', 'B6', ['a_way'], 26.5, 10, 8, 16, 8]);
  assert.equal(unit('bottom-2').room.stackId, 'B3', 'the room stays the front view');
  assert.equal(unit('bottom-2').slots.at(-1), b6, 'front-row tops come last');
  const cards = unit('under-cards').standing.filter((s) => s.row === 0);
  assert.ok(cards.length >= 3 && cards.every((s) => s.d === 10.8 && s.stackId === 'L1'));
  assert.ok(list.every((u) => [...u.slots, ...u.standing].every((s) => s.row === 0 ? s.d < 38 : s.row === null && s.d === 38)));
});

test('zoneSlots: a taller box wholly behind limits the depth instead of walling the surface', () => {
  const zone = ZONES.bottom;
  const front = { stackId: 'B1', gameId: 'f', x0: 10, x1: 30, top: 10, z0: 0, z1: 12 };
  const back = { stackId: 'B1', gameId: 'b', x0: 10, x1: 30, top: 20, z0: 12, z1: 30 };
  const slots = zoneSlots(zone, [front, back]);
  const open = slots.find((s) => s.on.includes('f'));
  assert.deepEqual([open.row, open.d, open.rest, open.y, open.kind], [0, 12, { x: 10, w: 20, d: 12 }, 10, 'top']);
  assert.deepEqual(slots.find((s) => s.on.includes('b')).row, null);
  // without depths every taller box is a wall, as before
  const flat = zoneSlots(zone, [{ ...front, z0: undefined, z1: undefined }, { ...back, z0: undefined, z1: undefined }]);
  assert.equal(flat.some((s) => s.on.includes('f')), false);
});
