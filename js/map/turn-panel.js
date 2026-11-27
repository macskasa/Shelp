// The turn chooser for a box on a shelf (Phase C item 4). Owner: Bruce (Part B).
// Lists only the orientations the store allows (pizza: 2, others up to 6, equal sizes once), each
// with its size and a small to-scale outline; the current way is marked. Choosing one previews
// store.turnBox and checks only the new problems: Turn / Turn anyway / Not allowed.
import { h, s, showPanel, closePanels, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { layoutStack2 } from '../core/geometry.js';
import { newProblems } from './spots.js';
import { turnOptions, confirmButton } from './pickup.js';
import { warningList } from './ui.js';

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
const ICON = 44; // px, the outline of the biggest option
let uniq = 0;

/** Open the turn chooser for a game on a shelf. Returns the dialog, or null. */
export function openTurnPanel(gameId) {
  const game = store.getGame(gameId);
  const loc = store.locate2(gameId);
  if (!game || loc?.kind !== 'stack') return null;
  const opts = turnOptions(game, loc);
  const scale = ICON / Math.max(...opts.map((o) => o.w + o.d * 0.4), ...opts.map((o) => o.h + o.d * 0.4));
  let chosen = -1;

  const preview = h('div', { class: 'map-preview', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Turn');
  const buttons = opts.map((o, i) => h('button', {
    type: 'button', class: 'map-turn-opt', 'aria-pressed': 'false', onclick: () => choose(i),
  }, outline(o, scale),
  h('span', { class: 'map-turn-text' },
    h('strong', {}, o.label, o.current ? h('span', { class: 'map-turn-now' }, 'now') : null),
    h('span', { class: 'muted' }, o.size))));

  const titleId = `map-turn-title-${++uniq}`;
  const dlg = h('dialog', { class: 'panel map-put map-turn', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); turn(); } },
      h('h2', { id: titleId }, 'Turn'),
      h('p', {}, h('strong', {}, game.title), h('span', { class: 'muted' }, ` · stack ${loc.stackId}`)),
      game.pizza !== false ? h('p', { class: 'muted map-turn-hint' }, 'A pizza game only lies flat; you can still turn it round.') : null,
      h('div', { class: 'map-turn-opts', role: 'group', 'aria-label': 'Which way' }, buttons),
      preview,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        submit)));

  const fn = () => store.turnBox(gameId, { up: opts[chosen].up, rot: opts[chosen].rot });

  function choose(i) {
    chosen = i;
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    const o = opts[i];
    if (o.current) {
      preview.replaceChildren(h('p', {}, 'It lies this way now.'));
      submit.disabled = true;
      submit.textContent = 'Turn';
      return;
    }
    const p = store.preview(fn);
    const np = p.error ? { block: [], warn: [] } : newProblems(store.getPlan2(), p.plan, store.getGame);
    const parts = [];
    if (p.error) parts.push(h('p', { class: 'map-put-error' }, p.error.message));
    else {
      const st = p.plan.stacks.find((x) => x.id === loc.stackId);
      parts.push(h('p', {}, `Stack ${loc.stackId} would be ${num(layoutStack2(st, store.getGame).h)} cm high.`));
      if (np.block.length) parts.push(h('p', { class: 'map-put-error' }, 'Not allowed:'));
      if (np.block.length || np.warn.length) parts.push(warningList([...np.block, ...np.warn]));
      else parts.push(h('p', { class: 'map-ok' }, '✓ No new problems.'));
    }
    preview.replaceChildren(h('div', {}, parts));
    const btn = confirmButton({ error: p.error, ...np }, 'Turn');
    submit.disabled = btn.disabled;
    submit.textContent = btn.label;
  }

  function turn() {
    if (chosen < 0 || submit.disabled) return;
    const label = opts[chosen].label.toLowerCase();
    try {
      fn();
      closePanels(() => toast(`${game.title} turned: ${label}`, { action: { label: 'Undo', run: () => store.undo() } }));
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  showPanel(dlg);
  (buttons.find((b, i) => opts[i].current) ?? buttons[0])?.focus();
  return dlg;
}

/** A small to-scale box: the front (along × high) and the top going back (deep), slanted. */
function outline(o, k) {
  const w = o.w * k;
  const hh = o.h * k;
  const dd = o.d * k * 0.4; // the depth, drawn at a slant
  const size = ICON + 4;
  const x = 2;
  const y = size - 2 - hh;
  return s('svg', { class: 'map-turn-icon', viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true' },
    s('path', { class: 'map-turn-side', d: `M${x} ${y} l${dd} ${-dd} h${w} v${hh} l${-dd} ${dd} h${-w} z` }),
    s('rect', { class: 'map-turn-front', x, y, width: w, height: hh }));
}
