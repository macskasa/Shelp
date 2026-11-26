// Hash router. Starter version by Tony; owner from kickoff: Peter (Part C).
// CONTRACT (keep these signatures): go(id, params), currentRoute(), startRouter(screens, el, opts), getScreens()
//
// A screen is: { id, title, order, mount(el, params) => cleanup?, update?(params) }
//   - mount() renders into el and may return a cleanup function (unsubscribe, timers…)
//   - update() is optional: if present it is called instead of a re-mount when only params change
// URLs look like  #/map?game=g042  so they survive reloads and can be bookmarked.
import { clear, closePanels } from '../core/dom.js';
import { emit } from '../core/bus.js';

let screens = [];
let root = null;
let fallback = null;
let active = null; // { screen, cleanup }

export function startRouter(list, el, { defaultScreen } = {}) {
  screens = [...list].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  root = el;
  fallback = defaultScreen ?? screens[0]?.id;
  window.addEventListener('hashchange', render);
  render();
}

export function getScreens() {
  return screens;
}

/** Navigate: go('map', { game: 'g042' }) */
export function go(id, params = {}) {
  const hash = toHash(id, params);
  // Open panels are closed first and their history entries dropped, so Back from the new screen
  // returns to the screen the panel was opened on (see core/dom.js closePanels).
  closePanels(() => {
    if (location.hash === hash) render();
    else location.hash = hash;
  });
}

export function currentRoute() {
  return parse(location.hash);
}

function toHash(id, params) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return `#/${id}${q ? `?${q}` : ''}`;
}

function parse(hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  return { id: path || fallback, params: Object.fromEntries(new URLSearchParams(query)) };
}

function render() {
  let { id, params } = parse(location.hash);
  let screen = screens.find((s) => s.id === id);
  if (!screen) {
    screen = screens.find((s) => s.id === fallback);
    id = screen?.id;
    params = {};
  }
  if (!screen) return;
  if (active?.screen === screen && screen.update) {
    screen.update(params);
  } else {
    try {
      active?.cleanup?.();
    } catch (err) {
      console.error('[router] cleanup failed', err);
    }
    clear(root);
    let cleanup = null;
    try {
      cleanup = screen.mount(root, params) ?? null;
    } catch (err) {
      console.error(`[router] screen "${id}" failed to mount`, err);
      root.textContent = `Something went wrong on this screen: ${err.message}`;
    }
    active = { screen, cleanup };
  }
  document.title = `${screen.title} · Shelp`;
  emit('route:changed', { id, params });
}
