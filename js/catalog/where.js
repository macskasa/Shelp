// "Where's my game?" – type a title, see where the box is and what is on top of it. Owner: Peter (Part C). Story C4.
// Opened from the search button in the header (js/shell/tools.js) on every screen.
// The matching is in search.js and the wording in where-text.js; this file only draws the panel.
import { h, loadCss, showPanel } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame, pickUp, showOnMap } from '../core/contracts.js';
import { fitToVisualViewport } from '../shell/viewport.js';
import { rankMatches, searchKey } from './search.js';
import { moveHint, whereText } from './where-text.js';

loadCss(new URL('./where.css', import.meta.url));

const LIMIT = 8; // best matches shown; the list is for finding one box, not for browsing
const HINT = 'Type part of a title. Capital letters and accents don’t matter.';

/** Open the panel. Returns the <dialog>. */
export function openWhere() {
  let items = [];
  const title = (id) => store.getGame(id)?.title ?? id;

  const input = h('input', {
    class: 'cat-search-input where-input', type: 'search', enterkeyhint: 'search', autocapitalize: 'off',
    autocorrect: 'off', autocomplete: 'off', spellcheck: 'false', placeholder: 'Game title',
    'aria-label': 'Game title', 'aria-controls': 'where-results', autofocus: true,
    oninput: () => show(),
    onkeydown: (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      const first = results.querySelector('button');
      // desktop: Enter moves to the first result so Enter again shows it; phone: Enter hides the keyboard
      if (first && matchMedia('(min-width: 1024px)').matches) first.focus();
      else input.blur();
    },
  });
  const status = h('p', { class: 'where-status', role: 'status' }, HINT);
  const results = h('ul', { class: 'where-results', id: 'where-results' });
  const dlg = h('dialog', { class: 'panel where-panel', 'aria-label': 'Where’s my game?' },
    h('div', { class: 'where-head' },
      h('h2', {}, 'Where’s my game?'),
      h('form', { method: 'dialog' }, h('button', { class: 'btn where-close', type: 'submit' }, 'Close'))),
    input, status, results);

  function show() {
    const all = rankMatches(items, input.value);
    const typed = input.value.trim() !== '';
    results.replaceChildren(...all.slice(0, LIMIT).map((item) => card(item.game)));
    if (!typed) status.textContent = HINT;
    else if (!all.length) status.textContent = `No game matches “${input.value.trim()}”.`;
    else if (all.length > LIMIT) status.textContent = `Showing the best ${LIMIT} of ${all.length}. Type more to narrow it down.`;
    else status.textContent = all.length === 1 ? '1 match' : `${all.length} matches`;
  }

  function card(game) {
    const { sentence, onTop } = whereText(store.locate2(game.id), title);
    const bgg = game.bggName && game.bggName !== game.title ? game.bggName : null;
    const hint = moveHint(game);
    const hintId = `where-note-${game.id}`;
    return h('li', { class: 'where-item' },
      h('div', { class: 'where-name' }, game.title, bgg && h('span', { class: 'where-bgg' }, bgg)),
      h('p', { class: 'where-sentence' }, sentence),
      onTop && h('p', { class: 'where-top' }, onTop),
      h('div', { class: 'where-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => showOnMap(game.id) }, 'Show on map'),
        h('button', { class: 'btn', type: 'button', disabled: !!hint, 'aria-describedby': hint ? hintId : null, onclick: () => pickUp(game.id) }, 'Move'),
        h('button', { class: 'btn', type: 'button', onclick: () => openGame(game.id) }, 'Details')),
      hint && h('p', { class: 'where-note', id: hintId }, hint));
  }

  // Follow the store (an Undo, a move, an import) while the panel is open.
  const load = () => { items = store.getGames().map((game) => ({ game, key: searchKey(game) })); };
  const off = on('store:changed', () => { load(); show(); });
  dlg.addEventListener('close', off, { once: true });
  load();

  // On a phone the keyboard covers the lower part of the screen: keep the panel inside what is left.
  fitToVisualViewport(dlg);

  showPanel(dlg);
  input.focus();
  return dlg;
}
