// Stack details panel (story C3). Owner: Bruce (Part B).
// A bottom sheet on phones (a centred panel on wider screens), opened with showPanel() so the
// Android back gesture closes it. It lists the boxes top to bottom, front row first; a title opens
// the game panel, and each box can be moved to the cupboard with an optional reason.
import { h, showPanel, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame } from '../core/contracts.js';
import { layoutStack } from './model.js';
import { stackDetails } from './details.js';
import { stackWarnings } from './cupboard.js';
import { categoryChips, warningList } from './ui.js';

let uniq = 0;

/**
 * Open the details of a stack. onClose runs once the panel is gone (by Back, ×, Esc or navigation).
 * Returns the dialog, or null if there is no such stack.
 */
export function openStackPanel(stackId, { onClose } = {}) {
  if (!store.getStack(stackId)) {
    toast(`There is no stack ${stackId} in this plan`, { error: true });
    return null;
  }
  const titleId = `map-sheet-title-${++uniq}`;
  const heading = h('h2', { id: titleId });
  const body = h('div', { class: 'map-sheet-body' });
  const dlg = h('dialog', { class: 'panel map-sheet', 'aria-labelledby': titleId },
    h('div', { class: 'map-sheet-head' },
      heading,
      h('button', { type: 'button', class: 'btn map-sheet-close', 'aria-label': 'Close', onclick: () => dlg.close() }, '×')),
    body);

  function render() {
    const st = store.getStack(stackId);
    if (!st) {
      dlg.close(); // the plan was replaced and this stack is gone
      return;
    }
    const d = stackDetails(st, layoutStack(st, store.getGame), store.getGame);
    const warnings = stackWarnings(store.getPlan(), store.getGame, stackId);
    heading.textContent = `Stack ${d.id}`;
    // a wrapper built with h(), which skips nulls and flattens lists (replaceChildren does neither)
    body.replaceChildren(h('div', {},
      h('dl', { class: 'map-facts' },
        h('dt', {}, 'Shelf'), h('dd', {}, d.shelf),
        h('dt', {}, 'Size'), h('dd', {}, `${d.size} `, h('span', { class: 'muted' }, '(wide × high)')),
        h('dt', {}, 'Games'), h('dd', {}, String(d.count))),
      warnings.length
        ? h('section', { class: 'map-row', 'aria-label': 'Rule warnings' }, warningList(warnings))
        : h('p', { class: 'map-ok' }, '✓ No rule problems.'),
      d.tags.length ? h('p', { class: 'map-tags' }, d.tags.map((t) => h('span', { class: 'map-tag' }, t))) : null,
      d.notes.length ? h('ul', { class: 'map-notes' }, d.notes.map((n) => h('li', {}, n))) : null,
      d.rows.map((row) => h('section', { class: 'map-row' },
        h('h3', {}, row.label ? `${row.label} · ${row.order}` : `Boxes · ${row.order}`),
        row.boxes.length
          ? h('ol', { class: 'map-boxlist' }, row.boxes.map(boxItem))
          : h('p', { class: 'muted' }, 'No boxes here.'))),
    ));
  }

  const off = on('store:changed', render);
  dlg.addEventListener('close', () => {
    off();
    onClose?.();
  }, { once: true });
  render();
  showPanel(dlg);
  return dlg;
}

function boxItem(b) {
  return h('li', { class: 'map-boxitem' },
    h('button', { type: 'button', class: 'map-boxitem-title', onclick: () => openGame(b.gameId) }, b.title),
    h('div', { class: 'map-boxitem-meta' },
      categoryChips(b.categories),
      h('span', {}, b.size),
      b.flags.map((f) => h('span', { class: 'map-flag' }, f))),
    h('button', {
      type: 'button', class: 'btn map-boxitem-move', 'aria-label': `Move ${b.title} to the cupboard`,
      onclick: () => askMoveToCupboard(b.gameId, b.title),
    }, 'To cupboard'));
}

/** Ask for an optional reason, then move the game to the cupboard. */
export function askMoveToCupboard(gameId, title) {
  const titleId = `map-move-title-${++uniq}`;
  const reason = h('input', { type: 'text', name: 'reason', maxlength: '200', autocomplete: 'off', placeholder: 'e.g. not played lately' });
  const dlg = h('dialog', { class: 'panel map-move', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); move(); } },
      h('h2', { id: titleId }, 'Move to the cupboard'),
      h('p', {}, h('strong', {}, title)),
      h('label', { class: 'map-field' }, h('span', {}, 'Reason (optional)'), reason),
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Move'))));

  function move() {
    try {
      store.moveToCupboard(gameId, reason.value.trim());
      dlg.close();
      toast(`${title} is in the cupboard now`);
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  showPanel(dlg);
  reason.focus();
}
