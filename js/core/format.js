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

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Human text for a location from store.locate(). getTitle(id) turns ids into titles.
 * Examples:
 *   "Bottom shelf · stack B3 · 2nd from the bottom · 3 boxes on top"
 *   "Inside the Lairs box (Bottom shelf · stack B4 · …)"
 *   "Cupboard – You said it can go to the cupboard"
 */
export function describeLocation(loc, getTitle = (id) => id) {
  if (!loc) return 'Unknown game';
  switch (loc.kind) {
    case 'stack': {
      const zone = ZONES[loc.zone]?.label ?? loc.zone;
      const parts = [zone, `stack ${loc.stackId}`];
      if (loc.rows > 1) parts.push(loc.row === 0 ? 'front row' : 'back row');
      if (loc.orientation === 'standing') {
        parts.push(`${ordinal(loc.index + 1)} from the left`);
      } else {
        parts.push(loc.index === 0 ? 'at the bottom' : `${ordinal(loc.index + 1)} from the bottom`);
        if (loc.side != null) parts.push('side by side');
        parts.push(loc.above.length ? `${loc.above.length} box${loc.above.length > 1 ? 'es' : ''} on top` : 'on top');
      }
      return parts.join(' · ');
    }
    case 'inside':
      return `Inside the ${getTitle(loc.hostId)} box (${describeLocation(loc.host, getTitle)})`;
    case 'cupboard':
      return loc.reason ? `Cupboard – ${loc.reason}` : 'Cupboard';
    default:
      return 'Not placed yet';
  }
}
