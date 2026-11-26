// Data format checks for seed, backups and plan imports. Owner: Tony (lead).
// The format itself is documented in docs/CONTEXT.md ("Data model").
import { ZONES } from './shelves.js';
import { CATEGORY_IDS } from './categories.js';

export const APP = 'shelp';
export const SCHEMA = 1;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isStrOrNull = (v) => v == null || typeof v === 'string';
const isRange = (v) => v == null || (isObj(v) && Number.isFinite(v.min) && Number.isFinite(v.max) && v.min <= v.max);

/** Problems with one game object, as a list of strings (empty = fine). */
export function validateGame(g) {
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
  return e;
}

function itemGames(item) {
  return item?.side ? item.side.map((x) => x?.game) : [item?.game];
}

/** Problems with a plan, checked against a set of known game ids. */
export function validatePlan(plan, gameIds) {
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
        for (const g of itemGames(item)) mark(g, `stack ${sid}`);
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
 * Check a full data file (seed / backup) or a plan-only file.
 * Full file:  { app: "shelp", schema: 1, games: [...], plan: {...} }
 * Plan only:  { app: "shelp", schema: 1, plan: {...} }  – checked against knownGameIds
 */
export function validateData(obj, knownGameIds = new Set()) {
  if (!isObj(obj)) return ['not a JSON object'];
  const e = [];
  if (obj.app !== APP) e.push(`"app" must be "${APP}"`);
  if (obj.schema !== SCHEMA) e.push(`"schema" must be ${SCHEMA} (got ${obj.schema})`);
  let ids = knownGameIds;
  if (obj.games != null) {
    if (!Array.isArray(obj.games)) return [...e, '"games" must be a list'];
    ids = new Set();
    for (const g of obj.games) {
      e.push(...validateGame(g));
      if (ids.has(g?.id)) e.push(`game id "${g?.id}" used twice`);
      ids.add(g?.id);
    }
  }
  if (obj.plan == null && obj.games == null) e.push('file has neither "games" nor "plan"');
  if (obj.plan != null) e.push(...validatePlan(obj.plan, ids));
  return e;
}
