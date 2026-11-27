// Keep a top-aligned panel inside the part of the screen that is left when the phone keyboard is open.
// Owner: Peter (Part C). The panel's CSS reads --panel-vh (see where.css, versions.css).

/** Sets --panel-vh on the dialog to the visual viewport height, and keeps it up to date until the dialog closes. */
export function fitToVisualViewport(dlg) {
  const vv = window.visualViewport;
  if (!vv) return;
  const fit = () => dlg.style.setProperty('--panel-vh', `${Math.floor(vv.height)}px`);
  fit();
  vv.addEventListener('resize', fit);
  dlg.addEventListener('close', () => vv.removeEventListener('resize', fit), { once: true });
}
