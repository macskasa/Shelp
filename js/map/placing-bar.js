// The placing bar under the drawing in placing mode (part-b3 item 3). Owner: Bruce (Part B).
// "Placing Ark Nova · 30 × 30 × 7 cm · tap a stack or an empty spot", up to three suggestions and Cancel. It takes
// the caption's room (the caption is hidden while placing), so the frame doesn't get shorter:
// one line from 600 px up, with the suggestions scrolling sideways; two lines on a phone.
import { h } from '../core/dom.js';
import { formatDims } from '../core/format.js';
import { chipText } from './placing.js';

/**
 * @param onCancel()        Cancel pressed
 * @param onSuggest(spot)   a suggestion pressed
 * @returns {{ el, show(game, suggestions), hide() }}
 */
export function placingBar({ onCancel, onSuggest }) {
  const text = h('p', { class: 'map-placing-text' });
  const list = h('div', { class: 'map-placing-sugg', role: 'group', 'aria-label': 'Suggested spots' });
  const cancel = h('button', { type: 'button', class: 'btn map-placing-cancel', onclick: () => onCancel() }, 'Cancel');
  const el = h('div', { class: 'map-placing', role: 'region', 'aria-label': 'Placing mode', hidden: true }, text, cancel, list);
  return {
    el,
    show(game, suggestions) {
      text.replaceChildren('Placing ', h('strong', {}, game.title), h('span', { class: 'muted' }, ` · ${formatDims(game.dims)}`), ' · tap a stack or an empty spot');
      list.replaceChildren(...(suggestions.length ? [h('span', { class: 'map-placing-label muted' }, 'Suggested')] : []),
        ...suggestions.map((spot) => h('button', {
          type: 'button', class: 'btn map-chip map-placing-chip', title: spot.text, 'aria-label': `Suggested: ${spot.text}`,
          onclick: () => onSuggest(spot),
        }, chipText(spot))));
      list.hidden = !suggestions.length;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
  };
}
