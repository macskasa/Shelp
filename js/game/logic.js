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

// ---------------------------------------------------------------- adding a game by hand (A4)

const wholeNumber = (text) => {
  const t = String(text ?? '').trim();
  return /^\d+$/.test(t) && Number(t) > 0 ? Number(t) : NaN;
};

/** BGG id from text: '' -> { id: null }, "342942" -> { id: 342942 }, anything else -> { error }. */
export function parseBggId(text) {
  const t = String(text ?? '').trim();
  if (t === '') return { id: null };
  const id = wholeNumber(t);
  return Number.isNaN(id) ? { error: 'The BGG id is a whole number, like 342942.' } : { id };
}

/**
 * A range from two boxes (players, play time): both empty -> { value: null }; only the first -> a single value (2 -> 2–2);
 * both -> { min, max }; anything else -> { error }.
 */
export function parseRange(minText, maxText, what) {
  const a = String(minText ?? '').trim();
  const b = String(maxText ?? '').trim();
  if (a === '' && b === '') return { value: null };
  if (a === '') return { error: `Fill in the lowest ${what} too.` };
  const min = wholeNumber(a);
  const max = b === '' ? min : wholeNumber(b);
  if (Number.isNaN(min) || Number.isNaN(max)) return { error: `The ${what} must be whole numbers, like 2 and 4.` };
  if (min > max) return { error: `The lowest ${what} cannot be more than the highest.` };
  return { value: { min, max } };
}

/** The game that already has this BGG id, if any. */
export const findByBggId = (games, bggId) => (bggId == null ? undefined : games.find((g) => g.bggId === bggId));

/**
 * The "Add a game" form as typed:
 *   { title, bggId, dims: [a, b, c], players: [min, max], time: [min, max], type, categories, inBgg }
 * -> { fields } for store.addGame, or { errors } with a message for each field that is wrong
 * (keys: title, bggId, dims, players, time).
 */
export function parseGameForm(form) {
  const errors = {};
  const title = cleanTitle(form.title);
  if (!title) errors.title = 'A game needs a name.';
  const bgg = parseBggId(form.bggId);
  if (bgg.error) errors.bggId = bgg.error;
  const size = parseDims(form.dims);
  if (size.error) errors.dims = size.error.replace('Not saved yet – f', 'F');
  const players = parseRange(form.players[0], form.players[1], 'number of players');
  if (players.error) errors.players = players.error;
  const time = parseRange(form.time[0], form.time[1], 'play time');
  if (time.error) errors.time = time.error;
  if (Object.keys(errors).length) return { errors };
  return {
    fields: {
      title,
      bggId: bgg.id,
      type: form.type === 'expansion' ? 'expansion' : 'base',
      dims: size.dims,
      players: players.value,
      time: time.value,
      categories: CATEGORY_IDS.filter((c) => form.categories.includes(c)),
      inBgg: !!form.inBgg,
    },
  };
}

/**
 * Switch the pizza flag ("may only lie flat") through the store. The store refuses to switch it on for a game
 * that stands or lies on its side on a shelf; its message is passed on as it is.
 * Returns { ok: true } or { ok: false, message, pizza } where pizza is what is really stored.
 * `store` is js/core/store.js (anything with updateGame and getGame).
 */
export function setPizza(store, id, on) {
  try {
    store.updateGame(id, { pizza: !!on });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message, pizza: store.getGame(id)?.pizza === true };
  }
}
