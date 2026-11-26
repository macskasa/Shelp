// Top navigation. Starter version by Tony; owner from kickoff: Peter (Part C).
import { h, clear } from '../core/dom.js';
import { on } from '../core/bus.js';
import { go, currentRoute } from './router.js';

export function renderNav(el, screens) {
  clear(el);
  const buttons = new Map();
  for (const s of [...screens].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))) {
    const b = h('button', { class: 'nav-btn', type: 'button', onclick: () => go(s.id) }, s.title);
    buttons.set(s.id, b);
    el.append(b);
  }
  const mark = ({ id }) => {
    for (const [sid, b] of buttons) b.toggleAttribute('aria-current', sid === id);
  };
  on('route:changed', mark);
  mark(currentRoute());
}
