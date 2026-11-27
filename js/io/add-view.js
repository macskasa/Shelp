// The "Add a game" card of the Data screen (story A4). Owner: Stephen (Part A).
import { h } from '../core/dom.js';
import { openAddGame } from '../game/add.js';

export function addGameSection() {
  return h('section', { class: 'card io-section' },
    h('h2', {}, 'Add a game'),
    h('p', { class: 'muted' }, 'For a game that is not in your BoardGameGeek list, like Fantasy Fluxx. It starts without a place on the shelves.'),
    h('div', { class: 'io-buttons io-start' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: openAddGame }, 'Add a game…')));
}
