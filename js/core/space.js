// Free space per shelf unit (story D3). Pure, no DOM. Owner: Tony (lead).
//
//   UNITS                       the units in shelf order: each wall shelf as left 60 | middle 80 | right 60
//                               (top, middle, bottom), the three parts under the stairs, the narrow shelf
//   freeSpace(plan, getGame)    -> Unit[] for a v2 plan (store.getPlan2(), store.getGame), same order
//
//   Unit = {
//     id: 'bottom-2', zone: 'bottom', label: 'Bottom shelf · middle', x0: 60, x1: 140, length: 80,
//     end: 140,          how far a stack may reach in this unit: x1, or the wall end + the 8 cm overhang (208)
//     height: 36.5,      the zone's usable height (2 cm air under the shelf above)
//     approximate,       true where a size isn't measured (under-gap height, narrow shelf depth)
//     free: 12.5,        empty shelf floor in the unit, cm: the sum of `gaps`
//     widest: 10,        the widest empty stretch, cm (0 when the unit is full)
//     gaps: [{ x, w }],  the empty stretches, x along the zone, cut at the unit's edges, left to right
//     stacks: [{ id, x, w, h, room, slot }],   stacks with boxes that reach into the unit, left to right;
//                        room = height left above the stack (usable height − stack height, topper included, ≥ 0);
//                        slot = the stack's highest slot (below), or null
//     slots: [Slot],     room on top of the stacks whose top surface lies in this unit, most height first
//     room: Slot | null, the slot with the most height (null: none)
//   }
//   Slot = { stackId, y, h, x, w, rest: { x, w }, on: [gameId] }   room on top of a stack
//     y      the height of the stack's top surface: its highest box (a topper is not a surface; boxes side by
//            side within 0.5 cm of the top count too); h = usable height − y
//     x, w   the AIR at that height: from the nearest taller thing on the left to the one on the right
//            (a box, a topper, a bracket on the middle and bottom shelves, or the shelf's end). It can reach
//            over lower neighbours, e.g. above M2 from M1's narrower top box to the bracket at 60 cm.
//     rest   the part of the surface that is open from above: what a box there rests on. A box wider than
//            rest.w + 2 cm sticks out more than 1 cm (the stacking warning). on: the boxes of that surface
//            (two side by side at the same height, within 0.5 cm, count as one surface: a bridge).
//
// Front view only: what the shelf floor and the heights show from the front. Room behind a shallow stack,
// depth, and the other rules for resting on a box are left out: this is "at a glance", the rule checker
// decides. A stack across a joint counts in both units. Empty stacks (no boxes) take no room. Stretches
// narrower than MIN_GAP are left out (stacks start 0.2 cm from a joint). Slots need MIN_REST cm to rest on
// and MIN_ROOM cm of height. A bracket stops a slot's air even where a low box could pass under it. Ledges
// lower down a pile (the open edge of a wider box under a narrower one) are not slots.
import { BRACKET, ZONES, bracketLimit } from './shelves.js';
import { layoutStack2 } from './geometry.js';

export const MIN_GAP = 1; // cm
export const MIN_REST = 3; // cm: a narrower open strip of a box top isn't a place to rest a box
export const MIN_ROOM = 1; // cm of height above a surface
const EPS = 1e-6;
const LEVEL = 0.5; // two surfaces this close in height count as one (a bridge may rest on both)

const SIDES = ['left', 'middle', 'right'];
const r1 = (n) => Math.round(n * 10) / 10;

function wallUnits(zone) {
  const cuts = [0, ...zone.joints, zone.length];
  return SIDES.map((side, i) => ({
    id: `${zone.id}-${i + 1}`, zone: zone.id, label: `${zone.label} · ${side}`,
    x0: cuts[i], x1: cuts[i + 1], length: cuts[i + 1] - cuts[i],
    end: i === SIDES.length - 1 ? zone.length + zone.overhang : cuts[i + 1],
  }));
}

export const UNITS = Object.freeze(Object.values(ZONES).flatMap((z) => {
  const units = z.group === 'wall'
    ? wallUnits(z)
    : [{ id: z.id, zone: z.id, label: z.label, x0: 0, x1: z.length, length: z.length, end: z.length + z.overhang }];
  return units.map((u) => Object.freeze({ ...u, height: z.usable, approximate: !!z.approximate }));
}));

/** The empty stretches of one zone's floor between 0 and `end`, given the occupied spans [{ x0, x1 }]. */
export function emptyStretches(spans, end) {
  const out = [];
  let at = 0;
  for (const s of [...spans].sort((a, b) => a.x0 - b.x0)) {
    if (s.x0 > at) out.push({ x0: at, x1: Math.min(s.x0, end) });
    at = Math.max(at, s.x1);
    if (at >= end) break;
  }
  if (at < end) out.push({ x0: at, x1: end });
  return out.filter((g) => g.x1 > g.x0);
}

/** [a, b] minus the intervals `cut` ([{ x0, x1 }]): the parts left, left to right. */
function subtract(a, b, cut) {
  let parts = [{ a, b }];
  for (const c of cut) {
    parts = parts.flatMap((p) => (c.x1 <= p.a + EPS || c.x0 >= p.b - EPS ? [p]
      : [{ a: p.a, b: Math.min(p.b, c.x0) }, { a: Math.max(p.a, c.x1), b: p.b }].filter((q) => q.b - q.a > EPS)));
  }
  return parts;
}

/**
 * The slots of one zone (see Slot above). pieces: every box and topper of the zone as
 * { stackId, gameId (null for a topper), x0, x1, top }, in zone x.
 */
export function zoneSlots(zone, pieces) {
  const brackets = zone.brackets.map((j) => ({ x0: j - BRACKET.width / 2, x1: j + BRACKET.width / 2, top: bracketLimit(zone, zone.depth) }));
  const end = zone.length + zone.overhang;
  const above = (t) => [...pieces.filter((p) => p.top > t + EPS), ...brackets];
  // open strips of each stack's top boxes, then the strips at (about) one height merged into surfaces
  const topOf = new Map();
  for (const p of pieces) if (p.gameId) topOf.set(p.stackId, Math.max(topOf.get(p.stackId) ?? 0, p.top));
  const strips = [];
  for (const p of pieces) {
    if (!p.gameId || p.top < topOf.get(p.stackId) - LEVEL - EPS || zone.usable - p.top < MIN_ROOM) continue;
    for (const s of subtract(p.x0, p.x1, above(p.top))) strips.push({ stackId: p.stackId, y: p.top, ...s, on: [p.gameId] });
  }
  strips.sort((m, n) => m.stackId.localeCompare(n.stackId) || n.y - m.y || m.a - n.a);
  const surfaces = [];
  for (const s of strips) {
    const prev = surfaces.find((q) => q.stackId === s.stackId && Math.abs(q.y - s.y) <= LEVEL && Math.abs(q.b - s.a) <= 0.01);
    if (prev) Object.assign(prev, { b: s.b, y: Math.max(prev.y, s.y), on: [...prev.on, ...s.on] });
    else surfaces.push({ ...s });
  }
  const out = [];
  for (const s of surfaces) {
    if (s.b - s.a < MIN_REST - EPS) continue;
    const walls = above(s.y);
    const left = Math.max(0, ...walls.filter((w) => w.x1 <= s.a + EPS).map((w) => w.x1));
    const right = Math.min(end, ...walls.filter((w) => w.x0 >= s.b - EPS).map((w) => w.x0));
    out.push({
      stackId: s.stackId, y: r1(s.y), h: r1(zone.usable - s.y), x: r1(left), w: r1(right - left),
      rest: { x: r1(s.a), w: r1(s.b - s.a) }, on: s.on,
    });
  }
  return out.sort((m, n) => n.h - m.h || m.x - n.x);
}

export function freeSpace(plan, getGame) {
  const byZone = new Map();
  const pieces = new Map();
  for (const st of plan.stacks) {
    if (!st.boxes?.length || !ZONES[st.zone]) continue;
    const lay = layoutStack2(st, getGame);
    const list = byZone.get(st.zone) ?? [];
    list.push({ id: st.id, x0: st.x, x1: st.x + lay.w, h: lay.h });
    byZone.set(st.zone, list);
    const ps = pieces.get(st.zone) ?? [];
    for (const b of lay.boxes) ps.push({ stackId: st.id, gameId: b.gameId, x0: st.x + b.x, x1: st.x + b.x + b.w, top: b.y + b.h });
    if (lay.topper) ps.push({ stackId: st.id, gameId: null, x0: st.x + lay.topper.x, x1: st.x + lay.topper.x + lay.topper.w, top: lay.topper.y + lay.topper.h });
    pieces.set(st.zone, ps);
  }
  const slotsOf = new Map([...pieces].map(([z, ps]) => [z, zoneSlots(ZONES[z], ps)]));
  return UNITS.map((u) => {
    const spans = byZone.get(u.zone) ?? [];
    const zoneEnd = ZONES[u.zone].length + ZONES[u.zone].overhang;
    const gaps = emptyStretches(spans, zoneEnd)
      .map((g) => ({ x0: Math.max(g.x0, u.x0), x1: Math.min(g.x1, u.end) }))
      .filter((g) => g.x1 - g.x0 >= MIN_GAP - 1e-9)
      .map((g) => ({ x: r1(g.x0), w: r1(g.x1 - g.x0) }));
    const stacks = spans
      .filter((s) => s.x1 > u.x0 + 1e-9 && s.x0 < u.end - 1e-9)
      .sort((a, b) => a.x0 - b.x0)
      .map((s) => ({
        id: s.id, x: r1(s.x0), w: r1(s.x1 - s.x0), h: r1(s.h), room: r1(Math.max(0, u.height - s.h)),
        slot: (slotsOf.get(u.zone) ?? []).filter((q) => q.stackId === s.id).sort((m, n) => n.y - m.y)[0] ?? null,
      }));
    const slots = (slotsOf.get(u.zone) ?? []).filter((q) => {
      const mid = q.rest.x + q.rest.w / 2;
      return mid >= u.x0 - EPS && mid < u.end + EPS && (mid < u.end - EPS || u.end === ZONES[u.zone].length + ZONES[u.zone].overhang);
    });
    return {
      ...u,
      free: r1(gaps.reduce((sum, g) => sum + g.w, 0)),
      widest: gaps.reduce((m, g) => Math.max(m, g.w), 0),
      gaps,
      stacks,
      slots,
      room: slots[0] ?? null,
    };
  });
}
