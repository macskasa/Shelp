// Tiny event bus. Owner: Tony (lead).
// Events in use (see docs/CONTEXT.md):
//   'store:changed'  detail: { games: string[] | null, plan: boolean }  – null games = everything changed

const handlers = new Map();

/** Subscribe. Returns an unsubscribe function – call it when your screen unmounts. */
export function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(fn);
  return () => handlers.get(type)?.delete(fn);
}

export function emit(type, detail) {
  for (const fn of [...(handlers.get(type) ?? [])]) {
    try {
      fn(detail);
    } catch (err) {
      console.error(`[bus] handler for "${type}" failed`, err);
    }
  }
}
