// The global tools in the header (#app-tools). Owner: Peter (Part C).
// Undo, Redo and "Where's my game?", reachable from every screen.
import { h } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { icon } from './icons.js';
import { undoStep, redoStep, wireUndoKeys } from './history.js';

const WHERE = 'Where’s my game?';

/**
 * renderTools(el, { where }) – where() opens the "Where's my game?" panel.
 * Undo and Redo stay in place but look dimmed (aria-disabled) while there is nothing to undo or redo,
 * so the header does not jump and keyboard focus is not lost.
 */
export function renderTools(el, { where }) {
  const tool = (cls, label, shape, action) => {
    const b = h('button', {
      class: `shell-tool ${cls}`, type: 'button', title: label, 'aria-label': label.replace(/ \(.*\)$/, ''),
      onclick: () => { if (b.getAttribute('aria-disabled') !== 'true') action(); },
    }, icon(shape));
    return b;
  };

  const undoBtn = tool('shell-undo', 'Undo (Ctrl+Z)', 'undo', undoStep);
  const redoBtn = tool('shell-redo', 'Redo (Ctrl+Shift+Z)', 'redo', redoStep);
  const whereBtn = h('button', { class: 'shell-tool shell-where', type: 'button', title: WHERE, 'aria-label': WHERE, 'aria-haspopup': 'dialog', onclick: () => where() },
    icon('search'), h('span', { class: 'shell-tool-label' }, WHERE));
  el.replaceChildren(undoBtn, redoBtn, whereBtn);

  const refresh = () => {
    undoBtn.setAttribute('aria-disabled', String(!store.canUndo()));
    redoBtn.setAttribute('aria-disabled', String(!store.canRedo()));
  };
  refresh();
  on('store:changed', refresh);
  wireUndoKeys();
}
