// The Shelves screen (stories C2, C3, C5 and the "where's my game?" highlight). Owner: Bruce (Part B).
// Builds the drawing from the store and shows it in a frame you can zoom and pan (pan-zoom.js).
// It opens at the full width of the shelves, shows a hover title for the mouse and the S Pen,
// highlights #/map?game=<id>, and opens a stack's details on a tap, on Enter / Space, or for
// #/map?stack=<id>. A new highlight pans to it but keeps the zoom.
// The Front row / Back row switch picks which row of the 2-deep stacks is drawn (issue #47);
// ?game= for a back-row game opens the back view. Every mount starts in the front view.
// Placing mode (part-b3 item 3): #/map?pick=<id> (pickUp). The placing bar takes the caption's
// room; a tap on a stack opens the spot sheet (put-panel.js) for it, a suggestion opens it preset.
// Placing leaves on #/map?game=<id>, Cancel / Esc on #/map, both replacing the ?pick entry, so
// Back and a reload never come back into placing mode; Back leaves it as any screen change does.
// The board strip (item 2) sits in the row-switch line; a chip opens the pick-up sheet.
import { h, loadCss, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { ZONES } from '../core/shelves.js';
import { go } from '../core/contracts.js';
import { describeLocation2 } from '../core/format.js';
import { buildScene, findInScene } from './scene.js';
import { drawScene } from './draw.js';
import { legend } from './legend.js';
import { frameHeight } from './fit.js';
import { TITLE_PX } from './labels.js';
import { openStackPanel } from './stack-panel.js';
import { deepStackIds, viewForLocation } from './rows.js';
import { rowSwitch } from './row-switch.js';
import { createPanZoom } from './pan-zoom.js';
import { openPutPanel } from './put-panel.js';
import { openPickUp } from './pickup-sheet.js';
import { suggestSpots } from '../rules/index.js';
import { placingFor, hashAfter, toDrawing, tapTarget, topSuggestions } from './placing.js';
import { placingBar } from './placing-bar.js';
import { boardStrip } from './board-strip.js';

loadCss(new URL('./map.css', import.meta.url));

const titleOf = (id) => store.getGame(id)?.title ?? id;
const ZOOM_STEP = 1.6;

/** Mount the map into el. Returns { update(params), destroy() }. */
export function mountMap(el, params) {
  const caption = h('div', { class: 'map-caption', role: 'status', hidden: true });
  const stage = h('div', { class: 'map-stage' });
  const tip = h('div', { class: 'map-tip', hidden: true, 'aria-hidden': 'true' });
  const tool = (label, text, onclick) => h('button', { type: 'button', class: 'btn map-tool', 'aria-label': label, title: label, onclick }, text);
  const tools = h('div', { class: 'map-tools', role: 'group', 'aria-label': 'Zoom' },
    tool('Zoom out', '−', () => panZoom.zoomBy(1 / ZOOM_STEP)),
    tool('Zoom in', '+', () => panZoom.zoomBy(ZOOM_STEP)),
    tool('Fit the width', '⤢', () => panZoom.fit()));
  const key = legend();
  // below 1024 px the legend is a card over the drawing, opened from the tools; beside it on desktop
  const keyBtn = h('button', {
    type: 'button', class: 'btn map-tool map-key-btn', 'aria-label': 'Legend', title: 'Legend',
    'aria-expanded': 'false', 'aria-controls': key.id, onclick: () => showKey(!root.classList.contains('map-key-open')),
  }, 'i');
  tools.prepend(keyBtn);
  const frame = h('div', { class: 'map-frame' }, stage, tools, tip);
  const body = h('div', { class: 'map-body' }, frame, key);
  const rows = rowSwitch((v) => setView(v));
  const board = boardStrip((id) => openPickUp(id));
  rows.el.append(board.el);
  const bar = placingBar({ onCancel: () => leavePlacing('cancel'), onSuggest: (spot) => openSpot(spot.target.stackId, spot) });
  const root = h('section', { class: 'map-view', 'aria-label': 'Shelves' }, caption, rows.el, body, bar.el);
  el.append(root);

  const measure = textMeasurer(root);
  let current = params ?? {};
  let scene = null;
  let drawing = null;
  let selected = null; // id of the stack whose details panel is open
  let view = 'front'; // which row of the 2-deep stacks is drawn
  let refitTimer = 0;
  let fittedK = 0; // the k the titles were last fitted for
  let placing = null; // id of the game being placed (placing mode), or null
  let suggestions = []; // the placing bar's suggestions for it

  const panZoom = createPanZoom(stage, { onChange: onView });

  function render() {
    const plan = store.getPlan2();
    if (placing && !store.getGame(placing)?.dims) {
      leavePlacing('cancel'); // deleted, or its size removed, while placing
      return;
    }
    if (placing) suggestions = topSuggestions(suggestSpots(plan, store.getGames(), placing, { limit: 12 }));
    rows.set(view, deepStackIds(plan));
    board.set(store.getBoard(), store.getGame);
    root.classList.toggle('map-has-board', store.getBoard().length > 0);
    root.dataset.view = view;
    scene = buildScene(plan, store.getGame, { view });
    drawing = drawScene(scene, store.getGame);
    drawing.svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    stage.replaceChildren(drawing.svg);
    layoutFrame();
    fittedK = 0;
    panZoom.attach(drawing.svg, scene); // keeps the zoom and pan
    applyParams();
  }

  /** Switch rows (the buttons, or a ?game= in the other row). Keeps the zoom and focus. */
  function setView(v) {
    if (v === view) return;
    view = v;
    render();
  }

  /** Text stays the same screen size at every zoom (--k); which titles fit is refitted shortly after. */
  function onView(v) {
    if (!drawing) return;
    drawing.svg.style.setProperty('--k', String(v.k));
    if (Math.abs(v.k - fittedK) < 1e-4) return;
    const refit = () => {
      fittedK = panZoom.view.k;
      drawing.refit(fittedK, measure);
    };
    clearTimeout(refitTimer);
    if (!fittedK) refit();
    else refitTimer = setTimeout(refit, 90);
  }

  /** Show or hide the legend card (below 1024 px; on desktop the legend is always beside the drawing). */
  function showKey(open) {
    root.classList.toggle('map-key-open', open);
    keyBtn.setAttribute('aria-expanded', String(open));
  }

  /**
   * The frame is as tall as the drawing at full width, but only as tall as the window allows, so
   * the page itself never scrolls (issue #65): whatever sits under the frame keeps its room.
   */
  function layoutFrame() {
    if (!scene) return;
    const width = frame.clientWidth;
    if (!width) return;
    const fr = frame.getBoundingClientRect();
    const after = root.getBoundingClientRect().bottom - fr.bottom; // content under the frame
    const padding = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    const px = `${frameHeight({
      windowH: window.innerHeight,
      top: fr.top + window.scrollY,
      below: Math.max(0, after) + padding,
      natural: scene.height * (width / scene.width),
    })}px`;
    if (frame.style.height !== px) frame.style.height = px;
  }

  /** The area of a stack in cm: its column from the top of the shelf down to its id. */
  function stackRect(stackId) {
    const st = scene.stacks.find((x) => x.id === stackId);
    if (!st) return null;
    const zone = scene.zones.find((z) => z.id === st.zone);
    const y = Math.min(zone.top, st.top);
    return { x: st.x, y, w: Math.max(st.w, 2), h: st.label.y + 3 - y };
  }

  function setCaption(title, text, link = null) {
    caption.replaceChildren(
      h('p', {}, title ? h('strong', {}, title) : null, title ? ' – ' : null, text, link ? [' ', link] : null),
      h('button', { class: 'btn map-caption-close', 'aria-label': 'Clear the highlight', onclick: () => go('map') }, '×'),
    );
    caption.hidden = false;
  }

  /** Show the highlight and caption for the current route params. reveal: pan to it. */
  function applyParams({ reveal = false } = {}) {
    caption.hidden = true;
    root.classList.toggle('map-placing-on', !!placing);
    if (placing) bar.show(store.getGame(placing), suggestions);
    else bar.hide();
    let target = null;
    if (placing) {
      // placing mode: the bar replaces the caption; only the stack being placed on is marked
    } else if (current.game) {
      const loc = store.locate2(current.game);
      // a box stored inside another box: show the host box
      const shownId = loc?.kind === 'inside' ? loc.hostId : current.game;
      const found = findInScene(scene, shownId);
      if (found) target = { stackId: found.stack.id, gameId: found.box ? shownId : null };
      // the cupboard screen lists the cupboard and the board
      const link = loc?.kind === 'cupboard' || loc?.kind === 'board' ? h('a', { href: '#/cupboard' }, 'Open the cupboard list') : null;
      setCaption(store.getGame(current.game)?.title ?? null, describeLocation2(loc, titleOf), link);
    } else if (current.stack) {
      const st = scene.stacks.find((x) => x.id === current.stack);
      if (st) {
        target = { stackId: st.id, gameId: null };
        setCaption(`Stack ${st.id}`, ZONES[st.zone].label);
      } else {
        setCaption(null, `There is no stack ${current.stack} in this plan.`);
      }
    }
    // while a stack's panel is open, that stack is the one marked
    if (selected) target = { stackId: selected, gameId: target?.stackId === selected ? target.gameId : null };
    drawing.highlight(target);
    layoutFrame(); // the caption takes room above the frame
    if (target && reveal) {
      frame.scrollIntoView({ block: 'nearest' });
      const r = stackRect(target.stackId);
      if (r) panZoom.reveal(r);
    }
  }

  /**
   * After the route changed: open the details for ?stack= and pan to the highlight.
   * Only on a route change – never on a redraw, or every store change would open the panel again.
   */
  function afterRoute() {
    const v = current.game ? viewForLocation(store.locate2(current.game)) : null;
    if (v && v !== view) {
      view = v;
      render();
    }
    const p = placingFor(current, store.getGame);
    if (p?.error) toast(p.error, { error: true });
    if (p?.error || (!p && placing)) {
      placing = null;
      if (p?.error) {
        history.replaceState(history.state, '', hashAfter('cancel'));
        current = {};
      }
    } else if (p) {
      placing = p.gameId;
      suggestions = topSuggestions(suggestSpots(store.getPlan2(), store.getGames(), placing, { limit: 12 }));
    }
    if (!placing && current.stack && scene.stacks.some((x) => x.id === current.stack)) openDetails(current.stack);
    applyParams({ reveal: true });
  }

  /**
   * Leave placing mode: 'placed' shows the game in its new place, 'cancel' plain #/map. Replaces
   * the ?pick history entry, so neither Back nor a reload returns to placing mode.
   */
  function leavePlacing(how) {
    if (!placing) return;
    const id = placing;
    placing = null;
    history.replaceState(history.state, '', hashAfter(how, id));
    current = how === 'placed' ? { game: id } : {};
    afterRoute();
  }

  /** After a panel over a stack closes: unmark it and give focus back to it (the drawing may be new). */
  function panelClosed(stackId) {
    selected = null;
    applyParams();
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) {
        drawing.stackNode(stackId)?.focus({ preventScroll: true });
      }
    });
  }

  /** Open a stack's details panel (one at a time). */
  function openDetails(stackId) {
    if (selected) return;
    const dlg = openStackPanel(stackId, { onClose: () => panelClosed(stackId) });
    if (!dlg) return;
    selected = stackId;
    applyParams();
  }

  /** Placing mode: the spot sheet for a stack, or preset from a suggestion (suggestSpots). */
  function openSpot(stackId, suggestion = null) {
    if (selected || !placing) return;
    const preset = suggestion ? { target: suggestion.target, label: suggestion.text } : null;
    const dlg = openPutPanel(placing, {
      stackId, preset, onPlaced: () => leavePlacing('placed'), onClose: () => panelClosed(stackId),
    });
    if (!dlg) return;
    selected = stackId;
    applyParams();
  }

  /** Placing mode: a tap at client point (cx, cy) on a stack opens its spot sheet. */
  function placeTap(cx, cy) {
    const r = stage.getBoundingClientRect();
    const hit = tapTarget(scene, toDrawing(panZoom.view, cx - r.left, cy - r.top));
    if (hit?.kind === 'stack') openSpot(hit.stackId);
    else if (hit?.kind === 'empty') toast('A new stack in empty space comes in a later update. For now, tap a stack.');
  }

  // Hover title for the mouse and the S Pen (touch has no hover; nothing while dragging).
  stage.addEventListener('pointermove', (e) => {
    const box = e.pointerType !== 'touch' && !e.buttons ? e.target.closest?.('[data-game]') : null;
    if (!box) {
      tip.hidden = true;
      return;
    }
    tip.textContent = titleOf(box.dataset.game);
    tip.hidden = false;
    const r = frame.getBoundingClientRect();
    const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 4);
    tip.style.left = `${Math.max(4, x)}px`;
    tip.style.top = `${Math.min(e.clientY - r.top + 18, r.height - tip.offsetHeight - 4)}px`;
  });
  stage.addEventListener('pointerleave', () => { tip.hidden = true; });

  // A tap anywhere in a stack's column (boxes are only a few px tall on a phone) opens its details.
  // pan-zoom.js swallows the click that ends a drag or a pinch.
  stage.addEventListener('click', (e) => {
    if (placing) {
      placeTap(e.clientX, e.clientY);
      return;
    }
    const st = e.target.closest?.('[data-stack]');
    if (st) openDetails(st.dataset.stack);
  });
  // Keyboard: Tab to a stack, then Enter or Space. + and − zoom, 0 fits.
  stage.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') panZoom.zoomBy(ZOOM_STEP);
    else if (e.key === '-') panZoom.zoomBy(1 / ZOOM_STEP);
    else if (e.key === '0') panZoom.fit();
    else if (e.key === 'Enter' || e.key === ' ') {
      const st = e.target.closest?.('[data-stack]');
      if (!st) return;
      if (placing) openSpot(st.dataset.stack);
      else openDetails(st.dataset.stack);
    } else return;
    e.preventDefault();
  });
  // Esc closes the legend card (a panel's own Esc closes the panel first: it is modal)
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !root.classList.contains('map-key-open')) return;
    e.preventDefault(); // the legend first, then placing mode (onEscape)
    showKey(false);
    keyBtn.focus();
  });
  // A stack reached with Tab is panned into view.
  stage.addEventListener('focusin', (e) => {
    const id = e.target.dataset?.stack;
    const r = id && e.target.matches(':focus-visible') ? stackRect(id) : null;
    if (r) panZoom.reveal(r, { animate: false });
  });

  let lastWidth = 0;
  const widthWatch = new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    if (w === lastWidth) return;
    lastWidth = w;
    requestAnimationFrame(layoutFrame);
  });
  widthWatch.observe(root);
  const sizeWatch = new ResizeObserver(() => panZoom.resize());
  sizeWatch.observe(stage);
  const onWindow = () => requestAnimationFrame(layoutFrame);
  window.addEventListener('resize', onWindow);
  const off = on('store:changed', () => render());
  // Esc leaves placing mode, once no panel is open (a panel's Esc closes the panel first)
  const onEscape = (e) => {
    if (e.key !== 'Escape' || !placing || e.defaultPrevented || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    leavePlacing('cancel');
  };
  document.addEventListener('keydown', onEscape);

  render();
  if (current.game || current.stack || current.pick) afterRoute();

  return {
    update(params) {
      current = params ?? {};
      afterRoute();
    },
    destroy() {
      off();
      clearTimeout(refitTimer);
      widthWatch.disconnect();
      sizeWatch.disconnect();
      window.removeEventListener('resize', onWindow);
      document.removeEventListener('keydown', onEscape);
      panZoom.destroy();
      root.remove();
    },
  };
}

/** measure(text) → width in px of the map's title font, using a canvas. */
function textMeasurer(el) {
  const ctx = document.createElement('canvas').getContext('2d');
  const family = getComputedStyle(el).fontFamily || 'sans-serif';
  ctx.font = `${TITLE_PX}px ${family}`;
  const cache = new Map();
  return (text) => {
    let w = cache.get(text);
    if (w === undefined) {
      if (cache.size > 5000) cache.clear();
      w = ctx.measureText(text).width;
      cache.set(text, w);
    }
    return w;
  };
}
