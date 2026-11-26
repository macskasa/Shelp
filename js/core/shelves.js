// Hard-coded shelf model (story C1). All sizes in cm. Owner: Tony (lead).
// x is measured from the LEFT end of a zone. For the wall shelves the left end is the stairs side.
// The numbers come from Adam's measurements of his IKEA BOAXEL shelves.

export const STACK_TOLERANCE = 1.0; // a box may overhang the box below by at most 1 cm (width or depth)

// BOAXEL brackets hang from the shelf ABOVE, so they only exist on the middle and bottom level.
// Seen from the side a bracket is a wedge: 6 cm tall near the wall, 0 cm at the front edge.
export const BRACKET = {
  width: 0.4,             // along the shelf; centred on the joint
  maxHeight: 6,           // at the wall end of the bracket
  fullHeightFromFront: 36, // the wedge reaches 6 cm at 36 cm from the front (2 cm from the wall)
  clearance: 1,           // keep 1 cm air between a box and the bracket
};

/** Height (cm) a box of the given depth may reach where it crosses a bracket on this zone. */
export function bracketLimit(zone, depth) {
  const z = typeof zone === 'string' ? ZONES[zone] : zone;
  const wedge = BRACKET.maxHeight * Math.min(depth, BRACKET.fullHeightFromFront) / BRACKET.fullHeightFromFront;
  return z.height - BRACKET.clearance - wedge;
}

const wall = { group: 'wall', length: 200, overhang: 8, depth: 38, joints: [60, 140] };

export const ZONES = {
  top: {
    ...wall, id: 'top', label: 'Top shelf', height: 40, usable: 38,
    brackets: [], // ceiling above, no brackets
    easy: [[0, 44]],
  },
  middle: {
    ...wall, id: 'middle', label: 'Middle shelf', height: 37.5, usable: 35.5,
    brackets: [0, 60, 140, 200],
    easy: [],
  },
  bottom: {
    ...wall, id: 'bottom', label: 'Bottom shelf', height: 38.5, usable: 36.5,
    brackets: [0, 60, 140, 200],
    easy: [[0, 208]],
  },
  // One 80 cm unit under the stairs, split into three parts (offset = position inside the unit).
  'under-cards': {
    id: 'under-cards', label: 'Under the stairs – card games', group: 'under', offset: 0,
    length: 31, overhang: 0, depth: 38, height: 17.8, usable: 16.8, joints: [], brackets: [],
    easy: [[0, 31]], standingOnly: true,
  },
  'under-tall': {
    id: 'under-tall', label: 'Under the stairs – tall part', group: 'under', offset: 31,
    length: 40, overhang: 0, depth: 38, height: 37, usable: 35, joints: [], brackets: [],
    easy: [[0, 40]],
  },
  'under-gap': {
    id: 'under-gap', label: 'Under the stairs – tall gap', group: 'under', offset: 71,
    length: 9, overhang: 0, depth: 38, height: 46, usable: 45, joints: [], brackets: [],
    easy: [[0, 9]], approximate: true, // height not measured; Ice Cool (41 cm) fits
  },
  narrow: {
    id: 'narrow', label: 'Narrow shelf', group: 'narrow', length: 80, overhang: 0,
    depth: 38, height: 8, usable: 7.9, joints: [], brackets: [],
    easy: [[0, 80]], approximate: true, // depth assumed, not measured
  },
};

// Drawing order and grouping. Wall levels are drawn top to bottom; the under-stairs parts side by side.
export const GROUPS = [
  { id: 'wall', label: 'Wall shelves', zones: ['top', 'middle', 'bottom'] },
  { id: 'under', label: 'Under the stairs', length: 80, zones: ['under-cards', 'under-tall', 'under-gap'] },
  { id: 'narrow', label: 'Narrow shelf', zones: ['narrow'] },
];

/** True if the whole span [x, x + w] lies in an easy-to-reach range of the zone. */
export function isEasy(zoneId, x, w) {
  return ZONES[zoneId].easy.some(([a, b]) => x >= a - 1e-6 && x + w <= b + 1e-6);
}
