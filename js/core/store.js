// The single source of truth for games and the shelf plan. Owner: Tony (lead).
//
// Rules for everyone:
//  - Read with the getters. What they return is FROZEN – never mutate it.
//  - Change data only with the write functions below. Each write saves to localStorage
//    and emits 'store:changed' on the bus (see bus.js). Re-render from the store when it fires.
//  - Write functions throw an Error with a readable message when a change is not allowed.
//    Catch it and show the message to the user.
//  - Use batch(() => { ... }) for many writes at once (e.g. a CSV import): one save, one event,
//    one undo step, and everything is rolled back if the function throws.
//
// Data is stored in plan format v2 (schema 2: boxes with positions, games on games, bridges,
// the board, the pizza flag; see js/core/plan2.js and docs/CONTEXT.md). Schema 1 files (old
// backups, plan files from chat) are upgraded on load and import.
//
// Saved versions (D6) are named copies of games + plan, kept under their own key and in full
// backups. Saving, renaming and deleting them are not undo steps; switching to one is.
import { emit } from './bus.js';
import {
  APP, MAX_VERSIONS, SCHEMA, VERSION_NAME_MAX, checkData, checkVersions, cleanFamily, knownFrom, validateGame,
} from './schema.js';
import { ZONES } from './shelves.js';
import { wallPush } from './space.js';
import {
  detach as detach2, findBox, insertOn, insertUnder, joinStacks as join2, locations2, nextStackId, renumber,
  turnBox as turn2,
} from './plan2.js';

export const STORAGE_KEY = 'shelp:data:v1'; // the key name stays; the data inside is schema 2
const BROKEN_KEY = 'shelp:data:broken';
export const VERSIONS_KEY = 'shelp:versions:v1';
export { MAX_VERSIONS };
const SEED_URL = new URL('../../data/seed.json', import.meta.url);
const HISTORY = 30;

let data = null; // private, mutable, schema 2: { app, schema, games: [], plan: {}, meta: {} }
let snap = null; // frozen copy handed out to readers
let byId = new Map();
let where2 = new Map();
let board = []; // ids on the board, in order: moved there explicitly, then games with no place at all
let families = []; // [{ name, ids }] by name, frozen (B2)
let seedCache = null;
let storage = null;
let depth = 0;
let pending = null;
let backup = null;
let committed = null; // games + plan as of the last commit (for undo)
let undoStack = [];
let redoStack = [];
let previewing = false;
let versions = []; // saved versions, oldest first: { id, name, savedAt, games, plan } (schema 2)

// ---------------------------------------------------------------- setup

/**
 * Load saved data from localStorage, or the bundled seed on first run.
 * Saved data in the old format is upgraded to schema 2.
 * Options (for tests): { seed: object, storage: {getItem, setItem, removeItem} }
 */
export async function init({ seed, storage: st } = {}) {
  storage = st ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (seed) seedCache = structuredClone(seed);
  let loaded = null;
  let upgraded = false;
  const raw = storage?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      const { problems, data: ok } = checkData(obj);
      if (problems.length) throw new Error(problems.slice(0, 3).join('; '));
      loaded = ok;
      upgraded = obj.schema !== SCHEMA;
    } catch (err) {
      console.error('[store] saved data is broken, starting from the seed', err);
      storage.setItem(BROKEN_KEY, raw);
    }
  }
  data = loaded ?? (await loadSeed());
  data.meta ??= {};
  undoStack = [];
  redoStack = [];
  committed = structuredClone({ games: data.games, plan: data.plan });
  versions = loadVersions();
  rebuild();
  if (!loaded || upgraded) save();
  return snap;
}

function loadVersions() {
  const raw = storage?.getItem(VERSIONS_KEY);
  if (!raw) return [];
  try {
    const { problems, versions: ok } = checkVersions(JSON.parse(raw));
    if (problems.length) console.error('[store] some saved versions are broken and were left out', problems.slice(0, 3));
    return ok;
  } catch (err) {
    console.error('[store] saved versions are broken', err);
    return [];
  }
}

async function loadSeed() {
  if (!seedCache) {
    const res = await fetch(SEED_URL);
    if (!res.ok) throw new Error(`Could not load the seed data (${res.status})`);
    seedCache = await res.json();
  }
  const { problems, data: ok } = checkData(structuredClone(seedCache));
  if (problems.length) throw new Error(`Seed data is invalid: ${problems[0]}`);
  return ok;
}

// ---------------------------------------------------------------- reads

/** All games, sorted by title (Hungarian collation). Frozen. Each has `pizza`. */
export function getGames() {
  return snap.games;
}

/** One game by id, or undefined. Frozen. */
export function getGame(id) {
  return byId.get(id);
}

/** Free-form app metadata, e.g. { lastImport: "2026-11-27T10:00:00Z" }. Frozen. */
export function getMeta() {
  return snap.meta;
}

/** v2: the whole plan { name, stacks: [{ id, zone, x, boxes, topper?, notes? }], cupboard, inside, board }. Frozen. */
export function getPlan2() {
  return snap.plan;
}

/** v2: one stack by id, or undefined. Frozen. */
export function getStack2(id) {
  return snap.plan.stacks.find((s) => s.id === id);
}

/**
 * v2: where is a game? One of:
 *  { kind: 'stack', stackId, zone, row, rows, x, up, rot, on, above, below }
 *      on: what it rests on ([] = the shelf floor, two ids = across two boxes)
 *      above: every box resting on it, directly or higher up, nearest first; below: everything under it
 *  { kind: 'inside', hostId, host }   { kind: 'cupboard', reason }   { kind: 'board', index }
 *  null for an unknown id
 */
export function locate2(id) {
  if (!byId.has(id)) return null;
  return where2.get(id) ?? { kind: 'board', index: board.indexOf(id) };
}

/**
 * v2: the games on the board, in order. The board holds every game that has no other place:
 * games moved there (in the order they arrived), then games that never had a place (e.g. new
 * from a BGG import), by title. Frozen list of ids.
 */
export function getBoard() {
  return board;
}

/**
 * Game families (B2): [{ name, ids }], sorted by name; ids in title order. A family with one game counts.
 * Frozen. Games without a family are not listed.
 */
export function getFamilies() {
  return families;
}

/** Everything as one plain (mutable) object – this is the backup file format (schema 2). */
export function exportData() {
  const out = { app: APP, exportedAt: new Date().toISOString(), ...structuredClone(stripSnap(data)), schema: SCHEMA };
  if (versions.length) out.versions = structuredClone(versions); // only when there are any (see importData)
  return out;
}

/** Check a backup or plan file (schema 1 or 2) before importing. Returns a list of problems (empty = OK). */
export function validate(obj) {
  return checkData(obj, knownFrom(data.games)).problems;
}

/** Can the last change be undone / redone? */
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

// ---------------------------------------------------------------- writes: games

/**
 * Change fields of a game. `id` cannot change. Throws if the result is invalid.
 * A game on a stack cannot lose its size, and cannot become pizza while it stands or lies on its side.
 * `family` is cleaned (trimmed, '' → null) and takes the spelling of an existing family that differs
 * only in letter case ("azul" joins "Azul"). To rename a whole family, use renameFamily.
 */
export function updateGame(id, patch) {
  const i = indexOf(id);
  if ('id' in patch && patch.id !== id) throw new Error('The id of a game cannot change');
  const next = { ...data.games[i], ...structuredClone(patch) };
  if (next.dims) next.dims = [...next.dims].sort((a, b) => a - b);
  if ('family' in patch) next.family = sameFamily(patch.family, id);
  check(validateGame(next));
  const onShelf = findBox(data.plan, id)?.box;
  if (next.dims == null && onShelf) {
    throw new Error(`${next.title} is on a shelf, so its box size cannot be removed. Move it to the cupboard or the board first.`);
  }
  if (next.pizza && onShelf && onShelf.up !== 's') {
    throw new Error(`${next.title} does not lie flat on the shelf. Turn it flat first, then mark it as a pizza game.`);
  }
  data.games[i] = next;
  changed({ games: [id] });
}

/** Add a game. Only `title` is required. Returns the new id. It has no place yet, so it is on the board; pizza by default. */
export function addGame(fields) {
  const id = nextId();
  const game = {
    id, title: '', bggId: null, bggName: null, type: 'base', dims: null, sizeSource: null,
    players: null, time: null, age: null, categories: [], inBgg: false, notes: null, pizza: true, family: null,
    ...structuredClone(fields),
  };
  game.id = id;
  game.family = sameFamily(game.family, id);
  if (game.dims) game.dims = [...game.dims].sort((a, b) => a - b);
  check(validateGame(game));
  data.games.push(game);
  changed({ games: [id], plan: false });
  return id;
}

/** Delete a game everywhere. Boxes stored inside it go to the cupboard; boxes on top of it settle down. */
export function removeGame(id) {
  const i = indexOf(id);
  const title = data.games[i].title;
  detach2(data.plan, id, rawGame);
  for (const [exp, host] of Object.entries(data.plan.inside)) {
    if (host === id) {
      delete data.plan.inside[exp];
      data.plan.cupboard.push({ game: exp, reason: `Was stored inside the ${title} box` });
    }
  }
  data.games.splice(i, 1);
  changed({ games: [id], plan: true });
}

/**
 * Rename a family on every game in it: one undo step. Returns how many games changed.
 * The new name is cleaned like updateGame's; an existing family's name merges the two (any letter case);
 * null or '' takes the family off all its games. Throws if no game has that family.
 */
export function renameFamily(name, newName) {
  const from = cleanFamily(name);
  const members = data.games.filter((g) => from != null && g.family === from);
  if (!members.length) throw new Error(`No game is in the family "${name}"`);
  const ids = new Set(members.map((g) => g.id));
  const to = sameFamily(newName, ids);
  check(validateGame({ ...members[0], family: to }));
  for (const g of members) g.family = to;
  changed({ games: [...ids], plan: false });
  return members.length;
}

// ---------------------------------------------------------------- writes: plan (v2)

/** Put a game on the board (from wherever it is). Boxes that were on top of it settle down. */
export function moveToBoard(id) {
  indexOf(id);
  detach2(data.plan, id, rawGame);
  data.plan.board.push({ game: id });
  changed({ games: [id], plan: true });
}

/** Put a game in the cupboard (from wherever it is). */
export function moveToCupboard(id, reason = '') {
  indexOf(id);
  detach2(data.plan, id, rawGame);
  data.plan.cupboard.push({ game: id, reason });
  changed({ games: [id], plan: true });
}

/**
 * v2: put a game on a stack (from wherever it is).
 * target = { stackId, row = 0, on = [], index, up = 's', rot = false }
 *   on: [] = on the shelf floor, [id] = on top of that box, [a, b] = across two boxes (a bridge)
 *   index: position among the boxes already on that surface, left to right (default: right end);
 *          the boxes to its right move over.
 * Refused: a game without a box size; a pizza game that does not lie flat (up must be 's').
 * Nothing else is checked here – that is the rule checker's job (js/rules/).
 */
export function placeBox(id, target) {
  const game = mustPlaceable(id, target.up ?? 's');
  if (!data.plan.stacks.some((s) => s.id === target.stackId)) throw new Error(`There is no stack ${target.stackId}`);
  for (const s of target.on ?? []) if (s === id) throw new Error('A box cannot rest on itself');
  detach2(data.plan, id, rawGame);
  insertOn(data.plan, rawGame, id, { ...target, up: target.up ?? 's', rot: !!target.rot });
  changed({ games: [game.id], plan: true });
}

/**
 * v2: slide a game in UNDER other boxes. It takes their place and they rest on it.
 * targets: ids of one box, or of boxes side by side on one surface.
 */
export function placeUnder(id, targets, { up = 's', rot = false } = {}) {
  const game = mustPlaceable(id, up);
  if (targets.includes(id)) throw new Error('A box cannot go under itself');
  detach2(data.plan, id, rawGame);
  insertUnder(data.plan, rawGame, id, targets, { up, rot });
  changed({ games: [game.id], plan: true });
}

/**
 * v2: turn a box on a shelf. up: 's' flat, 'm' on its side, 'l' on end; rot: which way round.
 * A pizza game can only lie flat (it can still be turned with rot).
 */
export function turnBox(id, { up, rot } = {}) {
  const game = data.games[indexOf(id)];
  const onShelf = findBox(data.plan, id)?.box;
  if (!onShelf) throw new Error(`${game.title} is not on a shelf`);
  const nextUp = up ?? onShelf.up;
  if (game.pizza && nextUp !== 's') throw new Error(`${game.title} is a pizza game: it can only lie flat (you can still turn it round).`);
  turn2(data.plan, rawGame, id, { up: nextUp, rot });
  changed({ games: [id], plan: true });
}

/** v2: a new empty stack on a shelf at x (cm from the shelf's left end). Returns its id, e.g. "T10". */
export function createStack(zoneId, { x = 0 } = {}) {
  if (!ZONES[zoneId]) throw new Error(`Unknown shelf ${zoneId}`);
  if (!(Number.isFinite(x) && x >= 0)) throw new Error('x must be a number ≥ 0');
  const id = nextStackId(data.plan, zoneId);
  data.plan.stacks.push({ id, zone: zoneId, x: Math.round(x * 100) / 100, boxes: [] });
  changed({ games: [], plan: true });
  return id;
}

/** v2: move a whole stack along its shelf. */
export function moveStack(stackId, x) {
  const st = mustStack(stackId);
  if (!(Number.isFinite(x) && x >= 0)) throw new Error('x must be a number ≥ 0');
  st.x = Math.round(x * 100) / 100;
  changed({ games: [], plan: true });
}

/**
 * v2: push the stacks of a wall shelf's wall-end unit to the wall (#100), using the 8 cm overhang:
 * see wallPush() in space.js. One undo step. Returns the Push; throws when nothing would move.
 */
export function pushToWall(zoneId) {
  const push = wallPush(data.plan, rawGame, zoneId);
  if (!push) throw new Error(`The stacks on the ${(ZONES[zoneId]?.label ?? zoneId).toLowerCase()} are as close to the wall as they can go`);
  for (const m of push.moves) mustStack(m.stackId).x = m.to;
  changed({ games: [], plan: true });
  return push;
}

/** v2: remove a stack. Its games go to the board (bottom first). */
export function removeStack(stackId) {
  const st = mustStack(stackId);
  const ids = [...st.boxes].sort((a, b) => a.on.length - b.on.length || a.x - b.x).map((b) => b.game);
  data.plan.stacks = data.plan.stacks.filter((s) => s !== st);
  for (const id of ids) data.plan.board.push({ game: id });
  changed({ games: ids, plan: true });
}

/**
 * v2: join two neighbouring stacks of one shelf into one, every box staying where it is on the shelf.
 * The left one keeps its id; the right one is gone. Then a box can rest across the tops of both.
 * Refused: another shelf, a stack between them, stacks that overlap, a topper on either. Returns the id.
 */
export function joinStacks(aId, bId) {
  const id = join2(data.plan, rawGame, aId, bId);
  changed({ games: [], plan: true });
  return id;
}

/** v2: rename every shelf's stacks left to right (T1, T2, …). Returns { oldId: newId } for those that changed. */
export function renumberStacks() {
  const map = renumber(data.plan);
  changed({ games: [], plan: true });
  return map;
}

/** Store an expansion inside another game's box. It takes no shelf space. */
export function setInside(id, hostId) {
  indexOf(id);
  indexOf(hostId);
  if (id === hostId) throw new Error('A box cannot go inside itself');
  if (data.plan.inside[hostId]) throw new Error(`${title(hostId)} is itself inside another box`);
  if (Object.values(data.plan.inside).includes(id)) {
    throw new Error(`Other boxes are stored inside ${title(id)} – take them out first`);
  }
  detach2(data.plan, id, rawGame);
  data.plan.inside[id] = hostId;
  changed({ games: [id], plan: true });
}

/** Undo the last change (games and plan; metadata is kept). Returns false if there is nothing to undo. */
export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(structuredClone({ games: data.games, plan: data.plan }));
  restore(undoStack.pop());
  return true;
}

/** Redo the last undone change. Returns false if there is nothing to redo. */
export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(structuredClone({ games: data.games, plan: data.plan }));
  restore(redoStack.pop());
  return true;
}

// ---------------------------------------------------------------- saved versions (D6)

/** Saved versions, newest first: [{ id, name, savedAt, games, stacks }] (games and stacks are counts). Frozen. */
export function listVersions() {
  return deepFreeze([...versions].reverse().map((v) => ({
    id: v.id, name: v.name, savedAt: v.savedAt, games: v.games.length, stacks: v.plan.stacks.length,
  })));
}

/** One saved version with its data: { id, name, savedAt, games, plan } (schema 2), frozen. null if unknown. */
export function getVersion(id) {
  const v = versions.find((x) => x.id === id);
  return v ? deepFreeze(structuredClone(v)) : null;
}

/**
 * Save the current games and plan under a name (1–60 characters). Returns the new id ("v4").
 * Refused when MAX_VERSIONS (10) are saved. Not an undo step; fires store:changed with versions: true.
 */
export function saveVersion(name) {
  notInPreviewOrBatch('saveVersion()');
  const clean = versionName(name);
  if (versions.length >= MAX_VERSIONS) throw new Error(`${MAX_VERSIONS} saved versions is the most. Delete one to save another.`);
  const id = `v${Math.max(0, ...versions.map((v) => Number(/^v(\d+)$/.exec(v.id)?.[1] ?? 0))) + 1}`;
  const copy = structuredClone({ games: data.games, plan: data.plan });
  storeVersions([...versions, { id, name: clean, savedAt: new Date().toISOString(), ...copy }]);
  return id;
}

/** Switch to a saved version: its games and plan replace the current ones (metadata stays). One undo step. */
export function restoreVersion(id) {
  const v = mustVersion(id);
  data.games = structuredClone(v.games);
  data.plan = normalizePlan(structuredClone(v.plan));
  changed({ games: null, plan: true });
}

/** Rename a saved version. Not an undo step. */
export function renameVersion(id, name) {
  notInPreviewOrBatch('renameVersion()');
  const v = mustVersion(id);
  const clean = versionName(name);
  storeVersions(versions.map((x) => (x === v ? { ...x, name: clean } : x)));
}

/** Delete a saved version. Not an undo step. */
export function deleteVersion(id) {
  notInPreviewOrBatch('deleteVersion()');
  const v = mustVersion(id);
  storeVersions(versions.filter((x) => x !== v));
}

function versionName(name) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Give the version a name');
  if (clean.length > VERSION_NAME_MAX) throw new Error(`A version name can be at most ${VERSION_NAME_MAX} characters`);
  return clean;
}

function mustVersion(id) {
  const v = versions.find((x) => x.id === id);
  if (!v) throw new Error('There is no such saved version');
  return v;
}

// Saved versions live outside `data`, so preview() and batch() could not put them back.
function notInPreviewOrBatch(what) {
  if (previewing || depth > 0) throw new Error(`${what} cannot run inside preview() or batch()`);
}

function storeVersions(next) {
  if (storage) {
    try {
      storage.setItem(VERSIONS_KEY, JSON.stringify(next));
    } catch (err) {
      throw new Error(`Could not save the versions: ${err.message}`);
    }
  }
  versions = next;
  emit('store:changed', { games: [], plan: false, versions: true });
}

/** Replace the whole plan (e.g. a plan made in chat), v1 or v2 shape. Games stay as they are. */
export function replacePlan(plan) {
  const v2 = Array.isArray(plan?.board) || (plan?.stacks ?? []).some((s) => Array.isArray(s?.boxes));
  const { problems, data: ok } = checkData({ app: APP, schema: v2 ? 2 : 1, plan: structuredClone(plan) }, knownFrom(data.games));
  check(problems);
  data.plan = normalizePlan(ok.plan);
  changed({ games: null, plan: true });
}

/**
 * Import a file (schema 1 or 2). Full file (games + plan) replaces everything; plan-only replaces the plan.
 * Saved versions: a full file that carries "versions" replaces them; any other file leaves them alone.
 * Returns 'all' or 'plan'. Throws with the list of problems if the file is invalid.
 */
export function importData(obj) {
  const { problems, data: ok } = checkData(structuredClone(obj), knownFrom(data.games));
  check(problems);
  if (ok.games && ok.versions) {
    notInPreviewOrBatch('Importing saved versions');
    storeVersions(ok.versions); // first: if this cannot be saved, nothing has changed yet
  }
  if (ok.games) {
    data = { app: APP, schema: SCHEMA, games: ok.games, plan: normalizePlan(ok.plan ?? emptyPlan()), meta: ok.meta ?? {} };
    changed({ games: null, plan: true });
    return 'all';
  }
  data.plan = normalizePlan(ok.plan);
  changed({ games: null, plan: true });
  return 'plan';
}

/** Throw away local changes and go back to the bundled seed data (can be undone). */
export async function resetToSeed() {
  const fresh = await loadSeed();
  data = { ...fresh, meta: {} };
  changed({ games: null, plan: true });
}

/** Set one metadata key (value must be JSON-safe). Not an undo step. */
export function setMeta(key, value) {
  data.meta[key] = structuredClone(value);
  changed({ games: [], plan: false, meta: true });
}

/**
 * Try writes without keeping them: runs fn, returns what the data would look like, then puts
 * everything back. Nothing is saved, no event fires, no undo step is made.
 *   const { plan, games, error } = store.preview(() => store.placeBox(id, target));
 * plan / games are frozen v2 copies (null if fn threw); error is the Error fn threw, or null.
 * Use it for "what if" checks, e.g. run the rule checker on the previewed plan.
 */
export function preview(fn) {
  if (previewing) throw new Error('preview() cannot be nested');
  const saved = structuredClone(data);
  previewing = true;
  try {
    fn();
    return { plan: deepFreeze(structuredClone(data.plan)), games: deepFreeze(structuredClone(data.games)), error: null };
  } catch (err) {
    return { plan: null, games: null, error: err };
  } finally {
    data = saved;
    pending = null;
    previewing = false;
  }
}

/** Run many writes as one change: one save, one event, one undo step, full rollback if fn throws. */
export function batch(fn) {
  if (depth === 0) backup = structuredClone(data);
  depth++;
  try {
    return fn();
  } catch (err) {
    if (depth === 1) {
      data = backup;
      pending = null;
    }
    throw err;
  } finally {
    depth--;
    if (depth === 0) {
      backup = null;
      if (pending) {
        const p = pending;
        pending = null;
        commit(p);
      }
    }
  }
}

// ---------------------------------------------------------------- internals

function indexOf(id) {
  const i = data.games.findIndex((g) => g.id === id);
  if (i < 0) throw new Error(`Unknown game ${id}`);
  return i;
}

const rawGame = (id) => data.games.find((g) => g.id === id);
const title = (id) => rawGame(id)?.title ?? id;

function mustStack(stackId) {
  const st = data.plan.stacks.find((s) => s.id === stackId);
  if (!st) throw new Error(`There is no stack ${stackId}`);
  return st;
}

/** The game, if it may go on a shelf in that orientation; otherwise a readable error. */
function mustPlaceable(id, up) {
  const game = data.games[indexOf(id)];
  if (!game.dims) throw new Error(`Add the box size of ${game.title} first – a game without a size cannot go on a shelf.`);
  if (!['s', 'm', 'l'].includes(up)) throw new Error('up must be "s", "m" or "l"');
  if (game.pizza && up !== 's') throw new Error(`${game.title} is a pizza game: it can only lie flat (you can still turn it round).`);
  return game;
}

function check(errors) {
  if (errors.length) {
    const err = new Error(errors.length === 1 ? errors[0] : `${errors.length} problems: ${errors.slice(0, 5).join('; ')}`);
    err.problems = errors;
    throw err;
  }
}

/** A cleaned family name, spelled like an existing family of other games when only the letter case differs. */
function sameFamily(v, self) {
  const name = cleanFamily(v);
  if (typeof name !== 'string') return name;
  const skip = self instanceof Set ? self : new Set([self]);
  const key = name.toLocaleLowerCase('hu');
  const other = data.games.find((g) => !skip.has(g.id) && typeof g.family === 'string' && g.family.toLocaleLowerCase('hu') === key);
  return other ? other.family : name;
}

function nextId() {
  const max = Math.max(0, ...data.games.map((g) => Number(/^g(\d+)$/.exec(g.id)?.[1] ?? 0)));
  return `g${String(max + 1).padStart(3, '0')}`;
}

const emptyPlan = () => ({ name: 'Empty plan', stacks: [], cupboard: [], inside: {}, board: [] });

function normalizePlan(p) {
  p.name ??= 'Imported plan';
  p.stacks ??= [];
  p.cupboard ??= [];
  p.inside ??= {};
  p.board ??= [];
  return p;
}

function restore(state) {
  data.games = state.games;
  data.plan = state.plan;
  commit({ games: null, plan: true, fromHistory: true });
}

function changed(info) {
  if (previewing) return;
  if (depth > 0) {
    pending = mergeInfo(pending, info);
    return;
  }
  commit(info);
}

function mergeInfo(a, b) {
  if (!a) return { games: b.games ?? null, plan: !!b.plan, meta: !!b.meta };
  const games = a.games === null || b.games == null ? null : [...new Set([...a.games, ...b.games])];
  return { games, plan: a.plan || !!b.plan, meta: a.meta && !!b.meta };
}

function commit(info) {
  if (!info.meta && !info.fromHistory && committed) {
    undoStack.push(committed);
    if (undoStack.length > HISTORY) undoStack.shift();
    redoStack = [];
  }
  committed = structuredClone({ games: data.games, plan: data.plan });
  rebuild();
  save();
  emit('store:changed', { games: info.games === undefined ? null : info.games, plan: !!info.plan });
}

function save() {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...stripSnap(data), schema: SCHEMA, savedAt: new Date().toISOString() }));
  } catch (err) {
    console.error('[store] could not save', err);
    emit('store:error', { message: `Could not save your changes: ${err.message}` });
  }
}

function stripSnap(d) {
  const { savedAt, exportedAt, ...rest } = d; // eslint-disable-line no-unused-vars
  return rest;
}

const collator = new Intl.Collator('hu', { sensitivity: 'base', numeric: true });

function rebuild() {
  const copy = structuredClone(stripSnap(data));
  copy.schema = SCHEMA;
  copy.games.sort((a, b) => collator.compare(a.title, b.title));
  snap = deepFreeze(copy);
  byId = new Map(snap.games.map((g) => [g.id, g]));
  where2 = locations2(snap.plan);
  const explicit = snap.plan.board.map((b) => b.game);
  const placeless = snap.games.filter((g) => !where2.has(g.id)).map((g) => g.id);
  board = Object.freeze([...explicit, ...placeless]);
  for (const id of placeless) where2.set(id, Object.freeze({ kind: 'board', index: board.indexOf(id) }));
  const fam = new Map();
  for (const g of snap.games) if (g.family) fam.set(g.family, [...(fam.get(g.family) ?? []), g.id]);
  families = deepFreeze([...fam].sort((a, b) => collator.compare(a[0], b[0])).map(([name, ids]) => ({ name, ids })));
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

