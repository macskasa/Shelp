// Measures text in the map's title font with a canvas, for labels.js. Owner: Bruce (Part B).
import { TITLE_PX } from './labels.js';

/** measure(text) → width in px of the map's title font (el's font family), cached. */
export function textMeasurer(el) {
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
