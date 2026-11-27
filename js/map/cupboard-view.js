// The Cupboard screen (story C6). Owner: Bruce (Part B).
// Lists the games in the cupboard (with the reason) and the games not placed yet, and puts one
// on a stack: choose the stack (grouped by shelf, with its current height), the row of a 2-deep
// stack and the position. The rule checker's warnings show before anything is moved.
// A game without a box size can never be on a shelf, so it gets "measure it first" instead.
import { h, loadCss, showPanel, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame } from '../core/contracts.js';
import { formatDims } from '../core/format.js';
import { offShelf, stackChoices, positionChoices, previewPlacement } from './cupboard.js';
import { categoryChips, warningList } from './ui.js';

loadCss(new URL('./map.css', import.meta.url));

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
let uniq = 0;

/** Mount the cupboard screen into el. Returns a cleanup function. */
export function mountCupboard(el) {
  const root = h('section', { class: 'map-cup', 'aria-label': 'Cupboard' });
  el.append(root);

  function render() {
    const { cupboard, unplaced } = offShelf(store.getGames(), store.locate);
    root.replaceChildren(h('div', {},
      h('h2', {}, 'In the cupboard ', h('span', { class: 'muted' }, `(${cupboard.length})`)),
      cupboard.length
        ? h('ul', { class: 'map-cuplist' }, cupboard.map(({ game, reason }) => row(game, reason)))
        : h('p', { class: 'muted' }, 'The cupboard is empty.'),
      h('h2', {}, 'Not placed yet ', h('span', { class: 'muted' }, `(${unplaced.length})`)),
      h('p', { class: 'muted map-cup-hint' }, 'Games in no stack, not in the cupboard and not inside another box – for example new ones from a BGG import.'),
      unplaced.length
        ? h('ul', { class: 'map-cuplist' }, unplaced.map(({ game }) => row(game, null)))
        : h('p', { class: 'muted' }, 'Nothing here – every game has a place.'),
    ));
  }

  render();
  return on('store:changed', render);
}

function row(game, reason) {
  const action = game.dims
    ? h('button', { type: 'button', class: 'btn map-cup-put', onclick: () => openPutPanel(game.id) }, 'Put on a stack…')
    : h('div', { class: 'map-cup-measure' },
      h('span', {}, 'Measure it first'),
      h('button', { type: 'button', class: 'btn', onclick: () => openGame(game.id), 'aria-label': `Add the box size of ${game.title}` }, 'Add size'));
  return h('li', { class: 'map-cupitem' },
    h('button', { type: 'button', class: 'map-boxitem-title', onclick: () => openGame(game.id) }, game.title),
    h('div', { class: 'map-boxitem-meta' }, categoryChips(game.categories ?? []), h('span', {}, formatDims(game.dims))),
    reason ? h('p', { class: 'map-cup-reason' }, reason) : null,
    action);
}

/** "Put on a stack…": pick stack, row and position; see the warnings; then place. */
export function openPutPanel(gameId) {
  const game = store.getGame(gameId);
  if (!game) return;
  const id = ++uniq;
  const field = (label, control, extra = {}) => h('label', { class: 'map-field', ...extra }, h('span', {}, label), control);

  const stackSel = h('select', { name: 'stack', required: true },
    h('option', { value: '', disabled: true, selected: true }, 'Choose a stack…'),
    stackChoices(store.getPlan(), store.getGame).map((g) => h('optgroup', { label: g.label },
      g.stacks.map((s) => h('option', { value: s.id },
        `${s.id} – ${num(s.height)} of ${num(s.limit)} cm${s.topper ? ` · with the ${s.topper}` : ''}${s.rows > 1 ? ' · 2 deep' : ''}${s.standing ? ' · standing' : ''}`)))));
  const rowSel = h('select', { name: 'row' }, h('option', { value: '0' }, 'Front row'), h('option', { value: '1' }, 'Back row'));
  const rowField = field('Row', rowSel, { hidden: true });
  const posSel = h('select', { name: 'position' });
  const posField = field('Position', posSel, { hidden: true });
  const preview = h('div', { class: 'map-preview', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Put it there');

  const titleId = `map-put-title-${id}`;
  const dlg = h('dialog', { class: 'panel map-put', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); place(); } },
      h('h2', { id: titleId }, 'Put on a stack'),
      h('p', {}, h('strong', {}, game.title), h('span', { class: 'muted' }, ` · ${formatDims(game.dims)}`)),
      field('Stack', stackSel), rowField, posField, preview,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        submit)));

  const chosen = () => ({ stackId: stackSel.value, row: Number(rowSel.value), index: posSel.value === '' ? undefined : Number(posSel.value) });

  function onStack() {
    const st = store.getStack(stackSel.value);
    if (!st) return;
    rowField.hidden = st.rows.length < 2;
    if (rowField.hidden) rowSel.value = '0';
    fillPositions();
  }

  function fillPositions() {
    const st = store.getStack(stackSel.value);
    const choices = positionChoices(st, Number(rowSel.value), store.getGame);
    posSel.replaceChildren(...choices.map((c) => h('option', { value: String(c.index) }, c.label)));
    posSel.value = String(choices.at(-1).index); // default: on top / at the right end
    posField.hidden = false;
    update();
  }

  function update() {
    const { stackId, row, index } = chosen();
    if (!stackId) return;
    const p = previewPlacement(store.getPlan(), store.getGame, gameId, stackId, { row, index });
    const fresh = p.warnings.filter((w) => w.isNew).length;
    preview.replaceChildren(h('div', {},
      h('p', {}, `Stack ${stackId} would be ${num(p.height)} cm high.`),
      p.warnings.length
        ? warningList(p.warnings)
        : h('p', { class: 'map-ok' }, '✓ No rule problems.')));
    submit.disabled = false;
    submit.textContent = fresh ? `Put it on ${stackId} anyway` : `Put it on ${stackId}`;
  }

  function place() {
    const { stackId, row, index } = chosen();
    if (!stackId) return;
    try {
      store.placeOnStack(gameId, stackId, { row, index });
      dlg.close();
      toast(`${game.title} is on stack ${stackId} now`);
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  stackSel.addEventListener('change', onStack);
  rowSel.addEventListener('change', fillPositions);
  posSel.addEventListener('change', update);
  showPanel(dlg);
}
