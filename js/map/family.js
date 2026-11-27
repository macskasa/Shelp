// A family on the map (B2, part-b4 item 1): #/map?family=<name>. Pure, no DOM. Owner: Bruce (Part B).
//   findFamily     the family a route names (store.getFamilies())
//   familyView     which row view to open: 'back' when every shelf member is in the back row
//   familyFocus    what to highlight in a scene: member boxes, their stacks, board chips, counts
//   familyCaption  "family · 3 games · B2, B3 · 1 in the back row · 1 on the board"
//   familyWarning  Stephen's checkPlan2 'family' warning for it, if the family is spread out
//   unionRect      the area to fit: every member stack's column

const lower = (s) => String(s).toLocaleLowerCase('hu');

/** The family named `name` ({ name, ids }), or null. Letter case is ignored (the store joins it). */
export function findFamily(families, name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  return families.find((f) => f.name === name) ?? families.find((f) => lower(f.name) === lower(name.trim())) ?? null;
}

/**
 * Where each member is. A game stored inside another box counts where its host box is, and the host
 * box is what gets highlighted (shownId).
 * @returns [{ gameId, shownId, kind: 'stack' | 'board' | 'cupboard', stackId?, row?, rows? }]
 */
export function familyPlaces(fam, locate) {
  return fam.ids.map((gameId) => {
    let loc = locate(gameId);
    let shownId = gameId;
    if (loc?.kind === 'inside') {
      shownId = loc.hostId;
      loc = loc.host;
    }
    if (loc?.kind === 'stack') return { gameId, shownId, kind: 'stack', stackId: loc.stackId, row: loc.row ?? 0, rows: loc.rows ?? 1 };
    return { gameId, shownId, kind: loc?.kind === 'cupboard' ? 'cupboard' : 'board' };
  });
}

const isBack = (p) => p.kind === 'stack' && p.rows > 1 && p.row > 0;
const isFront = (p) => p.kind === 'stack' && p.rows > 1 && p.row === 0;

/**
 * The row view to open: 'back' when every shelf member that only one view shows is in the back row,
 * 'front' when one of them is in a front row, null when both views show them all (stay as it is).
 */
export function familyView(places) {
  if (places.some(isFront)) return 'front';
  if (places.some(isBack)) return 'back';
  return null;
}

/**
 * What to highlight in a scene (scene.js) drawn in `view`.
 * @returns {{ name, count, boxIds: string[], stackIds: string[], ringStackIds: string[],
 *   boardIds: string[], onBoard, inCupboard, otherRow: { label, n } | null }}
 * boxIds are drawn in this view; stackIds are every member stack in drawing order (the caption, the
 * area to fit); ringStackIds the stacks whose member is in the row this view doesn't draw;
 * boardIds the board chips to mark (host boxes for games stored inside).
 */
export function familyFocus(fam, places, scene, view) {
  const drawn = new Set(scene.stacks.flatMap((st) => st.boxes.map((b) => b.gameId)));
  const shelf = places.filter((p) => p.kind === 'stack');
  const stackSet = new Set(shelf.map((p) => p.stackId));
  const hidden = shelf.filter((p) => !drawn.has(p.shownId));
  const boxIds = [...new Set(shelf.filter((p) => drawn.has(p.shownId)).map((p) => p.shownId))];
  const hiddenStacks = new Set(hidden.map((p) => p.stackId));
  const order = scene.stacks.map((st) => st.id).filter((id) => stackSet.has(id));
  const notOnShelf = places.filter((p) => p.kind !== 'stack');
  return {
    name: fam.name,
    count: fam.ids.length,
    boxIds,
    stackIds: order,
    ringStackIds: order.filter((id) => hiddenStacks.has(id) && !shelf.some((p) => p.stackId === id && drawn.has(p.shownId))),
    boardIds: [...new Set(notOnShelf.filter((p) => p.kind === 'board').map((p) => p.shownId))],
    onBoard: notOnShelf.filter((p) => p.kind === 'board').length,
    inCupboard: notOnShelf.filter((p) => p.kind === 'cupboard').length,
    otherRow: hidden.length ? { label: view === 'back' ? 'front row' : 'back row', n: hidden.length } : null,
  };
}

const games = (n) => `${n} game${n === 1 ? '' : 's'}`;

/** The caption after the family's name: "family · 3 games · B2, B3 · 1 in the back row · 1 on the board · 1 in the cupboard". */
export function familyCaption(focus) {
  const parts = ['family', games(focus.count)];
  if (focus.stackIds.length) parts.push(focus.stackIds.join(', '));
  if (focus.otherRow) parts.push(`${focus.otherRow.n} in the ${focus.otherRow.label}`);
  if (focus.onBoard) parts.push(`${focus.onBoard} on the board`);
  if (focus.inCupboard) parts.push(`${focus.inCupboard} in the cupboard`);
  return parts.join(' · ');
}

/** The 'family' warning of checkPlan2 for this family (spread out), or null. */
export function familyWarning(warnings, name) {
  return warnings.find((w) => w.rule === 'family' && w.family === name) ?? null;
}

/** The smallest rect (cm) around all the rects; null for none. */
export function unionRect(rects) {
  const rs = rects.filter(Boolean);
  if (!rs.length) return null;
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: x1 - x, h: y1 - y };
}
