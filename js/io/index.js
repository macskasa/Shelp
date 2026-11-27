// Part A – Data in and out: BGG CSV import, backup, restore, plan import. Owner: Stephen. Stories A1, E2.
import { h, loadCss } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { bggSection } from './bgg-view.js';

export const screens = [
  {
    id: 'data',
    title: 'Data',
    order: 40,
    mount(el) {
      loadCss(new URL('./io.css', import.meta.url));
      const counts = h('p', { class: 'muted' });
      const showCounts = () => {
        const p = store.getPlan();
        counts.textContent = `${store.getGames().length} games · plan “${p.name}” · ${p.stacks.length} stacks · ${p.cupboard.length} in the cupboard`;
      };
      showCounts();
      el.append(h('div', { class: 'io-screen' }, counts, bggSection()));
      return on('store:changed', showCounts);
    },
  },
];
