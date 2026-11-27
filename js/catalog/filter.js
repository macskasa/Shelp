// Catalog filtering and sorting: plain functions, no DOM, tested in Node. Owner: Peter (Part C). Story A6.
//
// An *entry* is one catalog row's data: { game, kind, where }
//   kind:  'shelf' | 'cupboard' | 'inside' | 'unplaced'   (what the location filter looks at)
//   where: short location text – "B3", "Cupboard", "In Lairs", "Not placed"
// A *state* is the filter + sort settings; it is saved in the URL, see stateFromParams / stateToParams.
import { CATEGORY_IDS } from '../core/categories.js';

export const TIME_STEPS = [15, 30, 60, 120]; // "play time ≤ N min"
export const CAT_FILTER_IDS = [...CATEGORY_IDS, 'other']; // 'other' = games without any category
export const WHERE_OPTIONS = [
  ['any', 'Anywhere'],
  ['shelf', 'On a shelf'],
  ['cupboard', 'In the cupboard'],
  ['inside', 'Inside a box'],
  ['unplaced', 'Not placed'],
];
export const SORT_KEYS = ['title', 'players', 'time', 'where'];

export const DEFAULT_STATE = Object.freeze({
  cats: [], players: null, time: null, where: 'any', sizeMissing: false, sort: 'title', dir: 'asc',
});

// ---------------------------------------------------------------- entries

/** The part of a location the filter cares about. */
export function locationKind(loc) {
  switch (loc?.kind) {
    case 'stack': return 'shelf';
    case 'cupboard': return 'cupboard';
    case 'inside': return 'inside';
    default: return 'unplaced';
  }
}

/** "B3", "Cupboard", "In Lairs", "Not placed". getTitle(id) turns a game id into its title. */
export function shortLocation(loc, getTitle = (id) => id) {
  switch (loc?.kind) {
    case 'stack': return loc.stackId;
    case 'cupboard': return 'Cupboard';
    case 'inside': return `In ${getTitle(loc.hostId)}`;
    default: return 'Not placed';
  }
}

export function makeEntry(game, loc, getTitle) {
  return { game, kind: locationKind(loc), where: shortLocation(loc, getTitle) };
}

// ---------------------------------------------------------------- state <-> URL params

const asInt = (v) => (/^\d{1,3}$/.test(String(v ?? '')) ? Number(v) : null);

/** URL params (strings) -> state. Anything invalid or missing falls back to the default. */
export function stateFromParams(params = {}) {
  const wanted = new Set(String(params.cat ?? '').split(','));
  const players = asInt(params.players);
  const time = asInt(params.time);
  return {
    cats: CAT_FILTER_IDS.filter((id) => wanted.has(id)),
    players: players >= 1 ? players : null,
    time: TIME_STEPS.includes(time) ? time : null,
    where: WHERE_OPTIONS.some(([id]) => id === params.where) ? params.where : 'any',
    sizeMissing: params.nosize === '1',
    sort: SORT_KEYS.includes(params.sort) ? params.sort : 'title',
    dir: params.dir === 'desc' ? 'desc' : 'asc',
  };
}

/** state -> URL params. Settings that are at their default are left out. */
export function stateToParams(state) {
  const p = {};
  if (state.cats.length) p.cat = state.cats.join(',');
  if (state.players != null) p.players = state.players;
  if (state.time != null) p.time = state.time;
  if (state.where !== 'any') p.where = state.where;
  if (state.sizeMissing) p.nosize = '1';
  if (state.sort !== 'title') p.sort = state.sort;
  if (state.dir !== 'asc') p.dir = state.dir;
  return p;
}

/** How many filters are switched on (the sort does not count). */
export function activeFilterCount(state) {
  return (state.cats.length ? 1 : 0) + (state.players != null) + (state.time != null)
    + (state.where !== 'any') + (state.sizeMissing ? 1 : 0);
}

// ---------------------------------------------------------------- filtering

/** Does the game have one of the wanted categories? 'other' means "none of the known categories". */
function hasCategory(game, wanted) {
  const own = game.categories ?? [];
  return wanted.some((id) => (id === 'other' ? !own.some((c) => CATEGORY_IDS.includes(c)) : own.includes(id)));
}

/** True if the entry passes every filter that is switched on. Games with unknown players or time never pass those two. */
export function matches(entry, state) {
  const g = entry.game;
  if (state.cats.length && !hasCategory(g, state.cats)) return false;
  if (state.players != null && !(g.players && g.players.min <= state.players && state.players <= g.players.max)) return false;
  if (state.time != null && !(g.time && g.time.max <= state.time)) return false; // the whole range fits
  if (state.where !== 'any' && entry.kind !== state.where) return false;
  if (state.sizeMissing && g.dims !== null) return false;
  return true;
}

// ---------------------------------------------------------------- sorting

const collator = new Intl.Collator('hu', { sensitivity: 'base', numeric: true });

/** The title as it sorts: a leading "A ", "Az " or "The " is ignored, so "A jelszó" sorts under J. */
export function sortTitle(title) {
  return title.replace(/^(?:az|a|the)\s+(?=\S)/i, '');
}

// A key is a string or a list of numbers; null = unknown (always sorted last, whatever the direction).
const KEYS = {
  title: (e) => sortTitle(e.game.title),
  players: (e) => (e.game.players ? [e.game.players.min, e.game.players.max] : null),
  time: (e) => (e.game.time ? [e.game.time.max, e.game.time.min] : null),
  where: (e) => e.where,
};

function compareKeys(a, b) {
  if (typeof a === 'string') return collator.compare(a, b);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const byTitle = (x, y) => collator.compare(sortTitle(x.game.title), sortTitle(y.game.title));

/** Sorted copy. Ties are broken by title (always A→Z). Titles sort without a leading A / Az / The. */
export function sortEntries(entries, sort = 'title', dir = 'asc') {
  const key = KEYS[sort] ?? KEYS.title;
  const sign = dir === 'desc' ? -1 : 1;
  return [...entries].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    if (a == null || b == null) {
      if (a == null && b == null) return byTitle(x, y);
      return a == null ? 1 : -1;
    }
    return sign * compareKeys(a, b) || byTitle(x, y);
  });
}

/** "1 game", "37 games" */
export function countLabel(n) {
  return `${n} game${n === 1 ? '' : 's'}`;
}
