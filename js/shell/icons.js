// Small line icons for the tab bar and header tools. Owner: Peter (Part C).
// 24 × 24 grid, drawn with currentColor strokes (the colour comes from the CSS: .shell-tab svg).
import { s } from '../core/dom.js';

const SHAPES = {
  // shelves with boxes on them
  map: [
    ['path', { d: 'M3 7h18M3 14h18M3 21h18' }],
    ['rect', { x: 5, y: 3, width: 5, height: 4 }],
    ['rect', { x: 12, y: 4, width: 4, height: 3 }],
    ['rect', { x: 6, y: 10, width: 6, height: 4 }],
    ['rect', { x: 14, y: 11, width: 3, height: 3 }],
    ['rect', { x: 5, y: 17, width: 8, height: 4 }],
  ],
  // a die
  catalog: [
    ['rect', { x: 4, y: 4, width: 16, height: 16, rx: 3 }],
    ['circle', { cx: 9, cy: 9, r: 1, fill: 'currentColor' }],
    ['circle', { cx: 15, cy: 9, r: 1, fill: 'currentColor' }],
    ['circle', { cx: 12, cy: 12, r: 1, fill: 'currentColor' }],
    ['circle', { cx: 9, cy: 15, r: 1, fill: 'currentColor' }],
    ['circle', { cx: 15, cy: 15, r: 1, fill: 'currentColor' }],
  ],
  // a shelf with a gap: two boxes and an empty dashed slot (Free space)
  space: [
    ['path', { d: 'M3 20h18' }],
    ['rect', { x: 4, y: 11, width: 5, height: 9 }],
    ['rect', { x: 15, y: 8, width: 5, height: 12 }],
    ['path', { d: 'M11.5 20v-4M11.5 13v-1', 'stroke-dasharray': '2 2' }],
    ['path', { d: 'M4 5h16' }],
  ],
  // a cupboard with two doors
  cupboard: [
    ['rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 }],
    ['path', { d: 'M12 3v18M9.5 11v2M14.5 11v2' }],
  ],
  // a database cylinder
  data: [
    ['ellipse', { cx: 12, cy: 6, rx: 7, ry: 3 }],
    ['path', { d: 'M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3' }],
  ],
  // curved arrows (header Undo and Redo)
  undo: [
    ['path', { d: 'M9 14L4 9l5-5' }],
    ['path', { d: 'M4 9h10.5a5.5 5.5 0 010 11H11' }],
  ],
  redo: [
    ['path', { d: 'M15 14l5-5-5-5' }],
    ['path', { d: 'M20 9H9.5a5.5 5.5 0 000 11H13' }],
  ],
  // counter-clockwise arrow around a clock (header Versions)
  versions: [
    ['path', { d: 'M4 4.5V9h4.5' }],
    ['path', { d: 'M4.6 9A8 8 0 1 1 4 12' }],
    ['path', { d: 'M12 7.5V12l3 1.8' }],
  ],
  // magnifying glass (header search, story C4)
  search: [
    ['circle', { cx: 11, cy: 11, r: 6 }],
    ['path', { d: 'M16 16l5 5' }],
  ],
};

const FALLBACK = [['circle', { cx: 12, cy: 12, r: 8 }]];

/** icon('map') -> <svg> element. Unknown names give a plain circle. */
export function icon(name) {
  const shapes = SHAPES[name] ?? FALLBACK;
  return s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    shapes.map(([tag, attrs]) => s(tag, attrs)));
}
