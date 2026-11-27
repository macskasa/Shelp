// Hash router. Owner: Peter (Part C).
// CONTRACT (keep these signatures): go(id, params), currentRoute(), startRouter(screens, el, opts), getScreens()
//
// A screen is: { id, title, order, mount(el, params) => cleanup?, update?(params) }
//   - mount() renders into el and may return a cleanup function (unsubscribe, timers…)
//   - update() is optional: if present it is called instead of a re-mount when only params change.
//     The scroll position is not touched then; the screen decides (a mount starts at the top, or restores on Back).
// URLs look like  #/map?game=g042  so they survive reloads and can be bookmarked.
//
// Back button: every screen change is one history step, so Back walks back through the screens you
// visited and leaves the app from the first one. An unknown or empty address is rewritten to the
// default screen *in place* (no extra step), so the first Back from the start screen leaves the app.
// Panels (core/dom.js showPanel) add their own history steps; go() closes them before a screen changes.
import { clear, closePanels } from '../core/dom.js';
import { emit } from '../core/bus.js';
import { toHash, resolveRoute, sortScreens } from './routes.js';

let screens = [];
let root = null;
let fallback = null;
let active = null; // { screen, cleanup }
let forward = false; // true while go() is navigating to a screen; false when Back/Forward (or a plain link) returned to one
const scrollOf = new Map(); // screen id -> scrollY when we left it, restored when Back returns to it

export function startRouter(list, el, { defaultScreen } = {}) {
  screens = sortScreens(list);
  root = el;
  fallback = defaultScreen ?? screens[0]?.id;
  history.scrollRestoration = 'manual'; // we put the scroll position back ourselves, after the screen has rendered
  window.removeEventListener('hashchange', render);
  window.addEventListener('hashchange', render);
  render();
}

export function getScreens() {
  return screens;
}

/** Navigate: go('map', { game: 'g042' }) */
export function go(id, params = {}) {
  const hash = toHash(id, params);
  // Close open panels first and drop their history steps (core/dom.js), then navigate.
  closePanels(() => {
    forward = true;
    if (location.hash === hash) render();
    else location.hash = hash;
  });
}

/** The screen the address bar is on right now: { id, params }. Unknown addresses give the default screen. */
export function currentRoute() {
  const { id, params } = resolveRoute(screens, location.hash, fallback);
  return { id, params };
}

function render() {
  const { screen, id, params, redirected } = resolveRoute(screens, location.hash, fallback);
  if (!screen) return;
  if (redirected) history.replaceState(history.state, '', toHash(id)); // fix the address, no new step, no hashchange
  const restore = !forward;
  forward = false;
  if (active) scrollOf.set(active.screen.id, window.scrollY);

  if (active?.screen === screen && screen.update) {
    try {
      screen.update(params);
    } catch (err) {
      console.error(`[router] screen "${id}" failed to update`, err);
    }
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
    // Only a real mount moves the scroll. update() leaves it alone, so a screen can scroll to
    // something itself (the map brings the highlighted game into view).
    window.scrollTo(0, restore ? (scrollOf.get(id) ?? 0) : 0);
  }
  document.title = `${screen.title} · Shelp`;
  emit('route:changed', { id, params });
}
