// The Free space screen: one card per shelf unit with the floor left, the room above and a to-scale bar.
import { h, clear, loadCss } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { showStack } from '../core/contracts.js';
import { freeSpace } from '../core/space.js';
import { barModel, cardTitle, floorText, groupUnits, roomText, summaryText } from './logic.js';

loadCss(new URL('./space.css', import.meta.url));

const pct = (f) => `${(f * 100).toFixed(3)}%`;

function bar(unit) {
  const m = barModel(unit);
  const el = h('div', { class: 'space-bar', role: 'group', 'aria-label': `${unit.label}, to scale` });
  el.append(h('div', { class: 'space-bar-floor', style: `width:${pct(m.shelf)}` }));
  if (m.shelf < 1) el.append(h('div', { class: 'space-bar-overhang', style: `left:${pct(m.shelf)}` }));
  for (const g of m.gaps) {
    el.append(h('div', { class: 'space-bar-gap', style: `left:${pct(g.left)};width:${pct(g.width)}`, 'aria-hidden': 'true' }));
  }
  for (const s of m.stacks) {
    el.append(h('button', {
      type: 'button', class: 'space-stack', style: `left:${pct(s.left)};width:${pct(s.width)}`,
      'aria-label': `Show stack ${s.id} on the map`, title: s.id, onclick: () => showStack(s.id),
    }, h('span', { class: 'space-stack-fill', style: `height:${pct(s.fill)}` })));
  }
  return el;
}

function card(unit) {
  const floor = floorText(unit);
  const room = roomText(unit);
  return h('article', { class: 'space-card' },
    h('h3', { class: 'space-card-title' }, cardTitle(unit), h('span', { class: 'space-card-len' }, `${unit.length} cm`)),
    h('p', { class: 'space-floor' },
      h('strong', { class: floor.main === 'Full' ? 'space-full' : '' }, floor.main),
      floor.extra ? h('span', { class: 'space-extra' }, ` · ${floor.extra}`) : null),
    h('p', { class: 'space-room' }, room || ' '),
    bar(unit));
}

/** Mount the screen into el. Returns the unmount function. */
export function mountSpace(el) {
  const summary = h('p', { class: 'space-summary', role: 'status' });
  const body = h('div', { class: 'space-groups' });
  el.append(h('div', { class: 'space' }, h('h2', { class: 'space-title' }, 'Free space'), summary, body));

  function render() {
    const units = freeSpace(store.getPlan2(), store.getGame);
    summary.textContent = summaryText(units);
    clear(body);
    for (const g of groupUnits(units)) {
      body.append(h('section', { class: `space-group${g.wall ? ' space-wall' : ''}` },
        h('h3', { class: 'space-group-title' }, g.title),
        h('div', { class: 'space-cards' }, g.units.map(card))));
    }
  }
  render();
  const off = on('store:changed', render);
  return () => {
    off();
    clear(el);
  };
}
