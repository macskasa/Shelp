// "Add a game" panel (story A4): a game that is not in the BGG list, like Fantasy Fluxx. Owner: Stephen (Part A).
// The game starts unplaced. Uses the same size parsing and category buttons as the game panel.
import { h, clear, loadCss, showPanel, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { openGame } from '../core/contracts.js';
import { CATEGORIES } from '../core/categories.js';
import { findByBggId, parseBggId, parseGameForm, toggleCategory } from './logic.js';

let uniq = 0;

/** Close the panel, wait until its history step is gone, then run next() (opening another panel straight away would clash). */
function closeThen(dlg, next) {
  const waits = !!history.state?.shelpPanel;
  dlg.close();
  if (!waits) { next(); return; }
  let done = false;
  let timer = null;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    window.removeEventListener('popstate', run);
    next();
  };
  window.addEventListener('popstate', run);
  timer = setTimeout(run, 400);
}

export function openAddGame() {
  loadCss(new URL('./game.css', import.meta.url));
  const opener = document.activeElement;
  const id = (name) => `game-add-${name}-${++uniq}`;
  const state = { type: 'base', categories: [], inBgg: false };

  const err = (name) => h('p', { class: 'game-hint is-error', role: 'alert', dataset: { for: name } });
  const errors = Object.fromEntries(['title', 'bggId', 'dims', 'players', 'time'].map((k) => [k, err(k)]));
  const text = (extra = {}) => h('input', { type: 'text', autocomplete: 'off', ...extra });
  const number = (label) => h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': label });

  const title = text({ id: id('title') });
  const bgg = text({ id: id('bgg'), inputmode: 'numeric', oninput: showDuplicate });
  const duplicate = h('p', { class: 'game-hint', role: 'status' });
  const dims = [1, 2, 3].map((n) => h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'game-dim', 'aria-label': `Box side ${n}, in cm`,
  }));
  const players = [number('Fewest players'), number('Most players')];
  const time = [number('Shortest play time in minutes'), number('Longest play time in minutes')];

  function showDuplicate() {
    clear(duplicate);
    const parsed = parseBggId(bgg.value);
    const other = findByBggId(store.getGames(), parsed.id);
    if (other) {
      duplicate.append(`Already in the app as “${other.title}”. You can still add it. `,
        h('button', { type: 'button', class: 'btn', onclick: () => openGame(other.id) }, 'Open it'));
    }
  }

  const typeName = id('type');
  const typeRadio = (value, label) => h('label', { class: 'game-radio' },
    h('input', { type: 'radio', name: typeName, value, checked: value === state.type, onchange: () => { state.type = value; } }), label);

  const catButtons = CATEGORIES.map((c) => h('button', {
    type: 'button', class: 'game-cat', style: `--c: var(${c.cssVar})`, 'aria-pressed': 'false',
    onclick: (e) => {
      state.categories = toggleCategory(state.categories, c.id);
      e.currentTarget.setAttribute('aria-pressed', String(state.categories.includes(c.id)));
    },
  }, c.label));

  const inBgg = h('input', { type: 'checkbox', id: id('inbgg'), onchange: (e) => { state.inBgg = e.target.checked; } });

  function save() {
    for (const e of Object.values(errors)) e.textContent = '';
    const result = parseGameForm({
      title: title.value, bggId: bgg.value, dims: dims.map((d) => d.value),
      players: players.map((p) => p.value), time: time.map((t) => t.value), ...state,
    });
    if (result.errors) {
      for (const [key, message] of Object.entries(result.errors)) errors[key].textContent = message;
      const first = { title, bggId: bgg, dims: dims[0], players: players[0], time: time[0] }[Object.keys(result.errors)[0]];
      first?.focus();
      return;
    }
    try {
      const newId = store.addGame(result.fields);
      toast(`Added ${result.fields.title}`);
      closeThen(dlg, () => openGame(newId));
    } catch (e) {
      toast(e.message, { error: true });
    }
  }

  const titleId = id('heading');
  const field = (label, forId, ...rest) => h('section', { class: 'game-sec' }, h('label', { class: 'game-label', for: forId }, label), ...rest);
  const range = (legend, boxes, unit, key) => h('fieldset', { class: 'game-range' },
    h('legend', { class: 'game-label' }, legend), boxes[0], h('span', { 'aria-hidden': 'true' }, '–'), boxes[1], h('span', { class: 'muted' }, unit),
    errors[key]);

  const dlg = h('dialog', { class: 'panel game-panel', 'aria-labelledby': titleId },
    h('header', { class: 'game-head' }, h('h2', { id: titleId, class: 'game-title' }, 'Add a game'),
      h('button', { type: 'button', class: 'btn game-close', 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
    h('form', { class: 'game-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); save(); } },
      h('div', { class: 'game-body' },
        h('p', { class: 'muted' }, 'For a game that is not in your BGG list. It starts without a place on the shelves.'),
        field('Name (as on the box), required', title.id, title, errors.title),
        field('BGG id, if it has one', bgg.id, bgg, errors.bggId, duplicate),
        h('fieldset', { class: 'game-dims' },
          h('legend', { class: 'game-label' }, 'Box size, three sides in any order (cm)'),
          dims[0], h('span', { 'aria-hidden': 'true' }, '×'), dims[1], h('span', { 'aria-hidden': 'true' }, '×'), dims[2], h('span', { class: 'muted' }, 'cm'),
          errors.dims),
        range('Players', players, 'players', 'players'),
        range('Play time', time, 'minutes', 'time'),
        h('fieldset', { class: 'game-radios' }, h('legend', { class: 'game-label' }, 'Type'),
          typeRadio('base', 'Base game'), typeRadio('expansion', 'Expansion')),
        h('section', { class: 'game-sec' }, h('h3', {}, 'Categories'), h('div', { class: 'game-cats' }, catButtons)),
        h('label', { class: 'game-check', for: inBgg.id }, inBgg, 'It is in my BGG collection')),
      h('div', { class: 'game-foot' },
        h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add game'))));

  dlg.addEventListener('close', () => { if (opener?.isConnected) opener.focus?.(); }, { once: true });
  showPanel(dlg);
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) title.focus(); // not on phones: no keyboard pops up by itself
}
