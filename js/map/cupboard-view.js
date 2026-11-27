// The Cupboard screen (stories C6, B2.3). Owner: Bruce (Part B).
// Lists the games in the cupboard (with the reason) and the games on the board (store.getBoard(),
// in board order). "Put on a stack…" opens the picker (put-panel.js). A game without a box size can
// never be on a shelf, so it gets "measure it first" instead.
import { h, loadCss } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame } from '../core/contracts.js';
import { formatDims } from '../core/format.js';
import { offShelf } from './cupboard.js';
import { openPutPanel } from './put-panel.js';
import { categoryChips } from './ui.js';

loadCss(new URL('./map.css', import.meta.url));

/** Mount the cupboard screen into el. Returns a cleanup function. */
export function mountCupboard(el) {
  const root = h('section', { class: 'map-cup', 'aria-label': 'Cupboard and board' });
  el.append(root);

  function render() {
    const { cupboard, board } = offShelf(store.getGames(), store.locate2, store.getBoard(), store.getGame);
    root.replaceChildren(h('div', {},
      h('h2', {}, 'In the cupboard ', h('span', { class: 'muted' }, `(${cupboard.length})`)),
      cupboard.length
        ? h('ul', { class: 'map-cuplist' }, cupboard.map(({ game, reason }) => row(game, reason)))
        : h('p', { class: 'muted' }, 'The cupboard is empty.'),
      h('h2', {}, 'On the board ', h('span', { class: 'muted' }, `(${board.length})`)),
      h('p', { class: 'muted map-cup-hint' }, 'Games waiting for a place: moved off a shelf, or new from a BGG import.'),
      board.length
        ? h('ul', { class: 'map-cuplist' }, board.map(({ game }) => row(game, null)))
        : h('p', { class: 'muted' }, 'The board is empty.'),
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
