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

const SEVERITY = { block: { icon: '⛔', name: 'Not allowed' }, warn: { icon: '⚠', name: 'Warning' } };

/**
 * A list of rule warnings. v2 warnings carry a severity: block = red, warn = amber (the icon has
 * an accessible name, so it is not colour alone). Existing problems (isNew === false) say "already".
 */
export function warningList(warnings) {
  return h('ul', { class: 'map-warnings' }, warnings.map((w) => h('li', { class: w.severity ? `map-sev-${w.severity}` : null },
    h('span', { class: 'map-warn-icon', role: 'img', 'aria-label': SEVERITY[w.severity]?.name ?? 'Warning' }, SEVERITY[w.severity]?.icon ?? '⚠'),
    h('span', {}, w.message, w.isNew === false ? h('span', { class: 'map-already' }, ' (already)') : null))));
}
