// One row of the catalog list. Owner: Peter (Part C). Story A6.
// On a phone a row is: title (+ BGG name) and location on top, chips, players and time below.
// From 1024 px the same elements line up as table columns (catalog.css).
import { h } from '../core/dom.js';
import { CATEGORY_IDS, category } from '../core/categories.js';
import { formatRange } from '../core/format.js';

const NONE = '–';

export function categoryChip(id) {
  const c = category(id);
  return h('span', { class: 'cat-chip', style: `--chip: var(${c.cssVar})` }, c.label);
}

/** entry = { game, where } from filter.js; onOpen(gameId) is called when the row is tapped. */
export function buildRow(entry, onOpen) {
  const g = entry.game;
  const players = formatRange(g.players);
  const time = formatRange(g.time);
  const bggName = g.bggName && g.bggName !== g.title ? g.bggName : null;
  const chips = CATEGORY_IDS.filter((id) => g.categories?.includes(id)).map(categoryChip);
  return h('li', { class: 'cat-item' },
    h('button', { class: 'cat-row', type: 'button', onclick: () => onOpen(g.id) },
      h('span', { class: 'cat-title' },
        h('span', { class: 'cat-name' }, g.title,
          g.pizza === true && h('span', { class: 'cat-pizza', role: 'img', 'aria-label': 'pizza', title: 'Pizza game' }, '🍕')),
        bggName && h('span', { class: 'cat-bgg' }, bggName)),
      h('span', { class: 'cat-where' }, entry.where),
      h('span', { class: 'cat-meta' },
        h('span', { class: 'cat-family', title: g.family ? `Family: ${g.family}` : null }, g.family ?? ''),
        h('span', { class: 'cat-chips' }, chips),
        h('span', { class: 'cat-players' }, players ? [players, h('span', { class: 'cat-unit' }, ' players')] : NONE),
        h('span', { class: 'cat-time' }, time ? [time, h('span', { class: 'cat-unit' }, ' min')] : NONE))));
}
