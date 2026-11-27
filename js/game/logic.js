// Game panel logic (stories A3, A5, B1). Plain functions, no DOM, tested in Node. Owner: Stephen (Part A).
import { CATEGORY_IDS } from '../core/categories.js';

const BGG = 'https://boardgamegeek.com';

// ---------------------------------------------------------------- box size (A3)

/**
 * Parse a number typed on a phone. Accepts "22.6" and "22,6" (Hungarian keyboard).
 * Returns a positive number, or NaN if the text is not one clean positive number.
 */
export function parseDecimal(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return NaN;
  const n = Number(t);
  return n > 0 ? n : NaN;
}

/**
 * Turn the three size inputs into a store patch.
 *   all three empty        -> { dims: null }   (size missing)
 *   three valid numbers    -> { dims: [..] }   sorted smallest first
 *   anything else          -> { error: 'text for the user' }, plus incomplete: true when some boxes are still empty
 * Returns { dims } or { error, incomplete? }.
 */
export function parseDims(texts) {
  const parts = texts.map((t) => String(t ?? '').trim());
  if (parts.every((p) => p === '')) return { dims: null };
  if (parts.some((p) => p === '')) return { error: 'Not saved yet – fill in all three sizes, or leave all three empty.', incomplete: true };
  const nums = parts.map(parseDecimal);
  if (nums.some(Number.isNaN)) return { error: 'Sizes must be positive numbers in cm, like 22.6 or 22,6.' };
  return { dims: nums.sort((a, b) => a - b) };
}

/** Text for the three inputs: largest first, like formatDims shows it. Missing size -> three empty strings. */
export function dimsToInputs(dims) {
  if (!dims) return ['', '', ''];
  return [...dims].sort((a, b) => b - a).map((n) => String(Math.round(n * 100) / 100));
}

export const sameDims = (a, b) => (a == null || b == null)
  ? a == b // eslint-disable-line eqeqeq
  : a.length === b.length && [...a].sort((x, y) => x - y).every((n, i) => n === [...b].sort((x, y) => x - y)[i]);

/** Empty or blank text becomes null (for sizeSource and notes). */
export const textOrNull = (text) => {
  const t = String(text ?? '').trim();
  return t === '' ? null : t;
};

/** The different "where the size came from" texts already used, most used first. For suggestions. */
export function sizeSources(games) {
  const count = new Map();
  for (const g of games) if (g.sizeSource) count.set(g.sizeSource, (count.get(g.sizeSource) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** A game's name as typed: trimmed, or null when blank (a game must have a name). */
export const cleanTitle = (text) => String(text ?? '').trim() || null;

// ---------------------------------------------------------------- categories (B1)

/** Add or remove one category. Returns the new list in the fixed category order. */
export function toggleCategory(categories, id) {
  const next = categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id];
  return CATEGORY_IDS.filter((c) => next.includes(c));
}

// ---------------------------------------------------------------- inside another box (A5)

/** Ids of the games stored inside this box, in title order. */
export function gamesInside(plan, hostId, games) {
  const order = new Map(games.map((g, i) => [g.id, i]));
  return Object.entries(plan.inside)
    .filter(([, host]) => host === hostId)
    .map(([id]) => id)
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/**
 * Which boxes can this game be stored in? Only one level of nesting is allowed:
 * a box that is itself inside another box cannot be a host, and a box that holds others cannot go inside.
 * Returns { hosts: Game[] } or { blocked: 'why' }.
 */
export function hostChoices(gameId, games, plan) {
  if (gamesInside(plan, gameId, games).length) {
    return { blocked: 'Other boxes are stored inside this one, so it cannot go inside another box.' };
  }
  return { hosts: games.filter((g) => g.id !== gameId && !plan.inside[g.id]) };
}

/** The cupboard reason used when a game is taken out of its host box. */
export const takenOutReason = (hostTitle) => `Taken out of the ${hostTitle} box`;

// ---------------------------------------------------------------- BoardGameGeek links

export const bggPage = (g) => (g.bggId ? `${BGG}/boardgame/${g.bggId}` : null);
export const bggVersions = (g) => (g.bggId ? `${BGG}/boardgame/${g.bggId}/versions` : null);
export const bggSearch = (g) =>
  `${BGG}/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(g.bggName || g.title)}`;
