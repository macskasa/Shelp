// Tests for the Free space texts and bar maths (story D3). Run from the repo root: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freeSpace } from '../js/core/space.js';
import { barModel, cardTitle, cm, floorText, groupUnits, moreRoom, moreRoomLabel, roomText, slotText, summaryText, totals } from '../js/space/logic.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const byId = new Map(seed.games.map((g) => [g.id, g]));
const list = freeSpace(seed.plan, (id) => byId.get(id));
const unit = (id) => list.find((u) => u.id === id);

test('cm: one decimal at most', () => {
  assert.deepEqual([cm(10), cm(4.1), cm(1.5), cm(3.8000001)], ['10', '4.1', '1.5', '3.8']);
});

test('floor headline: free, full, and the widest gap when there are several', () => {
  assert.deepEqual(floorText(unit('middle-1')), { main: '10 cm free', extra: '' });
  assert.deepEqual(floorText(unit('top-1')), { main: 'Full', extra: '' });
  assert.deepEqual(floorText(unit('under-gap')), { main: '3 cm free', extra: 'widest 1.5 cm' });
});

const nameOf = (id) => byId.get(id)?.title ?? id;

test('room line: height, the air when it is wider, what it rests on; (not measured) when approximate', () => {
  assert.equal(roomText(unit('middle-1'), nameOf), 'On M2: 4.1 cm high · 32.7 cm of air · rests on Port Royal, 12.7 cm');
  assert.equal(roomText(unit('bottom-2'), nameOf), 'On B3: 8.8 cm high · 24 cm of air · rests on Compile: Main 2 + Kontroll, 16.6 cm');
  assert.equal(roomText({ room: null, approximate: false }), '');
  const slot = { stackId: 'U1', h: 5, x: 0, w: 20, rest: { x: 0, w: 20 }, on: ['a'] };
  assert.equal(roomText({ room: slot, approximate: true }, () => 'Ice Cool'), 'On U1: 5 cm high · rests on Ice Cool, 20 cm (not measured)');
  assert.equal(roomText({ room: null, approximate: true }), '(not measured)');
  assert.equal(roomText({ room: { stackId: 'M2', h: 0 }, approximate: false }), 'No room on top');
  assert.equal(roomText({ room: { stackId: 'M2', h: 0.04 }, approximate: true }), 'No room on top (not measured)');
  assert.equal(roomText(unit('bottom-3'), nameOf), 'On B8: 4 cm high · 43.3 cm of air · rests on Unmatched: Cobble & Fog, 15.2 cm');
  assert.equal(roomText(unit('middle-2'), nameOf), 'On M5: 6.3 cm high · rests on A vörös katedrális, 16.9 cm'); // air 18.1 ≤ 16.9 + 2: left out
  // air exactly rest + 2 is left out, a little more is shown
  assert.ok(!slotText({ ...slot, w: 22 }).includes('air'));
  assert.ok(slotText({ ...slot, w: 22.1 }).includes('22.1 cm of air'));
});

test('more room on top: the other slots, one line each, most height first', () => {
  const u = unit('top-1');
  assert.equal(moreRoomLabel(u, nameOf), 'More room on top (2)');
  const lines = moreRoom(u, nameOf);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^On T1: 2\.4 cm high/);
  assert.match(lines[1], /^On T3: 1\.6 cm high/);
  assert.equal(moreRoomLabel(unit('middle-1'), nameOf), '');
  assert.deepEqual(moreRoom({ slots: [], room: null }), []);
});

test('bar slots: bands clipped at the unit, with the open part inside', () => {
  const u = unit('middle-1');
  const m = barModel(u);
  assert.equal(m.slots.length, 1);
  const s = m.slots[0];
  const span = u.end - u.x0;
  assert.ok(Math.abs(s.left - (27.1 - u.x0) / span) < 1e-9);
  assert.ok(Math.abs(s.width - 32.7 / span) < 1e-9);
  assert.ok(Math.abs(s.height - 4.1 / u.height) < 1e-9);
  assert.ok(s.restLeft >= s.left && s.restLeft + s.restWidth <= s.left + s.width + 1e-9);
  assert.ok(Math.abs(s.restWidth - 12.7 / span) < 1e-9);
  for (const x of list) for (const b of barModel(x).slots) assert.ok(b.left >= 0 && b.left + b.width <= 1 + 1e-9);
  // a slot sticking out of the unit is cut at its edge
  const cut = barModel({ ...u, slots: [{ stackId: 'X', h: 2, x: u.x0 - 10, w: 20, rest: { x: u.x0 - 10, w: 20 } }] }).slots[0];
  assert.equal(cut.left, 0);
  assert.ok(Math.abs(cut.width - 10 / span) < 1e-9);
});

test('summary: the total and the widest stretch', () => {
  const t = totals(list);
  assert.equal(t.free, Math.round(list.reduce((n, u) => n + u.free, 0) * 10) / 10);
  assert.ok(t.widest >= 10);
  assert.match(summaryText(list), /^[\d.]+ cm of free shelf in all · widest [\d.]+ cm, .+$/);
  assert.equal(summaryText([{ free: 0, widest: 0, label: 'x' }]), 'No free shelf at all');
  assert.equal(summaryText([{ free: 10, widest: 10, label: 'Middle shelf · left' }]),
    '10 cm of free shelf in all · widest 10 cm, Middle shelf · left');
});

test('groups: three wall shelves of three, under the stairs, narrow shelf', () => {
  const g = groupUnits(list);
  assert.deepEqual(g.map((x) => [x.title, x.units.length]),
    [['Top shelf', 3], ['Middle shelf', 3], ['Bottom shelf', 3], ['Under the stairs', 3], ['Narrow shelf', 1]]);
  assert.deepEqual(g.map((x) => x.wall), [true, true, true, false, false]);
  assert.deepEqual(g[1].units.map(cardTitle), ['Left', 'Middle', 'Right']);
  assert.deepEqual(g[3].units.map(cardTitle), ['Card games', 'Tall part', 'Tall gap']);
  assert.equal(cardTitle(unit('narrow')), 'Narrow shelf');
});

test('bar: gaps and stacks as fractions of the unit, overhang as the faint tail', () => {
  const m = barModel(unit('middle-1'));
  assert.equal(m.shelf, 1);
  assert.equal(m.gaps.length, 1);
  assert.ok(Math.abs(m.gaps[0].left - 30.2 / 60) < 1e-9 && Math.abs(m.gaps[0].width - 10 / 60) < 1e-9);
  assert.ok(m.stacks.every((s) => s.left >= 0 && s.left + s.width <= 1 + 1e-9 && s.fill >= 0 && s.fill <= 1));
  const right = barModel(unit('bottom-3'));
  assert.ok(Math.abs(right.shelf - 60 / 68) < 1e-9);
  assert.ok(right.gaps.every((g) => g.left + g.width <= 1 + 1e-9));
  const t7 = barModel(unit('top-3')).stacks.find((s) => s.id === 'T7');
  assert.equal(t7.fill, 1, 'a stack at or above the usable height is full');
});

test('bar: a stack across a joint is cut at the unit edge', () => {
  const m = barModel(unit('top-2'));
  const t3 = m.stacks.find((s) => s.id === 'T3');
  assert.ok(t3 && t3.left >= 0 && t3.left + t3.width <= 1 + 1e-9);
});
