// The single source of truth for games and the shelf plan. Owner: Tony (lead).
//
// Rules for everyone:
//  - Read with the getters. What they return is FROZEN – never mutate it.
//  - Change data only with the write functions below. Each write saves to localStorage
//    and emits 'store:changed' on the bus (see bus.js). Re-render from the store when it fires.
//  - Write functions throw an Error with a readable message when a change is not allowed.
//    Catch it and show the message to the user.
//  - Use batch(() => { ... }) for many writes at once (e.g. a CSV import): one save, one event,
//    and everything is rolled back if the function throws.
import { emit } from './bus.js';
import { APP, SCHEMA, validateData, validateGame, validatePlan } from './schema.js';

export const STORAGE_KEY = 'shelp:data:v1';
const BROKEN_KEY = 'shelp:data:broken';
const SEED_URL = new URL('../../data/seed.json', import.meta.url);

let data = null; // private, mutable: { app, schema, games: [], plan: {}, meta: {} }
let snap = null; // frozen copy handed out to readers
let byId = new Map();
let where = new Map();
let seedCache = null;
let storage = null;
let depth = 0;
let pending = null;
let backup = null;

// ---------------------------------------------------------------- setup

/**
 * Load saved data from localStorage, or the bundled seed on first run.
 * Options (for tests): { seed: object, storage: {getItem, setItem, removeItem} }
 */
export async function init({ seed, storage: st } = {}) {
  storage = st ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (seed) seedCache = structuredClone(seed);
  let loaded = null;
  const raw = storage?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      const errors = validateData(obj);
      if (errors.length) throw new Error(errors.slice(0, 3).join('; '));
      loaded = obj;
    } catch (err) {
      console.error('[store] saved data is broken, starting from the seed', err);
      storage.setItem(BROKEN_KEY, raw);
    }
  }
  data = loaded ?? (await loadSeed());
  data.meta ??= {};
  rebuild();
  if (!loaded) save();
  return snap;
}

async function loadSeed() {
  if (!seedCache) {
    const res = await fetch(SEED_URL);
    if (!res.ok) throw new Error(`Could not load the seed data (${res.status})`);
    seedCache = await res.json();
  }
  const errors = validateData(seedCache);
  if (errors.length) throw new Error(`Seed data is invalid: ${errors[0]}`);
  return structuredClone(seedCache);
}

// ---------------------------------------------------------------- reads

/** All games, sorted by title (Hungarian collation). Frozen. */
export function getGames() {
  return snap.games;
}

/** One game by id, or undefined. Frozen. */
export function getGame(id) {
  return byId.get(id);
}

/** The whole plan: { name, stacks, cupboard, inside }. Frozen. */
export function getPlan() {
  return snap.plan;
}

/** One stack by id, or undefined. Frozen. */
export function getStack(id) {
  return snap.plan.stacks.find((s) => s.id === id);
}

/** Free-form app metadata, e.g. { lastImport: "2026-11-27T10:00:00Z" }. Frozen. */
export function getMeta() {
  return snap.meta;
}

/**
 * Where is a game? Returns one of:
 *  { kind: 'stack', stackId, zone, orientation, rows, row, index, side, above, below }
 *      rows: number of rows in the stack (2 = two deep); row: 0 = front, 1 = back
 *      index: position in the row – bottom→top for flat stacks, left→right for standing ones
 *      side: index inside a side-by-side group, or null
 *      above / below: ids of the games on top of / under it (flat stacks only, [] otherwise)
 *  { kind: 'inside', hostId, host }      host = locate(hostId)
 *  { kind: 'cupboard', reason }
 *  { kind: 'unplaced' }                  a known game that is nowhere yet (e.g. just imported)
 *  null                                  unknown id
 */
export function locate(id) {
  if (!byId.has(id)) return null;
  return where.get(id) ?? { kind: 'unplaced' };
}

/** Everything as one plain (mutable) object – this is the backup file format. */
export function exportData() {
  return { app: APP, schema: SCHEMA, exportedAt: new Date().toISOString(), ...structuredClone(stripSnap(data)) };
}

/** Check a backup or plan file before importing. Returns a list of problems (empty = OK). */
export function validate(obj) {
  return validateData(obj, new Set(byId.keys()));
}

// ---------------------------------------------------------------- writes: games

/** Change fields of a game. `id` cannot change. Throws if the result is invalid. */
export function updateGame(id, patch) {
  const i = indexOf(id);
  if ('id' in patch && patch.id !== id) throw new Error('The id of a game cannot change');
  const next = { ...data.games[i], ...structuredClone(patch) };
  if (next.dims) next.dims = [...next.dims].sort((a, b) => a - b);
  check(validateGame(next));
  data.games[i] = next;
  changed({ games: [id] });
}

/** Add a game. Only `title` is required. Returns the new id. The game starts unplaced. */
export function addGame(fields) {
  const id = nextId();
  const game = {
    id, title: '', bggId: null, bggName: null, type: 'base', dims: null, sizeSource: null,
    players: null, time: null, age: null, categories: [], inBgg: false, notes: null,
    ...structuredClone(fields),
  };
  game.id = id;
  if (game.dims) game.dims = [...game.dims].sort((a, b) => a - b);
  check(validateGame(game));
  data.games.push(game);
  changed({ games: [id], plan: false });
  return id;
}

/** Delete a game everywhere. Boxes stored inside it go to the cupboard. */
export function removeGame(id) {
  const i = indexOf(id);
  const title = data.games[i].title;
  detach(id);
  for (const [exp, host] of Object.entries(data.plan.inside)) {
    if (host === id) {
      delete data.plan.inside[exp];
      data.plan.cupboard.push({ game: exp, reason: `Was stored inside the ${title} box` });
    }
  }
  data.games.splice(i, 1);
  changed({ games: [id], plan: true });
}

// ---------------------------------------------------------------- writes: plan

/** Put a game in the cupboard (from wherever it is). */
export function moveToCupboard(id, reason = '') {
  indexOf(id);
  detach(id);
  data.plan.cupboard.push({ game: id, reason });
  changed({ games: [id], plan: true });
}

/**
 * Put a game on a stack (from wherever it is).
 * row: 0 = front (default), 1 = back.  index: position in the row, default = on top / rightmost.
 * No rule checking here – the rule checker is story D2.
 */
export function placeOnStack(id, stackId, { row = 0, index } = {}) {
  indexOf(id);
  const st = data.plan.stacks.find((s) => s.id === stackId);
  if (!st) throw new Error(`There is no stack ${stackId}`);
  if (!st.rows[row]) throw new Error(`Stack ${stackId} has no ${row === 0 ? 'front' : 'back'} row`);
  detach(id);
  const r = st.rows[row];
  const at = index == null ? r.length : Math.max(0, Math.min(index, r.length));
  r.splice(at, 0, { game: id });
  changed({ games: [id], plan: true });
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
  detach(id);
  data.plan.inside[id] = hostId;
  changed({ games: [id], plan: true });
}

/** Replace the whole plan (e.g. a plan made in chat). Games stay as they are. */
export function replacePlan(plan) {
  const next = normalizePlan(structuredClone(plan));
  check(validatePlan(next, new Set(byId.keys())));
  data.plan = next;
  changed({ games: null, plan: true });
}

/**
 * Import a file. Full file (games + plan) replaces everything; plan-only replaces the plan.
 * Returns 'all' or 'plan'. Throws with the list of problems if the file is invalid.
 */
export function importData(obj) {
  check(validate(obj));
  if (obj.games) {
    data = { app: APP, schema: SCHEMA, games: structuredClone(obj.games), plan: normalizePlan(structuredClone(obj.plan ?? emptyPlan())), meta: structuredClone(obj.meta ?? {}) };
    changed({ games: null, plan: true });
    return 'all';
  }
  replacePlan(obj.plan);
  return 'plan';
}

/** Throw away local changes and go back to the bundled seed data. */
export async function resetToSeed() {
  data = await loadSeed();
  data.meta = {};
  changed({ games: null, plan: true });
}

/** Set one metadata key (value must be JSON-safe). */
export function setMeta(key, value) {
  data.meta[key] = structuredClone(value);
  changed({ games: [], plan: false });
}

/** Run many writes as one change: one save, one event, full rollback if fn throws. */
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

const title = (id) => data.games.find((g) => g.id === id)?.title ?? id;

function check(errors) {
  if (errors.length) {
    const err = new Error(errors.length === 1 ? errors[0] : `${errors.length} problems: ${errors.slice(0, 5).join('; ')}`);
    err.problems = errors;
    throw err;
  }
}

function nextId() {
  const max = Math.max(0, ...data.games.map((g) => Number(/^g(\d+)$/.exec(g.id)?.[1] ?? 0)));
  return `g${String(max + 1).padStart(3, '0')}`;
}

const emptyPlan = () => ({ name: 'Empty plan', stacks: [], cupboard: [], inside: {} });

function normalizePlan(p) {
  p.name ??= 'Imported plan';
  p.stacks ??= [];
  p.cupboard ??= [];
  p.inside ??= {};
  return p;
}

/** Remove a game from wherever it is in the plan (stack, side group, cupboard, inside). */
function detach(id) {
  const p = data.plan;
  for (const st of p.stacks) {
    for (const row of st.rows) {
      for (let i = row.length - 1; i >= 0; i--) {
        const item = row[i];
        if (item.game === id) row.splice(i, 1);
        else if (item.side) {
          item.side = item.side.filter((x) => x.game !== id);
          if (item.side.length === 1) row[i] = item.side[0];
          else if (item.side.length === 0) row.splice(i, 1);
        }
      }
    }
  }
  p.cupboard = p.cupboard.filter((c) => c.game !== id);
  delete p.inside[id];
}

function changed(info) {
  if (depth > 0) {
    pending = mergeInfo(pending, info);
    return;
  }
  commit(info);
}

function mergeInfo(a, b) {
  if (!a) return { games: b.games ?? null, plan: !!b.plan };
  const games = a.games === null || b.games == null ? null : [...new Set([...a.games, ...b.games])];
  return { games, plan: a.plan || !!b.plan };
}

function commit(info) {
  rebuild();
  save();
  emit('store:changed', { games: info.games === undefined ? null : info.games, plan: !!info.plan });
}

function save() {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...stripSnap(data), savedAt: new Date().toISOString() }));
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
  copy.games.sort((a, b) => collator.compare(a.title, b.title));
  snap = deepFreeze(copy);
  byId = new Map(snap.games.map((g) => [g.id, g]));
  where = new Map();
  for (const st of snap.plan.stacks) {
    st.rows.forEach((row, r) => {
      const flat = row.flatMap((item) => (item.side ? item.side.map((x) => x.game) : [item.game]));
      let pos = 0;
      row.forEach((item, i) => {
        const ids = item.side ? item.side.map((x) => x.game) : [item.game];
        ids.forEach((g, k) => {
          const isFlat = st.orientation === 'flat';
          where.set(g, Object.freeze({
            kind: 'stack', stackId: st.id, zone: st.zone, orientation: st.orientation,
            rows: st.rows.length, row: r, index: i, side: item.side ? k : null,
            above: Object.freeze(isFlat ? flat.slice(pos + ids.length) : []),
            below: Object.freeze(isFlat ? flat.slice(0, pos) : []),
          }));
        });
        pos += ids.length;
      });
    });
  }
  for (const c of snap.plan.cupboard) where.set(c.game, Object.freeze({ kind: 'cupboard', reason: c.reason ?? '' }));
  for (const [exp, host] of Object.entries(snap.plan.inside)) {
    where.set(exp, Object.freeze({ kind: 'inside', hostId: host, host: where.get(host) ?? { kind: 'unplaced' } }));
  }
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
