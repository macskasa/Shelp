// The to-scale SVG view of the shelves, front or back row (stories C2, C3, issue #47). Owner: Bruce (Part B).
// Turns a scene from scene.js into SVG with s(). Drawing units are cm (the viewBox).
// Text and outlines are sized in SCREEN px: map.css divides font sizes by the CSS variable --k
// (screen px per cm) and uses non-scaling strokes, so they stay the same size at any zoom.
// refit(k, measure) decides which titles are readable at the current zoom.
// Every stack is a focusable button (Tab, then Enter or Space); view.js handles the press.
import { s } from '../core/dom.js';
import { colorsFor } from '../core/categories.js';
import { boxTitle, fitText, stackLabel, TITLE_PX } from './labels.js';
import { stackAriaLabel } from './details.js';
import { hitSpan } from './hit.js';

const SEAM = 0.05; // cm; stripes overlap a little so no light seam shows between them
const RING = 0.6; // cm; rings sit this far outside the stack or box

/**
 * @returns {{ svg: SVGSVGElement, refit(k, measure), highlight({ stackId, gameId } | null),
 *             stackNode(id), boxNode(gameId) }}
 */
export function drawScene(scene, getGame) {
  const titles = []; // { node, box, title }
  const toppers = []; // { node, topper, room }
  const ids = []; // { node, stack }
  const hits = []; // { node, stack }: empty stacks, whose tap target follows the zoom (part-b4 item 3)
  const stackNodes = new Map();
  const stackData = new Map();
  const boxNodes = new Map();
  const boxData = new Map();
  const zoneById = new Map(scene.zones.map((z) => [z.id, z]));

  const easy = scene.easy.map((e) => s('path', { class: 'map-easy', d: e.path }));

  const zones = scene.zones.flatMap((z) => [
    s('rect', { class: `map-zone${z.approximate ? ' map-approx' : ''}`, x: z.x, y: z.top, width: z.length, height: z.height }),
    s('line', { class: 'map-floor', x1: z.x, x2: z.x + z.length, y1: z.floor, y2: z.floor }),
    z.overhang ? s('rect', { class: 'map-overhang', x: z.x + z.length, y: z.top, width: z.overhang, height: z.height }) : null,
  ]);

  const stacks = scene.stacks.map((st) => {
    const zone = zoneById.get(st.zone);
    const g = s('g', {
      class: 'map-stack', 'data-stack': st.id, tabindex: '0', role: 'button', 'aria-label': stackAriaLabel(st.id, st.zone, st.layout.boxes.length),
    },
    // tap target: the whole column of the stack, from the top of the shelf down to its id
    s('rect', { class: 'map-stack-hit', x: st.x, y: zone.top, width: Math.max(st.w, 2), height: st.label.y - zone.top + 3 }));
    if (st.empty) hits.push({ node: g.firstChild, stack: st });
    // an empty stack: a thin dashed outline, so it can be seen and tapped (part-b3 item 5)
    if (st.empty) g.append(s('rect', { class: 'map-empty', x: st.x, y: st.top, width: st.w, height: st.h }));
    for (const b of st.boxes) {
      const node = drawBox(b, getGame(b.gameId), titles);
      boxNodes.set(b.gameId, node);
      boxData.set(b.gameId, b);
      g.append(node);
    }
    // back view: the front row as faint outlines in front of the back row
    if (st.ghosts.length) {
      g.append(s('g', { class: 'map-ghosts', 'aria-hidden': 'true' },
        st.ghosts.map((b) => s('rect', { class: 'map-ghost', x: b.x, y: b.y, width: b.w, height: b.h }))));
    }
    if (st.topper) {
      const t = st.topper;
      const label = s('text', { class: 'map-topper-label', x: t.x + t.w / 2, y: t.y + t.h / 2 });
      // the label may use the stack's width when the object is narrower (the bonsai on M3)
      toppers.push({ node: label, topper: t, room: Math.max(t.w, st.w) });
      g.append(s('g', { class: 'map-topper' },
        s('rect', { x: t.x, y: t.y, width: t.w, height: t.h, rx: 0.8 }), label));
    }
    const id = s('text', { class: 'map-stack-id', x: st.label.x, y: st.label.y, 'aria-hidden': 'true' }, st.id);
    ids.push({ node: id, stack: st });
    g.append(id);
    stackNodes.set(st.id, g);
    stackData.set(st.id, st);
    return g;
  });

  const brackets = scene.brackets.map((b) => s('rect', { class: 'map-bracket', x: b.x, y: b.y, width: b.w, height: b.h }));
  const labels = scene.labels.map((l) => s('text', { class: 'map-band', x: l.x, y: l.y, 'aria-hidden': 'true' }, l.text));

  // Rings live in their own top layer: never hidden under a neighbour, and the stacks keep their
  // order (which is also the Tab order).
  const ring = (cls) => s('rect', { class: cls, rx: 0.8, visibility: 'hidden' });
  const focusRing = ring('map-ring-focus');
  const stackRing = ring('map-ring-stack');
  const boxHalo = ring('map-ring-halo');
  const boxLine = ring('map-ring-box');
  const family = s('g', { class: 'map-family-rings' }); // a family's boxes (part-b4 item 1)

  const svg = s('svg', {
    class: 'map-svg', viewBox: `0 0 ${scene.width} ${scene.height}`,
    role: 'group', 'aria-label': 'The shelves drawn to scale. Each stack is a button that opens its details.',
  },
  s('g', { class: 'map-layer-easy', 'aria-hidden': 'true' }, easy),
  s('g', { class: 'map-layer-zones', 'aria-hidden': 'true' }, zones),
  s('g', { class: 'map-layer-stacks' }, stacks),
  s('g', { class: 'map-layer-brackets', 'aria-hidden': 'true' }, brackets),
  s('g', { class: 'map-layer-labels', 'aria-hidden': 'true' }, labels),
  s('g', { class: 'map-layer-rings', 'aria-hidden': 'true' }, family, stackRing, boxHalo, boxLine, focusRing));

  // keyboard focus ring (only for keyboard focus, not after a tap)
  svg.addEventListener('focusin', (e) => {
    const st = stackData.get(e.target.dataset?.stack);
    if (st && e.target.matches(':focus-visible')) place(focusRing, st.x, st.top, st.w, st.h);
  });
  svg.addEventListener('focusout', () => hide(focusRing));

  return {
    svg,
    stackNode: (id) => stackNodes.get(id) ?? null,
    boxNode: (gameId) => boxNodes.get(gameId) ?? null,

    /** Show the titles, topper labels and stack ids that are readable at k screen px per cm. */
    refit(k, measure) {
      for (const { node, box, title } of titles) node.textContent = boxTitle(box, title, k, measure) ?? '';
      for (const { node, topper, room } of toppers) {
        node.textContent = topper.h * k >= TITLE_PX + 2 ? fitText(topper.label, room * k - 6, measure) ?? '' : '';
      }
      for (const { node, stack } of ids) {
        node.textContent = stackLabel(stack.id, stack.rows > 1, Math.max(stack.w * k, measure(stack.id)) + 4, measure);
      }
      for (const { node, stack } of hits) {
        const span = hitSpan(stack, k, measure(stack.id) + 4);
        node.setAttribute('x', span.x);
        node.setAttribute('width', span.w);
      }
    },

    /**
     * Mark a family (part-b4 item 1): an outline on each member box, a ring on each stack whose
     * member is in the row not drawn, and the rest of the drawing dimmed. null clears it.
     */
    markFamily(focus) {
      svg.classList.toggle('map-dim', !!focus);
      for (const [id, node] of boxNodes) node.classList.toggle('is-member', !!focus?.boxIds.includes(id));
      for (const [id, node] of stackNodes) node.classList.toggle('has-member', !!focus?.stackIds.includes(id));
      const rings = [];
      for (const id of focus?.boxIds ?? []) {
        const b = boxData.get(id);
        if (!b) continue;
        for (const cls of ['map-ring-halo', 'map-ring-box']) {
          const r = ring(cls);
          rings.push(r);
          place(r, b.x, b.y, b.w, b.h, 0.1);
        }
      }
      for (const id of focus?.ringStackIds ?? []) {
        const st = stackData.get(id);
        if (!st) continue;
        const r = ring('map-ring-stack');
        rings.push(r);
        place(r, st.x, st.top, st.w, st.h);
      }
      family.replaceChildren(...rings);
    },

    /**
     * Mark one stack (green ring) and optionally one box in it (dark outline with a light halo,
     * so it shows on green boxes too). null clears the highlight.
     */
    highlight(target) {
      for (const r of [stackRing, boxHalo, boxLine]) hide(r);
      const st = target && stackData.get(target.stackId);
      if (!st) return;
      place(stackRing, st.x, st.top, st.w, st.h);
      const b = target.gameId ? boxData.get(target.gameId) : null;
      if (b) {
        place(boxHalo, b.x, b.y, b.w, b.h, 0.1);
        place(boxLine, b.x, b.y, b.w, b.h, 0.1);
      }
    },
  };
}

function place(rect, x, y, w, h, pad = RING) {
  rect.setAttribute('x', x - pad);
  rect.setAttribute('y', y - pad);
  rect.setAttribute('width', Math.max(w, 0) + 2 * pad);
  rect.setAttribute('height', Math.max(h, 0) + 2 * pad);
  rect.setAttribute('visibility', 'visible');
  // restart the pulse animation
  rect.classList.remove('is-on');
  void rect.getBoundingClientRect(); // forces a style flush, so the animation starts again
  rect.classList.add('is-on');
}

function hide(rect) {
  rect.setAttribute('visibility', 'hidden');
  rect.classList.remove('is-on');
}

function drawBox(b, game, titles) {
  const title = game?.title ?? b.gameId;
  const colors = game ? colorsFor(game) : ['var(--cat-other)'];
  const g = s('g', { class: 'map-box', 'data-game': b.gameId });
  const n = colors.length;
  colors.forEach((c, i) => {
    const w = b.w / n + (i < n - 1 ? SEAM : 0);
    g.append(s('rect', { class: 'map-fill', x: b.x + (i * b.w) / n, y: b.y, width: w, height: b.h, style: `--c: ${c}` }));
  });
  g.append(s('rect', { class: 'map-box-line', x: b.x, y: b.y, width: b.w, height: b.h }));
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const t = s('text', { class: 'map-title', x: cx, y: cy, transform: b.vertical ? `rotate(-90 ${cx} ${cy})` : null });
  titles.push({ node: t, box: b, title });
  g.append(t);
  return g;
}
