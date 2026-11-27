// What the stack details panel shows (story C3). Pure, no DOM, so Node can test it. Owner: Bruce.
import { ZONES } from '../core/shelves.js';
import { formatDims } from '../core/format.js';

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });

/** Number of games in a stack (all rows, side groups counted box by box). */
export function gameCount(stack) {
  return stack.rows.flat().reduce((n, item) => n + (item.side ? item.side.length : 1), 0);
}

/** Accessible name of a stack on the map: "Stack B3, Bottom shelf, 5 games". */
export function stackAriaLabel(id, zone, count) {
  return `Stack ${id}, ${ZONES[zone]?.label ?? zone}, ${count} game${count === 1 ? '' : 's'}`;
}

/**
 * Everything the panel lists for one stack.
 * @param stack    plan stack
 * @param layout   layoutStack(stack, getGame) from model.js
 * @param getGame  id → game
 * @returns {{ id, shelf, size, count, tags: string[], notes: string[],
 *   rows: [{ label: 'Front row' | 'Back row' | null, order: 'top to bottom' | 'left to right',
 *            boxes: [{ gameId, title, categories, size, flags: string[] }] }] }}
 * Flat stacks list their boxes top to bottom (a side-by-side level stays in its plan order),
 * standing stacks left to right. Front row first.
 */
export function stackDetails(stack, layout, getGame) {
  const standing = stack.orientation === 'standing';
  const tags = [];
  if (stack.rows.length > 1) tags.push('2 deep');
  if (standing) tags.push('standing');
  if (stack.topper) tags.push(`${stack.topper.label} on top`);

  const rows = stack.rows.map((row, r) => {
    const levels = [];
    for (const b of layout.boxes.filter((x) => x.row === r)) {
      const game = getGame(b.gameId);
      const flags = [];
      if (b.rot) flags.push('long side out');
      if (b.side != null) flags.push('side by side');
      const entry = { gameId: b.gameId, title: game?.title ?? b.gameId, categories: game?.categories ?? [], size: formatDims(game?.dims ?? null), flags };
      if (levels.length && levels.at(-1).index === b.index) levels.at(-1).boxes.push(entry);
      else levels.push({ index: b.index, boxes: [entry] });
    }
    if (!standing) levels.reverse();
    return {
      label: stack.rows.length > 1 ? (r === 0 ? 'Front row' : 'Back row') : null,
      order: standing ? 'left to right' : 'top to bottom',
      boxes: levels.flatMap((l) => l.boxes),
    };
  });

  return {
    id: stack.id,
    shelf: ZONES[stack.zone]?.label ?? stack.zone,
    size: `${num(layout.w)} × ${num(layout.h)} cm`,
    count: gameCount(stack),
    tags,
    notes: [...(stack.notes ?? [])],
    rows,
  };
}
