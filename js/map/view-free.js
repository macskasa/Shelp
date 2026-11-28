// Free space on the Shelves screen (part-b7): the toggle, the overlay and a tapped band. Owner: Bruce (Part B).
// #/map?free=1 keeps it on (replaceState: Back and a reload keep it, the toggle adds no history step).
// The toggle sits with the row switch; it and the overlay hide in placing mode and while dragging (map.css).
// A tap on empty space near a band (not on a box) shows its line in the caption, with Join for a surface
// across two stacks (askJoin), Push to the wall for a gap in a wall-end unit, and a link to the Free
// space screen. The numbers come from Tony's freeSpace(); the bands and words from free-layer.js.
import { h } from '../core/dom.js';
import * as store from '../core/store.js';
import { freeSpace } from '../core/space.js';
import { go } from '../core/contracts.js';
import { freeBands, bandAt, bandLine, pushForBand, pushLabel, parseFreeParam, freeHash } from './free-layer.js';
import { drawFree } from './free-draw.js';
import { askJoin, pushWall } from './stack-confirm.js';
import { toDrawing } from './placing.js';

const TAP_PX = 20; // a tap this close to a band (screen px) still means it: 40 px targets

/**
 * @param getRoute () → the current route params
 * @param onChange (params) after the toggle or a band changed: view.js sets `current` and redraws the caption
 */
export function createFree({ getRoute, onChange }) {
  const btn = h('button', {
    type: 'button', class: 'btn map-free-btn', 'aria-pressed': 'false',
    title: 'Show the free space on the drawing', onclick: () => toggle(),
  }, 'Free space');
  let on = false;
  let units = [];
  let bands = [];
  let layer = null;
  let band = null; // the tapped band

  function toggle() {
    const params = getRoute();
    const next = !on;
    history.replaceState(history.state, '', freeHash(params, next));
    const p = { ...params };
    if (next) p.free = '1';
    else delete p.free;
    setOn(next);
    onChange(p);
  }

  function setOn(v) {
    on = v;
    band = null;
    btn.setAttribute('aria-pressed', String(on));
    layer?.el.classList.toggle('is-on', on);
    layer?.select(null);
  }

  return {
    btn,
    get on() { return on; },
    get band() { return band; },
    /** The route changed: on or off, and a tapped band is forgotten. */
    route(params) {
      setOn(parseFreeParam(params));
    },
    /** A new drawing: the overlay goes on top of the stacks (front view only: the same in either row). */
    attach(svg, scene) {
      units = freeSpace(store.getPlan2(), store.getGame);
      bands = freeBands(units, scene);
      band = band && bands.find((b) => b.key === band.key) || null;
      layer = drawFree(bands);
      svg.prepend(layer.defs);
      svg.querySelector('.map-layer-brackets').after(layer.el);
      layer.el.classList.toggle('is-on', on);
      layer.select(band?.key ?? null);
    },
    refit(k, measure) {
      layer?.refit(k, measure);
    },
    /** A click in the drawing: true when it meant a band (not on a box, overlay on). */
    tap(e, stage, view) {
      if (!on || e.target.closest?.('[data-game]')) return false;
      const r = stage.getBoundingClientRect();
      const hit = bandAt(bands, toDrawing(view, e.clientX - r.left, e.clientY - r.top), TAP_PX / view.k);
      if (!hit) return false;
      band = hit;
      layer.select(hit.key);
      onChange(getRoute());
      return true;
    },
    /** Forget the tapped band (the caption's ×). */
    clear() {
      band = null;
      layer?.select(null);
      onChange(getRoute());
    },
    /** The caption for the tapped band: its line, Join or Push, the Free space screen link. */
    caption() {
      const line = bandLine(band, store.getPlan2(), store.getGame);
      const push = band.kind === 'gap' ? pushForBand(units, band) : null;
      const [a, b] = line.join ?? [];
      return [
        h('p', {}, line.text),
        h('p', { class: 'map-free-actions' },
          line.join ? h('button', { type: 'button', class: 'btn', onclick: () => askJoin(a, b) }, `Join ${a} and ${b}`) : null,
          push ? h('button', { type: 'button', class: 'btn', onclick: () => pushWall(push.zone) }, pushLabel(push)) : null,
          h('a', { href: '#/space', onclick: (e) => { e.preventDefault(); go('space'); } }, 'Free space screen')),
      ];
    },
  };
}
