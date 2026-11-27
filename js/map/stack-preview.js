// A small to-scale drawing of one stack as it would be after a move (the spot sheet, part-b3 item 3).
// Owner: Bruce (Part B). The row the box goes to is filled in its category colours, the other row
// is outlined, the moved box is marked, and the shelf above is a dashed line.
import { s } from '../core/dom.js';
import { colorsFor } from '../core/categories.js';
import { layoutStack2 } from '../core/geometry.js';
import { ZONES } from '../core/shelves.js';

const PAD = 1.5; // cm around the stack

/** @returns an <svg>, or null when the stack is missing */
export function stackPicture(stack, getGame, { gameId = null } = {}) {
  if (!stack) return null;
  const lay = layoutStack2(stack, getGame);
  const height = ZONES[stack.zone]?.height ?? Math.max(lay.h, 10);
  const moved = lay.boxes.find((b) => b.gameId === gameId);
  const row = moved?.row ?? 0;
  const w = Math.max(lay.w, 8);
  const y = (b) => height - b.y - b.h;
  const rect = (b, cls, extra = {}) => s('rect', { class: cls, x: b.x, y: y(b), width: b.w, height: b.h, ...extra });

  const parts = [
    s('line', { class: 'map-pv-shelf', x1: -PAD, x2: w + PAD, y1: 0, y2: 0 }),
    s('line', { class: 'map-pv-floor', x1: -PAD, x2: w + PAD, y1: height, y2: height }),
  ];
  for (const b of lay.boxes.filter((x) => x.row !== row)) parts.push(rect(b, 'map-pv-ghost'));
  for (const b of lay.boxes.filter((x) => x.row === row)) {
    const game = getGame(b.gameId);
    const c = game ? colorsFor(game)[0] : 'var(--cat-other)';
    parts.push(rect(b, `map-pv-box${b.gameId === gameId ? ' map-pv-new' : ''}`, { style: `--c: ${c}` }));
  }
  if (lay.topper) parts.push(rect(lay.topper, 'map-pv-topper', { rx: 0.8 }));

  return s('svg', {
    class: 'map-pv', viewBox: `${-PAD} ${-PAD} ${w + 2 * PAD} ${height + 2 * PAD}`,
    preserveAspectRatio: 'xMidYMax meet', role: 'img',
    'aria-label': `Stack ${stack.id} as it would be${moved ? ', with the moved box marked' : ''}`,
  }, parts);
}
