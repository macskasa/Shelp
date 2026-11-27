// "Put on a stack…" on schema 2 (Phase B item 3). Owner: Bruce (Part B).
// Choose a stack, a spot on it (on the shelf, on top of, across two, under) and which way up.
// Every change is tried with store.preview() and checked with Stephen's checkPlan2; only new
// problems count. A blocking problem (or a store refusal) disables the button; warnings make it
// "… anyway". After placing: the panel closes and a toast offers Undo.
// Phase C reuses this as the spot sheet (openPutPanel(gameId, { stackId })); until placing mode
// exists, #/map?pick=<id> opens it too (view.js).
import { h, showPanel, closePanels, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { formatDims } from '../core/format.js';
import { layoutStack2 } from '../core/geometry.js';
import { stackChoices } from './cupboard.js';
import { spotChoices, orientationChoices, moveFn, newProblems, defaultSpot } from './spots.js';
import { warningList } from './ui.js';

const KIND = { shelf: 'On the shelf', on: 'On top of a box', across: 'Across two boxes', under: 'Under' };
const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
let uniq = 0;

/** Open the picker for a game. stackId: preselect that stack. onClose runs once it is gone. */
export function openPutPanel(gameId, { stackId = '', onClose } = {}) {
  const game = store.getGame(gameId);
  if (!game) return null;
  // spots are worked out on the plan without this game (it may already be on a stack)
  const base = store.locate2(gameId)?.kind === 'stack' ? store.preview(() => store.moveToBoard(gameId)).plan : store.getPlan2();
  const field = (label, control, extra = {}) => h('label', { class: 'map-field', ...extra }, h('span', {}, label), control);

  const stackSel = h('select', { name: 'stack' },
    h('option', { value: '', disabled: true, selected: !stackId }, 'Choose a stack…'),
    stackChoices(base, store.getGame).map((g) => h('optgroup', { label: g.label },
      g.stacks.map((s) => h('option', { value: s.id, selected: s.id === stackId },
        `${s.id} – ${num(s.height)} of ${num(s.limit)} cm${s.topper ? ` · with the ${s.topper}` : ''}${s.rows > 1 ? ' · 2 deep' : ''}`)))));
  const rowSel = h('select', { name: 'row' }, h('option', { value: '0' }, 'Front row'), h('option', { value: '1' }, 'Back row'));
  const rowField = field('Row', rowSel, { hidden: true });
  const spotSel = h('select', { name: 'spot' });
  const spotField = field('Where', spotSel, { hidden: true });
  const orients = orientationChoices(game);
  const upSel = h('select', { name: 'up' }, orients.map((o, i) => h('option', { value: String(i) }, `${o.label} – ${o.size}`)));
  const upField = field('Which way up', upSel, { hidden: true });
  const preview = h('div', { class: 'map-preview', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Put it there');

  const titleId = `map-put-title-${++uniq}`;
  const dlg = h('dialog', { class: 'panel map-put', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); place(); } },
      h('h2', { id: titleId }, 'Put on a stack'),
      h('p', {}, h('strong', {}, game.title), h('span', { class: 'muted' }, ` · ${formatDims(game.dims)}`)),
      field('Stack', stackSel), rowField, spotField, upField, preview,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        submit)));

  let spots = [];
  const baseStack = () => base.stacks.find((s) => s.id === stackSel.value);
  const current = () => ({ spot: spots[Number(spotSel.value)], orient: orients[Number(upSel.value)] ?? orients[0] });

  function onStack() {
    const st = baseStack();
    if (!st) return;
    rowField.hidden = layoutStack2(st, store.getGame).rows < 2;
    if (rowField.hidden) rowSel.value = '0';
    fillSpots();
  }

  function fillSpots() {
    spots = spotChoices(baseStack(), store.getGame, { row: Number(rowSel.value) });
    const groups = Object.entries(KIND).map(([kind, label]) => {
      const list = spots.map((s, i) => [s, i]).filter(([s]) => s.kind === kind);
      return list.length ? h('optgroup', { label }, list.map(([s, i]) => h('option', { value: String(i) }, s.label))) : null;
    }).filter(Boolean);
    spotSel.replaceChildren(...groups);
    spotSel.value = String(defaultSpot(spots));
    spotField.hidden = false;
    upField.hidden = false;
    update();
  }

  /** The move as a function for store.preview and the real write. */
  const move = () => {
    const { spot, orient } = current();
    return spot ? moveFn(store, gameId, spot, orient) : null;
  };

  function update() {
    const fn = move();
    if (!fn) return;
    const stackId = stackSel.value;
    const p = store.preview(fn);
    const parts = [];
    let blocked = false;
    let warned = false;
    if (p.error) {
      blocked = true;
      parts.push(h('p', { class: 'map-put-error' }, p.error.message));
    } else {
      const st = p.plan.stacks.find((s) => s.id === stackId);
      parts.push(h('p', {}, `Stack ${stackId} would be ${num(layoutStack2(st, store.getGame).h)} cm high.`));
      const { block, warn } = newProblems(store.getPlan2(), p.plan, store.getGame);
      blocked = block.length > 0;
      warned = warn.length > 0;
      if (blocked) parts.push(h('p', { class: 'map-put-error' }, 'Not allowed here:'));
      if (block.length || warn.length) parts.push(warningList([...block, ...warn]));
      else parts.push(h('p', { class: 'map-ok' }, '✓ No new problems.'));
    }
    preview.replaceChildren(h('div', {}, parts));
    submit.disabled = blocked;
    submit.textContent = blocked ? 'Not allowed' : warned ? `Put it on ${stackId} anyway` : `Put it on ${stackId}`;
  }

  function place() {
    const fn = move();
    if (!fn || submit.disabled) return;
    const stackId = stackSel.value;
    try {
      fn();
      closePanels(() => toast(`${game.title} → stack ${stackId}`, { action: { label: 'Undo', run: () => store.undo() } }));
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  stackSel.addEventListener('change', onStack);
  rowSel.addEventListener('change', fillSpots);
  spotSel.addEventListener('change', update);
  upSel.addEventListener('change', update);
  if (onClose) dlg.addEventListener('close', () => onClose(), { once: true });
  showPanel(dlg);
  if (stackId) onStack();
  return dlg;
}
