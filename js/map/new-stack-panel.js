// "New stack here", the spot sheet for empty shelf space in placing mode (part-b3 item 5).
// Owner: Bruce (Part B). Shows where the new stack goes, which way up the game lies, the stack as
// it would be and the new problems. Place writes one batch(createStack + placeBox) = one undo step.
// part-b5: Which way up lists only the ways without a block at the fitted x; none: why, no Place.
// part-b7: when the tapped gap runs to the wall end of a wall shelf, the stack goes against the wall end
// (its box ends at 208), unless that adds a rule problem the tapped spot doesn't have (free-layer.js).
import { h, showPanel, closePanels, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { ZONES } from '../core/shelves.js';
import { formatDims } from '../core/format.js';
import { layoutStack2 } from '../core/geometry.js';
import { orientationChoices } from './spots.js';
import { newStackFn, checkMove } from './stacks.js';
import { warningList } from './ui.js';
import { newStackWays } from './working.js';
import { stackPicture } from './stack-preview.js';
import { newStackAt } from './free-layer.js';

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
  const n = ++uniq;
  const upSel = h('select', { name: 'up', 'aria-labelledby': `map-new-up-${n}` });
  const upText = h('span', { class: 'map-way-text', hidden: true });
  const nothing = h('p', { class: 'map-put-error map-nothing', hidden: true });
  const upField = h('div', { class: 'map-field' }, h('span', { id: `map-new-up-${n}` }, 'Which way up'), upSel, upText);
  const preview = h('div', { class: 'map-preview', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Place');
  const where = h('p', { class: 'map-new-where' });

  const titleId = `map-new-title-${n}`;
  const dlg = h('dialog', { class: 'panel map-put map-new', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); place(); } },
      h('h2', { id: titleId }, 'New stack here'),
      h('p', {}, h('strong', {}, game.title), h('span', { class: 'muted' }, ` · ${formatDims(game.dims)}`)),
      where,
      upField,
      nothing,
      preview,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        submit)));

  let way = start;
  let checks = [];
  const orient = () => orients[way] ?? orients[0];
  const placed = new Map(); // way up → x: the wall end needs two previews, so once per way
  const atFor = (o) => {
    if (!placed.has(o)) placed.set(o, newStackAt(store, gameId, zone, x, o));
    return placed.get(o);
  };
  const at = () => atFor(orient());
  const fn = () => newStackFn(store, gameId, zone, at(), orient());

  /** Each way up at its own fitted x (fitNewStack); only those without a block are offered. */
  function fillWays(prefer = way) {
    const r = newStackWays(orients, (o) => checkMove(store, newStackFn(store, gameId, zone, atFor(o), o), 'Place'), { prefer });
    checks = r.checks;
    const text = (i) => `${orients[i].label} – ${orients[i].size}`;
    upSel.replaceChildren(...r.list.map((i) => h('option', { value: String(i) }, text(i))));
    const none = !r.list.length;
    nothing.hidden = !none;
    nothing.textContent = none ? `Nothing fits here: ${r.reason}` : '';
    upField.hidden = none;
    upSel.hidden = r.list.length < 2;
    upText.hidden = r.list.length !== 1;
    submit.hidden = none;
    if (none) {
      way = start;
      where.textContent = `${ZONES[zone].label} · at ${num(at())} cm`;
      preview.replaceChildren();
      submit.disabled = true;
      return;
    }
    way = r.chosen;
    upSel.value = String(way);
    upText.textContent = text(way);
    update(checks[way]);
  }

  function update(c = checkMove(store, fn(), 'Place')) {
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
    if (submit.disabled || submit.hidden) return;
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

  upSel.addEventListener('change', () => { way = Number(upSel.value); update(); });
  if (onClose) dlg.addEventListener('close', () => onClose(), { once: true });
  showPanel(dlg);
  fillWays(start);
  return dlg;
}
