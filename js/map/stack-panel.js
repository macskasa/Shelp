// Stack details panel (stories C3, B2.2). Owner: Bruce (Part B).
// A bottom sheet on phones (a centred panel on wider screens), opened with showPanel() so the
// Android back gesture closes it. Schema 2: it lists the boxes top to bottom by height, front row
// first, each with what it rests on; a title opens the game panel; Pick up opens the pick-up sheet
// (move, turn, to the board or the cupboard, inside a box).
// Warnings come from Stephen's v2 rule checker: block = red, warn = amber.
// A box of a game with a family has a chip with its name: showFamily (part-b4 item 2; go() closes the panel).
// Item 5: Move stack (stack-move-panel.js) and Remove stack (stack-confirm.js; asks first when it has games).
import { h, showPanel, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame, showFamily } from '../core/contracts.js';
import { layoutStack2 } from '../core/geometry.js';
import { checkPlan2, forStack } from '../rules/index.js';
import { stackDetails } from './details.js';
import { categoryChips, warningList } from './ui.js';
import { openPickUp } from './pickup-sheet.js';
import { openStackMove } from './stack-move-panel.js';
import { removeStack } from './stack-confirm.js';

let uniq = 0;

/**
 * Open the details of a stack. onClose runs once the panel is gone (by Back, ×, Esc or navigation).
 * Returns the dialog, or null if there is no such stack.
 */
export function openStackPanel(stackId, { onClose } = {}) {
  if (!store.getStack2(stackId)) {
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
    const st = store.getStack2(stackId);
    if (!st) {
      dlg.close(); // the plan was replaced and this stack is gone
      return;
    }
    const d = stackDetails(st, layoutStack2(st, store.getGame), store.getGame);
    // overlaps are reported once per pair; forStack shows them on both stacks
    const warnings = forStack(checkPlan2(store.getPlan2(), store.getGame), stackId)
      .sort((a, b) => (a.severity === 'block' ? 0 : 1) - (b.severity === 'block' ? 0 : 1));
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
        h('h3', {}, row.label ? `${row.label} · top to bottom` : 'Boxes · top to bottom'),
        row.boxes.length
          ? h('ol', { class: 'map-boxlist' }, row.boxes.map(boxItem))
          : h('p', { class: 'muted' }, d.count ? 'No boxes here.' : 'An empty stack. To put a game here, pick it up and tap this stack.'))),
      h('div', { class: 'map-stack-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => openStackMove(stackId) }, 'Move stack'),
        h('button', { type: 'button', class: 'btn btn-danger', onclick: () => removeStack(stackId) }, 'Remove stack')),
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
    h('p', { class: 'map-rests' }, b.rests, b.flags.length ? ` · ${b.flags.join(' · ')}` : null),
    h('div', { class: 'map-boxitem-meta' }, categoryChips(b.categories), h('span', {}, b.size),
      b.family ? h('button', {
        type: 'button', class: 'btn map-family-chip', 'aria-label': `Show the ${b.family} family on the map`,
        onclick: () => showFamily(b.family),
      }, `${b.family} family`) : null),
    h('div', { class: 'map-boxitem-moves' },
      h('button', {
        type: 'button', class: 'btn', 'aria-label': `Pick up ${b.title}`,
        onclick: () => openPickUp(b.gameId),
      }, 'Pick up')));
}
