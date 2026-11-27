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
//     stacks: [{ id, x, w, h, room }],   stacks with boxes that reach into the unit, left to right;
//                        room = height left above the stack (usable height − stack height, topper included, ≥ 0)
//     room: { stackId, h } | null,       the stack with the most room above it (null: no stacks)
//   }
//
// Front view only: what the shelf floor and the heights show from the front. Room behind a shallow stack,
// brackets, and the rules for resting on a box are left out: this is "at a glance", the rule checker decides.
// A stack across a joint counts in both units. Empty stacks (no boxes) take no room. Stretches narrower than
// MIN_GAP are left out (stacks start 0.2 cm from a joint).
import { ZONES } from './shelves.js';
import { layoutStack2 } from './geometry.js';

export const MIN_GAP = 1; // cm

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

export function freeSpace(plan, getGame) {
  const byZone = new Map();
  for (const st of plan.stacks) {
    if (!st.boxes?.length || !ZONES[st.zone]) continue;
    const lay = layoutStack2(st, getGame);
    const list = byZone.get(st.zone) ?? [];
    list.push({ id: st.id, x0: st.x, x1: st.x + lay.w, h: lay.h });
    byZone.set(st.zone, list);
  }
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
      .map((s) => ({ id: s.id, x: r1(s.x0), w: r1(s.x1 - s.x0), h: r1(s.h), room: r1(Math.max(0, u.height - s.h)) }));
    const top = stacks.reduce((best, s) => (!best || s.room > best.room ? s : best), null);
    return {
      ...u,
      free: r1(gaps.reduce((sum, g) => sum + g.w, 0)),
      widest: gaps.reduce((m, g) => Math.max(m, g.w), 0),
      gaps,
      stacks,
      room: top ? { stackId: top.id, h: top.room } : null,
    };
  });
}
