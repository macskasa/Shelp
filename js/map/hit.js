// Tap targets of the stacks (part-b4 item 3). Pure, no DOM. Owner: Bruce (Part B).
// A stack's tap target is its column, at least 2 cm wide. An empty stack is a 3 cm outline, about
// 5 px at a phone's fit zoom, so its target grows to the width of its id label or 40 px on screen,
// whichever is wider, as far as its neighbours leave room (scene.js gives it `room`).

/** Screen px an empty stack's tap target wants at least. */
export const MIN_HIT_PX = 40;
const MIN_W = 2; // cm

/**
 * The room an empty stack's target may grow into: from the end of the stack on its left to the
 * start of the one on its right (halfway to a neighbour that is empty too), else the shelf's ends.
 * @param stacks  scene stacks of one zone ({ x, w, empty })
 * @param zone    { x, length, overhang }
 * @returns Map<stack, { left, right }> for the empty stacks
 */
export function emptyRooms(stacks, zone) {
  const sorted = [...stacks].sort((a, b) => a.x - b.x);
  const out = new Map();
  sorted.forEach((st, i) => {
    if (!st.empty) return;
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const edge = (n, side) => {
      if (!n) return side < 0 ? zone.x : zone.x + zone.length + (zone.overhang ?? 0);
      const near = side < 0 ? n.x + Math.max(n.w, MIN_W) : n.x;
      if (!n.empty) return near;
      return side < 0 ? (near + st.x) / 2 : (st.x + st.w + near) / 2;
    };
    out.set(st, { left: Math.min(edge(prev, -1), st.x), right: Math.max(edge(next, 1), st.x + st.w) });
  });
  return out;
}

/**
 * The tap target's x span in cm at k screen px per cm: { x, w }.
 * @param st       a scene stack ({ x, w, empty, room? })
 * @param labelPx  the width of its id label in screen px (0 when unknown)
 */
export function hitSpan(st, k, labelPx = 0) {
  const own = { x: st.x, w: Math.max(st.w, MIN_W) };
  if (!st.empty || !st.room || !(k > 0)) return own;
  const want = Math.max(own.w, Math.max(labelPx, MIN_HIT_PX) / k);
  const { left, right } = st.room;
  if (want >= right - left) return { x: left, w: Math.max(right - left, own.w) };
  const x = Math.min(Math.max(st.x + st.w / 2 - want / 2, left), right - want);
  return { x, w: want };
}
