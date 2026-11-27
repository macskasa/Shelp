// Screen navigation: a bottom tab bar on phones, the top bar on desktop (see shell.css). Owner: Peter (Part C).
import { h, clear, loadCss } from '../core/dom.js';
import { on } from '../core/bus.js';
import { go, currentRoute } from './router.js';
import { sortScreens } from './routes.js';
import { icon } from './icons.js';

loadCss(new URL('./shell.css', import.meta.url));

let unsubscribe = null;

export function renderNav(el, screens) {
  unsubscribe?.();
  clear(el);
  const tabs = new Map();
  for (const s of sortScreens(screens)) {
    const tab = h('a', { class: 'nav-btn shell-tab', href: `#/${s.id}`, onclick: (e) => onTabClick(e, s.id) },
      icon(s.id),
      h('span', { class: 'shell-tab-label' }, s.title));
    tabs.set(s.id, tab);
    el.append(tab);
  }
  const mark = ({ id }) => {
    for (const [sid, tab] of tabs) {
      if (sid === id) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  };
  unsubscribe = on('route:changed', mark);
  mark(currentRoute());
}

function onTabClick(e, id) {
  // Let the browser handle "open in new tab" style clicks.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const here = currentRoute();
  // Tapping the tab you are on does nothing, unless the screen has params (a filter, a highlighted
  // game): then it goes back to the plain screen, which is a handy "reset".
  if (here.id === id && Object.keys(here.params).length === 0) return;
  go(id);
}
