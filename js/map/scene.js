// Drawing layout (story C2). Pure, no DOM: places every zone, stack and box in one drawing
// coordinate system, so draw.js only has to turn it into SVG. Owner: Bruce (Part B).
//
// Units are cm. Drawing x grows to the right, y grows DOWN (like SVG).
// The drawing is a column of bands: top, middle and bottom wall shelf, then under the stairs
// (its three parts side by side, bottom-aligned), then the narrow shelf (GROUPS order).
import { ZONES, GROUPS, BRACKET } from '../core/shelves.js';
import { layoutStack2 } from '../core/geometry.js';
import { rowForView } from './rows.js';

export const SPACING = Object.freeze({
  margin: 3,   // around the whole drawing
  label: 12,   // above each band, for its title ("Top shelf · 40 cm high")
  ids: 8,      // below each floor, for the stack ids
  // label and id text centres, as a share of their band (room for 13 / 11 px text at 1.8 px per cm)
  labelAt: 0.45,
  idAt: 0.45,
  easyPad: 0.9, // the dashed "easy to reach" outline sits this far outside the zone
  emptyW: 3,    // an empty stack is drawn as a thin outline this wide, the shelf's full height
});

const cm = (n) => Math.round(n * 100) / 100;

/** The bands of the drawing, top to bottom: [{ label, zones: [zoneId] }]. Wall levels get one band each. */
function bands() {
  const out = [];
  for (const g of GROUPS) {
    if (g.id === 'wall') for (const id of g.zones) out.push({ label: bandLabel(ZONES[id]), zones: [id] });
    else if (g.zones.length === 1) out.push({ label: bandLabel(ZONES[g.zones[0]]), zones: g.zones });
    else out.push({ label: g.label, zones: g.zones });
  }
  return out;
}

const bandLabel = (z) => `${z.label} · ${z.height} cm high`;

/**
 * Lay out the whole drawing.
 * @param plan     store.getPlan2() (schema 2)
 * @param getGame  id → game
 * @param view     'front' (default) or 'back': which row of the 2-deep stacks is drawn
 * @returns {{
 *   width, height,                          drawing size in cm
 *   labels: [{ text, x, y }],               band titles (y = text centre)
 *   zones:  [{ id, label, x, top, floor, length, height, overhang, approximate, brackets: [x] }],
 *   brackets: [{ zone, x, y, w, h }],       dark bars hanging from the shelf above
 *   easy:   [{ path, x0, x1 }],             dashed "easy to reach" outlines (SVG path data)
 *   stacks: [{ id, zone, x, w, h, top, floor, rows, deep, empty, back: [gameId], label: { x, y },
 *              boxes: [{ gameId, x, y, w, h, row, up, rot, on, vertical }],
 *              ghosts: [{ gameId, x, y, w, h }],
 *              topper: null | { label, x, y, w, h }, layout, plan }]
 * }}
 * Box x/y is the top-left corner in the drawing; positions come from core layoutStack2 (gravity:
 * a box sits on the highest of its supports, bridges included). vertical: taller than wide, so its
 * title runs up the box. `boxes` holds the row the view draws: the front row, or for a 2-deep stack
 * in the back view its back row, with its front row in `ghosts` (faint outlines drawn in front).
 * `back` always lists the back-row game ids. An empty stack (empty: true; stacks keep their ids,
 * part-b3 item 5) is SPACING.emptyW wide and as tall as its shelf, so it can be seen and tapped.
 */
export function buildScene(plan, getGame, { view = 'front' } = {}) {
  const { margin, label, ids } = SPACING;
  const zones = new Map();
  const labels = [];
  let y = margin;
  for (const band of bands()) {
    const top = y + label;
    const height = Math.max(...band.zones.map((id) => ZONES[id].height));
    const floor = top + height;
    labels.push({ text: band.label, x: margin, y: cm(y + label * SPACING.labelAt) });
    for (const id of band.zones) {
      const z = ZONES[id];
      zones.set(id, {
        id, label: z.label, x: cm(margin + (z.offset ?? 0)), top: cm(floor - z.height), floor: cm(floor),
        length: z.length, height: z.height, overhang: z.overhang ?? 0, approximate: !!z.approximate,
        brackets: z.brackets.map((bx) => cm(margin + (z.offset ?? 0) + bx)),
      });
    }
    y = floor + ids;
  }

  const brackets = [];
  for (const z of zones.values()) {
    for (const bx of z.brackets) {
      brackets.push({ zone: z.id, x: cm(bx - BRACKET.width / 2), y: z.top, w: BRACKET.width, h: BRACKET.maxHeight });
    }
  }

  const stacks = [];
  for (const st of plan.stacks) {
    const z = zones.get(st.zone);
    if (!z) continue; // the schema check keeps unknown zones out; never crash the drawing
    stacks.push(placeStack(st, z, getGame, rowForView(view)));
  }

  let right = 0;
  for (const z of zones.values()) right = Math.max(right, z.x + z.length + z.overhang);
  for (const st of stacks) {
    right = Math.max(right, st.x + st.w);
    if (st.topper) right = Math.max(right, st.topper.x + st.topper.w);
  }

  return {
    width: cm(right + margin),
    height: cm(y + margin - ids / 2),
    labels,
    zones: [...zones.values()],
    brackets,
    easy: easyOutlines([...zones.values()]),
    stacks,
  };
}

function placeStack(st, z, getGame, row) {
  const lay = layoutStack2(st, getGame);
  const x = z.x + st.x;
  const deep = lay.boxes.some((b) => b.row > 0);
  const shown = deep ? row : 0;
  const place = (b) => ({
    gameId: b.gameId, x: cm(x + b.x), y: cm(z.floor - b.y - b.h), w: b.w, h: b.h,
    row: b.row, up: b.up, rot: b.rot, on: b.on, vertical: b.h > b.w,
  });
  const boxes = lay.boxes.filter((b) => b.row === shown).map(place);
  const ghosts = shown > 0
    ? lay.boxes.filter((b) => b.row === 0).map((b) => { const p = place(b); return { gameId: p.gameId, x: p.x, y: p.y, w: p.w, h: p.h }; })
    : [];
  const t = lay.topper;
  const empty = !lay.boxes.length && !t;
  const w = empty ? SPACING.emptyW : lay.w;
  const h = empty ? z.height : lay.h;
  return {
    id: st.id, zone: st.zone, x: cm(x), w, h, top: cm(z.floor - h), floor: z.floor,
    rows: lay.rows,
    deep,
    empty,
    back: lay.boxes.filter((b) => b.row > 0).map((b) => b.gameId),
    label: { x: cm(x + w / 2), y: cm(z.floor + SPACING.ids * SPACING.idAt) },
    boxes,
    ghosts,
    topper: t ? { label: t.label, x: cm(x + t.x), y: cm(z.floor - t.y - t.h), w: t.w, h: t.h } : null,
    layout: lay,
    plan: st, // the plan stack this was drawn from
  };
}

/**
 * Dashed outlines around the easy-to-reach ranges. Ranges that touch on the same floor
 * (the three parts under the stairs) merge into one outline that steps with the zone heights.
 */
function easyOutlines(zones) {
  const pad = SPACING.easyPad;
  const byFloor = new Map();
  for (const z of zones) {
    for (const [a, b] of ZONES[z.id].easy) {
      const seg = { x0: z.x + a, x1: z.x + b, top: z.top, floor: z.floor };
      if (!byFloor.has(z.floor)) byFloor.set(z.floor, []);
      byFloor.get(z.floor).push(seg);
    }
  }
  const out = [];
  for (const segs of byFloor.values()) {
    segs.sort((p, q) => p.x0 - q.x0);
    let run = [];
    const flush = () => {
      if (run.length) out.push(outline(run, pad));
      run = [];
    };
    for (const seg of segs) {
      if (run.length && seg.x0 > run.at(-1).x1 + 0.01) flush();
      run.push(seg);
    }
    flush();
  }
  return out;
}

function outline(run, pad) {
  const floor = run[0].floor + pad;
  const x0 = run[0].x0 - pad;
  const x1 = run.at(-1).x1 + pad;
  const parts = [`M${cm(x0)} ${cm(floor)}`, `V${cm(run[0].top - pad)}`];
  run.forEach((seg, i) => {
    const next = run[i + 1];
    if (!next) {
      parts.push(`H${cm(x1)}`);
    } else if (next.top !== seg.top) {
      // step at the boundary between two parts; the taller part's outline stays outside
      const bx = seg.top < next.top ? seg.x1 + pad : next.x0 - pad;
      parts.push(`H${cm(bx)}`, `V${cm(next.top - pad)}`);
    }
  });
  parts.push(`V${cm(floor)}`, 'Z');
  return { path: parts.join(' '), x0: cm(x0), x1: cm(x1) };
}

/**
 * Where a game is drawn: { stack, box }, or null if not on a stack. box is null when the game is in
 * the row this view doesn't draw (a back-row game in the front view, or the other way round).
 */
export function findInScene(scene, gameId) {
  for (const stack of scene.stacks) {
    const box = stack.boxes.find((b) => b.gameId === gameId);
    if (box) return { stack, box };
    if (stack.back.includes(gameId) || stack.ghosts.some((g) => g.gameId === gameId)) return { stack, box: null };
  }
  return null;
}
