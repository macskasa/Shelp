// Export to the planning workbook (story E3): the catalog and the shelf plan as CSV. No DOM. Owner: Stephen (Part A).
// The columns are the ones of the workbook tabs, so Adam can paste the cells back.
import { CATEGORIES } from '../core/categories.js';
import { describeLocation2, formatRange } from '../core/format.js';
import { layoutStack2 } from '../core/geometry.js';
import { ZONES, isEasy } from '../core/shelves.js';
import { localDate } from './time.js';

export const CATALOG_HEADER = [
  'Title', 'BGG', 'Box size (cm)', 'Players', 'Play time (min)', 'Age', 'BGG name', 'Type', 'Location',
  'Box size from', 'In BGG collection', 'Notes', 'Family',
];
export const PLAN_HEADER = [
  'Shelf', 'Spot', 'Stack (left → right)', 'Level / position (1 = bottom)', 'Row / pile', 'Game', 'Box size (cm)',
  'Categories', 'Family', 'Notes',
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

/** One row per game, in the order given (the store sorts by title). `locateGame` is store.locate2. */
export function catalogRows(games, locateGame) {
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
    describeLocation2(locateGame(g.id), (id) => title.get(id) ?? id),
    g.sizeSource ?? '',
    g.inBgg ? 'Yes' : 'No',
    g.notes ?? '',
    g.family ?? '',
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

/** Where a box sits in the tree: 1 = on the shelf, 2 = on a box that is on the shelf … (the longest path down). */
function treeLevels(boxes) {
  const byId = new Map(boxes.map((b) => [b.gameId, b]));
  const memo = new Map();
  const level = (id, path = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (path.has(id)) return 1; // a loop: the schema check refuses those, never hang here
    path.add(id);
    const under = (byId.get(id)?.on ?? []).filter((u) => byId.has(u));
    const v = under.length ? 1 + Math.max(...under.map((u) => level(u, path))) : 1;
    memo.set(id, v);
    return v;
  };
  return new Map(boxes.map((b) => [b.gameId, level(b.gameId)]));
}

/**
 * Every game exactly once: the stacks (by shelf, then left to right), games stored inside a box right after
 * their host, then the cupboard, then the board (games that were moved there, then games with no place).
 * `plan` is a v2 plan (store.getPlan2()).
 *
 * Level / position: the level in the tree (1 = on the shelf, 2 = on a box that is on the shelf …, the longest
 * path down). A box that stands on the shelf floor (not flat) gets its position from the left in its row instead.
 */
export function planRows(games, plan) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const getGame = (id) => byId.get(id);
  const title = (id) => byId.get(id)?.title ?? id;
  const rows = [PLAN_HEADER];

  const inside = new Map(); // hostId -> [expansion ids], in title order
  for (const g of games) {
    const host = plan.inside?.[g.id];
    if (host) inside.set(host, [...(inside.get(host) ?? []), g.id]);
  }

  /** A game's row, then the rows of the games stored inside it. */
  const add = (id, where, extra = {}) => {
    const g = byId.get(id);
    if (!g) return;
    rows.push([where.shelf, where.spot, where.stack ?? '', where.level ?? '', extra.pile ?? '', g.title, sizeText(g.dims), categoriesText(g), g.family ?? '', extra.notes ?? '']);
    for (const inner of inside.get(id) ?? []) {
      const e = byId.get(inner);
      rows.push([where.shelf, where.spot, where.stack ?? '', where.level ?? '', 'inside the base box', e.title, '—', categoriesText(e), e.family ?? '', `stored inside the ${g.title} box`]);
    }
  };

  const placed = new Set();
  const stacks = [...plan.stacks].sort((a, b) => zoneRank(a.zone) - zoneRank(b.zone) || a.x - b.x);
  for (const stack of stacks) {
    const layout = layoutStack2(stack, getGame);
    const shelf = ZONES[stack.zone]?.label ?? stack.zone;
    const spot = spotOf(stack, layout.w);
    const notes = (stack.notes ?? []).join('; ');
    const tree = treeLevels(layout.boxes);
    const siblings = new Map(); // "row|supports" -> how many boxes rest on exactly those supports
    for (const b of layout.boxes) {
      if (b.on.length) siblings.set(`${b.row}|${b.on.join(',')}`, (siblings.get(`${b.row}|${b.on.join(',')}`) ?? 0) + 1);
    }
    const standsOnFloor = (b) => b.up !== 's' && !b.on.length;
    const position = new Map(); // gameId -> place from the left among the standing boxes of its row
    for (const r of [0, 1]) {
      layout.boxes.filter((b) => b.row === r && standsOnFloor(b)).sort((a, b) => a.x - b.x).forEach((b, i) => position.set(b.gameId, i + 1));
    }
    const ordered = [...layout.boxes].sort((a, b) => a.row - b.row || tree.get(a.gameId) - tree.get(b.gameId) || a.x - b.x);
    ordered.forEach((b, i) => {
      placed.add(b.gameId);
      const level = standsOnFloor(b) ? position.get(b.gameId) : tree.get(b.gameId);
      const pile = [
        layout.rows > 1 ? (b.row === 0 ? 'Front row' : 'Back row') : null,
        b.on.length && siblings.get(`${b.row}|${b.on.join(',')}`) > 1 ? 'side by side' : null,
        b.up === 'l' ? 'standing' : b.up === 'm' ? 'on its side' : null,
        b.rot ? 'long side out' : null,
        b.on.length === 2 ? `across ${title(b.on[0])} and ${title(b.on[1])}` : null,
      ].filter(Boolean).join(', ');
      add(b.gameId, { shelf, spot, stack: stack.id, level }, { pile, notes: i === 0 ? notes : '' });
    });
  }

  for (const { game, reason } of plan.cupboard) {
    placed.add(game);
    add(game, { shelf: 'Cupboard', spot: 'Cupboard' }, { notes: reason ?? '' });
  }
  for (const id of Object.keys(plan.inside ?? {})) placed.add(id);

  // the board: the games moved there in order, then every game that has no place at all
  for (const { game } of plan.board ?? []) {
    if (placed.has(game)) continue;
    placed.add(game);
    add(game, { shelf: 'Board', spot: '' });
  }
  for (const g of games) {
    if (!placed.has(g.id)) add(g.id, { shelf: 'Board', spot: '' });
  }
  return rows;
}
