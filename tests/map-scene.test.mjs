// Part B drawing layout tests (story C2). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ZONES } from '../js/core/shelves.js';
import { buildScene, findInScene, SPACING } from '../js/map/scene.js';
import { fitText, boxTitle, stackLabel, TITLE_PX } from '../js/map/labels.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const games = new Map(seed.games.map((g) => [g.id, g]));
const getGame = (id) => games.get(id);
const scene = buildScene(seed.plan, getGame);
const zone = (id) => scene.zones.find((z) => z.id === id);
const stack = (id) => scene.stacks.find((s) => s.id === id);
const byTitle = (t) => seed.games.find((g) => g.title === t).id;
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: got ${a}, expected ${b}`);

test('bands go top → middle → bottom → under the stairs → narrow, each below the last', () => {
  const order = ['top', 'middle', 'bottom', 'under-gap', 'narrow'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(zone(order[i]).top > zone(order[i - 1]).floor, `${order[i]} below ${order[i - 1]}`);
  }
  assert.deepEqual(scene.labels.map((l) => l.text), [
    'Top shelf · 40 cm high', 'Middle shelf · 37.5 cm high', 'Bottom shelf · 38.5 cm high',
    'Under the stairs', 'Narrow shelf · 8 cm high',
  ]);
});

test('zones are drawn at their physical size; wall shelves line up on the left', () => {
  for (const z of scene.zones) {
    near(z.floor - z.top, ZONES[z.id].height, `${z.id} height`);
    assert.equal(z.length, ZONES[z.id].length);
  }
  assert.equal(zone('top').x, SPACING.margin);
  assert.equal(zone('middle').x, zone('top').x);
  assert.equal(zone('bottom').x, zone('top').x);
  assert.ok(scene.width >= SPACING.margin * 2 + 208, 'the overhang fits');
});

test('under the stairs: three parts side by side, bottom-aligned, at their offsets', () => {
  const parts = ['under-cards', 'under-tall', 'under-gap'].map(zone);
  assert.ok(parts.every((z) => z.floor === parts[0].floor));
  near(parts[1].x - parts[0].x, 31, 'tall part offset');
  near(parts[2].x - parts[0].x, 71, 'gap offset');
  assert.equal(parts[2].approximate, true);
  assert.equal(zone('narrow').approximate, true);
  assert.equal(zone('top').approximate, false);
});

test('brackets: 0.4 × 6 bars centred on 0, 60, 140, 200 on the middle and bottom shelf only', () => {
  for (const id of ['middle', 'bottom']) {
    const bars = scene.brackets.filter((b) => b.zone === id);
    assert.deepEqual(bars.map((b) => Math.round((b.x + b.w / 2 - zone(id).x) * 100) / 100), [0, 60, 140, 200]);
    assert.ok(bars.every((b) => b.w === 0.4 && b.h === 6 && b.y === zone(id).top), `${id} bars hang from the top`);
  }
  assert.equal(scene.brackets.filter((b) => b.zone === 'top').length, 0);
});

test('easy to reach: top 0–44, the whole bottom shelf, one stepped outline under the stairs', () => {
  const pad = SPACING.easyPad;
  const top = scene.easy.find((e) => e.path.includes(`V${zone('top').top - pad}`));
  near(top.x1 - top.x0, 44 + 2 * pad, 'top easy width');
  const bottom = scene.easy.find((e) => e.path.includes(`V${zone('bottom').top - pad}`));
  near(bottom.x1 - bottom.x0, 208 + 2 * pad, 'bottom easy width (with overhang)');
  const under = scene.easy.find((e) => e.path.includes(`V${zone('under-gap').top - pad}`));
  near(under.x1 - under.x0, 80 + 2 * pad, 'under the stairs as one outline');
  assert.equal((under.path.match(/V/g) ?? []).length, 4, 'up, step, step, down');
  assert.equal(scene.easy.length, 4, 'top, bottom, under the stairs, narrow – nothing on the middle shelf');
  assert.ok(scene.easy.every((e) => !e.path.includes(`V${zone('middle').top - pad}`)), 'middle is not easy');
});

test('every placed game is drawn once (front row) or listed as back row', () => {
  const drawn = scene.stacks.flatMap((s) => s.boxes.map((b) => b.gameId));
  const back = scene.stacks.flatMap((s) => s.back);
  const onStacks = seed.plan.stacks.flatMap((s) => s.rows.flat().flatMap((it) => (it.side ? it.side : [it]).map((x) => x.game)));
  assert.equal(new Set([...drawn, ...back]).size, drawn.length + back.length, 'no duplicates');
  assert.deepEqual([...drawn, ...back].sort(), onStacks.sort());
  assert.equal(stack('T1').back.length, 6);
  assert.equal(stack('B5').back.length, 7);
  assert.equal(stack('L1').back.length, 7);
});

test('boxes stand on the floor and on each other', () => {
  for (const st of scene.stacks) {
    for (const b of st.boxes) {
      assert.ok(b.y + b.h <= st.floor + 1e-6, `${b.gameId} not below the floor`);
      assert.ok(b.x >= st.x - 1e-6 && b.x + b.w <= st.x + st.w + 1e-6, `${b.gameId} inside ${st.id}`);
    }
  }
  const b1 = stack('B1').boxes;
  near(b1[0].y + b1[0].h, stack('B1').floor, 'bottom box on the floor');
  for (let i = 1; i < b1.length; i++) near(b1[i].y + b1[i].h, b1[i - 1].y, `B1 box ${i} on box ${i - 1}`);
});

test('special placements are where the plan says (C5)', () => {
  // KLASK stands at the wall end and sticks out 8 cm past x = 200
  const klask = stack('T9').boxes[0];
  assert.equal(klask.standing, true);
  near(klask.x + klask.w, zone('top').x + 208, 'KLASK right edge');
  // Ice Cool stands upright in the tall gap
  const ice = stack('S1').boxes[0];
  near(ice.h, 41, 'Ice Cool height');
  near(ice.y + ice.h, zone('under-gap').floor, 'Ice Cool on the floor');
  // castle and bonsai: centred on top of their piles
  for (const [id, label] of [['M4', 'LEGO castle'], ['M3', 'Bonsai']]) {
    const st = stack(id);
    assert.equal(st.topper.label, label);
    near(st.topper.y + st.topper.h, st.floor - st.layout.pileH, `${label} on the pile`);
    near(st.topper.x + st.topper.w / 2, st.x + st.w / 2, `${label} centred`);
  }
  // Compile + Kontroll side by side on top of B3
  const b3 = stack('B3').boxes;
  const compile = b3.find((b) => b.gameId === byTitle('Compile: Main 2'));
  const kontroll = b3.find((b) => b.gameId === byTitle('Kontroll'));
  assert.equal(compile.y, kontroll.y);
  near(kontroll.x, compile.x + compile.w, 'side by side');
  assert.equal(Math.min(...b3.map((b) => b.y)), compile.y, 'on top');
  // two-row stacks
  for (const id of ['T1', 'B5', 'B6', 'L1']) assert.equal(stack(id).rows, 2, id);
});

test('findInScene: front row box, back row stack, not on a stack', () => {
  const ark = findInScene(scene, byTitle('Ark Nova'));
  assert.equal(ark.stack.id, 'M4');
  assert.equal(ark.box.gameId, byTitle('Ark Nova'));
  const backId = stack('T1').back[0];
  assert.deepEqual([findInScene(scene, backId).stack.id, findInScene(scene, backId).box], ['T1', null]);
  assert.equal(findInScene(scene, seed.plan.cupboard[0].game), null);
});

test('an empty plan still draws all zones', () => {
  const empty = buildScene({ stacks: [], cupboard: [], inside: {} }, getGame);
  assert.equal(empty.zones.length, Object.keys(ZONES).length);
  assert.equal(empty.stacks.length, 0);
  assert.ok(empty.width > 208);
});

// ---- labels ---------------------------------------------------------------------------------

const measure = (t) => Array.from(t).length * 6; // fake: 6 px per character

test('fitText: whole text, cut with an ellipsis, or nothing', () => {
  assert.equal(fitText('Ark Nova', 100, measure), 'Ark Nova');
  assert.equal(fitText('Ark Nova', 30, measure), 'Ark…', 'cut, trailing space dropped');
  assert.equal(fitText('Ark Nova', 12, measure), null);
  assert.equal(fitText('', 100, measure), null);
  assert.equal(fitText('Ark', 0, measure), null);
  // characters outside the BMP are not split
  assert.equal(fitText('🎲🎲🎲🎲🎲', 24, measure), '🎲🎲🎲…');
});

test('boxTitle: hidden below 11 px, horizontal for flat boxes, along the height for standing ones', () => {
  const flat = { w: 30, h: 7, standing: false };
  assert.equal(boxTitle(flat, 'Ark Nova', 1.8, measure), null, `7 cm at 1.8 px/cm is under ${TITLE_PX} px + 2`);
  assert.equal(boxTitle(flat, 'Ark Nova', 4, measure), 'Ark Nova', 'readable at 4 px/cm');
  const book = { w: 2.5, h: 12.5, standing: true };
  assert.equal(boxTitle(book, 'Love Letter', 4, measure), null, '10 px thin');
  assert.equal(boxTitle(book, 'Love Letter', 6, measure), 'Love Letter', 'vertical along 75 px');
});

test('stackLabel: long form when it fits, short form when not', () => {
  assert.equal(stackLabel('B3', false, 10, measure), 'B3');
  assert.equal(stackLabel('T1', true, 200, measure), 'T1 · 2 deep');
  assert.equal(stackLabel('B6', true, 26, measure), 'B6 ×2');
});
