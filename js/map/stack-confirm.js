// Remove stack and Renumber left to right (part-b3 item 5). Owner: Bruce (Part B).
// An empty stack is removed at once; one with games asks first (they go to the board).
// Renumber lists the renames from a preview of renumberStacks(), then runs it.
// Join with the next stack (part-b6 item 1): the new problems from a preview, or the store's refusal
// (then no Join button). Every one is one undo step, closes the panels and toasts with Undo.
import { h, showPanel, closePanels, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { removeText, renameLines, checkMove } from './stacks.js';
import { joinText, joinFn } from './join.js';
import { warningList } from './ui.js';
import { highlightStack } from './highlight.js';

const undo = { label: 'Undo', run: () => store.undo() };
let uniq = 0;

/** Remove a stack: at once when empty, else after a confirmation. */
export function removeStack(stackId) {
  const st = store.getStack2(stackId);
  if (!st) return;
  const text = removeText(st);
  if (!text) {
    run();
    return;
  }
  confirmPanel(`Remove stack ${stackId}?`, [h('p', {}, text)], 'Remove stack', run, { danger: true });

  function run() {
    try {
      store.removeStack(stackId);
      closePanels(() => toast(`Stack ${stackId} removed${text ? '; its games are on the board' : ''}`, { action: undo }));
    } catch (err) {
      toast(err.message, { error: true });
    }
  }
}

/** Renumber every shelf's stacks left to right, after showing the renames. */
export function askRenumber() {
  let map = {};
  const p = store.preview(() => { map = store.renumberStacks(); });
  if (p.error) {
    toast(p.error.message, { error: true });
    return;
  }
  const lines = renameLines(map, store.getPlan2());
  if (!lines.length) {
    toast('The stacks are already numbered left to right.');
    return;
  }
  confirmPanel('Renumber left to right', [
    h('p', {}, lines.length === 1 ? '1 stack gets a new id:' : `${lines.length} stacks get a new id:`),
    h('ul', { class: 'map-renames' }, lines.map((l) => h('li', {}, l))),
  ], 'Renumber', () => {
    try {
      store.renumberStacks();
      closePanels(() => toast(`Renumbered ${lines.length} stack${lines.length === 1 ? '' : 's'}`, { action: undo }));
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

/** Join two neighbouring stacks, after a confirmation with the new problems (or the store's refusal). */
export function askJoin(aId, bId) {
  const t = joinText(store.getPlan2(), aId, bId);
  const c = checkMove(store, joinFn(store, aId, bId), 'Join');
  const body = c.error ? [] : [h('p', {}, t.text)];
  if (c.error) body.push(h('p', { class: 'map-put-error' }, c.error.message));
  else if (c.block.length || c.warn.length) {
    if (c.block.length) body.push(h('p', { class: 'map-put-error' }, 'Not allowed:'));
    body.push(warningList([...c.block, ...c.warn]));
  } else body.push(h('p', { class: 'map-ok' }, '✓ No new problems.'));
  return confirmPanel(t.title, body, c.button.disabled ? null : c.button.label, () => {
    try {
      const id = store.joinStacks(aId, bId);
      closePanels(() => {
        toast(t.done, { action: undo });
        highlightStack(id);
      });
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

/** verb null: no confirm button (the action is refused), only Cancel. */
function confirmPanel(title, body, verb, onOk, { danger = false } = {}) {
  const titleId = `map-confirm-title-${++uniq}`;
  const dlg = h('dialog', { class: 'panel map-confirm', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); if (verb) onOk(); } },
      h('h2', { id: titleId }, title),
      h('div', { class: 'map-confirm-body' }, body),
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        verb ? h('button', { type: 'submit', class: danger ? 'btn btn-danger' : 'btn btn-primary' }, verb) : null)));
  showPanel(dlg);
  dlg.querySelector('[type=submit]')?.focus(); // Enter confirms
  return dlg;
}
