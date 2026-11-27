// How tall the map frame may be (issue #65). Pure, no DOM. Owner: Bruce (Part B).
//
// The Shelves page itself never scrolls: only the drawing pans and zooms. So the frame gets the
// height that is left in the window once everything above it (header, caption, row switch) and
// below it (whatever the map puts under the frame, the main area's bottom padding with the tab bar
// and the safe area) has its room. It is never taller than the drawing at the frame's width.

/** Below this the frame is too small to use; only a tiny window lets the page scroll. */
export const MIN_FRAME_H = 120;

/**
 * @param windowH  window height in px (innerHeight)
 * @param top      the frame's top, in px from the top of the page
 * @param below    px needed under the frame: content after it plus the main area's bottom padding
 * @param natural  the drawing's height in px at the frame's width
 * @returns the frame height in whole px
 */
export function frameHeight({ windowH, top, below, natural }) {
  const room = Math.floor(windowH - top - below);
  return Math.min(Math.ceil(natural), Math.max(room, MIN_FRAME_H));
}
