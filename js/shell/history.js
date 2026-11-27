// Undo and Redo: the store does the work (store.undo / redo), this file adds the toast and the keys.
// Owner: Peter (Part C). Every write except setMeta is one step, a batch is one step, 30 steps are kept in memory.
import * as store from '../core/store.js';
import { toast } from '../core/dom.js';
import { undoKeyAction } from './undo-keys.js';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

// One short toast at a time: pressing Undo five times should not stack five of them.
function say(text) {
  for (const t of document.querySelectorAll('.toast')) if (t.textContent === 'Undone' || t.textContent === 'Redone') t.remove();
  toast(text, { ms: 1800 });
}

/** Undo the last change. Says "Undone"; says nothing when there was nothing to undo. */
export function undoStep() {
  if (store.undo()) say('Undone');
}

export function redoStep() {
  if (store.redo()) say('Redone');
}

/** Is the focus somewhere you type text? There the browser's own undo of the typed text must work. */
function inTextField(el) {
  const f = el instanceof Element ? el.closest('input, textarea, [contenteditable]') : null;
  if (!f) return false;
  return f.tagName === 'INPUT' ? !NON_TEXT_INPUTS.has(f.type) : true;
}

/**
 * Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y anywhere in the app, also with a panel open (panels follow store:changed,
 * like the screens do), but not in text fields. Returns a function that removes the listener.
 */
export function wireUndoKeys() {
  const onKey = (e) => {
    const action = undoKeyAction(e, inTextField(e.target));
    if (!action) return;
    e.preventDefault();
    if (action === 'undo') undoStep();
    else redoStep();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
