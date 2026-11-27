// The game details panel: openGame(id). Owner: Stephen (Part A). Stories A3, A5, B1.
import { h, loadCss, showPanel, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame, showOnMap } from '../core/contracts.js';
import { describeLocation, formatRange } from '../core/format.js';
import { bggPage, bggSearch } from './logic.js';
import { categorySection, extLink, insideSection, notesSection, sizeSection } from './fields.js';

let uniq = 0;

export function openPanel(id) {
  if (!store.getGame(id)) return;
  loadCss(new URL('./game.css', import.meta.url));
  const opener = document.activeElement;
  const titleId = `game-title-${++uniq}`;

  /** Save a change straight away. Returns true if the store accepted it. */
  const save = (patch) => {
    try {
      store.updateGame(id, patch);
      return true;
    } catch (err) {
      toast(err.message, { error: true });
      return false;
    }
  };

  const title = h('h2', { id: titleId, class: 'game-title' });
  const bgg = h('p', { class: 'game-bgg' });
  const facts = h('dl', { class: 'game-facts' });
  const where = h('p', { class: 'game-where' });
  const sections = [sizeSection(id, save), categorySection(id, save), insideSection(id, openGame), notesSection(id, save)];

  const dlg = h('dialog', { class: 'panel game-panel', 'aria-labelledby': titleId },
    h('header', { class: 'game-head' }, title,
      h('button', { type: 'button', class: 'btn game-close', 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
    h('div', { class: 'game-body' },
      bgg, facts,
      h('section', { class: 'game-sec' }, h('h3', {}, 'Where is it?'), where,
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => showOnMap(id) }, 'Show on map')),
      ...sections.map((s) => s.el)));

  function refresh() {
    const g = store.getGame(id);
    if (!g) { dlg.close(); return; } // the game was deleted
    title.textContent = g.title;
    bgg.replaceChildren(...(g.bggId
      ? [extLink(bggPage(g), `${g.bggName || g.title} on BoardGameGeek`)]
      : ['Not linked to BoardGameGeek. ', extLink(bggSearch(g), 'Search BGG')]));
    const row = (k, v) => [h('dt', {}, k), h('dd', {}, v || '–')];
    facts.replaceChildren(
      ...row('Type', g.type === 'expansion' ? 'Expansion' : 'Base game'),
      ...row('Players', formatRange(g.players)),
      ...row('Play time', formatRange(g.time, 'min')),
      ...row('Age', g.age));
    where.textContent = describeLocation(store.locate(id), (gid) => store.getGame(gid)?.title ?? gid);
    for (const s of sections) s.refresh(g);
  }

  refresh();
  const off = on('store:changed', refresh);
  // After a field loses focus, show the saved (tidied) value in it.
  dlg.addEventListener('focusout', () => setTimeout(() => { if (dlg.isConnected) refresh(); }, 0));
  dlg.addEventListener('close', () => {
    off();
    for (const s of sections) s.flush?.(); // Esc or Back while typing must not lose the edit
    if (opener?.isConnected) opener.focus?.();
  }, { once: true });
  showPanel(dlg);
}
