// The global tools in the header (#app-tools). Owner: Peter (Part C).
// Today that is one button: "Where's my game?", reachable from every screen.
import { h } from '../core/dom.js';
import { icon } from './icons.js';

const LABEL = 'Where’s my game?';

/** renderTools(el, { where }) – where() opens the "Where's my game?" panel. */
export function renderTools(el, { where }) {
  el.replaceChildren(
    h('button', { class: 'shell-tool', type: 'button', title: LABEL, 'aria-label': LABEL, 'aria-haspopup': 'dialog', onclick: () => where() },
      icon('search'), h('span', { class: 'shell-tool-label' }, LABEL)));
}
