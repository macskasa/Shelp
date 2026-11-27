// Part C – Catalog list with filters (A6), search and "Where's my game?" (C4, next PR). Owner: Peter.
import { mountCatalog } from './view.js';

let view = null;

export const screens = [
  {
    id: 'catalog',
    title: 'Games',
    order: 20,
    mount(el, params) {
      view = mountCatalog(el, params);
      return () => {
        view?.destroy();
        view = null;
      };
    },
    update(params) {
      view?.setParams(params);
    },
  },
];
