// The editable parts of the game panel. Each function returns { el, refresh(game), flush() }.
// refresh() never overwrites a field the user is typing in; flush() saves edits that were not committed yet.
import { h, clear, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { CATEGORIES } from '../core/categories.js';
import { formatDims } from '../core/format.js';
import {
  parseDims, dimsToInputs, sameDims, textOrNull, sizeSources, toggleCategory,
  hostChoices, takenOutReason, bggVersions, bggSearch,
} from './logic.js';

let uniq = 0;
const nextId = (name) => `game-${name}-${++uniq}`;

/** Set a field's text unless the user is in it. */
const fill = (el, text) => {
  if (document.activeElement !== el && el.value !== text) el.value = text;
};

export const extLink = (href, text) =>
  h('a', { class: 'game-link', href, target: '_blank', rel: 'noopener noreferrer' }, text);

// ---------------------------------------------------------------- A3: box size

export function sizeSection(id, save) {
  const listId = nextId('sources');
  const sourceId = nextId('source');
  let dirty = false; // the size inputs hold edits that are not saved yet

  const inputs = [0, 1, 2].map((i) => h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done',
    class: 'game-dim', 'aria-label': `Box side ${i + 1}, in cm`,
    oninput: () => { dirty = true; hint.textContent = ''; },
    onchange: commitDims,
  }));
  const hint = h('p', { class: 'game-hint', role: 'status' });
  const missing = h('p', { class: 'game-missing' },
    h('strong', {}, 'Size missing. '), 'Measure the box or look the edition up on BGG, then type the three sides below.');
  const shown = h('p', { class: 'game-size-now muted' });
  const links = h('p', { class: 'game-links' });
  const datalist = h('datalist', { id: listId });
  const source = h('input', {
    type: 'text', id: sourceId, list: listId, autocomplete: 'off', onchange: commitSource,
  });

  function commitDims() {
    const r = parseDims(inputs.map((i) => i.value));
    if (r.error) {
      hint.textContent = r.error;
      hint.classList.toggle('is-error', !r.incomplete);
      return;
    }
    hint.textContent = '';
    if (sameDims(r.dims, store.getGame(id).dims)) { dirty = false; return; }
    if (save({ dims: r.dims })) dirty = false;
  }

  function commitSource() {
    const next = textOrNull(source.value);
    if (next !== (store.getGame(id).sizeSource ?? null)) save({ sizeSource: next });
  }

  const el = h('section', { class: 'game-sec' },
    h('h3', {}, 'Box size'),
    missing,
    h('fieldset', { class: 'game-dims' },
      h('legend', { class: 'game-label' }, 'Three sides, any order (cm)'),
      inputs[0], h('span', { 'aria-hidden': 'true' }, '×'),
      inputs[1], h('span', { 'aria-hidden': 'true' }, '×'),
      inputs[2], h('span', { class: 'muted' }, 'cm')),
    hint, shown,
    h('label', { class: 'game-label', for: sourceId }, 'Where the size came from'),
    source, datalist, links);

  return {
    el,
    refresh(g) {
      missing.hidden = !!g.dims;
      shown.textContent = g.dims ? `Saved: ${formatDims(g.dims)}` : '';
      if (!dirty) dimsToInputs(g.dims).forEach((text, i) => fill(inputs[i], text));
      fill(source, g.sizeSource ?? '');
      clear(datalist).append(...sizeSources(store.getGames()).map((t) => h('option', { value: t })));
      clear(links).append(g.bggId
        ? extLink(bggVersions(g), 'BGG versions: look up this edition’s size')
        : extLink(bggSearch(g), 'Search BGG for this game'));
    },
    flush() {
      if (dirty) {
        const r = parseDims(inputs.map((i) => i.value));
        if (r.error) toast('Box size was not saved. Fill in all three sides.', { error: true });
        else commitDims();
      }
      commitSource();
    },
  };
}

// ---------------------------------------------------------------- B1: categories

export function categorySection(id, save) {
  const buttons = CATEGORIES.map((c) => h('button', {
    type: 'button', class: 'game-cat', style: `--c: var(${c.cssVar})`, 'aria-pressed': 'false',
    onclick: () => save({ categories: toggleCategory(store.getGame(id).categories, c.id) }),
  }, c.label));
  return {
    el: h('section', { class: 'game-sec' }, h('h3', {}, 'Categories'), h('div', { class: 'game-cats' }, buttons)),
    refresh(g) {
      CATEGORIES.forEach((c, i) => buttons[i].setAttribute('aria-pressed', String(g.categories.includes(c.id))));
    },
  };
}

// ---------------------------------------------------------------- A5: inside another box

export function insideSection(id, openOther) {
  const selectId = nextId('inside');
  const note = h('p', { class: 'game-hint' });
  const select = h('select', { id: selectId, onchange: choose });
  const holds = h('div', { class: 'game-holds' });
  const title = (gid) => store.getGame(gid)?.title ?? gid;

  function choose() {
    const hostId = select.value;
    try {
      if (hostId) store.setInside(id, hostId);
      else {
        const loc = store.locate(id);
        if (loc.kind === 'inside') store.moveToCupboard(id, takenOutReason(title(loc.hostId)));
      }
    } catch (err) {
      toast(err.message, { error: true });
      el.refresh(store.getGame(id)); // put the picker back to what is really stored
    }
  }

  const el = {
    el: h('section', { class: 'game-sec' },
      h('h3', {}, 'Stored inside another box?'),
      h('label', { class: 'game-label', for: selectId }, 'Stored inside'),
      select, note, holds),
    refresh() {
      const games = store.getGames();
      const plan = store.getPlan();
      const choice = hostChoices(id, games, plan);
      clear(select).append(
        h('option', { value: '' }, 'Not inside another box'),
        ...(choice.hosts ?? []).map((g) => h('option', { value: g.id }, g.title)));
      select.value = plan.inside[id] ?? '';
      select.disabled = !!choice.blocked;
      note.textContent = choice.blocked ?? '';

      const ids = Object.entries(plan.inside).filter(([, host]) => host === id).map(([gid]) => gid);
      ids.sort((a, b) => title(a).localeCompare(title(b), 'hu'));
      clear(holds).append(...(ids.length ? [
        h('h4', {}, 'Stored inside this box'),
        h('ul', { class: 'game-holds-list' },
          ids.map((gid) => h('li', {}, h('button', { type: 'button', class: 'btn', onclick: () => openOther(gid) }, title(gid))))),
      ] : []));
    },
  };
  return el;
}

// ---------------------------------------------------------------- notes

export function notesSection(id, save) {
  const noteId = nextId('notes');
  const area = h('textarea', { id: noteId, rows: 3, onchange: commit });
  function commit() {
    const next = textOrNull(area.value);
    if (next !== (store.getGame(id).notes ?? null)) save({ notes: next });
  }
  return {
    el: h('section', { class: 'game-sec' }, h('label', { class: 'game-label', for: noteId }, 'Notes'), area),
    refresh: (g) => fill(area, g.notes ?? ''),
    flush: commit,
  };
}
