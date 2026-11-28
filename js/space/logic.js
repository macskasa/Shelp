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

/**
 * One slot in words: "On M2: 4.1 cm high · 32.7 cm of air · rests on Port Royal, 12.7 cm".
 * The air is left out when it is no wider than what the box rests on (+ 2 cm). "No room on top" when the height rounds to 0.
 * nameOf(gameId) -> the game's title (defaults to the id).
 */
export function slotText(slot, nameOf = (id) => id) {
  if (cm(slot.h) === '0') return 'No room on top';
  const parts = [`On ${slot.stackId}: ${cm(slot.h)} cm high`];
  const rest = slot.rest;
  if (rest && slot.w > rest.w + 2) parts.push(`${cm(slot.w)} cm of air`);
  if (rest) {
    const names = (slot.on ?? []).map((id) => nameOf(id));
    parts.push(`rests on ${names.length ? `${names.join(' + ')}, ` : ''}${cm(rest.w)} cm`);
  }
  return parts.join(' · ');
}

/** The room line of a unit: its best slot in words; "" without stacks; "(not measured)" is added for approximate units. */
export function roomText(unit, nameOf) {
  const base = unit.room ? slotText(unit.room, nameOf) : '';
  if (!unit.approximate) return base;
  return base ? `${base} (not measured)` : '(not measured)';
}

/** The unit's other slots, one text each, most height first (the best one is the room line). */
export function moreRoom(unit, nameOf) {
  return (unit.slots ?? []).filter((s) => s !== unit.room && cm(s.h) !== '0').map((s) => slotText(s, nameOf));
}

/** "More room on top (3)" for the toggle, "" when there is nothing more. */
export function moreRoomLabel(unit, nameOf) {
  const n = moreRoom(unit, nameOf).length;
  return n ? `More room on top (${n})` : '';
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
 * -> { shelf, stacks: [{ id, left, width, fill }], gaps: [{ left, width }], slots: [{ id, left, width, height, restLeft, restWidth }] }
 */
export function barModel(unit) {
  const span = unit.end - unit.x0;
  const clip = (x, w) => {
    const a = Math.max(x, unit.x0);
    const b = Math.min(x + w, unit.end);
    return { left: (a - unit.x0) / span, width: Math.max(0, b - a) / span };
  };
  return {
    shelf: (unit.x1 - unit.x0) / span,
    stacks: unit.stacks.map((s) => ({
      id: s.id, ...clip(s.x, s.w), fill: Math.min(1, Math.max(0, s.h / unit.height)),
    })),
    gaps: unit.gaps.map((g) => clip(g.x, g.w)),
    slots: (unit.slots ?? []).filter((s) => s.h > 0).map((s) => {
      const band = clip(s.x, s.w);
      const rest = s.rest ? clip(s.rest.x, s.rest.w) : { left: band.left, width: 0 };
      return {
        id: s.stackId, ...band, height: Math.min(1, Math.max(0, s.h / unit.height)),
        restLeft: rest.left, restWidth: rest.width,
      };
    }).filter((s) => s.width > 0),
  };
}
