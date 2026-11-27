// The Shelves screen (stories C2, C3, C5 and the "where's my game?" highlight). Owner: Bruce (Part B).
// Builds the drawing from the store and shows it in a frame you can zoom and pan (pan-zoom.js).
// It opens at the full width of the shelves, shows a hover title for the mouse and the S Pen,
// highlights #/map?game=<id>, and opens a stack's details on a tap, on Enter / Space, or for
// #/map?stack=<id>. A new highlight pans to it but keeps the zoom.
import { h, loadCss } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { ZONES } from '../core/shelves.js';
import { go } from '../core/contracts.js';
import { describeLocation } from '../core/format.js';
import { buildScene, findInScene } from './scene.js';
import { drawScene } from './draw.js';
import { legend } from './legend.js';
import { TITLE_PX } from './labels.js';
import { openStackPanel } from './stack-panel.js';
import { createPanZoom } from './pan-zoom.js';

loadCss(new URL('./map.css', import.meta.url));

const titleOf = (id) => store.getGame(id)?.title ?? id;
const MIN_FRAME_H = 240; // px; in landscape the frame is short and you pan up and down
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
  const frame = h('div', { class: 'map-frame' }, stage, tools, tip);
  const root = h('section', { class: 'map-view', 'aria-label': 'Shelves' }, caption, frame, legend());
  el.append(root);

  const measure = textMeasurer(root);
  let current = params ?? {};
  let scene = null;
  let drawing = null;
  let selected = null; // id of the stack whose details panel is open
  let refitTimer = 0;
  let fittedK = 0; // the k the titles were last fitted for

  const panZoom = createPanZoom(stage, { onChange: onView });

  function render() {
    scene = buildScene(store.getPlan(), store.getGame);
    drawing = drawScene(scene, store.getGame);
    drawing.svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    stage.replaceChildren(drawing.svg);
    layoutFrame();
    fittedK = 0;
    panZoom.attach(drawing.svg, scene);
    applyParams();
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

  /** The frame is as tall as the drawing at full width, but never taller than the screen allows. */
  function layoutFrame() {
    if (!scene) return;
    const width = frame.clientWidth;
    if (!width) return;
    const natural = scene.height * (width / scene.width);
    const top = frame.getBoundingClientRect().top + window.scrollY;
    const bottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    const room = window.innerHeight - top - bottom;
    const px = `${Math.round(Math.max(MIN_FRAME_H, Math.min(natural, room)))}px`;
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
    let target = null;
    if (current.game) {
      const loc = store.locate(current.game);
      // a box stored inside another box: show the host box
      const shownId = loc?.kind === 'inside' ? loc.hostId : current.game;
      const found = findInScene(scene, shownId);
      if (found) target = { stackId: found.stack.id, gameId: found.box ? shownId : null };
      const offShelf = loc?.kind === 'cupboard' || loc?.kind === 'unplaced';
      const link = offShelf ? h('a', { href: '#/cupboard' }, 'Open the cupboard list') : null;
      setCaption(store.getGame(current.game)?.title ?? null, describeLocation(loc, titleOf), link);
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
   * After the route changed: pan to the highlight and open the details for ?stack=.
   * Runs one frame later, after the router has handled the hashchange (it closes panels and resets
   * the scroll position). Never on a redraw, or every store change would open the panel again.
   */
  function afterRoute() {
    requestAnimationFrame(() => {
      applyParams({ reveal: true });
      if (current.stack && scene.stacks.some((x) => x.id === current.stack)) openDetails(current.stack);
    });
  }

  /** Open a stack's details panel (one at a time). */
  function openDetails(stackId) {
    if (selected) return;
    const dlg = openStackPanel(stackId, {
      onClose() {
        selected = null;
        applyParams();
        // the drawing may have been rebuilt while the panel was open: give focus back to the stack
        requestAnimationFrame(() => {
          if (!document.activeElement || document.activeElement === document.body) {
            drawing.stackNode(stackId)?.focus({ preventScroll: true });
          }
        });
      },
    });
    if (!dlg) return;
    selected = stackId;
    applyParams();
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
      openDetails(st.dataset.stack);
    } else return;
    e.preventDefault();
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

  render();
  if (current.game || current.stack) afterRoute();

  return {
    update(params) {
      current = params ?? {};
      applyParams();
      afterRoute();
    },
    destroy() {
      off();
      clearTimeout(refitTimer);
      widthWatch.disconnect();
      sizeWatch.disconnect();
      window.removeEventListener('resize', onWindow);
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
