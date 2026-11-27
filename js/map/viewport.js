// Zoom and pan maths for the map (story C2). Pure, no DOM. Owner: Bruce (Part B).
//
// A view is { x, y, k }: the drawing point (in cm) at the frame's top-left corner, and k = screen px
// per cm. With a frame of fw × fh px the SVG viewBox is  x y fw/k fh/k.
// Every function returns a view that is clamped: k between the limits, and the drawing kept in
// the frame (centred across, at the top down, when it is smaller than the frame).

/** Largest zoom in screen px per cm: a 2.5 cm card game box is then 60 px wide. */
export const MAX_K = 24;

/** Smallest and largest k for this frame: from "the whole drawing fits" to MAX_K. */
export function limits(scene, fw, fh) {
  const fitW = fw / scene.width;
  const fitAll = Math.min(fitW, fh / scene.height);
  return { min: fitAll, max: Math.max(MAX_K, fitW) };
}

const clampK = (k, lim) => Math.min(lim.max, Math.max(lim.min, k));

export function clampView(v, scene, fw, fh) {
  const k = clampK(v.k, limits(scene, fw, fh));
  const vw = fw / k;
  const vh = fh / k;
  const x = vw >= scene.width ? (scene.width - vw) / 2 : Math.min(Math.max(v.x, 0), scene.width - vw);
  const y = vh >= scene.height ? 0 : Math.min(Math.max(v.y, 0), scene.height - vh);
  return { x, y, k };
}

/** The opening view: the full width of the drawing, from the top. */
export function fitWidth(scene, fw, fh) {
  return clampView({ x: 0, y: 0, k: fw / scene.width }, scene, fw, fh);
}

/** Zoom by `factor`, keeping the drawing point under the screen point (px, py) where it is. */
export function zoomAt(v, factor, px, py, scene, fw, fh) {
  const k = clampK(v.k * factor, limits(scene, fw, fh));
  const dx = v.x + px / v.k;
  const dy = v.y + py / v.k;
  return clampView({ x: dx - px / k, y: dy - py / k, k }, scene, fw, fh);
}

/** Move the drawing by (dx, dy) screen px from view v (a drag). */
export function panBy(v, dx, dy, scene, fw, fh) {
  return clampView({ x: v.x - dx / v.k, y: v.y - dy / v.k, k: v.k }, scene, fw, fh);
}

/**
 * Two-finger pinch. v0, m0 (midpoint) and d0 (finger distance) are from the start of the pinch;
 * m and d are now. The drawing point that was under the first midpoint follows the fingers.
 */
export function pinchView(v0, m0, d0, m, d, scene, fw, fh) {
  const k = clampK(v0.k * (d0 > 0 ? d / d0 : 1), limits(scene, fw, fh));
  const px = v0.x + m0.x / v0.k;
  const py = v0.y + m0.y / v0.k;
  return clampView({ x: px - m.x / k, y: py - m.y / k, k }, scene, fw, fh);
}

/** Is the rect (cm) fully inside the view, `pad` cm away from the edges? */
export function isVisible(v, rect, fw, fh, pad = 0) {
  return rect.x >= v.x + pad && rect.y >= v.y + pad
    && rect.x + rect.w <= v.x + fw / v.k - pad && rect.y + rect.h <= v.y + fh / v.k - pad;
}

/**
 * Bring a rect (cm) into view without changing the zoom: the same view if it is already visible,
 * otherwise a view centred on it.
 */
export function reveal(v, rect, scene, fw, fh, pad = 2) {
  if (isVisible(v, rect, fw, fh, pad)) return v;
  const vw = fw / v.k;
  const vh = fh / v.k;
  return clampView({ x: rect.x + rect.w / 2 - vw / 2, y: rect.y + rect.h / 2 - vh / 2, k: v.k }, scene, fw, fh);
}

/**
 * Bring a rect (cm) into view, e.g. a family's boxes (part-b4 item 1): like reveal() while it fits at
 * the current zoom, otherwise zoomed out just enough to fit it (with `pad` cm around), centred on it.
 */
export function showRect(v, rect, scene, fw, fh, pad = 2) {
  const w = rect.w + 2 * pad;
  const h = rect.h + 2 * pad;
  if (w <= fw / v.k && h <= fh / v.k) return reveal(v, rect, scene, fw, fh, pad);
  const k = Math.min(fw / w, fh / h);
  return clampView({ x: rect.x + rect.w / 2 - fw / k / 2, y: rect.y + rect.h / 2 - fh / k / 2, k }, scene, fw, fh);
}

const r3 = (n) => Math.round(n * 1000) / 1000;

/** The SVG viewBox for a view. */
export function viewBox(v, fw, fh) {
  return `${r3(v.x)} ${r3(v.y)} ${r3(fw / v.k)} ${r3(fh / v.k)}`;
}

/**
 * What a wheel event does (issue #49). Without Ctrl it pans: two-finger trackpad scrolling or the
 * mouse wheel move the drawing, both ways, and Shift + mouse wheel goes sideways. With Ctrl it
 * zooms at the pointer: a trackpad pinch arrives as Ctrl + wheel, and Ctrl + mouse wheel zooms too.
 * deltaMode 1 is lines, 2 is pages (one frame height). Returns screen px to pan the drawing by
 * (for panBy), or a zoom factor (for zoomAt).
 */
export function wheelAction({ deltaX = 0, deltaY = 0, deltaMode = 0, ctrlKey = false, shiftKey = false }, fh) {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? fh : 1;
  // a pinch sends small steps; one Ctrl + mouse wheel notch (~100 px) is capped at about 18 %
  if (ctrlKey) return { zoom: Math.exp(Math.max(-0.2, Math.min(0.2, -deltaY * unit * 0.01))) };
  // some browsers leave Shift + wheel on deltaY; sideways is what the user means
  const [x, y] = shiftKey && !deltaX ? [deltaY, 0] : [deltaX, deltaY];
  return { dx: -x * unit || 0, dy: -y * unit || 0 }; // || 0: no -0
}
