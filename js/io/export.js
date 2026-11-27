// Export to the planning workbook (story E3): the catalog and the shelf plan as CSV. No DOM. Owner: Stephen (Part A).
// The columns are the ones of the workbook tabs, so Adam can paste the cells back.
import { CATEGORIES } from '../core/categories.js';
import { describeLocation, formatRange } from '../core/format.js';
import { ZONES, isEasy } from '../core/shelves.js';
import { layoutStack } from '../map/model.js';
import { localDate } from './time.js';

export const CATALOG_HEADER = [
  'Title', 'BGG', 'Box size (cm)', 'Players', 'Play time (min)', 'Age', 'BGG name', 'Type', 'Location',
  'Box size from', 'In BGG collection', 'Notes',
];
export const PLAN_HEADER = [
  'Shelf', 'Spot', 'Stack (left → right)', 'Level / position (1 = bottom)', 'Row / pile', 'Game', 'Box size (cm)',
  'Categories', 'Notes',
];

export const catalogFileName = (date = new Date()) => `shelp-catalog-${localDate(date)}.csv`;
export const planFileName = (date = new Date()) => `shelp-plan-${localDate(date)}.csv`;

// ---------------------------------------------------------------- CSV text

const needsQuotes = /[",\r\n]/;
const cell = (v) => {
  const t = v == null ? '' : String(v);
  return needsQuotes.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
};

/** Rows of cells -> CSV text: UTF-8 BOM (so Sheets and Excel read the accents), commas, \r\n line ends. */
export const toCsv = (rows) => `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;

// ---------------------------------------------------------------- values

const num = (n) => String(Math.round(n * 100) / 100);

/** [5.1, 22.6, 30.5] -> "30.5 × 22.6 × 5.1" (no unit), or "" when the size is missing. */
export const sizeText = (dims) => (dims ? [...dims].sort((a, b) => b - a).map(num).join(' × ') : '');

const categoriesText = (game) => CATEGORIES.filter((c) => game.categories.includes(c.id)).map((c) => c.label).join(' + ');

// ---------------------------------------------------------------- catalog

/** One row per game, in the order given (the store sorts by title). `locate` is store.locate. */
export function catalogRows(games, locate) {
  const title = new Map(games.map((g) => [g.id, g.title]));
  return [CATALOG_HEADER, ...games.map((g) => [
    g.title,
    g.bggId ? `https://boardgamegeek.com/boardgame/${g.bggId}` : '',
    sizeText(g.dims),
    formatRange(g.players),
    formatRange(g.time),
    g.age ?? '',
    g.bggName ?? '',
    g.type === 'expansion' ? 'Expansion' : 'Base',
    describeLocation(locate(g.id), (id) => title.get(id) ?? id),
    g.sizeSource ?? '',
    g.inBgg ? 'Yes' : 'No',
    g.notes ?? '',
  ])];
}

// ---------------------------------------------------------------- shelf plan

const zoneRank = (id) => {
  const i = Object.keys(ZONES).indexOf(id);
  return i < 0 ? 99 : i;
};

function spotOf(stack, width) {
  if (!isEasy(stack.zone, stack.x, width)) return 'Hard';
  return stack.zone === 'top' ? 'Easy (from the stairs)' : 'Easy';
}

/**
 * Every game exactly once: the stacks (by shelf, then left to right), games stored inside a box right after
 * their host, then the cupboard, then games that are not placed.
 */
export function planRows(games, plan) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const getGame = (id) => byId.get(id);
  const rows = [PLAN_HEADER];

  const inside = new Map(); // hostId -> [expansion ids], in title order
  for (const g of games) {
    const host = plan.inside[g.id];
    if (host) inside.set(host, [...(inside.get(host) ?? []), g.id]);
  }

  /** A game's row, then the rows of the games stored inside it. */
  const add = (id, where, extra = {}) => {
    const g = byId.get(id);
    if (!g) return;
    rows.push([where.shelf, where.spot, where.stack ?? '', where.level ?? '', extra.pile ?? '', g.title, sizeText(g.dims), categoriesText(g), extra.notes ?? '']);
    for (const inner of inside.get(id) ?? []) {
      const e = byId.get(inner);
      rows.push([where.shelf, where.spot, where.stack ?? '', where.level ?? '', 'inside the base box', e.title, '—', categoriesText(e), `stored inside the ${g.title} box`]);
    }
  };

  const placed = new Set();
  const stacks = [...plan.stacks].sort((a, b) => zoneRank(a.zone) - zoneRank(b.zone) || a.x - b.x);
  for (const stack of stacks) {
    const layout = layoutStack(stack, getGame);
    const shelf = ZONES[stack.zone]?.label ?? stack.zone;
    const spot = spotOf(stack, layout.w);
    const notes = (stack.notes ?? []).join('; ');
    const standing = stack.orientation === 'standing';
    const counter = new Map(); // row -> boxes counted so far (standing stacks count every box)
    layout.boxes.forEach((b, i) => {
      placed.add(b.gameId);
      let level = b.index + 1;
      if (standing) {
        counter.set(b.row, (counter.get(b.row) ?? 0) + 1);
        level = counter.get(b.row);
      }
      const pile = [
        stack.rows.length > 1 ? (b.row === 0 ? 'Front row' : 'Back row') : null,
        !standing && b.side != null ? 'side by side' : null,
        b.rot ? 'long side out' : null,
        standing && layout.boxes.length === 1 ? 'Standing' : null,
      ].filter(Boolean).join(', ');
      add(b.gameId, { shelf, spot, stack: stack.id, level }, { pile, notes: i === 0 ? notes : '' });
    });
  }

  for (const { game, reason } of plan.cupboard) {
    placed.add(game);
    add(game, { shelf: 'Cupboard', spot: 'Cupboard' }, { notes: reason ?? '' });
  }
  for (const id of Object.keys(plan.inside)) placed.add(id);
  for (const g of games) {
    if (!placed.has(g.id)) add(g.id, { shelf: 'Not placed', spot: '' });
  }
  return rows;
}
