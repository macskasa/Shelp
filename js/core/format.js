// Shared text formatting, so every screen says things the same way. Owner: Tony (lead).
import { ZONES } from './shelves.js';

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });

/** [5.1, 22.6, 30.5] -> "30.5 × 22.6 × 5.1 cm"; null -> "size missing" */
export function formatDims(dims) {
  if (!dims) return 'size missing';
  return `${[...dims].sort((a, b) => b - a).map(num).join(' × ')} cm`;
}

/** {min: 2, max: 4} -> "2–4"; {min: 2, max: 2} -> "2"; null -> "" */
export function formatRange(r, unit = '') {
  if (!r) return '';
  const t = r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
  return unit ? `${t} ${unit}` : t;
}

const POSE = { m: 'on its side', l: 'standing' };

/**
 * Human text for a v2 location from store.locate2(). getTitle(id) turns ids into titles.
 * Examples:
 *   "Bottom shelf · stack B3 · on Legacy of Yu · 2 boxes on top"
 *   "Bottom shelf · stack B5 · back row · on the shelf · nothing on top"
 *   "Under the stairs – card games · stack L1 · standing on the shelf · nothing on top"
 *   "Middle shelf · stack M2 · across Kerge futam and Acélmágnás · on top"
 *   "On the board"
 */
export function describeLocation2(loc, getTitle = (id) => id) {
  if (!loc) return 'Unknown game';
  switch (loc.kind) {
    case 'stack': {
      const parts = [ZONES[loc.zone]?.label ?? loc.zone, `stack ${loc.stackId}`];
      if (loc.rows > 1) parts.push(loc.row === 0 ? 'front row' : 'back row');
      const pose = POSE[loc.up] ? `${POSE[loc.up]} ` : '';
      if (!loc.on.length) parts.push(`${pose}on the shelf`);
      else if (loc.on.length === 1) parts.push(`${pose}on ${getTitle(loc.on[0])}`);
      else parts.push(`${pose}across ${getTitle(loc.on[0])} and ${getTitle(loc.on[1])}`);
      const n = loc.above.length;
      parts.push(n ? `${n} box${n > 1 ? 'es' : ''} on top` : 'nothing on top');
      return parts.join(' · ');
    }
    case 'inside':
      return `Inside the ${getTitle(loc.hostId)} box (${describeLocation2(loc.host, getTitle)})`;
    case 'cupboard':
      return loc.reason ? `Cupboard – ${loc.reason}` : 'Cupboard';
    case 'board':
      return 'On the board';
    default:
      return 'Unknown place';
  }
}
