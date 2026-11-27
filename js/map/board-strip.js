// The board strip on the Shelves screen (part-b3 item 2). Owner: Bruce (Part B).
// "Board (3)" and one chip per game from store.getBoard(), in board order, with its category colours.
// It sits in the row-switch line and stays one row that scrolls sideways (on a phone in portrait it
// wraps to its own line). Hidden while the board is empty. Tapping a chip opens the pick-up sheet.
import { h } from '../core/dom.js';
import { boardChips } from './placing.js';

/**
 * @param onPick(gameId)  a chip pressed
 * @returns {{ el, set(board, getGame), mark(ids) }}  mark: the chips of a family shown on the map (part-b4)
 */
export function boardStrip(onPick) {
  const count = h('span', { class: 'map-board-label' });
  const chips = h('div', { class: 'map-board-chips' });
  const el = h('div', { class: 'map-board', role: 'group', 'aria-label': 'Games on the board', hidden: true }, count, chips);
  return {
    el,
    set(board, getGame) {
      const list = boardChips(board, getGame);
      count.textContent = `Board (${list.length})`;
      chips.replaceChildren(...list.map((c) => h('button', {
        type: 'button', class: 'btn map-chip map-board-chip', 'data-game': c.id, title: c.title,
        'aria-label': `${c.title}: pick up`, onclick: () => onPick(c.id),
      }, h('span', { class: 'map-board-sw', 'aria-hidden': 'true', style: stripes(c.colors) }), h('span', { class: 'map-board-title' }, c.title))));
      el.hidden = !list.length;
    },
    mark(ids) {
      for (const chip of chips.children) chip.classList.toggle('is-member', ids.includes(chip.dataset.game));
    },
  };
}

/** A small swatch with one stripe per category colour. */
function stripes(colors) {
  const n = colors.length;
  const stops = colors.map((c, i) => `${c} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(', ');
  return `background: linear-gradient(90deg, ${stops})`;
}
