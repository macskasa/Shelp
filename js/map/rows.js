// The back row (issue #47). Pure, no DOM. Owner: Bruce (Part B).
// The Shelves screen shows one row of the 2-deep stacks at a time: the front view (row 0) or the
// back view (row 1). Stacks with one row look the same in both. Placing mode reuses the view to
// say which row a box goes into (rowForView).

export const VIEWS = Object.freeze(['front', 'back']);

/** Ids of the stacks that are 2 deep (any box in row 1), in plan order. */
export function deepStackIds(plan) {
  return plan.stacks.filter((st) => st.boxes.some((b) => b.row > 0)).map((st) => st.id);
}

/** The row a view draws: 0 front, 1 back. */
export const rowForView = (view) => (view === 'back' ? 1 : 0);

/**
 * Which view ?game= opens for a located game (store.locate2): 'back' for a box in the back row of a
 * 2-deep stack (or a game stored inside one), 'front' for its front row, null when either view shows
 * it the same (a stack with one row, the cupboard, the board): then the view stays as it is.
 */
export function viewForLocation(loc) {
  const at = loc?.kind === 'inside' ? loc.host : loc;
  if (at?.kind !== 'stack' || !(at.rows > 1)) return null;
  return at.row > 0 ? 'back' : 'front';
}
