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
//                        slot = the stack's highest 'top' slot (below), or null
//     slots: [Slot],     room on top of the stacks (kind 'top') whose surface lies (mostly) in this unit, most height first
//     standing: [Slot],  standing spaces (kind 'standing') in this unit, most height first
//     room: Slot | null, slots[0]: the room on top with the most height (null: none)
//   }
//   Slot = { kind, stackId, stackIds, y, h, x, w, rest: { x, w }, tilt, on: [gameId] }
//     kind   'top': on top of a stack; 'standing': a ledge lower down, beside something taller, e.g. the open
//            edge of Anachrony next to KLASK: narrow and tall, where a box can stand (#88)
//     y      the height of the surface (a topper is not a surface); h = usable height − y
//     x, w   the AIR at that height: from the nearest taller thing on the left to the one on the right
//            (a box or topper more than TILT higher, a bracket on the middle and bottom shelves, or the shelf's
//            end). It can reach over lower neighbours, e.g. above M2 from M1's narrower top box to the bracket.
//     rest   the open part of the surface: what a box there rests on. A box wider than rest.w + 2 cm sticks
//            out more than 1 cm (the stacking warning). on: the boxes of that surface.
//     tilt   surfaces within TILT (0.5 cm, as for a bridge) side by side count as one, also across two stacks
//            (stackIds), so a box may rest across them a little tilted (#89); tilt is the height difference,
//            y the higher one. stackId: the stack with the most of the surface.
//
// Front view only: what the shelf floor and the heights show from the front. Room behind a shallow stack,
// depth, and the other rules for resting on a box are left out: this is "at a glance", the rule checker
// decides. A stack across a joint counts in both units. Empty stacks (no boxes) take no room. Stretches
// narrower than MIN_GAP are left out (stacks start 0.2 cm from a joint). Slots need MIN_REST cm to rest on
// and MIN_ROOM cm of height. A bracket stops a slot's air even where a low box could pass under it.
import { BRACKET, ZONES, bracketLimit } from './shelves.js';
import { layoutStack2 } from './geometry.js';

export const MIN_GAP = 1; // cm
export const MIN_REST = 2; // cm: a narrower open strip of a box top isn't a place to rest a box (thin boxes stand)
export const MIN_ROOM = 1; // cm of height above a surface
const EPS = 1e-6;
export const TILT = 0.5; // cm: surfaces this close in height count as one, as for a bridge (#89)
const TOUCH = 0.5; // cm: strips this close side by side make one surface

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
  // a wall at height t: anything more than TILT cm higher (a box up to TILT higher is level enough to rest across)
  const walls = (t) => [...pieces.filter((p) => p.top > t + TILT + EPS), ...brackets];
  const topOf = new Map();
  for (const p of pieces) if (p.gameId) topOf.set(p.stackId, Math.max(topOf.get(p.stackId) ?? 0, p.top));
  // the open strips of every box top
  const strips = [];
  for (const p of pieces) {
    if (!p.gameId || zone.usable - p.top < MIN_ROOM) continue;
    for (const s of subtract(p.x0, p.x1, walls(p.top))) strips.push({ stackId: p.stackId, y: p.top, ...s, on: [p.gameId] });
  }
  // strips that touch (or overlap, front and back row) and lie within TILT of each other make one surface,
  // also across two stacks side by side
  strips.sort((m, n) => m.a - n.a || n.y - m.y);
  const surfaces = [];
  for (const st of strips) {
    const across = (x) => brackets.some((br) => br.x0 < Math.max(x.b, st.b) - EPS && br.x1 > Math.min(x.a, st.a) + EPS
      && !(br.x1 <= x.a + EPS && br.x1 <= st.a + EPS) && !(br.x0 >= x.b - EPS && br.x0 >= st.b - EPS));
    const q = surfaces.find((x) => st.a <= x.b + TOUCH + EPS && st.b >= x.a - TOUCH - EPS
      && Math.max(x.hi, st.y) - Math.min(x.lo, st.y) <= TILT + EPS && !across(x)); // never across a bracket
    if (q) {
      Object.assign(q, { a: Math.min(q.a, st.a), b: Math.max(q.b, st.b), lo: Math.min(q.lo, st.y), hi: Math.max(q.hi, st.y) });
      q.on.push(...st.on.filter((id) => !q.on.includes(id)));
      q.share.set(st.stackId, (q.share.get(st.stackId) ?? 0) + st.b - st.a);
    } else {
      surfaces.push({ a: st.a, b: st.b, lo: st.y, hi: st.y, on: [...st.on], share: new Map([[st.stackId, st.b - st.a]]) });
    }
  }
  const out = [];
  for (const s of surfaces) {
    if (s.b - s.a < MIN_REST - EPS || zone.usable - s.hi < MIN_ROOM) continue;
    const ws = walls(s.hi);
    const left = Math.max(0, ...ws.filter((w) => w.x1 <= s.a + EPS).map((w) => w.x1));
    const right = Math.min(end, ...ws.filter((w) => w.x0 >= s.b - EPS).map((w) => w.x0));
    const stackIds = [...s.share.keys()];
    const stackId = [...s.share].sort((m, n) => n[1] - m[1])[0][0];
    out.push({
      kind: stackIds.some((id) => s.hi >= topOf.get(id) - TILT - EPS) ? 'top' : 'standing',
      stackId, stackIds, y: r1(s.hi), h: r1(zone.usable - s.hi), x: r1(left), w: r1(right - left),
      rest: { x: r1(s.a), w: r1(s.b - s.a) }, tilt: r1(s.hi - s.lo), on: s.on,
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
        slot: (slotsOf.get(u.zone) ?? []).filter((q) => q.kind === 'top' && q.stackIds.includes(s.id)).sort((m, n) => n.y - m.y)[0] ?? null,
      }));
    const here = (slotsOf.get(u.zone) ?? []).filter((q) => {
      const mid = q.rest.x + q.rest.w / 2;
      return mid >= u.x0 - EPS && mid < u.end + EPS && (mid < u.end - EPS || u.end === ZONES[u.zone].length + ZONES[u.zone].overhang);
    });
    return {
      ...u,
      free: r1(gaps.reduce((sum, g) => sum + g.w, 0)),
      widest: gaps.reduce((m, g) => Math.max(m, g.w), 0),
      gaps,
      stacks,
      slots: here.filter((q) => q.kind === 'top'),
      standing: here.filter((q) => q.kind === 'standing'),
      room: here.find((q) => q.kind === 'top') ?? null,
    };
  });
}
