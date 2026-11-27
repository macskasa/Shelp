// A yes/no question as a panel (the Back gesture counts as "no"). Owner: Stephen (Part A).
import { h, showPanel } from '../core/dom.js';

let uniq = 0;

/**
 * confirmPanel({ title, lines: ['text'], items: ['a list'], confirmLabel: 'Delete', danger: true }) -> Promise<boolean>
 */
export function confirmPanel({ title, lines = [], items = [], confirmLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let yes = false;
    const titleId = `io-confirm-${++uniq}`;
    const dlg = h('dialog', { class: 'panel io-confirm', 'aria-labelledby': titleId },
      h('h2', { id: titleId }, title),
      ...lines.map((t) => h('p', {}, t)),
      items.length ? h('ul', { class: 'io-confirm-list' }, items.map((t) => h('li', {}, t))) : null,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        h('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => { yes = true; dlg.close(); } }, confirmLabel)));
    dlg.addEventListener('close', () => resolve(yes), { once: true });
    showPanel(dlg);
  });
}
