// The to-scale SVG front view (story C2). Owner: Bruce (Part B).
// Turns a scene from scene.js into SVG with s(). Drawing units are cm (the viewBox).
// Text and outlines are sized in SCREEN px: map.css divides font sizes by the CSS variable --k
// (screen px per cm) and uses non-scaling strokes, so they stay the same size at any zoom.
// refit(k, measure) decides which titles are readable at the current zoom.
import { s } from '../core/dom.js';
import { colorsFor } from '../core/categories.js';
import { boxTitle, fitText, stackLabel, TITLE_PX } from './labels.js';

const SEAM = 0.05; // cm; stripes overlap a little so no light seam shows between them

/**
 * @returns {{ svg: SVGSVGElement, refit(k, measure), highlight({ stackId, gameId } | null),
 *             stackNode(id), boxNode(gameId) }}
 */
export function drawScene(scene, getGame) {
  const titles = []; // { node, box, title }
  const toppers = []; // { node, topper }
  const ids = []; // { node, stack }
  const stackNodes = new Map();
  const boxNodes = new Map();
  const zoneById = new Map(scene.zones.map((z) => [z.id, z]));

  const easy = scene.easy.map((e) => s('path', { class: 'map-easy', d: e.path }));

  const zones = scene.zones.flatMap((z) => [
    s('rect', { class: `map-zone${z.approximate ? ' map-approx' : ''}`, x: z.x, y: z.top, width: z.length, height: z.height }),
    s('line', { class: 'map-floor', x1: z.x, x2: z.x + z.length, y1: z.floor, y2: z.floor }),
    z.overhang ? s('rect', { class: 'map-overhang', x: z.x + z.length, y: z.top, width: z.overhang, height: z.height }) : null,
  ]);

  const stacks = scene.stacks.map((st) => {
    const zone = zoneById.get(st.zone);
    const g = s('g', { class: 'map-stack', 'data-stack': st.id },
      // tap target: the whole column of the stack, from the top of the shelf down to its id
      s('rect', { class: 'map-stack-hit', x: st.x, y: zone.top, width: Math.max(st.w, 2), height: st.label.y - zone.top + 3 }),
      s('rect', { class: 'map-stack-ring', x: st.x - 0.6, y: st.top - 0.6, width: st.w + 1.2, height: st.h + 1.2, rx: 0.8 }),
    );
    for (const b of st.boxes) {
      const node = drawBox(b, getGame(b.gameId), titles);
      boxNodes.set(b.gameId, node);
      g.append(node);
    }
    if (st.topper) {
      const t = st.topper;
      const label = s('text', { class: 'map-topper-label', x: t.x + t.w / 2, y: t.y + t.h / 2 });
      // the label may use the stack's width when the object is narrower (the bonsai on M3)
      toppers.push({ node: label, topper: t, room: Math.max(t.w, st.w) });
      g.append(s('g', { class: 'map-topper' },
        s('rect', { x: t.x, y: t.y, width: t.w, height: t.h, rx: 0.8 }), label));
    }
    const id = s('text', { class: 'map-stack-id', x: st.label.x, y: st.label.y }, st.id);
    ids.push({ node: id, stack: st });
    g.append(id);
    stackNodes.set(st.id, g);
    return g;
  });

  const brackets = scene.brackets.map((b) => s('rect', { class: 'map-bracket', x: b.x, y: b.y, width: b.w, height: b.h }));
  const labels = scene.labels.map((l) => s('text', { class: 'map-band', x: l.x, y: l.y }, l.text));

  const svg = s('svg', {
    class: 'map-svg', viewBox: `0 0 ${scene.width} ${scene.height}`,
    role: 'img', 'aria-label': 'The shelves drawn to scale, with every box',
  },
  s('g', { class: 'map-layer-easy' }, easy),
  s('g', { class: 'map-layer-zones' }, zones),
  s('g', { class: 'map-layer-stacks' }, stacks),
  s('g', { class: 'map-layer-brackets' }, brackets),
  s('g', { class: 'map-layer-labels' }, labels));

  let lit = [];
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
    },

    /** Mark one stack and (optionally) one box in it. null clears the highlight. */
    highlight(target) {
      for (const n of lit) n.classList.remove('is-hl');
      lit = [];
      if (!target) return;
      const st = stackNodes.get(target.stackId);
      const box = target.gameId ? boxNodes.get(target.gameId) : null;
      for (const n of [st, box]) {
        if (n) {
          n.classList.add('is-hl');
          lit.push(n);
        }
      }
      // draw the highlighted stack last, so its ring is not hidden under its neighbours
      st?.parentNode?.append(st);
    },
  };
}

function drawBox(b, game, titles) {
  const title = game?.title ?? b.gameId;
  const colors = game ? colorsFor(game) : ['var(--cat-other)'];
  const g = s('g', { class: `map-box${b.missing ? ' map-missing' : ''}`, 'data-game': b.gameId });
  const n = colors.length;
  colors.forEach((c, i) => {
    const w = b.w / n + (i < n - 1 ? SEAM : 0);
    g.append(s('rect', { class: 'map-fill', x: b.x + (i * b.w) / n, y: b.y, width: w, height: b.h, style: `--c: ${c}` }));
  });
  g.append(s('rect', { class: 'map-box-line', x: b.x, y: b.y, width: b.w, height: b.h }));
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (b.missing) {
    // drawn at box scale (not screen px), so the mark is there at every zoom
    g.append(s('text', { class: 'map-q', x: cx, y: cy, style: `font-size: ${Math.min(b.w, b.h) * 0.8}px` }, '?'));
  }
  const t = s('text', { class: 'map-title', x: cx, y: cy, transform: b.standing ? `rotate(-90 ${cx} ${cy})` : null });
  titles.push({ node: t, box: b, title: b.missing ? `? ${title}` : title });
  g.append(t);
  return g;
}
