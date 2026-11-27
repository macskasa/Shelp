// "Put on a stack…" on schema 2 (Phase B item 3). Owner: Bruce (Part B).
// Choose a stack, a spot on it (on the shelf, on top of, across two, under) and which way up.
// Every change is tried with store.preview() and checked with Stephen's checkPlan2; only new
// problems count. A blocking problem (or a store refusal) disables the button; warnings make it
// "… anyway". After placing: the panel closes and a toast offers Undo.
// Phase C: placing mode (view.js) opens it as the spot sheet, with the tapped stack chosen or a
// suggestion preset, and draws the stack as it would be (stack-preview.js).
// part-b5: Stephen's checkSpots checks every spot × way up of the stack at once; the sheet lists only
// the spots that work, best first and preselected, and only the ways up without a block. The rest
// hide behind "Show N blocked spots", greyed out with a reason. The final check stays store.preview.
import { h, showPanel, closePanels, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { formatDims } from '../core/format.js';
import { layoutStack2 } from '../core/geometry.js';
import { stackChoices } from './cupboard.js';
import { checkSpots } from '../rules/index.js';
import { spotChoices, orientationChoices, moveFn, newProblems } from './spots.js';
import { sortSpots, workingWays, blockedLinkText, nothingFitsText } from './working.js';
import { warningList } from './ui.js';
import { presetFor } from './placing.js';
import { stackPicture } from './stack-preview.js';

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
let uniq = 0;

/**
 * Open the picker for a game. stackId: preselect that stack. preset: { target, label }, a
 * suggestion (suggestSpots) to preselect: its stack, row, spot and way up. onPlaced(stackId) runs
 * after the move, once the panels are closed and before the toast; onClose once the panel is gone.
 */
export function openPutPanel(gameId, { stackId = '', preset = null, onPlaced = null, onClose } = {}) {
  if (preset) stackId = preset.target.stackId;
  const game = store.getGame(gameId);
  if (!game) return null;
  // spots are worked out on the plan without this game (it may already be on a stack); checkSpots
  // detaches it the same way, so its runs come from this same base
  const baseOf = () => (store.locate2(gameId)?.kind === 'stack' ? store.preview(() => store.moveToBoard(gameId)).plan : store.getPlan2());
  let base = baseOf();
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
  const nothing = h('p', { class: 'map-put-error map-nothing', hidden: true });
  const blockedList = h('ul', { class: 'map-blocked', hidden: true });
  const blockedLink = h('button', { type: 'button', class: 'map-link', hidden: true, 'aria-expanded': 'false', onclick: () => toggleBlocked() });
  const orients = orientationChoices(game);
  const n = ++uniq;
  const upSel = h('select', { name: 'up', 'aria-labelledby': `map-put-up-${n}` });
  const upText = h('span', { class: 'map-way-text', hidden: true });
  const upField = h('div', { class: 'map-field', hidden: true }, h('span', { id: `map-put-up-${n}` }, 'Which way up'), upSel, upText);
  const preview = h('div', { class: 'map-preview', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Put it there');

  const titleId = `map-put-title-${n}`;
  const dlg = h('dialog', { class: 'panel map-put', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); place(); } },
      h('h2', { id: titleId }, 'Put on a stack'),
      h('p', {}, h('strong', {}, game.title), h('span', { class: 'muted' }, ` · ${formatDims(game.dims)}`)),
      field('Stack', stackSel), rowField, spotField, nothing, blockedLink, blockedList, upField, preview,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        submit)));

  let spots = [];
  let checks = [];
  let way = -1; // index in orients
  let pending = preset; // used once, for the first stack shown
  let done = false;
  const baseStack = () => base.stacks.find((s) => s.id === stackSel.value);
  const current = () => ({ spot: spots[Number(spotSel.value)], orient: orients[way] ?? orients[0] });

  function onStack() {
    const st = baseStack();
    if (!st) return;
    const back = pending?.target.stackId === st.id && pending.target.row === 1; // a suggestion may start a back row
    rowField.hidden = layoutStack2(st, store.getGame).rows < 2 && !back;
    rowSel.value = back ? '1' : rowField.hidden ? '0' : rowSel.value;
    fillSpots();
  }

  /** keepKey / keepWay: after a store change, stay on the same spot and way when they still work. */
  function fillSpots({ keepKey = null, keepWay = null } = {}) {
    const st = baseStack();
    if (!st) return;
    spots = spotChoices(st, store.getGame, { row: Number(rowSel.value) });
    let keep = -1;
    let prefer = -1;
    if (pending?.target.stackId === stackSel.value) {
      const p = presetFor(spots, orients, game, pending.target, pending.label);
      spots = p.spots;
      keep = p.spot;
      prefer = p.orient;
    }
    pending = null;
    // every spot × way up at once (Stephen), not one preview per choice
    checks = checkSpots(store.getPlan2(), store.getGames(), gameId, spots.map((s) => s.run));
    const view = sortSpots(spots, checks, { keep, stackId: st.id });

    spotSel.replaceChildren(...view.working.map(({ i, spot }) => h('option', { value: String(i) }, spot.label)));
    blockedList.replaceChildren(...view.blocked.map(({ spot, reason }) =>
      h('li', { 'aria-disabled': 'true' }, h('span', {}, spot.label), h('span', { class: 'map-blocked-why' }, reason))));
    blockedList.hidden = true;
    blockedLink.hidden = !view.blocked.length;
    blockedLink.setAttribute('aria-expanded', 'false');
    blockedLink.textContent = blockedLinkText(view.blocked.length) ?? '';

    const none = !view.working.length;
    nothing.hidden = !none;
    nothing.textContent = none ? nothingFitsText(st.id) : '';
    spotField.hidden = none;
    upField.hidden = none;
    submit.hidden = none;
    if (none) {
      preview.replaceChildren();
      submit.disabled = true;
      return;
    }
    const again = keepKey != null ? view.working.find((x) => x.spot.key === keepKey) : null;
    spotSel.value = String((again ?? view.working[0]).i);
    fillWays(again && keepWay != null ? keepWay : prefer);
  }

  function toggleBlocked() {
    const open = blockedList.hidden;
    blockedList.hidden = !open;
    blockedLink.setAttribute('aria-expanded', String(open));
    blockedLink.textContent = blockedLinkText(blockedList.children.length, open) ?? '';
  }

  /** The ways up for the chosen spot: only those without a block; one alone shows as text. */
  function fillWays(prefer = -1) {
    let { list, chosen } = workingWays(checks[Number(spotSel.value)], orients, { prefer, game });
    if (!list.length) { list = orients.map((_, i) => i); chosen = 0; } // no check result: let the store decide
    way = chosen;
    const text = (i) => `${orients[i].label} – ${orients[i].size}`;
    upSel.replaceChildren(...list.map((i) => h('option', { value: String(i) }, text(i))));
    upSel.value = String(chosen);
    upSel.hidden = list.length < 2;
    upText.hidden = list.length > 1;
    upText.textContent = text(chosen);
    update();
  }

  /** The move as a function for store.preview and the real write. */
  const move = () => {
    const { spot, orient } = current();
    return spot && orient ? moveFn(store, gameId, spot, orient) : null;
  };

  // the final check stays the real one, so the sheet never offers what the store refuses
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
      parts.push(stackPicture(st, store.getGame, { gameId }));
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
    if (!fn || submit.disabled || submit.hidden) return;
    const stackId = stackSel.value;
    try {
      done = true;
      fn();
      closePanels(() => {
        onPlaced?.(stackId);
        toast(`${game.title} → stack ${stackId}`, { action: { label: 'Undo', run: () => store.undo() } });
      });
    } catch (err) {
      done = false;
      toast(err.message, { error: true });
    }
  }

  stackSel.addEventListener('change', onStack);
  rowSel.addEventListener('change', () => fillSpots());
  spotSel.addEventListener('change', () => fillWays());
  upSel.addEventListener('change', () => { way = Number(upSel.value); update(); });
  // another change (Undo, another tab): check again, staying on the same spot and way if they still work
  const off = on('store:changed', () => {
    if (done || !store.getGame(gameId)) return;
    base = baseOf();
    if (!baseStack()) return;
    fillSpots({ keepKey: current().spot?.key ?? null, keepWay: way });
  });
  dlg.addEventListener('close', () => off(), { once: true });
  if (onClose) dlg.addEventListener('close', () => onClose(), { once: true });
  showPanel(dlg);
  if (stackId) onStack();
  return dlg;
}
