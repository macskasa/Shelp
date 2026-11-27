// The caption above the Shelves drawing and what it highlights, for view.js. Owner: Bruce (Part B).
// #/map?game=<id> names the game and where it is (a game inside a box shows its host box),
// ?stack=<id> names the stack, ?family=<name> shows the family's caption (view-family.js).
// The × clears the highlight (go('map')). Placing mode has no caption: its bar takes the room.
import { h } from '../core/dom.js';
import * as store from '../core/store.js';
import { ZONES } from '../core/shelves.js';
import { go } from '../core/contracts.js';
import { describeLocation2 } from '../core/format.js';
import { findInScene } from './scene.js';
import { lookupFamily, familyShown } from './view-family.js';

const titleOf = (id) => store.getGame(id)?.title ?? id;

/** A caption in `caption` (a div). forParams fills it for the route; hide (placing mode) marks nothing. */
export function createCaption(caption) {
  function setCaption(title, text, link = null) {
    showCaption(h('p', {}, title ? h('strong', {}, title) : null, title ? ' – ' : null, text, link ? [' ', link] : null));
  }

  function showCaption(...content) {
    caption.replaceChildren(
      h('div', { class: 'map-caption-text' }, content),
      h('button', { class: 'btn map-caption-close', 'aria-label': 'Clear the highlight', onclick: () => go('map') }, '×'),
    );
    caption.hidden = false;
  }

  /**
   * Fill (or hide) the caption for the route params.
   * @returns {{ target: { stackId, gameId } | null, family: ReturnType<familyShown> | null }}
   */
  function forParams(current, scene, view) {
    caption.hidden = true;
    let target = null;
    let family = null;
    if (current.game) {
      const loc = store.locate2(current.game);
      // a box stored inside another box: show the host box
      const shownId = loc?.kind === 'inside' ? loc.hostId : current.game;
      const found = findInScene(scene, shownId);
      if (found) target = { stackId: found.stack.id, gameId: found.box ? shownId : null };
      // the cupboard screen lists the cupboard and the board
      const link = loc?.kind === 'cupboard' || loc?.kind === 'board' ? h('a', { href: '#/cupboard' }, 'Open the cupboard list') : null;
      setCaption(store.getGame(current.game)?.title ?? null, describeLocation2(loc, titleOf), link);
    } else if (current.stack) {
      const st = scene.stacks.find((x) => x.id === current.stack);
      if (st) {
        target = { stackId: st.id, gameId: null };
        setCaption(`Stack ${st.id}`, ZONES[st.zone].label);
      } else {
        setCaption(null, `There is no stack ${current.stack} in this plan.`);
      }
    } else if (current.family) {
      const fam = lookupFamily(current.family);
      family = fam ? familyShown(fam, scene, view) : null;
      if (family) showCaption(...family.content);
    }
    return { target, family };
  }

  function hide() {
    caption.hidden = true;
    return { target: null, family: null };
  }

  return { forParams, hide };
}
