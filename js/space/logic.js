// Free space screen: texts, totals and bar fractions without DOM (story D3). Owner: Peter (Part C).
// The numbers come from freeSpace() in js/core/space.js; nothing here works out free space itself.

const r1 = (n) => Math.round(n * 10) / 10;

/** 10 -> "10", 4.1 -> "4.1", 1.50 -> "1.5" */
export function cm(n) {
  return String(r1(n));
}

/** { main: '10 cm free' | 'Full', extra: 'widest 6 cm' | '' } for one unit. */
export function floorText(unit) {
  if (!(unit.free > 0)) return { main: 'Full', extra: '' };
  return {
    main: `${cm(unit.free)} cm free`,
    extra: unit.gaps.length > 1 ? `widest ${cm(unit.widest)} cm` : '',
  };
}

/** "M2" / "M1 and M2": where a slot is. */
const stacksOf = (slot) => (slot.stackIds?.length > 1 ? slot.stackIds.join(' and ') : slot.stackId);

/** The depth of the shelf of a unit: the deepest air of any slot, or the floor behind a stack up to the back wall. */
export function shelfDepth(unit) {
  if (unit.depth > 0) return unit.depth;
  return Math.max(0, ...[...(unit.slots ?? []), ...(unit.standing ?? [])].map((s) => s.d ?? 0), ...(unit.behind ?? []).map((b) => b.z + b.d));
}

/** "On B6" / "Across M1 and M2" / "On a_way (front row)": where a slot is. */
function placeText(slot, nameOf) {
  if (slot.row === 0 && slot.on?.length) return `On ${slot.on.map((id) => nameOf(id)).join(' + ')} (front row)`;
  return `${slot.stackIds?.length > 1 ? 'Across' : 'On'} ${stacksOf(slot)}${slot.row === 0 ? ' (front row)' : ''}`;
}

/** "only 9.5 cm deep" when the air is less deep than the shelf, "" otherwise. */
function onlyDeep(slot, depth) {
  return slot.d > 0 && depth > 0 && slot.d < depth && cm(slot.d) !== cm(depth) ? `only ${cm(slot.d)} cm deep` : '';
}

/** "rests on Port Royal, 12.7 cm" (or just "rests on 12.7 cm" without names). */
function restsOn(slot, nameOf) {
  const names = (slot.on ?? []).map((id) => nameOf(id));
  return `rests on ${names.length ? `${names.join(' + ')}, ` : ''}${cm(slot.rest.w)} cm`;
}

/**
 * One slot of room on top in words: "On M2: 4.1 cm high · 32.7 cm of air · rests on Port Royal, 12.7 cm".
 * The air is left out when it is no wider than what the box rests on (+ 2 cm), except across two stacks.
 * A surface across two stacks: "Across M1 and M2: 7.4 cm high · … · 0.4 cm tilt" ("tilt" only when it is above 0).
 * "No room on top" when the height rounds to 0. nameOf(gameId) -> the game's title (defaults to the id).
 */
export function slotText(slot, nameOf = (id) => id, depth = 0) {
  if (cm(slot.h) === '0') return 'No room on top';
  const across = slot.stackIds?.length > 1;
  const parts = [`${placeText(slot, nameOf)}: ${cm(slot.h)} cm high`];
  const rest = slot.rest;
  if (rest && (across || slot.w > rest.w + 2)) parts.push(`${cm(slot.w)} cm of air`);
  if (onlyDeep(slot, depth)) parts.push(onlyDeep(slot, depth));
  if (rest) parts.push(restsOn(slot, nameOf));
  if (cm(slot.tilt ?? 0) !== '0') parts.push(`${cm(slot.tilt)} cm tilt`);
  return parts.join(' · ');
}

/** A standing space in words, the width first (it limits a standing box): "On T8: 4.3 cm wide · 31.8 cm high · rests on Anachrony, 4 cm". */
export function standingText(slot, nameOf = (id) => id, depth = 0) {
  const parts = [`${placeText(slot, nameOf)}: ${cm(slot.w)} cm wide · ${cm(slot.h)} cm high`];
  if (onlyDeep(slot, depth)) parts.push(onlyDeep(slot, depth));
  if (slot.rest) parts.push(restsOn(slot, nameOf));
  if (cm(slot.tilt ?? 0) !== '0') parts.push(`${cm(slot.tilt)} cm tilt`);
  return parts.join(' · ');
}

/** The unit's standing spaces, one text each, most height first. */
export function standingRoom(unit, nameOf) {
  return (unit.standing ?? []).filter((s) => cm(s.h) !== '0').map((s) => standingText(s, nameOf, shelfDepth(unit)));
}

/** "Standing room (3)" for the toggle, "" when there is none. */
export function standingLabel(unit, nameOf) {
  const n = standingRoom(unit, nameOf).length;
  return n ? `Standing room (${n})` : '';
}

/** The room line of a unit: its best slot in words; "" without stacks; "(not measured)" is added for approximate units. */
export function roomText(unit, nameOf) {
  const base = unit.room ? slotText(unit.room, nameOf, shelfDepth(unit)) : '';
  if (!unit.approximate) return base;
  return base ? `${base} (not measured)` : '(not measured)';
}

/** The unit's other slots, one text each, most height first (the best one is the room line). */
export function moreRoom(unit, nameOf) {
  return (unit.slots ?? []).filter((s) => s !== unit.room && cm(s.h) !== '0').map((s) => slotText(s, nameOf, shelfDepth(unit)));
}

/** "More room on top (3)" for the toggle, "" when there is nothing more. */
export function moreRoomLabel(unit, nameOf) {
  const n = moreRoom(unit, nameOf).length;
  return n ? `More room on top (${n})` : '';
}

/**
 * The floor behind the stacks, one line each: { text, easy }.
 * "Behind B3: 24 cm wide · 14 cm deep · 36.5 cm high"; " · 2 rows warn here" when it is not an easy spot;
 * "about 20 cm deep" on a unit whose depth isn't measured.
 */
export function behindRoom(unit) {
  return (unit.behind ?? []).map((b) => {
    const deep = unit.approximate ? `about ${cm(b.d)} cm deep` : `${cm(b.d)} cm deep`;
    const text = `Behind ${b.stackId}: ${cm(b.w)} cm wide · ${deep} · ${cm(b.h)} cm high${b.easy ? '' : ' · 2 rows warn here'}`;
    return { text, easy: !!b.easy };
  });
}

/** "Room behind (3)" for the toggle, "" when there is none. */
export function behindLabel(unit) {
  const n = behindRoom(unit).length;
  return n ? `Room behind (${n})` : '';
}

/** "M6", "M6 and M7", "A, B and C": the moved stacks from left to right. */
function namesText(ids) {
  return ids.length < 2 ? ids.join('') : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/** The push-to-the-wall line of a unit ("" without a push): "Push M6 and M7 to the wall: the gap at 152.4 cm grows to 2.5 cm (+2.5)". */
export function pushText(unit) {
  const p = unit.push;
  if (!p) return '';
  const ids = [...p.moves].sort((a, b) => a.from - b.from).map((m) => m.stackId);
  return `Push ${namesText(ids)} to the wall: the gap at ${cm(p.gap.x)} cm grows to ${cm(p.gap.w)} cm (+${cm(p.gain)})`;
}

/** Total free floor and the unit with the widest empty stretch (the first one on a tie). */
export function totals(units) {
  let free = 0;
  let best = null;
  for (const u of units) {
    free += u.free;
    if (u.widest > 0 && (!best || u.widest > best.widest)) best = u;
  }
  return { free: r1(free), widest: best ? best.widest : 0, widestUnit: best };
}

/** "45 cm of free shelf in all · widest 10 cm, Middle shelf · left" */
export function summaryText(units) {
  const t = totals(units);
  if (!(t.free > 0)) return 'No free shelf at all';
  return `${cm(t.free)} cm of free shelf in all · widest ${cm(t.widest)} cm, ${t.widestUnit.label}`;
}

/** The card's own title inside its group: "Left", "Tall part", "Narrow shelf". */
export function cardTitle(unit) {
  const cut = /^[^·–]*[·–]\s*/.exec(unit.label);
  const t = cut ? unit.label.slice(cut[0].length) : unit.label;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Cards grouped like the shelves: [{ key, title, wall, units }]. */
export function groupUnits(units) {
  const groups = [];
  for (const u of units) {
    let key;
    let title;
    if (u.label.includes(' · ')) {
      key = u.zone;
      title = u.label.split(' · ')[0];
    } else if (u.zone.startsWith('under-')) {
      key = 'under';
      title = 'Under the stairs';
    } else {
      key = u.zone;
      title = u.label;
    }
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, title, wall: u.label.includes(' · '), units: [] }));
    g.units.push(u);
  }
  return groups;
}

/**
 * The to-scale bar of one unit, as fractions (0..1) of its width.
 * It spans x0 .. end; `shelf` is the part up to x1 (the rest is the overhang, drawn fainter).
 * Slots are the room on top: a band `left`/`width` wide and `height` high (a share of the usable height, from the top
 * down), with the open part `restLeft`/`restWidth` inside it; all clipped at the unit's edges like the stacks.
 * Standing spaces are bands from their surface `y` up: `bottom` and `height` are shares of the usable height.
 * -> { shelf, stacks, gaps, slots: [{ id, left, width, height, restLeft, restWidth }], standing: [{ id, left, width, bottom, height, restLeft, restWidth }] }
 */
export function barModel(unit) {
  const span = unit.end - unit.x0;
  const clip = (x, w) => {
    const a = Math.max(x, unit.x0);
    const b = Math.min(x + w, unit.end);
    return { left: (a - unit.x0) / span, width: Math.max(0, b - a) / span };
  };
  const band = (s) => {
    const b = clip(s.x, s.w);
    const rest = s.rest ? clip(s.rest.x, s.rest.w) : { left: b.left, width: 0 };
    return { ...b, restLeft: rest.left, restWidth: rest.width };
  };
  const share = (v) => Math.min(1, Math.max(0, v / unit.height));
  return {
    shelf: (unit.x1 - unit.x0) / span,
    stacks: unit.stacks.map((s) => ({
      id: s.id, ...clip(s.x, s.w), fill: share(s.h),
    })),
    gaps: unit.gaps.map((g) => clip(g.x, g.w)),
    slots: (unit.slots ?? []).filter((s) => s.h > 0).map((s) => ({ id: s.stackId, ...band(s), height: share(s.h) }))
      .filter((s) => s.width > 0),
    standing: (unit.standing ?? []).filter((s) => s.h > 0).map((s) => {
      const bottom = share(s.y);
      return { id: s.stackId, ...band(s), bottom, height: Math.min(share(s.h), 1 - bottom) };
    }).filter((s) => s.width > 0 && s.height > 0),
  };
}
