// A family on the Shelves screen (B2, part-b4 item 1): #/map?family=<name> (showFamily). Owner: Bruce.
// Reads the store and the rule checker for view.js; the logic is in family.js.
// The caption: "Azul family · 3 games · B2, B3 · 1 on the board", then the family warning in amber.
import { h } from '../core/dom.js';
import * as store from '../core/store.js';
import { checkPlan2 } from '../rules/index.js';
import { findFamily, familyPlaces, familyView, familyFocus, familyCaption, familyWarning, unionRect } from './family.js';
import { stackArea } from './scene.js';

/** The family a route names, or null (renamed, or an old link). */
export const lookupFamily = (name) => findFamily(store.getFamilies(), name);

/** The row view to open for a family, or null to keep the current one. */
export const viewForFamily = (fam) => familyView(familyPlaces(fam, store.locate2));

/**
 * What to show for a family in a scene drawn in `view`.
 * @returns {{ focus, rect: {x,y,w,h} | null, content: Node[] }}  content goes into the caption
 */
export function familyShown(fam, scene, view) {
  const focus = familyFocus(fam, familyPlaces(fam, store.locate2), scene, view);
  const warning = familyWarning(checkPlan2(store.getPlan2(), store.getGame), fam.name);
  return {
    focus,
    rect: unionRect(focus.stackIds.map((id) => stackArea(scene, id))),
    content: [
      h('p', {}, h('strong', {}, fam.name), ` ${familyCaption(focus)}`),
      warning ? h('p', { class: 'map-caption-warn' },
        h('span', { role: 'img', 'aria-label': 'Warning' }, '⚠'), ` ${warning.message}`) : null,
    ],
  };
}
