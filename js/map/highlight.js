// Mark a stack on the map without opening its details (part-b6: after Join). Owner: Bruce (Part B).
// The mounted map registers itself; the route becomes #/map?stack=<id> (replaceState, so the panel
// doesn't open again over the toast with Undo).
let handler = null;

/** The map's view registers here. Returns an unregister function. */
export function onHighlight(fn) {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

/** Mark the stack on the map, if the map is showing. */
export function highlightStack(stackId) {
  handler?.(stackId);
}
