// Part B zoom and pan maths (story C2). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_K, limits, clampView, fitWidth, zoomAt, panBy, pinchView, isVisible, reveal, viewBox } from '../js/map/viewport.js';

const scene = { width: 214, height: 262 };
const near = (a, b, what, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b}`);

// phone portrait: 384 px wide, the frame as tall as the drawing at fit width
const PHONE = [384, 262 * (384 / 214)];
// desktop: 1176 × 800 px, the drawing is taller than the frame at fit width
const DESK = [1176, 800];

test('fit width opens with the full width at about 1.8 px per cm on a 384 px phone', () => {
  const v = fitWidth(scene, ...PHONE);
  near(v.k, 384 / 214, 'k');
  assert.ok(v.k > 1.75 && v.k < 1.85);
  assert.deepEqual([v.x, v.y], [0, 0]);
  assert.equal(viewBox(v, ...PHONE), '0 0 214 262');
});

test('limits: zoom out until everything fits, zoom in to MAX_K', () => {
  const lim = limits(scene, ...DESK);
  near(lim.min, 800 / 262, 'min = whole height fits');
  assert.equal(lim.max, MAX_K);
  assert.equal(clampView({ x: 0, y: 0, k: 999 }, scene, ...DESK).k, MAX_K);
  near(clampView({ x: 0, y: 0, k: 0.1 }, scene, ...DESK).k, 800 / 262, 'clamped up');
});

test('clamp keeps the drawing in the frame, centred across when it is narrower', () => {
  const k = 10;
  const v = clampView({ x: -50, y: 9999, k }, scene, ...DESK);
  assert.equal(v.x, 0);
  near(v.y, 262 - 800 / k, 'bottom edge');
  const small = clampView({ x: 40, y: 40, k: 800 / 262 }, scene, ...DESK);
  near(small.x, (214 - 1176 / small.k) / 2, 'centred across');
  assert.equal(small.y, 0, 'top aligned');
});

test('zoomAt keeps the point under the cursor in place', () => {
  const v0 = fitWidth(scene, ...DESK);
  const [px, py] = [600, 300];
  const before = [v0.x + px / v0.k, v0.y + py / v0.k];
  const v1 = zoomAt(v0, 2, px, py, scene, ...DESK);
  near(v1.k, v0.k * 2, 'k doubled');
  near(v1.x + px / v1.k, before[0], 'same x under the cursor');
  near(v1.y + py / v1.k, before[1], 'same y under the cursor');
  // zooming back out returns to the same view
  const v2 = zoomAt(v1, 0.5, px, py, scene, ...DESK);
  near(v2.k, v0.k, 'k back');
  near(v2.x, v0.x, 'x back');
  near(v2.y, v0.y, 'y back');
});

test('panBy moves the drawing with the finger, and stops at the edges', () => {
  const v0 = { x: 50, y: 50, k: 4 };
  const v1 = panBy(v0, 40, -20, scene, ...PHONE);
  near(v1.x, 50 - 10, 'dragging right shows what is to the left');
  near(v1.y, 50 + 5, 'dragging up shows what is below');
  const atFit = fitWidth(scene, ...PHONE);
  assert.deepEqual(panBy(atFit, 100, 100, scene, ...PHONE), atFit, 'nothing to pan at fit on the phone');
});

test('pinch: spreading two fingers zooms around them, moving them pans', () => {
  const v0 = { x: 20, y: 20, k: 4 };
  const m0 = { x: 200, y: 150 };
  const spread = pinchView(v0, m0, 100, m0, 200, scene, ...PHONE);
  near(spread.k, 8, 'twice the distance, twice the zoom');
  near(spread.x + m0.x / spread.k, v0.x + m0.x / v0.k, 'point under the fingers stays');
  const moved = pinchView(v0, m0, 100, { x: 240, y: 150 }, 100, scene, ...PHONE);
  near(moved.k, 4, 'same distance, same zoom');
  near(moved.x, v0.x - 40 / 4, 'moved with the fingers');
  assert.equal(pinchView(v0, m0, 0, m0, 50, scene, ...PHONE).k, 4, 'no division by zero');
});

test('reveal: no change when visible, otherwise centred at the same zoom', () => {
  const v = { x: 0, y: 0, k: 8 }; // 147 × 100 cm visible on the desktop frame
  const inside = { x: 10, y: 10, w: 20, h: 30 };
  assert.ok(isVisible(v, inside, ...DESK, 2));
  assert.equal(reveal(v, inside, scene, ...DESK), v, 'same object back');
  const far = { x: 170, y: 200, w: 20, h: 40 };
  const r = reveal(v, far, scene, ...DESK);
  assert.equal(r.k, 8);
  assert.ok(isVisible(r, far, ...DESK), 'now visible');
});
