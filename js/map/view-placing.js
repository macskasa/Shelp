// Placing mode on the Shelves screen (part-b3 items 3 and 5). Owner: Bruce (Part B).
// Holds the game being placed and its suggestions, shows the placing bar, and opens the sheets:
// a tap on a stack → the spot sheet (put-panel.js); a tap on empty shelf → "New stack here"
// (new-stack-panel.js) at the tapped x, rounded and snapped (stacks.js); a suggestion → either one,
// preset. view.js owns the route: it calls fromRoute() and does what onLeave(how) asks.
import { toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { suggestSpots } from '../rules/index.js';
import { placingFor, toDrawing, tapTarget, topSuggestions } from './placing.js';
import { placingBar } from './placing-bar.js';
import { openPutPanel } from './put-panel.js';
import { openNewStackPanel } from './new-stack-panel.js';
import { newStackX } from './stacks.js';

/**
 * @param stage, panZoom, getScene()  to turn a tap into a stack or a shelf spot
 * @param openOver(stackId, open)     view.js opens a sheet over a stack (null: a new one):
 *                                    open(onClose) → dialog | null
 * @param onLeave(how)                'placed' or 'cancel': leave placing mode
 */
export function createPlacing({ stage, panZoom, getScene, openOver, onLeave }) {
  let gameId = null;
  let suggestions = [];
  const bar = placingBar({ onCancel: () => onLeave('cancel'), onSuggest: (spot) => suggest(spot) });
  const refresh = () => {
    suggestions = topSuggestions(suggestSpots(store.getPlan2(), store.getGames(), gameId, { limit: 12 }));
  };

  function openSpot(stackId, suggestion = null) {
    if (!gameId) return;
    const id = gameId;
    const preset = suggestion ? { target: suggestion.target, label: suggestion.text } : null;
    openOver(stackId, (onClose) => openPutPanel(id, { stackId, preset, onPlaced: () => onLeave('placed'), onClose }));
  }

  function newStack(zone, x, way = {}) {
    if (!gameId || x == null) return;
    const id = gameId;
    openOver(null, (onClose) => openNewStackPanel(id, { zone, x, ...way, onPlaced: () => onLeave('placed'), onClose }));
  }

  function suggest(spot) {
    if (spot.kind === 'new-stack') newStack(spot.zone, spot.x, { up: spot.up, rot: spot.rot });
    else openSpot(spot.target.stackId, spot);
  }

  return {
    el: bar.el,
    get gameId() { return gameId; },

    /** From the route (?pick=). Returns 'error' when the route must be replaced (a toast says why). */
    fromRoute(params) {
      const p = placingFor(params, store.getGame);
      if (p?.error) toast(p.error, { error: true });
      gameId = p?.gameId ?? null;
      if (gameId) refresh();
      return p?.error ? 'error' : null;
    },

    /** On a redraw: false when placing must end (the game was deleted or lost its size). */
    refresh() {
      if (!gameId) return true;
      if (!store.getGame(gameId)?.dims) return false;
      refresh();
      return true;
    },

    /** Stop placing; returns the game that was being placed (or null). */
    stop() {
      const id = gameId;
      gameId = null;
      return id;
    },

    showBar() {
      if (gameId) bar.show(store.getGame(gameId), suggestions);
      else bar.hide();
    },

    openSpot,

    /** A tap at client point (cx, cy): a stack's spot sheet, or a new stack on empty shelf. */
    tap(cx, cy) {
      const r = stage.getBoundingClientRect();
      const hit = tapTarget(getScene(), toDrawing(panZoom.view, cx - r.left, cy - r.top));
      if (hit?.kind === 'stack') openSpot(hit.stackId);
      else if (hit?.kind === 'empty') newStack(hit.zone, newStackX(hit.zone, hit.x));
    },
  };
}
