// Map legend (story C2). Owner: Bruce (Part B).
import { h } from '../core/dom.js';
import { CATEGORIES, OTHER } from '../core/categories.js';

const swatch = (cls, style, text) => h('span', { class: `map-sw ${cls}`, style, 'aria-hidden': 'true' }, text);

export function legend() {
  const item = (sw, label) => h('li', {}, sw, h('span', {}, label));
  const [first, second] = CATEGORIES;
  return h('ul', { class: 'map-legend', 'aria-label': 'Legend' },
    [...CATEGORIES, OTHER].map((c) => item(swatch('map-sw-cat', `--c: var(${c.cssVar})`), c.label)),
    item(swatch('map-sw-striped', `--c1: var(${first.cssVar}); --c2: var(${second.cssVar})`), 'Striped = several'),
    item(swatch('map-sw-easy'), 'Easy to reach'),
    item(swatch('map-sw-bracket'), 'Bracket'),
    item(swatch('map-sw-missing', null, '?'), 'Size missing'),
    item(swatch('map-sw-text', null, '×2'), '2 deep (front row drawn)'),
  );
}
