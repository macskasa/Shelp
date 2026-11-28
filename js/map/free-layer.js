// Free space on the map (part-b7, D3), the parts without DOM, so Node can test them. Owner: Bruce (Part B).
// The numbers are Tony's: freeSpace(plan, getGame) from js/core/space.js. This only places them in the
// drawing (scene.js coordinates: cm, y down) and words them.
//   freeBands(units, scene)        one band per slot, standing space and gap: { key, kind, unit, zone, stackIds,
//                                  slot | gap, air: {x,y,w,h}, rest: {x,y,w} | null, hit: {x,y,w,h}, text }
//   fitLabel(rect, text, k, measure)  where a label fits at k screen px per cm: { x, y, vertical } | null
//   placeLabels(bands, k, measure) the labels that fit and don't overlap one another: Map key → { x, y, vertical }
//   bandAt(bands, pt, tol)         the band a tap at drawing point pt means (the smallest one it is in,
//                                  else the nearest within tol cm), or null
//   bandLine(band, plan, getGame)  the caption: { text, join: [left, right] | null }
//   pushForStack(units, stackId)   the unit's Push when this stack is one that moves, else null
//   pushLabel(push)                "Push to the wall (+2.5 cm)"
//   wallEndX(plan, getGame, zone, x, w)  a new stack against the wall end, when the tapped gap runs to it
//   preferWall(atTap, atWall)      true when the wall end adds no rule problem the tapped spot doesn't have
//   newStackAt(store, gameId, zone, x, o)  x of a new stack for a way up o: fitNewStack, or the wall end
//   parseFreeParam / freeHash      #/map?free=1: is it on, and the map route with it on or off
import { ZONES } from '../core/shelves.js';
import { layoutStack2 } from '../core/geometry.js';
import { fitNewStack, newStackFn, checkMove } from './stacks.js';

/** Height of the hatched band along the floor of a gap (cm). */
export const GAP_H = 1.6;
/** Labels are drawn at this size (screen px), and only where they fit. */
export const LABEL_PX = 11;
const PAD_PX = 4;

const r2 = (n) => Math.round(n * 100) / 100;
export const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });

/** The short label: "22.9 × 7.4" (air width × height), "4.3 wide" (standing), "12.5 cm" (gap). */
export function bandText(kind, w, h) {
  if (kind === 'gap') return `${num(w)} cm`;
  if (kind === 'standing') return `${num(w)} wide`;
  return `${num(w)} × ${num(h)}`;
}

/**
 * Bands for the units of freeSpace(), in a scene from scene.js (the front view: zone positions are the
 * same in either row). Slots and standing spaces first (most height first, as the core lists them), then gaps.
 */
export function freeBands(units, scene) {
  const zones = new Map(scene.zones.map((z) => [z.id, z]));
  const seen = new Set();
  const out = [];
  for (const u of units ?? []) {
    const z = zones.get(u.zone);
    if (!z) continue;
    for (const slot of [...(u.slots ?? []), ...(u.standing ?? [])]) {
      const key = `${slot.kind}|${slot.stackIds.join('+')}|${slot.y}|${slot.x}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const air = { x: r2(z.x + slot.x), y: r2(z.floor - slot.y - slot.h), w: slot.w, h: slot.h };
      out.push({
        key, kind: slot.kind, unit: u.id, zone: u.zone, stackIds: [...slot.stackIds], slot,
        air, hit: air, rest: { x: r2(z.x + slot.rest.x), y: r2(z.floor - slot.y), w: slot.rest.w },
        text: bandText(slot.kind, slot.w, slot.h),
      });
    }
    for (const gap of u.gaps ?? []) {
      const key = `gap|${u.zone}|${gap.x}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const x = r2(z.x + gap.x);
      out.push({
        key, kind: 'gap', unit: u.id, unitLabel: u.label, zone: u.zone, stackIds: [], gap,
        air: { x, y: r2(z.floor - GAP_H), w: gap.w, h: GAP_H },
        hit: { x, y: z.top, w: gap.w, h: z.height }, // the whole empty column
        rest: null,
        text: bandText('gap', gap.w),
      });
    }
  }
  return out;
}

/** Where a band's label goes: in its air, or for a gap in the empty column above the hatching. */
export function labelRect(band) {
  if (band.kind !== 'gap') return band.air;
  return { x: band.hit.x, y: band.hit.y, w: band.hit.w, h: band.hit.h - GAP_H };
}

/**
 * Where `text` fits in rect (cm) at k screen px per cm: across, or else up the band (a standing space,
 * a narrow gap). Returns its centre and direction, or null when it fits neither way.
 */
export function fitLabel(rect, text, k, measure) {
  const len = measure(text) + 2 * PAD_PX;
  const line = LABEL_PX + 2;
  const wPx = rect.w * k;
  const hPx = rect.h * k;
  const at = { x: r2(rect.x + rect.w / 2), y: r2(rect.y + rect.h / 2) };
  if (wPx >= len && hPx >= line) return { ...at, vertical: false };
  if (hPx >= len && wPx >= line) return { ...at, vertical: true };
  return null;
}

/**
 * Every label that fits at k screen px per cm (fitLabel), smallest band first; a label that would
 * overlap one already placed is left out (it shows on tap). Returns Map key → { x, y, vertical }.
 */
export function placeLabels(bands, k, measure) {
  const out = new Map();
  const boxes = [];
  const gap = 2 / k; // 2 px between labels
  for (const b of [...bands].sort((p, q) => p.air.w * p.air.h - q.air.w * q.air.h)) {
    const at = fitLabel(labelRect(b), b.text, k, measure);
    if (!at) continue;
    const len = (measure(b.text) + 2 * PAD_PX) / k / 2 + gap;
    const half = (LABEL_PX + 2) / k / 2 + gap;
    const [hw, hh] = at.vertical ? [half, len] : [len, half];
    const box = { x0: at.x - hw, x1: at.x + hw, y0: at.y - hh, y1: at.y + hh };
    if (boxes.some((o) => o.x0 < box.x1 && box.x0 < o.x1 && o.y0 < box.y1 && box.y0 < o.y1)) continue;
    boxes.push(box);
    out.set(b.key, at);
  }
  return out;
}

const inside = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const dist = (r, p) => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));

/** The band at drawing point pt: the smallest whose tap area holds it, else the nearest within tol cm. */
export function bandAt(bands, pt, tol = 0) {
  let best = null;
  let bestArea = Infinity;
  for (const b of bands) {
    const a = b.hit.w * b.hit.h;
    if (inside(b.hit, pt) && a < bestArea) {
      best = b;
      bestArea = a;
    }
  }
  if (best) return best;
  let near = Infinity;
  for (const b of bands) {
    const d = dist(b.hit, pt);
    if (d <= tol && d < near) {
      best = b;
      near = d;
    }
  }
  return best;
}

const and = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/**
 * The caption line for a tapped band.
 *   "On T8: standing room 4.3 cm wide · 31.8 cm high · rests on Anachrony: A jövő útjai"
 *   "Across M1 and M2: room on top … · join them to rest a box across both"   (join: ['M1', 'M2'])
 *   "Bottom shelf · left: empty floor 1.4 cm wide · at 58.6 cm"
 * @returns {{ text, join: [string, string] | null }}
 */
export function bandLine(band, plan, getGame) {
  if (band.kind === 'gap') {
    return { text: `${band.unitLabel ?? band.zone}: empty floor ${num(band.gap.w)} cm wide · at ${num(band.gap.x)} cm`, join: null };
  }
  const s = band.slot;
  const xOf = (id) => plan?.stacks?.find((st) => st.id === id)?.x ?? 0;
  const ids = [...new Set(s.stackIds)].sort((a, b) => xOf(a) - xOf(b));
  const across = ids.length > 1;
  const what = s.kind === 'standing' ? 'standing room' : 'room on top';
  const titles = s.on.map((id) => getGame(id)?.title ?? id);
  const parts = [`${what} ${num(s.w)} cm wide`, `${num(s.h)} cm high`];
  if (titles.length) parts.push(`rests on ${and(titles)}`);
  if (s.tilt > 0) parts.push(`${num(s.tilt)} cm tilt`);
  if (across) parts.push('join them to rest a box across both');
  const head = across ? `Across ${and(ids)}` : `On ${ids[0] ?? s.stackId}`;
  return { text: `${head}: ${parts.join(' · ')}`, join: across && ids.length === 2 ? ids : null };
}

/** The Push of the unit in which this stack is one that moves (unit.push.moves), else null. */
export function pushForStack(units, stackId) {
  return (units ?? []).find((u) => u.push?.moves.some((m) => m.stackId === stackId))?.push ?? null;
}

/** The Push of a band's unit (a gap tapped in a wall-end unit), else null. */
export function pushForBand(units, band) {
  return (units ?? []).find((u) => u.id === band?.unit)?.push ?? null;
}

export const pushLabel = (push) => `Push to the wall (+${num(push.gain)} cm)`;

/**
 * A new stack of width w against the wall end (its box ends at length + overhang, 208 on the wall
 * shelves), when the empty stretch the tap at x landed in runs to the wall end; else null.
 * @param plan  the plan the stack goes into (store.getPlan2())
 */
export function wallEndX(plan, getGame, zoneId, x, w) {
  const z = ZONES[zoneId];
  if (!z || z.group !== 'wall' || !(w > 0)) return null;
  const end = z.length + (z.overhang ?? 0);
  const eps = 1e-6;
  const spans = plan.stacks.filter((s) => s.zone === zoneId)
    .map((s) => ({ a: s.x, b: s.x + layoutStack2(s, getGame).w }));
  if (spans.some((s) => s.a <= x + eps && s.b > x + eps)) return null; // the tap is on a stack
  const start = Math.max(0, ...spans.filter((s) => s.a <= x + eps).map((s) => s.b));
  if (spans.some((s) => s.a > x + eps && s.a < end - eps)) return null; // another stack before the wall end
  const at = r2(end - w);
  return at >= start - eps ? at : null;
}

/** The rules a spot breaks, as keys that don't depend on the new stack's x. */
const keys = (c) => new Set([...(c.block ?? []), ...(c.warn ?? [])].map((p) => `${p.rule}|${p.gameId ?? ''}|${p.otherStackId ?? ''}`));

/**
 * Whether a new stack goes against the wall end: only when that works (no error) and adds no rule
 * problem the tapped spot doesn't have. atTap / atWall: checkMove() results for the two spots.
 */
export function preferWall(atTap, atWall) {
  if (!atWall || atWall.error) return false;
  if (atTap?.error) return true;
  const tap = keys(atTap);
  return [...keys(atWall)].every((k) => tap.has(k));
}

/** #/map?free=1 turns the overlay on. */
export const parseFreeParam = (params) => params?.free === '1';

/** The map route for these params with the overlay on or off (the other params kept). */
export function freeHash(params, on) {
  const entries = Object.entries(params ?? {}).filter(([k, v]) => k !== 'free' && v != null && v !== '');
  if (on) entries.push(['free', '1']);
  const q = new URLSearchParams(entries).toString();
  return `#/map${q ? `?${q}` : ''}`;
}

/**
 * Where a new stack goes for a tap at x (newStackX) and a way up o ({ up, rot, w }): against the wall end
 * when the tapped gap runs to it and preferWall agrees, else where fitNewStack puts it.
 */
export function newStackAt(store, gameId, zone, x, o) {
  const plan = store.getPlan2();
  const fit = fitNewStack(plan, store.getGame, zone, x, o.w);
  const wall = wallEndX(plan, store.getGame, zone, x, o.w);
  if (wall == null || wall === fit) return fit;
  const check = (at) => checkMove(store, newStackFn(store, gameId, zone, at, o), 'Place');
  return preferWall(check(fit), check(wall)) ? wall : fit;
}
