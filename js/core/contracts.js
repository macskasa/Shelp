// The only ways parts call each other. Owner: Tony (lead).
//
//   openGame(id)      open the game details panel        – implemented by Part A (Stephen) via provide()
//   showOnMap(id)     go to the map and highlight a game – route #/map?game=<id>, handled by Part B (Bruce)
//   showStack(id)     go to the map and select a stack   – route #/map?stack=<id>, handled by Part B (Bruce)
//   go(screen, params) navigate to any screen            – router, owned by Part C (Peter)
import { go } from '../shell/router.js';
import { getGame, locate } from './store.js';
import { describeLocation, formatDims, formatRange } from './format.js';
import { category } from './categories.js';
import { h } from './dom.js';

export { go };

const impl = { openGame: fallbackOpenGame };

/** A part registers its implementation once, in its init(): provide('openGame', fn) */
export function provide(name, fn) {
  if (!(name in impl)) throw new Error(`Unknown contract "${name}"`);
  impl[name] = fn;
}

export function openGame(id) {
  return impl.openGame(id);
}

export function showOnMap(gameId) {
  go('map', { game: gameId });
}

export function showStack(stackId) {
  go('map', { stack: stackId });
}

// Minimal read-only panel used until Part A ships the real one.
function fallbackOpenGame(id) {
  const g = getGame(id);
  if (!g) return;
  const title = (gid) => getGame(gid)?.title ?? gid;
  const dlg = h('dialog', { class: 'panel' },
    h('h2', {}, g.title),
    h('dl', {},
      h('dt', {}, 'Box'), h('dd', {}, formatDims(g.dims)),
      h('dt', {}, 'Players'), h('dd', {}, formatRange(g.players) || '–'),
      h('dt', {}, 'Play time'), h('dd', {}, formatRange(g.time, 'min') || '–'),
      h('dt', {}, 'Categories'), h('dd', {}, g.categories.map((c) => category(c).label).join(', ') || '–'),
      h('dt', {}, 'Where'), h('dd', {}, describeLocation(locate(id), title)),
    ),
    h('form', { method: 'dialog' }, h('button', { class: 'btn' }, 'Close')),
  );
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
