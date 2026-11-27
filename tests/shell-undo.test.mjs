// Which keys mean Undo and Redo (Part C, Undo). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { undoKeyAction } from '../js/shell/undo-keys.js';

const key = (k, mods = {}) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

test('Ctrl+Z is undo, Ctrl+Shift+Z and Ctrl+Y are redo', () => {
  assert.equal(undoKeyAction(key('z', { ctrlKey: true })), 'undo');
  assert.equal(undoKeyAction(key('Z', { ctrlKey: true, shiftKey: true })), 'redo'); // Shift gives a capital Z
  assert.equal(undoKeyAction(key('z', { ctrlKey: true, shiftKey: true })), 'redo');
  assert.equal(undoKeyAction(key('y', { ctrlKey: true })), 'redo');
  assert.equal(undoKeyAction(key('Y', { ctrlKey: true })), 'redo');
});

test('Cmd works like Ctrl (Mac)', () => {
  assert.equal(undoKeyAction(key('z', { metaKey: true })), 'undo');
  assert.equal(undoKeyAction(key('z', { metaKey: true, shiftKey: true })), 'redo');
});

test('other keys, plain letters, Alt combinations and Ctrl+Shift+Y are not ours', () => {
  assert.equal(undoKeyAction(key('z')), null);
  assert.equal(undoKeyAction(key('y')), null);
  assert.equal(undoKeyAction(key('x', { ctrlKey: true })), null);
  assert.equal(undoKeyAction(key('c', { ctrlKey: true })), null);
  assert.equal(undoKeyAction(key('z', { ctrlKey: true, altKey: true })), null); // AltGr on some keyboards
  assert.equal(undoKeyAction(key('y', { ctrlKey: true, shiftKey: true })), null);
  assert.equal(undoKeyAction(key('Control', { ctrlKey: true })), null);
  assert.equal(undoKeyAction({ key: undefined, ctrlKey: true }), null);
});

test('in a text field the keys are left to the browser', () => {
  assert.equal(undoKeyAction(key('z', { ctrlKey: true }), true), null);
  assert.equal(undoKeyAction(key('z', { ctrlKey: true, shiftKey: true }), true), null);
  assert.equal(undoKeyAction(key('y', { ctrlKey: true }), true), null);
});
