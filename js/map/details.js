// What the stack details panel shows (stories C3, B2.2). Pure, no DOM, so Node can test it. Owner: Bruce.
// Schema 2: a stack is a tree of boxes resting on the shelf, on one box, or across two (a bridge).
import { ZONES } from '../core/shelves.js';
import { formatDims } from '../core/format.js';

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
const POSE = { m: 'on its side', l: 'standing' };

/** Accessible name of a stack on the map: "Stack B3, Bottom shelf, 5 games". */
export function stackAriaLabel(id, zone, count) {
  return `Stack ${id}, ${ZONES[zone]?.label ?? zone}, ${count} game${count === 1 ? '' : 's'}`;
}

/** What a box rests on: "on the shelf", "on Takenokolor", "across Compile: Main 2 and Kontroll". */
export function restsOn(on, getTitle) {
  if (!on.length) return 'on the shelf';
  if (on.length === 1) return `on ${getTitle(on[0])}`;
  return `across ${getTitle(on[0])} and ${getTitle(on[1])}`;
}

/**
 * Everything the panel lists for one v2 stack.
 * @param stack    store.getStack2(id)
 * @param layout   layoutStack2(stack, getGame) from js/core/geometry.js
 * @param getGame  id → game
 * @returns {{ id, shelf, size, count, tags: string[], notes: string[],
 *   rows: [{ label: 'Front row' | 'Back row' | null,
 *            boxes: [{ gameId, title, categories, size, rests, flags: string[] }] }] }}
 * Boxes run top to bottom by height (y, where the box sits; same height: left to right, so
 * standing card games read like the shelf), front row first. flags: "standing" / "on its side" when not flat, and "long side out".
 */
export function stackDetails(stack, layout, getGame) {
  const title = (id) => getGame(id)?.title ?? id;
  const tags = [];
  if (layout.rows > 1) tags.push('2 deep');
  if (stack.topper) tags.push(`${stack.topper.label} on top`);

  const rows = [];
  for (let r = 0; r < layout.rows; r++) {
    const boxes = layout.boxes
      .filter((b) => b.row === r)
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((b) => {
        const game = getGame(b.gameId);
        const flags = [];
        if (POSE[b.up]) flags.push(POSE[b.up]);
        if (b.rot) flags.push('long side out');
        return {
          gameId: b.gameId, title: title(b.gameId), categories: game?.categories ?? [],
          size: formatDims(game?.dims ?? null), rests: restsOn(b.on, title), flags,
        };
      });
    rows.push({ label: layout.rows > 1 ? (r === 0 ? 'Front row' : 'Back row') : null, boxes });
  }

  return {
    id: stack.id,
    shelf: ZONES[stack.zone]?.label ?? stack.zone,
    size: `${num(layout.w)} × ${num(layout.h)} cm`,
    count: stack.boxes.length,
    tags,
    notes: [...(stack.notes ?? [])],
    rows,
  };
}
