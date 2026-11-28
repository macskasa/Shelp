// Drag and drop on desktop (part-b3 item 6). Owner: Bruce (Part B).
// With the mouse only, a box on the map or a chip on the board strip can be dragged onto a stack or
// onto empty shelf. While dragging, the spot under the pointer is outlined where the box would sit
// (red and dashed when it doesn't work there, with the reason beside the pointer). Dropping opens
// the spot sheet with that spot (or New stack here) over the map; after placing, the map shows the
// game (#/map?game=). Esc or a drop off the shelves cancels.
// Touch and the pen never start a drag: they pan, and tapping through placing mode is their way.
// A press that doesn't move stays a click (stack details, or the pick-up sheet for a chip).
// The logic (targets, spots, outlines, thresholds) is in drag.js.
import { h, s } from '../core/dom.js';
import * as store from '../core/store.js';
import { showOnMap } from '../core/contracts.js';
import { openPutPanel } from './put-panel.js';
import { openNewStackPanel } from './new-stack-panel.js';
import { toDrawing } from './placing.js';
import { canStartDrag, pastSlop, dropTarget, stackLocal, probeStack, aimStack, probeEmpty, aimEmpty } from './drag.js';

/**
 * @param root, stage, frame  the map's elements (the board strip is inside root)
 * @param panZoom             for the view (drawing cm ↔ screen px)
 * @param getScene(), getView()  the scene drawn and 'front' | 'back'
 * @param isOff()             true while a drag must not start (placing mode, a panel open)
 * @param openOver(stackId, open)  view.js opens a sheet over a stack (null: a new one): open(onClose) → dialog | null
 */
export function createDrag({ root, stage, frame, panZoom, getScene, getView, isOff, openOver }) {
  const note = h('div', { class: 'map-drag-note', hidden: true, 'aria-hidden': 'true' });
  frame.append(note);
  let press = null; // { gameId, start, source, pointerId, active }
  let probe = null; // probeStack / probeEmpty for what the pointer is over, with its cache key
  let aim = null; // what a drop now would do
  let ghost = null;

  function onDown(e) {
    if (press || !canStartDrag(e) || isOff()) return;
    const chip = e.target.closest?.('.map-board-chip');
    const box = chip ? null : stage.contains(e.target) && e.target.closest?.('[data-game]');
    const source = chip || box;
    if (!source || !store.getGame(source.dataset.game)?.dims) return;
    if (box) e.stopPropagation(); // the press is ours: pan-zoom does not start a pan
    press = { gameId: source.dataset.game, start: { x: e.clientX, y: e.clientY }, source, pointerId: e.pointerId, active: false };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', cancel, true);
  }

  function onMove(e) {
    if (!press || e.pointerId !== press.pointerId) return;
    if (!press.active) {
      if (!pastSlop(press.start, { x: e.clientX, y: e.clientY })) return;
      press.active = true;
      try { press.source.setPointerCapture(e.pointerId); } catch { /* gone already */ }
      root.classList.add('map-dragging');
      press.source.classList.add('is-dragged');
      getSelection()?.removeAllRanges();
    }
    e.preventDefault();
    track(e.clientX, e.clientY);
  }

  /** Work out what is under the pointer and draw it. */
  function track(cx, cy) {
    const scene = getScene();
    const r = stage.getBoundingClientRect();
    const inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    const pt = inside ? toDrawing(panZoom.view, cx - r.left, cy - r.top) : null;
    const hit = pt && scene ? dropTarget(scene, pt, panZoom.view.k, getView()) : null;
    aim = null;
    if (hit?.kind === 'stack') {
      const key = `stack|${hit.stackId}|${hit.row}`;
      if (probe?.key !== key) probe = { key, data: probeStack(store, press.gameId, hit.stackId, hit.row) };
      const st = scene.stacks.find((x) => x.id === hit.stackId);
      const a = probe.data && st ? aimStack(probe.data, store.getGame(press.gameId), stackLocal(st, pt)) : null;
      if (a) {
        const g = a.ghost;
        aim = {
          target: { kind: 'stack', stackId: hit.stackId, row: hit.row, key: a.key },
          works: a.works, note: a.note, rect: g ? { x: st.x + g.x, y: st.floor - g.y - g.h, w: g.w, h: g.h } : null,
        };
      }
    } else if (hit?.kind === 'empty') {
      const key = `empty|${hit.zone}|${Math.round(hit.x * 2)}`; // the new stack's x moves in 0.5 cm steps
      if (probe?.key !== key) probe = { key, data: probeEmpty(store, press.gameId, hit.zone, hit.x) };
      const a = probe.data ? aimEmpty(probe.data, scene) : null;
      if (a) aim = { target: { kind: 'empty', zone: hit.zone, x: probe.data.x, way: probe.data.way }, ...a };
    }
    draw(cx, cy);
  }

  function draw(cx, cy) {
    const svg = stage.querySelector('svg');
    if (!aim?.rect || !svg) ghost?.remove();
    else {
      if (!ghost || ghost.ownerSVGElement !== svg) {
        ghost?.remove();
        ghost = s('rect', { class: 'map-drop-ghost' });
        svg.append(ghost);
      }
      const { x, y, w, h: ht } = aim.rect;
      for (const [k, v] of Object.entries({ x, y, width: Math.max(w, 0.5), height: Math.max(ht, 0.5) })) ghost.setAttribute(k, String(v));
      ghost.classList.toggle('is-blocked', !aim.works);
    }
    note.hidden = !aim;
    if (!aim) return;
    note.textContent = aim.note;
    note.classList.toggle('is-blocked', !aim.works);
    const fr = frame.getBoundingClientRect();
    note.style.left = `${Math.max(4, Math.min(cx - fr.left + 16, fr.width - note.offsetWidth - 4))}px`;
    note.style.top = `${Math.max(4, Math.min(cy - fr.top + 18, fr.height - note.offsetHeight - 4))}px`;
  }

  function onUp(e) {
    if (!press || e.pointerId !== press.pointerId) return;
    const { active, gameId } = press;
    const target = active ? aim?.target : null;
    end();
    if (!active) return; // a plain click: its own handler runs (details, pick-up sheet)
    swallowClick();
    if (target) onDrop(gameId, target);
  }

  /** The click that follows a drag must not open details or the pick-up sheet. */
  function swallowClick() {
    const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
  }

  /** A drop: the spot sheet with the dropped spot, or New stack here at the dropped x. */
  function onDrop(gameId, t) {
    const onPlaced = () => showOnMap(gameId);
    if (t.kind === 'stack') {
      openOver(t.stackId, (onClose) => openPutPanel(gameId, { stackId: t.stackId, drop: { key: t.key, row: t.row }, onPlaced, onClose }));
    } else {
      openOver(null, (onClose) => openNewStackPanel(gameId, { zone: t.zone, x: t.x, ...t.way, onPlaced, onClose }));
    }
  }

  /** pointercancel: no click follows. */
  function cancel() {
    end();
  }

  function end() {
    if (press) {
      press.source.classList.remove('is-dragged');
      try { press.source.releasePointerCapture(press.pointerId); } catch { /* not captured */ }
    }
    press = null;
    probe = null;
    aim = null;
    ghost?.remove();
    ghost = null;
    note.hidden = true;
    root.classList.remove('map-dragging');
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', cancel, true);
  }

  // Esc during a drag cancels it, before anything else hears it (placing mode, a family's highlight)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !press) return;
    const was = press.active;
    end();
    if (!was) return;
    // the button is still down: the click its release makes must not open anything
    window.addEventListener('pointerup', swallowClick, { capture: true, once: true });
    e.preventDefault();
    e.stopPropagation();
  };

  root.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);

  return {
    get dragging() { return !!press?.active; },
    destroy() {
      end();
      root.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    },
  };
}
