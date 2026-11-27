// A yes/no question as a panel, with an optional tick box. Owner: Peter (Part C).
// The Back gesture counts as "no". Resolves { yes, checked }.
import { h, showPanel } from '../core/dom.js';

let uniq = 0;

/**
 * confirmChoice({ title, lines, confirmLabel, danger, checkbox: { label, checked, disabled, note } })
 *   -> Promise<{ yes: boolean, checked: boolean }>
 * errorOf(result) can be passed to keep the question open when the action fails: throw an Error from onYes.
 */
export function confirmChoice({ title, lines = [], confirmLabel = 'OK', danger = false, checkbox = null, onYes = null }) {
  return new Promise((resolve) => {
    let yes = false;
    const id = ++uniq;
    const box = checkbox
      ? h('input', { type: 'checkbox', id: `ver-check-${id}`, checked: !!checkbox.checked, disabled: !!checkbox.disabled })
      : null;
    const error = h('p', { class: 'ver-error', role: 'alert', hidden: true });
    const go = h('button', {
      type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
      onclick: () => {
        try {
          onYes?.({ checked: !!box?.checked });
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
          return;
        }
        yes = true;
        dlg.close();
      },
    }, confirmLabel);
    const dlg = h('dialog', { class: 'panel ver-confirm', 'aria-labelledby': `ver-confirm-${id}` },
      h('h2', { id: `ver-confirm-${id}` }, title),
      ...lines.map((t) => h('p', {}, t)),
      checkbox && h('div', { class: 'ver-check' }, box,
        h('label', { for: `ver-check-${id}` }, checkbox.label),
        checkbox.note && h('p', { class: 'muted ver-check-note' }, checkbox.note)),
      error,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'), go));
    dlg.addEventListener('close', () => resolve({ yes, checked: !!box?.checked }), { once: true });
    showPanel(dlg);
  });
}
