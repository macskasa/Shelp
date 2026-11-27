// Move stack (part-b3 item 5). Owner: Bruce (Part B). Opens over the stack details:
// ←5 ←1 1→ 5→ (cm) and the current x; every step previews moveStack and lists the new problems.
// Save writes one moveStack (one undo step), closes the panels and toasts with Undo.
// Desktop: ← / → move 1 cm, with Shift 5 cm.
import { h, showPanel, closePanels, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { ZONES } from '../core/shelves.js';
import { moveStackFn, checkMove, stepX, arrowStep } from './stacks.js';
import { warningList } from './ui.js';

const num = (n) => (Math.round(n * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
const STEPS = [[-5, '←5'], [-1, '←1'], [1, '1→'], [5, '5→']];
let uniq = 0;

/** Open Move stack for a stack. Returns the dialog, or null. */
export function openStackMove(stackId) {
  const st = store.getStack2(stackId);
  if (!st) return null;
  const from = st.x;
  let x = from;

  const value = h('output', { class: 'map-move-x', 'aria-live': 'polite' });
  const preview = h('div', { class: 'map-preview', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Save');
  const steps = STEPS.map(([d, label]) => h('button', {
    type: 'button', class: 'btn map-move-step', 'aria-label': `${d < 0 ? 'Left' : 'Right'} ${Math.abs(d)} cm`,
    onclick: () => step(d),
  }, label));

  const titleId = `map-smove-title-${++uniq}`;
  const dlg = h('dialog', { class: 'panel map-put map-smove', 'aria-labelledby': titleId },
    h('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
      h('h2', { id: titleId }, `Move stack ${stackId}`),
      h('p', { class: 'muted' }, `${ZONES[st.zone]?.label ?? st.zone} · now at ${num(from)} cm`),
      h('div', { class: 'map-move-row', role: 'group', 'aria-label': 'Move along the shelf' },
        steps[0], steps[1], value, steps[2], steps[3]),
      h('p', { class: 'muted map-move-keys' }, 'Arrow keys: 1 cm, with Shift 5 cm.'),
      preview,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        submit)));

  function step(d) {
    x = stepX(x, d);
    update();
  }

  function update() {
    value.textContent = `${num(x)} cm`;
    steps[0].disabled = steps[1].disabled = x <= 0;
    if (x === from) {
      preview.replaceChildren(h('p', { class: 'muted' }, 'Where it is now.'));
      submit.disabled = true;
      submit.textContent = 'Save';
      return;
    }
    const c = checkMove(store, moveStackFn(store, stackId, x), 'Save');
    const parts = [h('p', {}, `${x > from ? 'Right' : 'Left'} ${num(Math.abs(x - from))} cm.`)];
    if (c.error) parts.push(h('p', { class: 'map-put-error' }, c.error.message));
    else if (c.block.length || c.warn.length) {
      if (c.block.length) parts.push(h('p', { class: 'map-put-error' }, 'Not allowed here:'));
      parts.push(warningList([...c.block, ...c.warn]));
    } else parts.push(h('p', { class: 'map-ok' }, '✓ No new problems.'));
    preview.replaceChildren(h('div', {}, parts));
    submit.disabled = c.button.disabled;
    submit.textContent = c.button.label;
  }

  function save() {
    if (submit.disabled) return;
    try {
      store.moveStack(stackId, x);
      closePanels(() => toast(`Stack ${stackId} → ${num(x)} cm`, { action: { label: 'Undo', run: () => store.undo() } }));
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  dlg.addEventListener('keydown', (e) => {
    const d = arrowStep(e);
    if (!d || e.altKey || e.ctrlKey || e.metaKey || e.target.matches?.('input, select, textarea')) return;
    e.preventDefault();
    step(d);
  });
  showPanel(dlg);
  update();
  steps[2].focus();
  return dlg;
}
