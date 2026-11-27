// The Family part of the game panel (story B2): the field, suggestion chips, "Also in …" and Rename family…
// Same shape as the parts in fields.js: returns { el, refresh(game), flush() }. Owner: Stephen (Part A).
import { h, clear, closePanels, showPanel, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { suggestFamilyNames, alsoIn } from './family.js';
import { textOrNull } from './logic.js';

let uniq = 0;

/** The small "Rename family…" panel. On success: close the panels and toast with Undo (like a move). */
function renamePanel(name) {
  const titleId = `game-family-title-${++uniq}`;
  const inputId = `game-family-name-${uniq}`;
  const hint = h('p', { class: 'game-hint is-error', role: 'status' });
  const input = h('input', { type: 'text', id: inputId, autocomplete: 'off', maxlength: 40, enterkeyhint: 'done', value: name });
  const go = () => {
    const next = textOrNull(input.value);
    if (!next) { hint.textContent = 'A family needs a name.'; return; }
    if (next === name) { dlg.close(); return; }
    try {
      store.renameFamily(name, next);
    } catch (err) {
      hint.textContent = err.message;
      return;
    }
    const shown = store.getFamilies().find((f) => f.name.toLocaleLowerCase('hu') === next.toLocaleLowerCase('hu'))?.name ?? next;
    closePanels(() => toast(`Renamed the family to “${shown}”`, { action: { label: 'Undo', run: store.undo } }));
  };
  const dlg = h('dialog', { class: 'panel game-family-rename', 'aria-labelledby': titleId },
    h('h2', { id: titleId }, 'Rename family'),
    h('p', { class: 'muted' }, 'This renames it on every game in the family. A name that exists already merges the two families.'),
    h('label', { class: 'game-label', for: inputId }, 'Family name'), input, hint,
    h('div', { class: 'panel-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: go }, 'Rename')));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  input.addEventListener('input', () => { hint.textContent = ''; });
  showPanel(dlg);
  input.focus();
  input.select();
}

export function familySection(id, save, openOther) {
  const inputId = `game-family-${++uniq}`;
  const input = h('input', {
    type: 'text', id: inputId, autocomplete: 'off', maxlength: 40, enterkeyhint: 'done',
    placeholder: 'e.g. Azul', class: 'game-family-input', onchange: commit,
  });
  const chips = h('div', { class: 'game-chips', role: 'group', 'aria-label': 'Suggested families' });
  const also = h('p', { class: 'game-also' });
  const rename = h('button', { type: 'button', class: 'btn game-rename', onclick: () => { const f = store.getGame(id)?.family; if (f) renamePanel(f); } }, 'Rename family…');
  let key = ''; // what chips and the "also in" line show now, so a refresh with the same content keeps the buttons

  function commit() {
    const next = textOrNull(input.value);
    if (next !== (store.getGame(id).family ?? null)) save({ family: next });
  }

  const title = (gid) => store.getGame(gid)?.title ?? gid;
  return {
    el: h('section', { class: 'game-sec' },
      h('label', { class: 'game-label', for: inputId }, 'Family'), input, chips, also, rename),
    refresh(g) {
      if (document.activeElement !== input && input.value !== (g.family ?? '')) input.value = g.family ?? '';
      rename.hidden = !g.family;
      const names = suggestFamilyNames(g, store.getGames(), store.getPlan2().inside);
      const others = alsoIn(g, store.getFamilies());
      const next = JSON.stringify([g.family, names, others.map((o) => [o, title(o)])]);
      if (next === key) return;
      key = next;
      clear(chips).append(...names.map((n) => h('button', { type: 'button', class: 'game-chip', onclick: () => save({ family: n }) }, n)));
      chips.hidden = !names.length;
      clear(also);
      also.hidden = !others.length;
      if (others.length) {
        also.append(`Also in ${g.family}: `);
        others.forEach((o, i) => {
          if (i) also.append(' · ');
          also.append(h('button', { type: 'button', class: 'game-also-link', onclick: () => openOther(o) }, title(o)));
        });
      }
    },
    flush: commit,
  };
}
