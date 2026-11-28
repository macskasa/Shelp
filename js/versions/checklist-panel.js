// "Moving checklist" panel (D7): the steps from movingSteps(), with ticks that survive a reload. Owner: Peter (Part C).
// The ticks live in store meta 'checklist' = { from, to, done: [key, …] }; steps are worked out again on every change.
import { h, showPanel } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame } from '../core/contracts.js';
import { fitToVisualViewport } from '../shell/viewport.js';
import { movingSteps } from './checklist.js';

const SECTIONS = [['takeOut', 'Take out'], ['slide', 'Slide'], ['putIn', 'Put in'], ['inside', 'Inside boxes']];

/** Ticked keys saved for this pair, or [] when the saved ticks belong to another pair. */
export function savedTicks(meta, from, to) {
  const c = meta?.checklist;
  return c && c.from === from && c.to === to && Array.isArray(c.done) ? c.done : [];
}

/** "12 of 40 done". */
export const progressText = (done, total) => `${done} of ${total} done`;

/** `sideOf(id)` gives { label, name, games, plan } or null. */
export function openChecklist({ from, to, sideOf }) {
  let hideDone = false;
  const done = new Set(savedTicks(store.getMeta(), from, to));
  let keys = new Set();

  const title = h('h2', {}, 'Moving checklist');
  const sub = h('p', { class: 'muted ver-caption' });
  const count = h('p', { class: 'ver-summary', role: 'status' });
  const hide = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', onclick: () => { hideDone = !hideDone; render(); } }, 'Hide done');
  const clear = h('button', { class: 'btn', type: 'button', onclick: () => { done.clear(); save(); render(); } }, 'Clear ticks');
  const results = h('div', { class: 'ver-results' });
  const dlg = h('dialog', { class: 'panel ver-panel ver-compare ver-todo', 'aria-label': 'Moving checklist' },
    h('div', { class: 'ver-head' }, title, h('form', { method: 'dialog' }, h('button', { class: 'btn ver-close', type: 'submit' }, 'Close'))),
    sub, count, h('div', { class: 'ver-todo-tools' }, hide, clear), results);

  function save() {
    store.setMeta('checklist', { from, to, done: [...done].filter((k) => keys.has(k)) });
  }

  function row(step) {
    const box = h('input', { type: 'checkbox', checked: done.has(step.key), 'aria-label': step.text });
    box.addEventListener('change', () => { if (box.checked) done.add(step.key); else done.delete(step.key); save(); render(); });
    const open = store.getGame(step.id) ? h('button', { type: 'button', class: 'ver-todo-open', onclick: () => openGame(step.id) }, step.title) : null;
    const at = step.text.indexOf(step.title);
    const text = open && at >= 0 ? [step.text.slice(0, at), open, step.text.slice(at + step.title.length)] : [step.text];
    return h('li', {}, h('label', { class: `ver-todo-row${done.has(step.key) ? ' is-done' : ''}` }, box, h('span', {}, ...text)));
  }

  function render() {
    const a = sideOf(from);
    const b = sideOf(to);
    if (!a || !b) { count.textContent = 'One of the two versions is gone.'; results.replaceChildren(); return; }
    sub.textContent = `From ${a.name} to ${b.name}`;
    const steps = movingSteps(a, b);
    const all = SECTIONS.flatMap(([k]) => steps[k]);
    keys = new Set(all.map((s) => s.key));
    for (const k of [...done]) if (!keys.has(k)) done.delete(k);
    count.textContent = progressText(done.size, all.length);
    hide.setAttribute('aria-pressed', String(hideDone));
    hide.classList.toggle('btn-primary', hideDone);
    let number = 0;
    results.replaceChildren(...SECTIONS.map(([k, label]) => {
      if (!steps[k].length) return null;
      const name = `${++number}. ${label}`;
      const shown = hideDone ? steps[k].filter((s) => !done.has(s.key)) : steps[k];
      return h('section', { class: 'ver-group' }, h('h3', {}, `${name} (${steps[k].length})`),
        shown.length ? h('ul', { class: 'ver-lines' }, ...shown.map(row)) : h('p', { class: 'muted ver-caption' }, 'All done.'));
    }).filter(Boolean));
    if (!all.length) results.replaceChildren(h('p', { class: 'muted' }, 'Nothing to move.'));
  }

  const off = on('store:changed', (e) => { if (!e?.meta) render(); });
  dlg.addEventListener('close', off, { once: true });
  render();
  fitToVisualViewport(dlg);
  showPanel(dlg);
  return dlg;
}
