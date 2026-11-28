// The Shelves screen (stories C2, C3, C5 and the "where's my game?" highlight). Owner: Bruce (Part B).
// Builds the drawing from the store and shows it in a frame you can zoom and pan (pan-zoom.js).
// It opens at the full width of the shelves, shows a hover title for the mouse and the S Pen,
// highlights #/map?game=<id>, and opens a stack's details on a tap, on Enter / Space, or for
// #/map?stack=<id>. A new highlight pans to it but keeps the zoom.
// The Front row / Back row switch picks which row of the 2-deep stacks is drawn (issue #47);
// ?game= for a back-row game opens the back view. Every mount starts in the front view.
// Placing mode (part-b3 items 3, 5): #/map?pick=<id> (pickUp), run by view-placing.js. Its bar
// takes the caption's room. Placing leaves on #/map?game=<id>, Cancel / Esc on #/map, both
// replacing the ?pick entry, so Back and a reload never come back into placing mode.
// The board strip (item 2) and Renumber (item 5) sit in the row-switch line.
// #/map?family=<name> (showFamily, part-b4 item 1) marks every member and dims the rest
// (view-family.js); Back, Esc and the × leave it, an unknown family toasts and goes to #/map.
// Input (hover, tap, keys) is in view-input.js, the caption and what it highlights in view-caption.js.
// Drag and drop with the mouse (part-b3 item 6) is in view-drag.js.
import { h, loadCss, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { go } from '../core/contracts.js';
import { buildScene, stackArea } from './scene.js';
import { drawScene } from './draw.js';
import { legend } from './legend.js';
import { frameHeight } from './fit.js';
import { openStackPanel } from './stack-panel.js';
import { deepStackIds, viewForLocation } from './rows.js';
import { rowSwitch } from './row-switch.js';
import { createPanZoom } from './pan-zoom.js';
import { openPickUp } from './pickup-sheet.js';
import { hashAfter } from './placing.js';
import { boardStrip } from './board-strip.js';
import { textMeasurer } from './measure.js';
import { wireInput, ZOOM_STEP } from './view-input.js';
import { createPlacing } from './view-placing.js';
import { createDrag } from './view-drag.js';
import { askRenumber } from './stack-confirm.js';
import { lookupFamily, viewForFamily } from './view-family.js';
import { createCaption } from './view-caption.js';

loadCss(new URL('./map.css', import.meta.url));

const titleOf = (id) => store.getGame(id)?.title ?? id;
const NEW = '+new'; // `selected` while the "New stack here" sheet is open (no stack to mark)

/** Mount the map into el. Returns { update(params), destroy() }. */
export function mountMap(el, params) {
  const caption = h('div', { class: 'map-caption', role: 'status', hidden: true });
  const captions = createCaption(caption);
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
  const renumber = h('button', {
    type: 'button', class: 'btn map-renumber', title: 'Rename the stacks of every shelf left to right', onclick: () => askRenumber(),
  }, 'Renumber');
  rows.el.firstChild.after(renumber); // beside the row switch: no extra line on a phone
  rows.el.append(board.el);

  let current = params ?? {};
  let scene = null;
  let drawing = null;
  let selected = null; // id of the stack whose details panel is open
  let view = 'front'; // which row of the 2-deep stacks is drawn
  let refitTimer = 0;
  let fittedK = 0; // the k the titles were last fitted for

  const panZoom = createPanZoom(stage, { onChange: onView });
  const placing = createPlacing({ stage, panZoom, getScene: () => scene, openOver, onLeave: (how) => leavePlacing(how) });
  const root = h('section', { class: 'map-view', 'aria-label': 'Shelves' }, caption, rows.el, body, placing.el);
  el.append(root);
  const drag = createDrag({
    root, stage, frame, panZoom, getScene: () => scene, getView: () => view, openOver,
    isOff: () => !!placing.gameId || !!selected || !!document.querySelector('dialog[open]'),
  });
  const measure = textMeasurer(root);

  function render() {
    const plan = store.getPlan2();
    if (!placing.refresh()) {
      leavePlacing('cancel'); // deleted, or its size removed, while placing
      return;
    }
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

  const stackRect = (stackId) => stackArea(scene, stackId);

  /** Show the highlight and caption for the current route params. reveal: pan to it. */
  function applyParams({ reveal = false } = {}) {
    root.classList.toggle('map-placing-on', !!placing.gameId);
    placing.showBar();
    // placing mode: the bar replaces the caption; only the stack being placed on is marked
    const shown = placing.gameId ? captions.hide() : captions.forParams(current, scene, view);
    const { family } = shown;
    let { target } = shown;
    drawing.markFamily(family?.focus ?? null);
    board.mark(family?.focus.boardIds ?? []);
    // while a stack's panel is open, that stack is the one marked
    if (selected) target = { stackId: selected, gameId: target?.stackId === selected ? target.gameId : null };
    drawing.highlight(target);
    layoutFrame(); // the caption takes room above the frame
    if (reveal && family?.rect) {
      frame.scrollIntoView({ block: 'nearest' });
      panZoom.reveal(family.rect, { fit: true }); // a spread family: zoom out just enough
    } else if (target && reveal) {
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
    let v = current.game ? viewForLocation(store.locate2(current.game)) : null;
    if (current.family) {
      const fam = lookupFamily(current.family);
      if (fam) v = viewForFamily(fam);
      else {
        toast(`No family “${current.family}” any more`);
        history.replaceState(history.state, '', '#/map');
        current = {};
      }
    }
    if (v && v !== view) {
      view = v;
      render();
    }
    if (placing.fromRoute(current) === 'error') {
      history.replaceState(history.state, '', hashAfter('cancel'));
      current = {};
    }
    if (!placing.gameId && current.stack && scene.stacks.some((x) => x.id === current.stack)) openDetails(current.stack);
    applyParams({ reveal: true });
  }

  /**
   * Leave placing mode: 'placed' shows the game in its new place, 'cancel' plain #/map. Replaces
   * the ?pick history entry, so neither Back nor a reload returns to placing mode.
   */
  function leavePlacing(how) {
    const id = placing.stop();
    if (!id) return;
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

  /** Open a panel over a stack (null: a new stack), one at a time. open(onClose) → dialog | null. */
  function openOver(stackId, open) {
    if (selected) return;
    const dlg = open(() => panelClosed(stackId));
    if (!dlg) return;
    selected = stackId ?? NEW;
    applyParams();
  }

  const openDetails = (stackId) => openOver(stackId, (onClose) => openStackPanel(stackId, { onClose }));

  // A tap anywhere in a stack's column (boxes are only a few px tall on a phone) opens its details;
  // in placing mode a tap picks a stack or an empty spot.
  wireInput({ root, stage, frame, tip, keyBtn }, {
    panZoom, titleOf, showKey, stackRect,
    onClick: (e) => {
      if (placing.gameId) placing.tap(e.clientX, e.clientY);
      else if (e.target.closest?.('[data-stack]')) openDetails(e.target.closest('[data-stack]').dataset.stack);
    },
    onEnter: (stackId) => (placing.gameId ? placing.openSpot(stackId) : openDetails(stackId)),
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
  // Esc leaves placing mode, or a family's highlight, once no panel is open (a panel's Esc closes the panel first)
  const onEscape = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return;
    if (placing.gameId) leavePlacing('cancel');
    else if (current.family) go('map');
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', onEscape);

  render();
  if (current.game || current.stack || current.pick || current.family) afterRoute();

  return {
    update(params) {
      current = params ?? {};
      afterRoute();
    },
    destroy() {
      off();
      drag.destroy();
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
