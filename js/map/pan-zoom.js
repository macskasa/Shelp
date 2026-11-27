// Zoom and pan on the map with Pointer Events (story C2). Owner: Bruce (Part B).
// One finger (or the S Pen, or the mouse) drags, two fingers pinch, the mouse wheel and a
// trackpad pinch zoom around the pointer. A tap that does not move stays a normal click, so
// tapping a stack still opens it; the click after a drag or pinch is swallowed.
// The maths is in viewport.js; this file only reads pointers and sets the SVG viewBox.
import { clampView, fitWidth, zoomAt, panBy, pinchView, reveal, viewBox } from './viewport.js';

const SLOP = { touch: 8, pen: 4, mouse: 4 }; // px a pointer must move before it is a drag
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param stage     the element that holds the SVG (gets touch-action: none in map.css)
 * @param onChange  called with the view after every change ({ x, y, k })
 */
export function createPanZoom(stage, { onChange }) {
  let svg = null;
  let scene = null;
  let fw = 0;
  let fh = 0;
  let view = null;
  let fitted = true; // still at the opening view: a resize fits again
  let rect = null; // stage rect during a gesture
  const pointers = new Map(); // pointerId → { x, y } relative to the stage
  let gesture = null; // { kind: 'maybe' | 'pan' | 'pinch', … }
  let swallowClick = false;
  let anim = 0;

  function measure() {
    const r = stage.getBoundingClientRect();
    fw = r.width;
    fh = r.height;
  }

  function set(v) {
    view = v;
    svg?.setAttribute('viewBox', viewBox(view, fw, fh));
    onChange(view);
  }

  function stop() {
    cancelAnimationFrame(anim);
    anim = 0;
  }

  function animateTo(target, ms = 220) {
    stop();
    if (reducedMotion() || !view) {
      set(target);
      return;
    }
    const from = view;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = 1 - (1 - t) ** 3;
      set({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      anim = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  }

  const local = (e) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  const mid = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);

  function startPan(id, type) {
    gesture = { kind: 'pan', id, type, start: pointers.get(id), v0: view };
  }

  function onDown(e) {
    if (!view || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stop();
    swallowClick = false;
    rect = stage.getBoundingClientRect();
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      gesture = { kind: 'maybe', id: e.pointerId, type: e.pointerType, start: local(e), v0: view };
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      for (const id of pointers.keys()) capture(id);
      gesture = { kind: 'pinch', v0: view, m0: mid(pts), d0: dist(pts) };
      swallowClick = true;
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (gesture?.kind === 'maybe' && e.pointerId === gesture.id) {
      if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) <= (SLOP[gesture.type] ?? 6)) return;
      // it is a drag: capture only now, so a plain tap still clicks the stack under the finger
      capture(e.pointerId);
      swallowClick = true;
      gesture.kind = 'pan';
    }
    if (gesture?.kind === 'pan' && e.pointerId === gesture.id) {
      fitted = false;
      set(panBy(gesture.v0, p.x - gesture.start.x, p.y - gesture.start.y, scene, fw, fh));
    } else if (gesture?.kind === 'pinch' && pointers.size >= 2) {
      const pts = [...pointers.values()].slice(0, 2);
      fitted = false;
      set(pinchView(gesture.v0, gesture.m0, gesture.d0, mid(pts), dist(pts), scene, fw, fh));
    }
  }

  function onUp(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size === 1 && gesture?.kind === 'pinch') {
      // one finger lifted after a pinch: the other one carries on as a drag
      const [id] = pointers.keys();
      startPan(id, 'touch');
    } else if (pointers.size === 0) {
      gesture = null;
    }
  }

  function capture(id) {
    try {
      stage.setPointerCapture(id);
    } catch { /* the pointer is already gone */ }
  }

  function onClick(e) {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }

  function onWheel(e) {
    if (!view) return;
    e.preventDefault();
    stop();
    const r = stage.getBoundingClientRect();
    const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
    // a trackpad pinch arrives as ctrl + wheel with small steps
    const factor = Math.exp(-e.deltaY * lines * (e.ctrlKey ? 0.01 : 0.0015));
    fitted = false;
    set(zoomAt(view, factor, e.clientX - r.left, e.clientY - r.top, scene, fw, fh));
  }

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('click', onClick, true);
  stage.addEventListener('wheel', onWheel, { passive: false });

  return {
    get view() {
      return view;
    },
    get frame() {
      return { fw, fh };
    },

    /** A new drawing: keep the user's zoom and position, or fit if they have not moved yet. */
    attach(newSvg, newScene) {
      svg = newSvg;
      scene = newScene;
      measure();
      if (!fw || !fh) return;
      set(fitted || !view ? fitWidth(scene, fw, fh) : clampView(view, scene, fw, fh));
    },

    /** The frame changed size (rotation, window resize). */
    resize() {
      const before = { fw, fh };
      measure();
      if (!scene || !fw || !fh || (before.fw === fw && before.fh === fh && view)) return;
      set(fitted || !view ? fitWidth(scene, fw, fh) : clampView(view, scene, fw, fh));
    },

    fit() {
      if (!scene) return;
      fitted = true;
      animateTo(fitWidth(scene, fw, fh));
    },

    /** Zoom around the middle of the frame (the + and − buttons). */
    zoomBy(factor) {
      if (!view) return;
      fitted = false;
      animateTo(zoomAt(view, factor, fw / 2, fh / 2, scene, fw, fh));
    },

    /** Pan (not zoom) so the rect, in cm, is visible. */
    reveal(r, { animate = true } = {}) {
      if (!view) return;
      const next = reveal(view, r, scene, fw, fh);
      if (next === view) return;
      fitted = false;
      if (animate) animateTo(next);
      else {
        stop();
        set(next);
      }
    },

    destroy() {
      stop();
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick, true);
      stage.removeEventListener('wheel', onWheel);
    },
  };
}
