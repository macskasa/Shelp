// The Front row / Back row switch above the drawing (issue #47). Owner: Bruce (Part B).
// A two-button toggle; view.js owns the state and redraws. Placing mode reuses it.
import { h } from '../core/dom.js';

const LABELS = { front: 'Front row', back: 'Back row' };

/**
 * @param onPick(view)  called when a button is pressed ('front' | 'back')
 * @returns {{ el, set(view, deepIds) }}  set() marks the current view and names the 2-deep stacks
 */
export function rowSwitch(onPick) {
  const buttons = Object.entries(LABELS).map(([view, label]) =>
    h('button', { type: 'button', class: 'btn map-row-btn', 'data-view': view, 'aria-pressed': 'false', onclick: () => onPick(view) }, label));
  const group = h('div', { class: 'map-rows', role: 'group', 'aria-label': 'Which row of the 2-deep stacks to show' }, buttons);
  const note = h('p', { class: 'map-rows-note' });
  const el = h('div', { class: 'map-bar' }, group, note);
  return {
    el,
    set(view, deepIds) {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.view === view));
      const list = deepIds.join(', ');
      note.textContent = !deepIds.length ? 'No stack is 2 deep.'
        : view === 'back' ? `Back row of ${list}; the front row is outlined.` : `2 deep: ${list}`;
      el.hidden = false;
    },
  };
}
