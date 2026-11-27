// The only ways parts call each other. Owner: Tony (lead).
//
//   openGame(id)      open the game details panel        – implemented by Part A (Stephen) via provide()
//   showOnMap(id)     go to the map and highlight a game – route #/map?game=<id>, handled by Part B (Bruce)
//   showStack(id)     go to the map and select a stack   – route #/map?stack=<id>, handled by Part B (Bruce)
//   pickUp(id)        go to the map in placing mode      – route #/map?pick=<id>, handled by Part B (Bruce)
//   showFamily(name)  go to the map and highlight a family – route #/map?family=<name>, handled by Part B (Bruce)
//   go(screen, params) navigate to any screen            – router, owned by Part C (Peter)
import { go } from '../shell/router.js';
import { getGame, locate2 } from './store.js';
import { describeLocation2, formatDims, formatRange } from './format.js';
import { category } from './categories.js';
import { h, showPanel } from './dom.js';

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

/** Start moving a game: the Shelves screen in placing mode (Phase C). */
export function pickUp(gameId) {
  go('map', { pick: gameId });
}

/** Show a game family on the map (B2): every member is highlighted. `name` as in store.getFamilies(). */
export function showFamily(name) {
  go('map', { family: name });
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
      h('dt', {}, 'Where'), h('dd', {}, describeLocation2(locate2(id), title)),
    ),
    h('div', { class: 'panel-actions' },
      h('button', { class: 'btn', onclick: () => showOnMap(id) }, 'Show on map'),
      h('form', { method: 'dialog' }, h('button', { class: 'btn' }, 'Close'))),
  );
  showPanel(dlg);
}
