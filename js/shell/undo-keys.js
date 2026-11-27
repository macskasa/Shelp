// Which keys mean Undo and Redo. Plain function, no DOM, tested in Node. Owner: Peter (Part C). Story: Undo (Phase B).

/**
 * e: { key, ctrlKey, metaKey, shiftKey, altKey } from a keydown event.
 * inTextField: true when the focus is in a text field (the browser's own undo of the typed text wins there).
 * Returns 'undo', 'redo' or null (not ours).
 *   Ctrl+Z (Cmd+Z on a Mac)           undo
 *   Ctrl+Shift+Z, Ctrl+Y              redo
 */
export function undoKeyAction(e, inTextField = false) {
  if (inTextField || e.altKey || !(e.ctrlKey || e.metaKey)) return null;
  const key = String(e.key).toLowerCase();
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !e.shiftKey) return 'redo';
  return null;
}
