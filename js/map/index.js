// Part B – Shelf map. Owner: Bruce. Stories C1–C3, C5, C6.
//   scene.js        where everything goes in the drawing, in cm (C2)
//   rows.js         which row of the 2-deep stacks a view draws (#47); row-switch.js is the switch
//   labels.js       which titles fit at the current zoom
//   draw.js         the SVG
//   viewport.js     zoom and pan maths; pan-zoom.js reads the pointers
//   view.js         the Shelves screen: zoom, highlight, hover, tap / keyboard → stack details
//   details.js      what the stack details panel lists (C3); stack-panel.js shows it
//   cupboard.js     what the cupboard screen lists, placement preview (C6); cupboard-view.js shows it
//   ui.js           category chips and warning lists
//   pickup.js       what the pick-up sheet offers and the turn options (Phase C); pickup-sheet.js and
//                   turn-panel.js show them; put-panel.js is "Put on a stack…", the spot sheet
//   placing.js      placing mode and the board strip without DOM (route, taps, suggestions, chips);
//                   placing-bar.js, board-strip.js and stack-preview.js show them
import { mountMap } from './view.js';
import { mountCupboard } from './cupboard-view.js';

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
    mount(el) {
      return mountCupboard(el);
    },
  },
];
