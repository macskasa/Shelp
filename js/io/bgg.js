// BGG collection export (story A1): parsing the CSV and matching it to the games. Plain functions, no DOM.
// Owner: Stephen (Part A).
import { formatRange } from '../core/format.js';
import { parseCsv } from './csv.js';

const REQUIRED = ['objectid', 'objectname', 'own'];

const wholeNumber = (v) => {
  const t = String(v ?? '').trim();
  return /^\d+$/.test(t) ? Number(t) : 0;
};

/** {min, max} from two numbers, or null when BGG has no usable values (it writes 0 for unknown). */
const range = (min, max) => {
  const a = wholeNumber(min);
  const b = wholeNumber(max);
  return a > 0 && b >= a ? { min: a, max: b } : null;
};

/**
 * Read a BGG collection export. Only rows with own = 1 count.
 * Returns { rows, notOwned } where each row is
 *   { bggId, name, type: 'base' | 'expansion' | null, players, time, age }
 * Throws an Error with a readable message when the file is not a BGG export.
 */
export function parseBggCsv(text) {
  const table = parseCsv(text);
  if (!table.length) throw new Error('The file is empty.');
  const header = table[0].map((c) => c.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) {
    throw new Error(`This does not look like a BoardGameGeek collection export (missing column: ${missing.join(', ')}).`);
  }
  const col = (name) => header.indexOf(name);
  const at = (r, name) => (col(name) < 0 ? '' : (r[col(name)] ?? '').trim());

  const rows = [];
  const seen = new Set();
  let notOwned = 0;
  for (const r of table.slice(1)) {
    const bggId = wholeNumber(at(r, 'objectid'));
    if (!bggId) continue;
    if (at(r, 'own') !== '1') { notOwned++; continue; }
    if (seen.has(bggId)) continue; // the same game listed twice: the first row wins
    seen.add(bggId);
    const itemtype = at(r, 'itemtype');
    rows.push({
      bggId,
      name: at(r, 'objectname'),
      type: itemtype === 'expansion' ? 'expansion' : itemtype === 'standalone' ? 'base' : null,
      players: range(at(r, 'minplayers'), at(r, 'maxplayers')),
      time: range(at(r, 'minplaytime'), at(r, 'maxplaytime')),
      age: at(r, 'bggrecagerange') || null,
    });
  }
  return { rows, notOwned };
}

const sameRange = (a, b) => (a == null || b == null ? a == b : a.min === b.min && a.max === b.max); // eslint-disable-line eqeqeq

/**
 * What would the import change in a game that matches a row?
 * Only bggName, type, players, time, age (when empty) and inBgg are ever touched.
 */
export function diffGame(game, row) {
  const patch = {};
  const changes = [];
  const set = (key, value, text) => { patch[key] = value; changes.push(text); };
  if (row.name && row.name !== game.bggName) set('bggName', row.name, `BGG name “${row.name}”`);
  if (row.type && row.type !== game.type) set('type', row.type, `type ${game.type} → ${row.type}`);
  if (row.players && !sameRange(game.players, row.players)) {
    set('players', row.players, `players ${formatRange(game.players) || '–'} → ${formatRange(row.players)}`);
  }
  if (row.time && !sameRange(game.time, row.time)) {
    set('time', row.time, `play time ${formatRange(game.time, 'min') || '–'} → ${formatRange(row.time, 'min')}`);
  }
  if (row.age && !game.age) set('age', row.age, `age ${row.age}`);
  if (!game.inBgg) set('inBgg', true, 'now in BGG');
  return { patch, changes };
}

/**
 * Compare the file with the games.
 *   updates   games that match by bggId and would change: { id, title, patch, changes }
 *   unchanged number of matching games that are already up to date
 *   fresh     rows no game has the bggId of (and that were not ignored before)
 *   ignored   such rows that Adam unticked in an earlier import (meta.bggIgnored)
 *   missing   games marked as in BGG whose id is not in the file: { id, title }
 *   prevIgnored  the ids ignored so far
 */
export function planImport(rows, games, meta = {}) {
  const byBgg = new Map(games.filter((g) => g.bggId != null).map((g) => [g.bggId, g]));
  const inFile = new Set(rows.map((r) => r.bggId));
  const prevIgnored = (meta.bggIgnored ?? []).filter(Number.isInteger);
  const ignoredSet = new Set(prevIgnored);
  const updates = [];
  const fresh = [];
  const ignored = [];
  let unchanged = 0;

  for (const row of rows) {
    const game = byBgg.get(row.bggId);
    if (!game) {
      (ignoredSet.has(row.bggId) ? ignored : fresh).push(row);
      continue;
    }
    const { patch, changes } = diffGame(game, row);
    if (changes.length) updates.push({ id: game.id, title: game.title, patch, changes });
    else unchanged++;
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  const missing = games
    .filter((g) => g.inBgg && g.bggId != null && !inFile.has(g.bggId))
    .map((g) => ({ id: g.id, title: g.title }));
  return { updates, unchanged, fresh: fresh.sort(byName), ignored: ignored.sort(byName), missing, prevIgnored };
}

/** Fields for a game added from a BGG row: the BGG name is the title, Duo when it is a 2-player game. */
export function newGameFields(row) {
  return {
    title: row.name,
    bggId: row.bggId,
    bggName: row.name,
    type: row.type ?? 'base',
    players: row.players,
    time: row.time,
    age: row.age,
    categories: row.players?.max === 2 ? ['duo'] : [],
    inBgg: true,
  };
}

/**
 * Things to do after adding games from BGG, as short sentences for the "done" message.
 * rows = the BGG rows that were added.
 */
export function afterImportHints(rows) {
  if (!rows.length) return [];
  const hints = ['They are not on a shelf yet and use the BGG name as title: open a game to rename it or set its size.'];
  const expansions = rows.filter((r) => r.type === 'expansion').length;
  if (expansions) {
    hints.push(`${expansions === rows.length ? 'All' : expansions} of them ${expansions === 1 ? 'is an expansion' : 'are expansions'}: if one lives in its base game's box, open it and set “Stored inside”.`);
  }
  return hints;
}
