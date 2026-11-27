// The Shelves screen (stories C2, C3, C5 and the "where's my game?" highlight). Owner: Bruce (Part B).
// Builds the drawing from the store, fits it to the screen width, shows a hover title for the
// mouse and the S Pen, highlights #/map?game=<id>, and opens a stack's details on a tap, on
// Enter / Space, or for #/map?stack=<id>.
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

loadCss(new URL('./map.css', import.meta.url));

const titleOf = (id) => store.getGame(id)?.title ?? id;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Mount the map into el. Returns { update(params), destroy() }. */
export function mountMap(el, params) {
  const caption = h('div', { class: 'map-caption', role: 'status', hidden: true });
  const stage = h('div', { class: 'map-stage' });
  const tip = h('div', { class: 'map-tip', hidden: true, 'aria-hidden': 'true' });
  const frame = h('div', { class: 'map-frame' }, stage, tip);
  const root = h('section', { class: 'map-view', 'aria-label': 'Shelves' }, caption, frame, legend());
  el.append(root);

  const measure = textMeasurer(root);
  let current = params ?? {};
  let scene = null;
  let drawing = null;
  let k = 0;
  let selected = null; // id of the stack whose details panel is open

  function render() {
    scene = buildScene(store.getPlan(), store.getGame);
    drawing = drawScene(scene, store.getGame);
    stage.replaceChildren(drawing.svg);
    k = 0;
    fit();
    applyParams();
  }

  /** Work out screen px per cm and refit the text. The drawing always fills the frame's width. */
  function fit() {
    const width = drawing.svg.getBoundingClientRect().width;
    if (!width) return;
    const next = width / scene.width;
    if (Math.abs(next - k) < 0.001) return;
    k = next;
    drawing.svg.style.setProperty('--k', String(k));
    drawing.refit(k, measure);
  }

  function setCaption(title, text, link = null) {
    caption.replaceChildren(
      h('p', {}, title ? h('strong', {}, title) : null, title ? ' – ' : null, text, link ? [' ', link] : null),
      h('button', { class: 'btn map-caption-close', 'aria-label': 'Clear the highlight', onclick: () => go('map') }, '×'),
    );
    caption.hidden = false;
  }

  /** Show the highlight and caption for the current route params. scroll: bring it into view. */
  function applyParams({ scroll = false } = {}) {
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
    if (target && scroll) {
      drawing.stackNode(target.stackId)?.scrollIntoView({ block: 'center', inline: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }

  /**
   * After the route changed: scroll to the highlight and open the details for ?stack=.
   * Runs one frame later, because during the hashchange core/dom.js closes every open panel and
   * the router resets the scroll position. Never on a redraw, or every store change would
   * open the panel again.
   */
  function afterRoute() {
    requestAnimationFrame(() => {
      applyParams({ scroll: true });
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

  // Hover title for the mouse and the S Pen (touch has no hover).
  function onHover(e) {
    if (e.pointerType === 'touch') return;
    const box = e.target.closest?.('[data-game]');
    if (!box) {
      tip.hidden = true;
      return;
    }
    tip.textContent = titleOf(box.dataset.game);
    tip.hidden = false;
    const r = frame.getBoundingClientRect();
    const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 4);
    tip.style.left = `${Math.max(4, x)}px`;
    tip.style.top = `${e.clientY - r.top + 18}px`;
  }
  stage.addEventListener('pointermove', onHover);
  stage.addEventListener('pointerleave', () => { tip.hidden = true; });

  // A tap anywhere in a stack's column (boxes are only a few px tall on a phone) opens its details.
  stage.addEventListener('click', (e) => {
    const st = e.target.closest?.('[data-stack]');
    if (st) openDetails(st.dataset.stack);
  });
  // Keyboard: Tab to a stack, then Enter or Space.
  stage.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const st = e.target.closest?.('[data-stack]');
    if (!st) return;
    e.preventDefault();
    openDetails(st.dataset.stack);
  });

  const resize = new ResizeObserver(() => fit());
  resize.observe(stage);
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
      resize.disconnect();
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
