import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameHeight, MIN_FRAME_H } from '../js/map/fit.js';

test('the frame takes the room that is left in the window', () => {
  // 1440 × 900: header + padding + row switch above (112), padding below (12)
  assert.equal(frameHeight({ windowH: 900, top: 112, below: 12, natural: 2000 }), 776);
});

test('content below the frame (a bar, a strip) takes its room too', () => {
  assert.equal(frameHeight({ windowH: 900, top: 112, below: 12 + 60, natural: 2000 }), 716);
});

test('never taller than the drawing at full width', () => {
  assert.equal(frameHeight({ windowH: 832, top: 120, below: 80, natural: 300.4 }), 301);
});

test('phone landscape: a short frame, still no page scroll', () => {
  assert.equal(frameHeight({ windowH: 384, top: 113, below: 56, natural: 900 }), 215);
});

test('a tiny window keeps a usable minimum', () => {
  assert.equal(frameHeight({ windowH: 200, top: 150, below: 40, natural: 900 }), MIN_FRAME_H);
  assert.equal(frameHeight({ windowH: 200, top: 150, below: 40, natural: 80 }), 80);
});
