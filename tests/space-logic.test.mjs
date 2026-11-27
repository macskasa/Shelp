// Tests for the Free space texts and bar maths (story D3). Run from the repo root: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freeSpace } from '../js/core/space.js';
import { barModel, cardTitle, cm, floorText, groupUnits, roomText, summaryText, totals } from '../js/space/logic.js';

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

test('room line: on top of the stack with most room, (not measured) when approximate', () => {
  assert.equal(roomText(unit('middle-1')), 'up to 4.1 cm on top of M2');
  assert.equal(roomText({ room: null, approximate: false }), '');
  assert.equal(roomText({ room: { stackId: 'U1', h: 5 }, approximate: true }), 'up to 5 cm on top of U1 (not measured)');
  assert.equal(roomText({ room: null, approximate: true }), '(not measured)');
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
