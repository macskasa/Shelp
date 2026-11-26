// Part B – Shelf map. Owner: Bruce. Stories C1–C3, C5, C6.
// PLACEHOLDER by Tony: shows the plan as plain lists so the wiring can be tested. Replace freely.
import { h } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { ZONES } from '../core/shelves.js';
import { openGame } from '../core/contracts.js';

function placeholder(el, text) {
  el.append(h('div', { class: 'card placeholder' }, h('p', { class: 'muted' }, text)));
}

function renderMap(el, params) {
  placeholder(el, 'Bruce builds the to-scale shelf map here (Part B). For now: the plan as lists.');
  const hl = params.game ? store.locate(params.game) : null;
  const hlStack = hl?.kind === 'stack' ? hl.stackId : hl?.kind === 'inside' ? hl.host?.stackId : params.stack;
  for (const zone of Object.values(ZONES)) {
    const stacks = store.getPlan().stacks.filter((s) => s.zone === zone.id);
    el.append(h('h3', {}, zone.label));
    for (const st of stacks) {
      const names = st.rows.map((row) => row
        .flatMap((it) => (it.side ? it.side : [it]))
        .map((it) => h('button', { class: 'btn', onclick: () => openGame(it.game) }, store.getGame(it.game)?.title)));
      el.append(h('p', { style: st.id === hlStack ? 'outline: 3px solid var(--accent)' : '' }, h('strong', {}, `${st.id} `), names));
    }
  }
}

export const screens = [
  {
    id: 'map',
    title: 'Shelves',
    order: 10,
    mount(el, params) {
      renderMap(el, params);
      return on('store:changed', () => { el.replaceChildren(); renderMap(el, params); });
    },
  },
  {
    id: 'cupboard',
    title: 'Cupboard',
    order: 30,
    mount(el) {
      placeholder(el, 'Bruce builds the cupboard list here (story C6).');
      for (const c of store.getPlan().cupboard) {
        el.append(h('p', {}, h('strong', {}, store.getGame(c.game)?.title), ` – ${c.reason}`));
      }
    },
  },
];
