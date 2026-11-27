// The "Saved versions" panel (D6): save, list, switch, rename, delete. Owner: Peter (Part C).
// Opened from the header button (js/shell/tools.js). It follows store:changed.
import { h, loadCss, showPanel, closePanels, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { undoStep } from '../shell/history.js';
import { fitToVisualViewport } from '../shell/viewport.js';
import { confirmChoice } from './confirm.js';
import {
  NAME_MAX, autoSaveName, defaultName, describeVersion, formatSaved, hasRoom, nameProblem, switchQuestion,
} from './logic.js';

loadCss(new URL('./versions.css', import.meta.url));

/** Open the panel. Returns the <dialog>. */
export function openVersions() {
  let editing = null; // { id, value } while a name is being changed in the list

  const nameField = h('input', {
    class: 'ver-input', type: 'text', maxlength: NAME_MAX, autocomplete: 'off', enterkeyhint: 'done',
    'aria-label': 'Name for this version', 'aria-describedby': 'ver-full',
    onkeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } },
  });
  nameField.value = defaultName();
  const saveBtn = h('button', { class: 'btn btn-primary ver-save', type: 'button', onclick: save }, 'Save this version');
  const full = h('p', { class: 'muted ver-note', id: 'ver-full' });
  const status = h('p', { class: 'ver-status', role: 'status' });
  const list = h('ul', { class: 'ver-list' });

  const dlg = h('dialog', { class: 'panel ver-panel', 'aria-label': 'Saved versions' },
    h('div', { class: 'ver-head' },
      h('h2', {}, 'Saved versions'),
      h('form', { method: 'dialog' }, h('button', { class: 'btn ver-close', type: 'submit' }, 'Close'))),
    h('div', { class: 'ver-save-row' }, nameField, saveBtn), full, status, list);

  function save() {
    const problem = nameProblem(nameField.value);
    if (problem) { status.textContent = problem; status.className = 'ver-status ver-error'; return; }
    try {
      const name = nameField.value.trim().replace(/\s+/g, ' ');
      store.saveVersion(name);
      status.textContent = `Saved “${name}”.`;
      status.className = 'ver-status';
      nameField.value = defaultName();
    } catch (err) {
      status.textContent = err.message;
      status.className = 'ver-status ver-error';
    }
  }

  async function doSwitch(v) {
    const room = hasRoom(store.listVersions(), store.MAX_VERSIONS);
    const { yes } = await confirmChoice({
      title: 'Switch to this version?',
      lines: [switchQuestion(v.name)],
      confirmLabel: 'Switch',
      checkbox: {
        label: 'Save the current state as a version first',
        checked: room,
        disabled: !room,
        note: room ? null : `${store.MAX_VERSIONS} versions are saved. Delete one to keep the current state too.`,
      },
      onYes: ({ checked }) => {
        if (checked) store.saveVersion(autoSaveName(v.name));
        store.restoreVersion(v.id);
      },
    });
    if (!yes) return;
    // a modal panel makes the toast's Undo button untappable, so close the panels first
    closePanels(() => toast(`Switched to “${v.name}”`, { action: { label: 'Undo', run: undoStep } }));
  }

  async function doDelete(v) {
    const { yes } = await confirmChoice({
      title: 'Delete this version?',
      lines: [`“${v.name}” is removed for good. Your current games and shelf plan stay as they are.`],
      confirmLabel: 'Delete',
      danger: true,
      onYes: () => store.deleteVersion(v.id),
    });
    if (yes) status.textContent = `Deleted “${v.name}”.`;
  }

  function renameForm(v) {
    const error = h('p', { class: 'ver-error', role: 'alert', hidden: true });
    const field = h('input', {
      class: 'ver-input', type: 'text', maxlength: NAME_MAX, autocomplete: 'off', enterkeyhint: 'done', 'aria-label': `New name for ${v.name}`,
      oninput: () => { editing.value = field.value; },
      onkeydown: (e) => {
        if (e.isComposing) return;
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } // Esc cancels the rename, not the panel
      },
    });
    field.value = editing.value;
    function commit() {
      const problem = nameProblem(field.value);
      if (problem) { error.textContent = problem; error.hidden = false; return; }
      try {
        store.renameVersion(v.id, field.value);
        editing = null;
        render();
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    }
    function cancel() { editing = null; render(); }
    queueMicrotask(() => { field.focus(); field.select(); });
    return [field, error,
      h('div', { class: 'ver-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: commit }, 'Save name'),
        h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Cancel'))];
  }

  function item(v) {
    if (editing?.id === v.id) return h('li', { class: 'ver-item' }, ...renameForm(v));
    return h('li', { class: 'ver-item' },
      h('div', { class: 'ver-name' }, v.name),
      h('div', { class: 'ver-meta muted' }, `${formatSaved(v.savedAt)} · ${describeVersion(v)}`),
      h('div', { class: 'ver-actions' },
        h('button', { class: 'btn', type: 'button', 'aria-label': `Switch to ${v.name}`, onclick: () => doSwitch(v) }, 'Switch to it'),
        h('button', { class: 'btn', type: 'button', 'aria-label': `Rename ${v.name}`, onclick: () => { editing = { id: v.id, value: v.name }; render(); } }, 'Rename'),
        h('button', { class: 'btn btn-danger', type: 'button', 'aria-label': `Delete ${v.name}`, onclick: () => doDelete(v) }, 'Delete')));
  }

  function render() {
    const versions = store.listVersions();
    const room = hasRoom(versions, store.MAX_VERSIONS);
    saveBtn.disabled = !room;
    nameField.disabled = !room;
    full.textContent = room ? '' : `${store.MAX_VERSIONS} versions are saved. Delete one to save another.`;
    full.hidden = room;
    list.replaceChildren(...(versions.length
      ? versions.map(item)
      : [h('li', { class: 'ver-empty muted' }, 'No saved versions yet. Save one before you rearrange things, then you can go back to it or compare.')]));
  }

  const off = on('store:changed', render);
  dlg.addEventListener('close', off, { once: true });
  render();
  fitToVisualViewport(dlg);
  showPanel(dlg);
  return dlg;
}
