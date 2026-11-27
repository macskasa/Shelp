// Pointer and keyboard input on the Shelves screen's drawing. Owner: Bruce (Part B).
// Hover title for the mouse and the S Pen, a tap or Enter / Space on a stack, + / − / 0 zoom,
// Esc closes the legend card, and a stack reached with Tab is panned into view.
// view.js decides what a tap or Enter means (details, or the spot sheet in placing mode).
const ZOOM_STEP = 1.6;

/**
 * @param els        { root, stage, frame, tip, keyBtn }
 * @param panZoom    from pan-zoom.js
 * @param titleOf    game id → title
 * @param onClick(e) a click in the drawing (pan-zoom.js swallows the one that ends a drag or pinch)
 * @param onEnter(stackId)  Enter or Space on a focused stack
 * @param showKey(open)     show / hide the legend card
 * @param stackRect(id)     a stack's area in cm, to pan to
 */
export function wireInput({ root, stage, frame, tip, keyBtn }, { panZoom, titleOf, onClick, onEnter, showKey, stackRect }) {
  // Hover title (touch has no hover; nothing while dragging).
  stage.addEventListener('pointermove', (e) => {
    const box = e.pointerType !== 'touch' && !e.buttons ? e.target.closest?.('[data-game]') : null;
    if (!box) {
      tip.hidden = true;
      return;
    }
    tip.textContent = titleOf(box.dataset.game);
    tip.hidden = false;
    const r = frame.getBoundingClientRect();
    const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 4);
    tip.style.left = `${Math.max(4, x)}px`;
    tip.style.top = `${Math.min(e.clientY - r.top + 18, r.height - tip.offsetHeight - 4)}px`;
  });
  stage.addEventListener('pointerleave', () => { tip.hidden = true; });
  stage.addEventListener('click', onClick);
  // Keyboard: Tab to a stack, then Enter or Space. + and − zoom, 0 fits.
  stage.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') panZoom.zoomBy(ZOOM_STEP);
    else if (e.key === '-') panZoom.zoomBy(1 / ZOOM_STEP);
    else if (e.key === '0') panZoom.fit();
    else if (e.key === 'Enter' || e.key === ' ') {
      const st = e.target.closest?.('[data-stack]');
      if (!st) return;
      onEnter(st.dataset.stack);
    } else return;
    e.preventDefault();
  });
  // Esc closes the legend card (a panel's own Esc closes the panel first: it is modal)
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !root.classList.contains('map-key-open')) return;
    e.preventDefault(); // the legend first, then placing mode
    showKey(false);
    keyBtn.focus();
  });
  stage.addEventListener('focusin', (e) => {
    const id = e.target.dataset?.stack;
    const r = id && e.target.matches(':focus-visible') ? stackRect(id) : null;
    if (r) panZoom.reveal(r, { animate: false });
  });
}

export { ZOOM_STEP };
