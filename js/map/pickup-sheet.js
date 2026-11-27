// The pick-up sheet (Phase C item 1). Owner: Bruce (Part B).
// Opens from stack details and the Cupboard screen (and later the board strip). It offers Move
// (pickUp → #/map?pick=<id>), Turn (only on a shelf), To the board, To the cupboard and
// Put inside a box… (the game panel, whose "Stored inside" picker does that). Before a box leaves
// a stack it says what the boxes on top do. Every move closes the panels and toasts with Undo.
import { h, showPanel, closePanels, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame, pickUp } from '../core/contracts.js';
import { describeLocation2, formatDims } from '../core/format.js';
import { pickUpActions, settleText } from './pickup.js';
import { openTurnPanel } from './turn-panel.js';

const titleOf = (id) => store.getGame(id)?.title ?? id;
const undo = { label: 'Undo', run: () => store.undo() };
let uniq = 0;

/** Open the pick-up sheet for a game. Returns the dialog, or null. */
export function openPickUp(gameId) {
  if (!store.getGame(gameId)) return null;
  const titleId = `map-pick-title-${++uniq}`;
  const heading = h('h2', { id: titleId });
  const body = h('div', { class: 'map-sheet-body' });
  const dlg = h('dialog', { class: 'panel map-sheet map-pick', 'aria-labelledby': titleId },
    h('div', { class: 'map-sheet-head' },
      heading,
      h('button', { type: 'button', class: 'btn map-sheet-close', 'aria-label': 'Close', onclick: () => dlg.close() }, '×')),
    body);

  const ACTIONS = {
    move: ['Move', 'Put it somewhere on the shelves', () => pickUp(gameId)],
    turn: ['Turn', 'Which side is up, long side out', () => openTurnPanel(gameId)],
    board: ['To the board', 'Waits there for a new place', () => moveToBoard(gameId)],
    cupboard: ['To the cupboard…', 'With a reason, if you like', () => askMoveToCupboard(gameId, titleOf(gameId))],
    inside: ['Put inside a box…', 'Choose the box in the game panel', () => openGame(gameId)],
  };

  function render() {
    const game = store.getGame(gameId);
    if (!game) {
      dlg.close(); // the game was deleted
      return;
    }
    const loc = store.locate2(gameId);
    const settle = loc?.kind === 'stack' ? settleText(store.getStack2(loc.stackId), gameId, titleOf) : null;
    heading.textContent = game.title;
    body.replaceChildren(h('div', {},
      h('p', { class: 'map-pick-where' }, describeLocation2(loc, titleOf), h('span', { class: 'muted' }, ` · ${formatDims(game.dims)}`)),
      settle ? h('p', { class: 'map-settle' }, `If it leaves: ${settle}.`) : null,
      game.dims ? null : h('p', { class: 'muted' }, 'No box size yet, so it can’t go on a shelf. Add it in the game panel.'),
      h('div', { class: 'map-pick-actions' }, pickUpActions(game, loc).map((key) => {
        const [label, hint, run] = ACTIONS[key];
        return h('button', { type: 'button', class: 'btn map-pick-btn', 'data-action': key, onclick: run },
          h('strong', {}, label), h('span', { class: 'muted' }, hint));
      }))));
  }

  const off = on('store:changed', render);
  dlg.addEventListener('close', off, { once: true });
  render();
  showPanel(dlg);
  return dlg;
}

/** Move a game to the board; the boxes above it settle down (the store does that). */
function moveToBoard(gameId) {
  try {
    store.moveToBoard(gameId);
    closePanels(() => toast(`${titleOf(gameId)} → the board`, { action: undo }));
  } catch (err) {
    toast(err.message, { error: true });
  }
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
      closePanels(() => toast(`${title} → the cupboard`, { action: undo }));
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  showPanel(dlg);
  reason.focus();
}
