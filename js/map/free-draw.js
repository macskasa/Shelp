// Free space on the map (part-b7 item 2): the SVG for the bands of free-layer.js. Owner: Bruce (Part B).
// Room on top and standing spaces: the air as a faint box with a dashed outline, the part it rests on
// as a stronger line on the surface. Empty floor: a faint hatched band along the floor. Labels only
// where they fit at the current zoom (refit). Colour: --focus (not a category colour, not a warning).
import { s } from '../core/dom.js';
import { placeLabels } from './free-layer.js';

let uniq = 0;

/**
 * @param bands  freeBands(units, scene)
 * @returns {{ el: SVGGElement, defs: SVGDefsElement, refit(k, measure), select(key | null) }}
 */
export function drawFree(bands) {
  const hatch = `map-free-hatch-${++uniq}`;
  const defs = s('defs', {},
    s('pattern', { id: hatch, width: 0.8, height: 0.8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('rect', { class: 'map-free-hatch', x: 0, y: 0, width: 0.3, height: 0.8 })));
  const nodes = new Map(); // key → g
  const labels = []; // { node, band }
  // the biggest first, so the small ones are drawn on top
  const items = [...bands].sort((a, b) => b.air.w * b.air.h - a.air.w * a.air.h).map((b) => {
    const g = s('g', { class: `map-free-band map-free-${b.kind}`, 'data-free': b.key });
    if (b.kind === 'gap') {
      g.append(s('rect', { class: 'map-free-gap', x: b.air.x, y: b.air.y, width: b.air.w, height: b.air.h, fill: `url(#${hatch})` }));
    } else {
      g.append(
        s('rect', { class: 'map-free-air', x: b.air.x, y: b.air.y, width: b.air.w, height: b.air.h }),
        s('line', { class: 'map-free-rest', x1: b.rest.x, x2: b.rest.x + b.rest.w, y1: b.rest.y, y2: b.rest.y }));
    }
    const t = s('text', { class: 'map-free-label' });
    labels.push({ node: t, band: b });
    g.append(t);
    nodes.set(b.key, g);
    return g;
  });
  const el = s('g', { class: 'map-layer-free', 'aria-hidden': 'true' }, items);
  let selected = null;

  return {
    el,
    defs,
    refit(k, measure) {
      const placed = placeLabels(bands, k, measure);
      for (const { node, band } of labels) {
        const at = placed.get(band.key);
        node.textContent = at ? band.text : '';
        if (!at) continue;
        node.setAttribute('x', at.x);
        node.setAttribute('y', at.y);
        if (at.vertical) node.setAttribute('transform', `rotate(-90 ${at.x} ${at.y})`);
        else node.removeAttribute('transform');
      }
    },
    select(key) {
      nodes.get(selected)?.classList.remove('is-selected');
      selected = key;
      const g = nodes.get(key);
      if (!g) return;
      g.classList.add('is-selected');
      g.parentNode.append(g); // on top of its neighbours
    },
  };
}

