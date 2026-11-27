// Data format checks for seed, backups and plan imports. Owner: Tony (lead).
// The format itself is documented in docs/CONTEXT.md ("Data model").
// Schema 2 is current. Schema 1 files (old backups, the seed, plan files from the planning chat)
// are checked as v1 and then upgraded with js/core/plan2.js.
import { ZONES } from './shelves.js';
import { CATEGORY_IDS } from './categories.js';
import { migrateDataV1, migratePlanV1 } from './plan2.js';

export const APP = 'shelp';
export const SCHEMA = 2;
export const MAX_VERSIONS = 10; // saved versions (D6)
export const VERSION_NAME_MAX = 60;
export const FAMILY_MAX = 40; // game family names (B2)

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isStrOrNull = (v) => v == null || typeof v === 'string';
const isRange = (v) => v == null || (isObj(v) && Number.isFinite(v.min) && Number.isFinite(v.max) && v.min <= v.max);

/** Problems with one game object, as a list of strings (empty = fine). v2 games also need `pizza`. */
export function validateGame(g, { schema = SCHEMA } = {}) {
  const e = [];
  const name = g?.title ? `"${g.title}"` : g?.id ?? '(game)';
  if (!isObj(g)) return ['game is not an object'];
  if (typeof g.id !== 'string' || !g.id) e.push(`${name}: id must be a non-empty string`);
  if (typeof g.title !== 'string' || !g.title.trim()) e.push(`${name}: title is required`);
  if (!(g.bggId == null || Number.isInteger(g.bggId))) e.push(`${name}: bggId must be a whole number or null`);
  if (!isStrOrNull(g.bggName)) e.push(`${name}: bggName must be text or null`);
  if (!['base', 'expansion'].includes(g.type)) e.push(`${name}: type must be "base" or "expansion"`);
  if (!(g.dims == null || (Array.isArray(g.dims) && g.dims.length === 3 && g.dims.every((d) => Number.isFinite(d) && d > 0)))) {
    e.push(`${name}: dims must be null or three positive numbers`);
  } else if (g.dims && !(g.dims[0] <= g.dims[1] && g.dims[1] <= g.dims[2])) {
    e.push(`${name}: dims must be sorted smallest first`);
  }
  if (!isStrOrNull(g.sizeSource)) e.push(`${name}: sizeSource must be text or null`);
  if (!isRange(g.players)) e.push(`${name}: players must be {min, max} or null`);
  if (!isRange(g.time)) e.push(`${name}: time must be {min, max} or null`);
  if (!isStrOrNull(g.age)) e.push(`${name}: age must be text or null`);
  if (!Array.isArray(g.categories) || g.categories.some((c) => !CATEGORY_IDS.includes(c))) {
    e.push(`${name}: categories must be a list of ${CATEGORY_IDS.join(', ')}`);
  }
  if (typeof g.inBgg !== 'boolean') e.push(`${name}: inBgg must be true or false`);
  if (!isStrOrNull(g.notes)) e.push(`${name}: notes must be text or null`);
  if (schema >= 2 && typeof g.pizza !== 'boolean') e.push(`${name}: pizza must be true or false`);
  if (!(g.family == null || (typeof g.family === 'string' && g.family.trim() && g.family.trim().length <= FAMILY_MAX))) {
    e.push(`${name}: family must be a name (1–${FAMILY_MAX} characters) or null`);
  }
  return e;
}

/**
 * A family name as it is stored: trimmed, inner spaces collapsed, '' → null (B2).
 * Anything that isn't text is returned as it is, so validateGame can report it.
 */
export function cleanFamily(v) {
  if (typeof v !== 'string') return v ?? null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t || null;
}

function itemGames(item) {
  return item?.side ? item.side.map((x) => x?.game) : [item?.game];
}

/**
 * Problems with a v1 plan (schema 1), checked against a set of known game ids.
 * sizeless: ids of games without a box size (dims: null). They may be in the cupboard or inside
 * another box, but never on a stack – the map and the rule checker can rely on that.
 */
export function validatePlanV1(plan, gameIds, sizeless = new Set()) {
  const e = [];
  if (!isObj(plan)) return ['plan is missing'];
  if (!Array.isArray(plan.stacks)) return ['plan.stacks must be a list'];
  const seen = new Map();
  const mark = (id, where) => {
    if (!gameIds.has(id)) e.push(`${where}: unknown game id "${id}"`);
    else if (seen.has(id)) e.push(`${where}: game "${id}" is already placed in ${seen.get(id)}`);
    else seen.set(id, where);
  };
  const stackIds = new Set();
  for (const st of plan.stacks) {
    const sid = st?.id ?? '(stack)';
    if (typeof st?.id !== 'string' || !st.id) e.push('a stack has no id');
    else if (stackIds.has(st.id)) e.push(`stack ${sid}: id used twice`);
    stackIds.add(st?.id);
    if (!ZONES[st?.zone]) e.push(`stack ${sid}: unknown zone "${st?.zone}"`);
    if (!Number.isFinite(st?.x) || st.x < 0) e.push(`stack ${sid}: x must be a number ≥ 0`);
    if (!['flat', 'standing'].includes(st?.orientation)) e.push(`stack ${sid}: orientation must be "flat" or "standing"`);
    if (!Array.isArray(st?.rows) || st.rows.length < 1 || st.rows.length > 2) {
      e.push(`stack ${sid}: rows must be a list of 1 or 2 rows`);
      continue;
    }
    st.rows.forEach((row, r) => {
      if (!Array.isArray(row)) return e.push(`stack ${sid}: row ${r} must be a list`);
      row.forEach((item) => {
        if (item?.side && (!Array.isArray(item.side) || item.side.length < 2)) {
          e.push(`stack ${sid}: a side-by-side group needs at least 2 games`);
        }
        if (item?.side && st.orientation !== 'flat') e.push(`stack ${sid}: side-by-side only works in flat stacks`);
        for (const g of itemGames(item)) {
          mark(g, `stack ${sid}`);
          if (sizeless.has(g)) e.push(`stack ${sid}: game "${g}" has no box size, so it cannot be on a shelf`);
        }
        if (!item?.side && item?.rot != null && typeof item.rot !== 'boolean') e.push(`stack ${sid}: rot must be true/false`);
      });
    });
    if (st.topper != null && !(isObj(st.topper) && typeof st.topper.label === 'string' && Number.isFinite(st.topper.w) && Number.isFinite(st.topper.h))) {
      e.push(`stack ${sid}: topper must be {label, w, h}`);
    }
    if (st.notes != null && !(Array.isArray(st.notes) && st.notes.every((n) => typeof n === 'string'))) {
      e.push(`stack ${sid}: notes must be a list of text`);
    }
  }
  for (const c of plan.cupboard ?? []) mark(c?.game, 'the cupboard');
  if (plan.cupboard != null && !Array.isArray(plan.cupboard)) e.push('plan.cupboard must be a list');
  const inside = plan.inside ?? {};
  if (!isObj(inside)) e.push('plan.inside must be an object');
  for (const [exp, host] of Object.entries(inside)) {
    mark(exp, `inside the box of "${host}"`);
    if (!gameIds.has(host)) e.push(`inside: unknown host game "${host}"`);
    if (exp === host) e.push(`inside: "${exp}" cannot be inside itself`);
    if (inside[host]) e.push(`inside: "${host}" is itself inside another box (no nesting)`);
  }
  return e;
}

/**
 * Problems with a v2 plan (schema 2).
 * known: { ids: Set of game ids, sizeless: Set (no box size), pizza: Set (may only lie flat) }
 */
export function validatePlan2(plan, { ids, sizeless = new Set(), pizza = new Set() }) {
  const e = [];
  if (!isObj(plan)) return ['plan is missing'];
  if (!Array.isArray(plan.stacks)) return ['plan.stacks must be a list'];
  const seen = new Map();
  const mark = (id, where) => {
    if (!ids.has(id)) e.push(`${where}: unknown game id "${id}"`);
    else if (seen.has(id)) e.push(`${where}: game "${id}" is already placed in ${seen.get(id)}`);
    else seen.set(id, where);
  };
  const stackIds = new Set();
  for (const st of plan.stacks) {
    const sid = st?.id ?? '(stack)';
    if (typeof st?.id !== 'string' || !st.id) e.push('a stack has no id');
    else if (stackIds.has(st.id)) e.push(`stack ${sid}: id used twice`);
    stackIds.add(st?.id);
    if (!ZONES[st?.zone]) e.push(`stack ${sid}: unknown zone "${st?.zone}"`);
    if (!Number.isFinite(st?.x) || st.x < 0) e.push(`stack ${sid}: x must be a number ≥ 0`);
    if (!Array.isArray(st?.boxes)) {
      e.push(`stack ${sid}: boxes must be a list`);
      continue;
    }
    const here = new Map(st.boxes.map((b) => [b?.game, b]));
    for (const b of st.boxes) {
      const g = b?.game;
      mark(g, `stack ${sid}`);
      if (![0, 1].includes(b?.row)) e.push(`stack ${sid}: "${g}" row must be 0 (front) or 1 (back)`);
      if (!Number.isFinite(b?.x) || b.x < 0) e.push(`stack ${sid}: "${g}" x must be a number ≥ 0`);
      if (!['s', 'm', 'l'].includes(b?.up)) e.push(`stack ${sid}: "${g}" up must be "s", "m" or "l"`);
      if (typeof b?.rot !== 'boolean') e.push(`stack ${sid}: "${g}" rot must be true or false`);
      if (!Array.isArray(b?.on) || b.on.length > 2) {
        e.push(`stack ${sid}: "${g}" on must be a list of at most 2 boxes`);
        continue;
      }
      if (new Set(b.on).size !== b.on.length) e.push(`stack ${sid}: "${g}" rests on the same box twice`);
      for (const s of b.on) {
        const sup = here.get(s);
        if (!sup) e.push(`stack ${sid}: "${g}" rests on "${s}", which is not on this stack`);
        else if (sup.row !== b.row) e.push(`stack ${sid}: "${g}" rests on a box in the other row`);
        if (s === g) e.push(`stack ${sid}: "${g}" cannot rest on itself`);
      }
      if (sizeless.has(g)) e.push(`stack ${sid}: game "${g}" has no box size, so it cannot be on a shelf`);
      if (pizza.has(g) && b.up !== 's') e.push(`stack ${sid}: game "${g}" is a pizza game, so it can only lie flat`);
    }
    // no loops: following "rests on" must always reach the floor
    const state = new Map();
    const loops = (id) => {
      if (state.get(id) === 1) return true;
      if (state.get(id) === 2) return false;
      state.set(id, 1);
      const bad = (here.get(id)?.on ?? []).some((s) => here.has(s) && loops(s));
      state.set(id, 2);
      return bad;
    };
    for (const b of st.boxes) if (loops(b?.game)) { e.push(`stack ${sid}: boxes rest on each other in a loop`); break; }
    if (st.topper != null && !(isObj(st.topper) && typeof st.topper.label === 'string' && Number.isFinite(st.topper.w) && Number.isFinite(st.topper.h))) {
      e.push(`stack ${sid}: topper must be {label, w, h}`);
    }
    if (st.notes != null && !(Array.isArray(st.notes) && st.notes.every((n) => typeof n === 'string'))) {
      e.push(`stack ${sid}: notes must be a list of text`);
    }
  }
  if (!Array.isArray(plan.cupboard)) e.push('plan.cupboard must be a list');
  else for (const c of plan.cupboard) mark(c?.game, 'the cupboard');
  if (!Array.isArray(plan.board)) e.push('plan.board must be a list');
  else for (const b of plan.board) mark(b?.game, 'the board');
  const inside = plan.inside ?? {};
  if (!isObj(inside)) e.push('plan.inside must be an object');
  for (const [exp, host] of Object.entries(inside)) {
    mark(exp, `inside the box of "${host}"`);
    if (!ids.has(host)) e.push(`inside: unknown host game "${host}"`);
    if (exp === host) e.push(`inside: "${exp}" cannot be inside itself`);
    if (inside[host]) e.push(`inside: "${host}" is itself inside another box (no nesting)`);
  }
  return e;
}

/** What validatePlan2 needs to know about a list of games. */
export function knownFrom(games) {
  return {
    ids: new Set(games.map((g) => g?.id)),
    sizeless: new Set(games.filter((g) => g && g.dims == null).map((g) => g.id)),
    pizza: new Set(games.filter((g) => g?.pizza === true).map((g) => g.id)),
    byId: new Map(games.map((g) => [g?.id, g])),
  };
}

/**
 * Check a full data file (seed / backup) or a plan-only file, schema 1 or 2.
 * Full file:  { app: "shelp", schema, games: [...], plan: {...} }
 * Plan only:  { app: "shelp", schema, plan: {...} }  – checked against `current` (knownFrom(store games))
 * Returns { problems: [...], data } where data is the file upgraded to schema 2 (null if there are problems).
 */
export function checkData(obj, current = knownFrom([])) {
  if (!isObj(obj)) return { problems: ['not a JSON object'], data: null };
  const e = [];
  if (obj.app !== APP) e.push(`"app" must be "${APP}"`);
  if (obj.schema !== 1 && obj.schema !== 2) e.push(`"schema" must be 1 or 2 (got ${obj.schema})`);
  if (obj.plan == null && obj.games == null) e.push('file has neither "games" nor "plan"');
  if (obj.games != null && !Array.isArray(obj.games)) e.push('"games" must be a list');
  if (e.length) return { problems: e, data: null };

  let known = current;
  if (obj.games) {
    const ids = new Set();
    for (const g of obj.games) {
      e.push(...validateGame(g, { schema: obj.schema }));
      if (ids.has(g?.id)) e.push(`game id "${g?.id}" used twice`);
      ids.add(g?.id);
    }
    if (e.length) return { problems: e, data: null };
  }
  if (obj.schema === 1) {
    const ids = obj.games ? new Set(obj.games.map((g) => g.id)) : current.ids;
    const sizeless = obj.games ? new Set(obj.games.filter((g) => g.dims == null).map((g) => g.id)) : current.sizeless;
    if (obj.plan != null) e.push(...validatePlanV1(obj.plan, ids, sizeless));
    if (e.length) return { problems: e, data: null };
    if (obj.games) {
      obj = migrateDataV1(obj);
    } else {
      obj = { ...obj, schema: 2, plan: migratePlanV1(obj.plan, (id) => current.byId?.get(id)) };
    }
  }
  if (obj.games) {
    // `family` (B2) is optional in files made before it existed; in the store every game has it.
    obj = { ...obj, games: obj.games.map((g) => ({ ...g, family: cleanFamily(g.family) })) };
    known = knownFrom(obj.games);
  }
  if (obj.plan != null) {
    const plan = { cupboard: [], inside: {}, board: [], ...obj.plan };
    e.push(...validatePlan2(plan, known));
    obj = { ...obj, plan };
  }
  if (obj.versions != null) {
    if (!obj.games) e.push('"versions" can only be in a full backup (with "games")');
    else {
      const v = checkVersions(obj.versions);
      e.push(...v.problems);
      obj = { ...obj, versions: v.versions };
    }
  }
  return e.length ? { problems: e, data: null } : { problems: [], data: obj };
}

/**
 * Saved versions (D6), as kept by the store and in full backups:
 *   [{ id: "v3", name: "Before the top shelf", savedAt: ISO date, games: [Game…], plan: Plan }]  (schema 2)
 * Returns { problems, versions }: versions holds the valid ones (names trimmed, plans completed),
 * so the store can keep those when a few are broken; an import refuses the file if there are problems.
 */
export function checkVersions(list) {
  if (!Array.isArray(list)) return { problems: ['"versions" must be a list'], versions: [] };
  const problems = [];
  const versions = [];
  const ids = new Set();
  for (const v of list) {
    const label = `saved version "${typeof v?.name === 'string' ? v.name : '?'}"`;
    const e = [];
    if (!isObj(v)) e.push('not an object');
    else {
      if (typeof v.id !== 'string' || !v.id) e.push('"id" must be text');
      else if (ids.has(v.id)) e.push(`id "${v.id}" used twice`);
      if (typeof v.name !== 'string' || !v.name.trim()) e.push('"name" must be text');
      else if (v.name.trim().length > VERSION_NAME_MAX) e.push(`"name" can be at most ${VERSION_NAME_MAX} characters`);
      if (typeof v.savedAt !== 'string' || Number.isNaN(Date.parse(v.savedAt))) e.push('"savedAt" must be a date');
      if (!e.length) {
        const r = checkData({ app: APP, schema: SCHEMA, games: v.games, plan: v.plan });
        if (r.problems.length) e.push(...r.problems);
        else {
          ids.add(v.id);
          versions.push({ id: v.id, name: v.name.trim(), savedAt: v.savedAt, games: r.data.games, plan: r.data.plan });
        }
      }
    }
    if (e.length) problems.push(...e.slice(0, 3).map((p) => `${label}: ${p}`));
  }
  if (versions.length > MAX_VERSIONS) problems.push(`at most ${MAX_VERSIONS} saved versions (this file has ${versions.length})`);
  return { problems, versions: versions.slice(-MAX_VERSIONS) };
}

/** Problems only (empty = fine). Kept for callers that just want the list. */
export function validateData(obj, current) {
  return checkData(obj, current ?? knownFrom([])).problems;
}
