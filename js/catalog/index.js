// Part C – Catalog, search and "Where's my game?". Owner: Peter. Stories A6, C4.
// PLACEHOLDER by Tony: a bare search list that exercises the contracts. Replace freely.
import { h, clear } from '../core/dom.js';
import * as store from '../core/store.js';
import { openGame, showOnMap } from '../core/contracts.js';
import { describeLocation } from '../core/format.js';

export const screens = [
  {
    id: 'catalog',
    title: 'Games',
    order: 20,
    mount(el) {
      const list = h('div');
      const title = (id) => store.getGame(id)?.title ?? id;
      const render = (q = '') => {
        clear(list);
        const games = store.getGames().filter((g) => g.title.toLowerCase().includes(q.toLowerCase()));
        for (const g of games.slice(0, 50)) {
          list.append(h('p', {},
            h('button', { class: 'btn', onclick: () => openGame(g.id) }, g.title), ' ',
            h('button', { class: 'btn', onclick: () => showOnMap(g.id) }, 'On map'), ' ',
            h('span', { class: 'muted' }, describeLocation(store.locate(g.id), title))));
        }
      };
      el.append(
        h('div', { class: 'card placeholder' }, h('p', { class: 'muted' }, 'Peter builds the catalog and search here (Part C).')),
        h('p', {}, h('input', { type: 'search', placeholder: 'Search…', oninput: (e) => render(e.target.value) })),
        list,
      );
      render();
    },
  },
];
