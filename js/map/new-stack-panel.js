// "New stack here", the spot sheet for empty shelf space in placing mode (part-b3 item 5).
// Owner: Bruce (Part B). Shows where the new stack goes, which way up the game lies, the stack as
// it would be and the new problems. Place writes one batch(createStack + placeBox) = one undo step.
import { h, showPanel, closePanels, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { ZONES } from '../core/shelves.js';
import { formatDims } from '../core/format.js';
import { layoutStack2 } from '../core/geometry.js';
import { orientationChoices } from './spots.js';
import { newStackFn, checkMove, fitNewStack } from './stacks.js';
import { warningList } from './ui.js';
import { stackPicture } from './stack-preview.js';

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
let uniq = 0;

/**
 * Open the sheet for a game and a spot { zone, x } (x already rounded / snapped). Per way up, the
 * stack slides left within its gap when the box would run into the next stack (fitNewStack).
 * up / rot: the way up to preselect (a suggestion). onPlaced(stackId) runs once the panels are
 * closed, before the toast; onClose once the panel is gone. Returns the dialog, or null.
 */
export function openNewStackPanel(gameId, { zone, x, up = 's', rot = false, onPlaced = null, onClose } = {}) {
  const game = store.getGame(gameId);
  if (!game?.dims || !ZONES[zone]) return null;
  const orients = orientationChoices(game);
  const start = Math.max(0, orients.findIndex((o) => o.up === up && o.rot === !!rot));
  const upSel = h('select', { name: 'up' }, orients.map((o, i) => h('option', { value: String(i), selected: i === start }, `${o.label} – ${o.size}`)));
  const preview = h('div', { class: 'map-preview', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Place');
  const where = h('p', { class: 'map-new-where' });

  const titleId = `map-new-title-${++uniq}`;
  const dlg = h('dialog', { class: 'panel map-put map-new', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); place(); } },
      h('h2', { id: titleId }, 'New stack here'),
      h('p', {}, h('strong', {}, game.title), h('span', { class: 'muted' }, ` · ${formatDims(game.dims)}`)),
      where,
      h('label', { class: 'map-field' }, h('span', {}, 'Which way up'), upSel),
      preview,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        submit)));

  const orient = () => orients[Number(upSel.value)] ?? orients[0];
  const at = () => fitNewStack(store.getPlan2(), store.getGame, zone, x, orient().w);
  const fn = () => newStackFn(store, gameId, zone, at(), orient());

  function update() {
    const c = checkMove(store, fn(), 'Place');
    const parts = [];
    where.textContent = `${ZONES[zone].label} · at ${num(at())} cm${c.result ? ` · becomes stack ${c.result}` : ''}`;
    if (c.error) parts.push(h('p', { class: 'map-put-error' }, c.error.message));
    else {
      const st = c.plan.stacks.find((s) => s.id === c.result);
      parts.push(stackPicture(st, store.getGame, { gameId }));
      parts.push(h('p', {}, `Stack ${c.result} would be ${num(layoutStack2(st, store.getGame).h)} cm high.`));
      if (c.block.length) parts.push(h('p', { class: 'map-put-error' }, 'Not allowed here:'));
      if (c.block.length || c.warn.length) parts.push(warningList([...c.block, ...c.warn]));
      else parts.push(h('p', { class: 'map-ok' }, '✓ No new problems.'));
    }
    preview.replaceChildren(h('div', {}, parts));
    submit.disabled = c.button.disabled;
    submit.textContent = c.button.label;
  }

  function place() {
    if (submit.disabled) return;
    try {
      const id = fn()();
      closePanels(() => {
        onPlaced?.(id);
        toast(`${game.title} → new stack ${id}`, { action: { label: 'Undo', run: () => store.undo() } });
      });
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  upSel.addEventListener('change', update);
  if (onClose) dlg.addEventListener('close', () => onClose(), { once: true });
  showPanel(dlg);
  update();
  return dlg;
}
