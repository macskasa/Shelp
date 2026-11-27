// Which text fits where on the map (story C2). Pure, no DOM: the caller passes
// measure(text) → width in screen px, and k = screen px per cm at the current zoom. Owner: Bruce.

/** Titles are never drawn smaller than this (screen px). If they don't fit, they hide instead. */
export const TITLE_PX = 11;
/** Stack ids and band titles (screen px). */
export const ID_PX = 11;
export const BAND_PX = 13;

const ELLIPSIS = '…';
const PAD_PX = 3; // free space at each end of a title inside its box

/**
 * The longest version of `text` that fits in maxPx: the whole text, or a cut one ending in "…".
 * Returns null if fewer than `minChars` characters would be left.
 */
export function fitText(text, maxPx, measure, minChars = 3) {
  if (!text || !(maxPx > 0)) return null;
  if (measure(text) <= maxPx) return text;
  const chars = Array.from(text);
  const cut = (n) => chars.slice(0, n).join('').trimEnd() + ELLIPSIS;
  let lo = 0;
  let hi = chars.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(cut(mid)) <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  return lo >= Math.min(minChars, chars.length) && lo > 0 ? cut(lo) : null;
}

/**
 * Title for a drawn box, or null if the box is too small at this zoom.
 * Flat boxes get a horizontal title; standing boxes (like books) a vertical one along their height.
 * @param box  { w, h, standing } in cm
 */
export function boxTitle(box, title, k, measure) {
  const across = (box.standing ? box.w : box.h) * k; // room for the line height
  const along = (box.standing ? box.h : box.w) * k - 2 * PAD_PX;
  if (across < TITLE_PX + 2) return null;
  return fitText(title, along, measure, MIN_TITLE_CHARS);
}

/** A cut title must keep at least this many characters ("Notti…"); shorter stubs are just noise. */
export const MIN_TITLE_CHARS = 5;

/**
 * Text under a stack: "T1 · 2 deep" when there is room, "T1 ×2" when not, plain "T1" for one row.
 * @param widthPx  room under the stack in screen px (about the stack's width)
 */
export function stackLabel(id, twoDeep, widthPx, measure) {
  if (!twoDeep) return id;
  const long = `${id} · 2 deep`;
  return measure(long) <= widthPx ? long : `${id} ×2`;
}
