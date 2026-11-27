// Small UI pieces shared by the map's panels and the cupboard screen. Owner: Bruce (Part B).
import { h } from '../core/dom.js';
import { category } from '../core/categories.js';

/** Category chips for a game's categories (none for "Other"). */
export function categoryChips(categories) {
  return categories.map((id) => {
    const c = category(id);
    return h('span', { class: 'chip', style: `background: var(${c.cssVar})` }, c.label);
  });
}

/** A list of rule warnings; existing problems (isNew === false) are marked "already". */
export function warningList(warnings) {
  return h('ul', { class: 'map-warnings' }, warnings.map((w) => h('li', {},
    h('span', { class: 'map-warn-icon', 'aria-hidden': 'true' }, '⚠'),
    h('span', {}, w.message, w.isNew === false ? h('span', { class: 'map-already' }, ' (already)') : null))));
}
