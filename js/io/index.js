// Part A – Data in and out: BGG CSV import, backup, restore, plan import. Owner: Stephen. Stories A1, E2.
// PLACEHOLDER by Tony. Replace freely.
import { h } from '../core/dom.js';
import * as store from '../core/store.js';

export const screens = [
  {
    id: 'data',
    title: 'Data',
    order: 40,
    mount(el) {
      const p = store.getPlan();
      el.append(
        h('div', { class: 'card placeholder' }, h('p', { class: 'muted' }, 'Stephen builds BGG import, backup, restore and plan import here (Part A).')),
        h('p', {}, `${store.getGames().length} games · plan "${p.name}" · ${p.stacks.length} stacks · ${p.cupboard.length} in the cupboard`),
      );
    },
  },
];
