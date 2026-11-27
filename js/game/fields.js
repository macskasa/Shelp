// The editable parts of the game panel. Each function returns { el, refresh(game), flush() }.
// refresh() never overwrites a field the user is typing in; flush() saves edits that were not committed yet.
import { h, clear, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { CATEGORIES } from '../core/categories.js';
import { formatDims } from '../core/format.js';
import {
  cleanTitle, parseDims, dimsToInputs, sameDims, textOrNull, sizeSources, toggleCategory,
  hostChoices, hostResults, foldText, takenOutReason, bggVersions, bggSearch, setPizza, pizzaStamp,
} from './logic.js';

let uniq = 0;
const nextId = (name) => `game-${name}-${++uniq}`;

/** Set a field's text unless the user is in it. */
const fill = (el, text) => {
  if (document.activeElement !== el && el.value !== text) el.value = text;
};

export const extLink = (href, text) =>
  h('a', { class: 'game-link', href, target: '_blank', rel: 'noopener noreferrer' }, text);

// ---------------------------------------------------------------- name

/** The name as printed on the box (often Hungarian). Games added from BGG start with the English BGG name. */
export function titleSection(id, save) {
  const inputId = nextId('title');
  const hint = h('p', { class: 'game-hint is-error', role: 'status' });
  const input = h('input', { type: 'text', id: inputId, autocomplete: 'off', onchange: commit, oninput: () => { hint.textContent = ''; } });

  function commit() {
    const next = cleanTitle(input.value);
    if (!next) {
      hint.textContent = 'A game needs a name.';
      input.value = store.getGame(id).title;
      return;
    }
    if (next !== store.getGame(id).title) save({ title: next });
  }

  return {
    el: h('section', { class: 'game-sec' },
      h('label', { class: 'game-label', for: inputId }, 'Name (as on the box)'), input, hint),
    refresh: (g) => fill(input, g.title),
    flush() {
      const next = cleanTitle(input.value);
      if (next && next !== store.getGame(id)?.title) save({ title: next });
    },
  };
}

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

// ---------------------------------------------------------------- pizza: may only lie flat

export function pizzaSection(id) {
  const inputId = nextId('pizza');
  const hint = h('p', { class: 'game-hint is-error', role: 'status' });
  const input = h('input', { type: 'checkbox', role: 'switch', id: inputId, onchange: toggle });
  let shownFor = null; // what the message was about (pizzaStamp), null = no message

  function toggle() {
    const r = setPizza(store, id, input.checked);
    hint.textContent = r.ok ? '' : r.message; // the store says why, e.g. the game stands on a shelf
    shownFor = r.ok ? null : pizzaStamp(store.locate2(id));
    if (!r.ok) input.checked = r.pizza;
  }

  return {
    el: h('section', { class: 'game-sec' },
      h('h3', {}, 'Pizza'),
      h('label', { class: 'game-switch', for: inputId }, input, h('span', {}, 'Pizza – may only lie flat')),
      h('p', { class: 'game-hint muted' }, 'A pizza game lies flat on its biggest side; a quarter turn is fine. It is never stood up on a shelf.'),
      hint),
    refresh(g) {
      input.checked = g.pizza === true;
      // An old message goes when what it was about has changed (Undo, turned or moved elsewhere). It stays while
      // nothing changed: the panel also refreshes on focusout, right after the tap that set the message.
      if (shownFor !== null && shownFor !== pizzaStamp(store.locate2(id))) {
        hint.textContent = '';
        shownFor = null;
      }
    },
  };
}

// ---------------------------------------------------------------- A5: inside another box

export function insideSection(id, openOther) {
  const searchId = nextId('inside');
  const note = h('p', { class: 'game-hint' });
  const current = h('p', { class: 'game-inside-now' });
  const search = h('input', {
    type: 'search', id: searchId, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'go',
    placeholder: 'Type a title or BGG name', oninput: () => render(), onkeydown: keys,
  });
  const heading = h('p', { class: 'game-hint', role: 'status' });
  const list = h('ul', { class: 'game-pick-list' });
  const more = h('p', { class: 'game-hint', role: 'status' });
  const searchBox = h('div', { class: 'game-pick' }, h('label', { class: 'game-label', for: searchId }, 'Search boxes'), search, heading, list, more);
  const holds = h('div', { class: 'game-holds' });
  const title = (gid) => store.getGame(gid)?.title ?? gid;
  let shown = []; // the results on screen, first one = what Enter picks
  let key = '';   // what the list shows now: a re-render with the same content keeps the buttons (a tap must not lose its button)

  function keys(e) {
    if (e.key === 'Escape') {
      e.preventDefault(); // leaves the field; a second Esc closes the panel
      e.stopPropagation();
      search.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[0]) pick(shown[0].id);
    }
  }

  function pick(hostId) {
    try {
      store.setInside(id, hostId);
      search.value = '';
    } catch (err) {
      toast(err.message, { error: true });
    }
    render();
  }

  function takeOut() {
    const loc = store.locate2(id);
    if (loc.kind !== 'inside') return;
    try {
      store.moveToCupboard(id, takenOutReason(title(loc.hostId)));
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  function render() {
    const choice = hostChoices(id, store.getGames(), store.getPlan2());
    searchBox.hidden = !!choice.blocked;
    note.textContent = choice.blocked ?? '';
    if (choice.blocked) { shown = []; key = ''; return; }
    const r = hostResults(store.getGame(id), choice.hosts, search.value);
    shown = r.results;
    const next = [r.more, r.likely, ...shown.map((g) => `${g.id}|${g.title}|${g.bggName}`)].join('\n');
    if (next === key) return;
    key = next;
    heading.textContent = r.likely ? 'Likely boxes' : (!shown.length && foldText(search.value) ? 'No box found.' : '');
    clear(list).append(...shown.map((g) => h('li', {},
      h('button', { type: 'button', class: 'btn game-pick-btn', onclick: () => pick(g.id) },
        h('span', { class: 'game-pick-title' }, g.title),
        g.bggName && g.bggName !== g.title ? h('span', { class: 'game-pick-bgg muted' }, g.bggName) : null))));
    more.textContent = r.more ? `${r.more} more. Type more letters to narrow it down.` : '';
  }

  return {
    el: h('section', { class: 'game-sec' },
      h('h3', {}, 'Stored inside another box?'), current,
      note, searchBox, holds),
    refresh() {
      const plan = store.getPlan2();
      const hostId = plan.inside[id];
      clear(current).append(...(hostId ? [
        h('span', {}, 'Stored inside '), h('strong', {}, title(hostId)), ' ',
        h('button', { type: 'button', class: 'btn game-takeout', onclick: takeOut }, 'Take out'),
      ] : [h('span', { class: 'muted' }, 'Not inside another box.')]));
      render();

      const ids = Object.entries(plan.inside).filter(([, host]) => host === id).map(([gid]) => gid);
      ids.sort((a, b) => title(a).localeCompare(title(b), 'hu'));
      clear(holds).append(...(ids.length ? [
        h('h4', {}, 'Stored inside this box'),
        h('ul', { class: 'game-holds-list' },
          ids.map((gid) => h('li', {}, h('button', { type: 'button', class: 'btn', onclick: () => openOther(gid) }, title(gid))))),
      ] : []));
    },
  };
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
