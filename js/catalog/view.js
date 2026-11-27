// The catalog screen: filters, count, sortable list. Owner: Peter (Part C). Story A6.
// Rows are built once per data change and only re-ordered / hidden when a filter changes, so
// switching filters stays fast with 200+ games. Filters and sort live in the URL (replaceState,
// so they do not add Back steps) and are restored when Back returns to the screen.
import { h, loadCss } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame } from '../core/contracts.js';
import { CATEGORIES, OTHER } from '../core/categories.js';
import { buildRow } from './row.js';
import {
  TIME_STEPS, WHERE_OPTIONS, activeFilterCount, countLabel, makeEntry, matches,
  sortEntries, stateFromParams, stateToParams,
} from './filter.js';

loadCss(new URL('./catalog.css', import.meta.url));

const CHIP_OPTIONS = [...CATEGORIES, OTHER];
const PLAYER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];
const SORT_COLUMNS = [['title', 'Title'], ['players', 'Players'], ['time', 'Time'], ['where', 'Location']];

/** Mount the catalog into el. Returns { setParams(params), destroy() }. */
export function mountCatalog(el, params) {
  let state = stateFromParams(params);
  let filtersOpen = activeFilterCount(state) > 0; // phones: the filter panel is folded away until needed
  let entries = [];
  let visible = []; // the entries on screen, in order: Enter opens the first one
  const rows = new Map();

  // ---- controls
  const search = h('input', {
    class: 'cat-search-input', type: 'search', placeholder: 'Search by title', 'aria-label': 'Search games',
    enterkeyhint: 'search', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false',
    oninput: () => setState({ q: search.value }),
    onkeydown: onSearchKey,
  });
  const toggle = h('button', { class: 'btn cat-filter-toggle', type: 'button', 'aria-controls': 'cat-filters',
    onclick: () => { filtersOpen = !filtersOpen; syncControls(); } });
  const count = h('p', { class: 'cat-count', role: 'status' });

  const catButtons = new Map(CHIP_OPTIONS.map((c) => [c.id, h('button', {
    class: 'cat-toggle', type: 'button', 'aria-pressed': 'false', style: `--chip: var(${c.cssVar})`,
    onclick: () => setState({ cats: toggled(state.cats, c.id) }),
  }, c.label)]));

  const playersSel = select(['', 'Any', ...PLAYER_COUNTS.flatMap((n) => [String(n), String(n)])],
    (v) => setState({ players: v ? Number(v) : null }));
  const timeSel = select(['', 'Any', ...TIME_STEPS.flatMap((t) => [String(t), `≤ ${t} min`])],
    (v) => setState({ time: v ? Number(v) : null }));
  const whereSel = select(WHERE_OPTIONS.flat(), (v) => setState({ where: v }));
  const sizeBox = h('input', { type: 'checkbox', onchange: (e) => setState({ sizeMissing: e.target.checked }) });

  const panel = h('div', { class: 'cat-filters', id: 'cat-filters' },
    h('div', { class: 'cat-toggles', role: 'group', 'aria-label': 'Category' }, [...catButtons.values()]),
    field('Players', playersSel),
    field('Play time', timeSel),
    h('div', { class: 'cat-field-wide' }, field('Where', whereSel)),
    h('label', { class: 'cat-check' }, sizeBox, 'Size missing'),
    h('button', { class: 'btn cat-clear', type: 'button', onclick: clearFilters }, 'Clear filters'));

  const sortButtons = new Map(SORT_COLUMNS.map(([key, label]) => [key, h('button', {
    class: `cat-sort cat-sort-${key}`, type: 'button', onclick: () => sortBy(key),
  }, label, h('span', { class: 'cat-arrow', 'aria-hidden': 'true' }))]));
  const sortBar = h('div', { class: 'cat-sortbar' },
    sortButtons.get('title'), h('span', { class: 'cat-sort-plain' }, 'Categories'),
    sortButtons.get('players'), sortButtons.get('time'), sortButtons.get('where'));

  const list = h('ul', { class: 'cat-list' });
  const emptyText = h('p', {});
  const clearBtn = h('button', { class: 'btn', type: 'button', onclick: clearAll }, 'Clear filters');
  const empty = h('div', { class: 'cat-empty card', hidden: true }, emptyText, clearBtn);

  el.append(h('section', { class: 'cat-screen' },
    h('div', { class: 'cat-bar' }, search, toggle, count), panel, sortBar, list, empty));

  // ---- state changes
  function setState(patch) {
    state = { ...state, ...patch };
    apply();
  }
  function clearFilters() {
    setState({ cats: [], players: null, time: null, where: 'any', sizeMissing: false });
  }
  function clearAll() {
    setState({ q: '', cats: [], players: null, time: null, where: 'any', sizeMissing: false });
  }
  function sortBy(key) {
    setState(state.sort === key ? { dir: state.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' });
  }

  function rebuild() {
    const title = (id) => store.getGame(id)?.title ?? id;
    entries = store.getGames().map((g) => makeEntry(g, store.locate(g.id), title));
    rows.clear();
    for (const e of entries) rows.set(e.game.id, buildRow(e, openGame));
  }

  function apply() {
    const shown = sortEntries(entries.filter((e) => matches(e, state)), state.sort, state.dir);
    visible = shown;
    list.replaceChildren(...shown.map((e) => rows.get(e.game.id)));
    count.textContent = countLabel(shown.length);
    const none = shown.length === 0;
    empty.hidden = !none;
    list.hidden = none;
    const q = state.q.trim();
    const filtered = activeFilterCount(state) > 0;
    emptyText.textContent = q ? `No game matches “${q}”${filtered ? ' with these filters' : ''}.`
      : filtered ? 'No games match these filters.' : 'There are no games yet.';
    clearBtn.textContent = q ? (filtered ? 'Clear search and filters' : 'Clear search') : 'Clear filters';
    clearBtn.hidden = !q && !filtered;
    syncControls();
    syncUrl();
  }

  function syncControls() {
    const n = activeFilterCount(state);
    toggle.textContent = n ? `Filters (${n})` : 'Filters';
    toggle.setAttribute('aria-expanded', String(filtersOpen));
    if (search.value !== state.q) search.value = state.q; // Back or a link changed it
    panel.hidden = !filtersOpen;
    for (const [id, b] of catButtons) b.setAttribute('aria-pressed', String(state.cats.includes(id)));
    setValue(playersSel, state.players == null ? '' : String(state.players));
    setValue(timeSel, state.time == null ? '' : String(state.time));
    setValue(whereSel, state.where);
    sizeBox.checked = state.sizeMissing;
    for (const [key, b] of sortButtons) {
      const on = state.sort === key;
      b.classList.toggle('cat-sort-on', on);
      b.querySelector('.cat-arrow').textContent = on ? (state.dir === 'asc' ? '▲' : '▼') : '';
      const label = SORT_COLUMNS.find(([k]) => k === key)[1];
      b.setAttribute('aria-label', on ? `${label}, sorted ${state.dir === 'asc' ? 'ascending' : 'descending'}. Reverse` : `Sort by ${label}`);
    }
  }

  function syncUrl() {
    if (history.state?.shelpPanel) return; // never touch the history entry of an open panel
    const q = new URLSearchParams(Object.entries(stateToParams(state)).map(([k, v]) => [k, String(v)]))
      .toString().replace(/%2C/g, ',');
    const hash = `#/catalog${q ? `?${q}` : ''}`;
    if (location.hash !== hash) history.replaceState(history.state, '', hash);
  }

  const desktop = matchMedia('(min-width: 1024px)');

  /** Enter: desktop opens the first match, a phone just hides the keyboard so the list is visible. */
  function onSearchKey(e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (desktop.matches && visible.length) openGame(visible[0].game.id);
    else search.blur();
  }

  /** Desktop: "/" jumps to the search field, unless you are typing somewhere or a panel is open. */
  function onKeydown(e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || !desktop.matches) return;
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    search.focus();
    search.select();
  }
  document.addEventListener('keydown', onKeydown);

  rebuild();
  apply();
  const off = on('store:changed', (d) => {
    if (d?.plan === false && d.games?.length === 0) return; // metadata only
    rebuild();
    apply();
  });

  return {
    /** Back, or a tap on the Games tab, changed the params while the screen stays mounted. */
    setParams(next) {
      state = stateFromParams(next);
      filtersOpen = filtersOpen || activeFilterCount(state) > 0;
      apply();
    },
    destroy() {
      off();
      document.removeEventListener('keydown', onKeydown);
    },
  };
}

// ---- small helpers

const toggled = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** flat = [value, label, value, label, …] */
function select(flat, onChange) {
  const options = [];
  for (let i = 0; i < flat.length; i += 2) options.push(h('option', { value: flat[i] }, flat[i + 1]));
  return h('select', { onchange: (e) => onChange(e.target.value) }, options);
}

/** A value from the URL may not be in the list (players=12): add it so the select can show it. */
function setValue(sel, value) {
  if (value !== '' && ![...sel.options].some((o) => o.value === value)) sel.append(h('option', { value }, value));
  sel.value = value;
}

function field(label, control) {
  return h('label', { class: 'cat-field' }, h('span', {}, label), control);
}
