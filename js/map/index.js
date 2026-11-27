// Part B – Shelf map. Owner: Bruce. Stories C1–C3, C5, C6.
//   model.js   box and stack geometry (C1)
//   scene.js   where everything goes in the drawing, in cm (C2)
//   labels.js  which titles fit at the current zoom
//   draw.js    the SVG
//   view.js    the Shelves screen: fit, highlight, hover, tap / keyboard → stack details
//   details.js what the stack details panel lists (C3)
//   stack-panel.js  the stack details panel and "move to cupboard"
import { h } from '../core/dom.js';
import * as store from '../core/store.js';
import { mountMap } from './view.js';

let mapView = null;

export const screens = [
  {
    id: 'map',
    title: 'Shelves',
    order: 10,
    mount(el, params) {
      mapView = mountMap(el, params);
      return () => {
        mapView?.destroy();
        mapView = null;
      };
    },
    update(params) {
      mapView?.update(params);
    },
  },
  {
    id: 'cupboard',
    title: 'Cupboard',
    order: 30,
    // PLACEHOLDER by Tony until story C6.
    mount(el) {
      el.append(h('div', { class: 'card placeholder' }, h('p', { class: 'muted' }, 'Bruce builds the cupboard list here (story C6).')));
      for (const c of store.getPlan().cupboard) {
        el.append(h('p', {}, h('strong', {}, store.getGame(c.game)?.title), ` – ${c.reason}`));
      }
    },
  },
];
