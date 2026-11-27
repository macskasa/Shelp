// The game details panel: openGame(id). Owner: Stephen (Part A). Stories A3, A5, B1.
import { closePanels, h, loadCss, showPanel, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame, pickUp, showOnMap } from '../core/contracts.js';
import { describeLocation2, formatRange } from '../core/format.js';
import { confirmPanel } from '../io/confirm.js';
import { bggPage, bggSearch, deleteText, gamesInside, moveBlockedReason } from './logic.js';
import { categorySection, extLink, insideSection, notesSection, pizzaSection, sizeSection, titleSection } from './fields.js';

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
  const moveHintId = `game-move-hint-${uniq}`;
  const moveHint = h('p', { id: moveHintId, class: 'game-hint', role: 'status' });
  const moveBtn = h('button', { type: 'button', class: 'btn game-move', onclick: () => pickUp(id) }, 'Move');
  async function deleteGame() {
    const g = store.getGame(id);
    const above = store.locate2(id)?.above?.length ?? 0;
    const inside = gamesInside(store.getPlan2(), id, store.getGames()).map((x) => store.getGame(x)?.title ?? x);
    const ok = await confirmPanel({
      title: `Delete ${g.title}?`, lines: [deleteText(g.title, above, inside)], confirmLabel: 'Delete', danger: true,
    });
    if (!ok || !store.getGame(id)) return;
    try {
      store.removeGame(id);
    } catch (err) {
      toast(err.message, { error: true });
      return;
    }
    closePanels(() => toast(`Deleted ${g.title}`, { action: { label: 'Undo', run: store.undo } }));
  }
  const nameSection = titleSection(id, save);
  const sections = [nameSection, sizeSection(id, save), categorySection(id, save), pizzaSection(id), insideSection(id, openGame), notesSection(id, save)];

  const dlg = h('dialog', { class: 'panel game-panel', 'aria-labelledby': titleId },
    h('header', { class: 'game-head' }, title,
      h('button', { type: 'button', class: 'btn game-close', 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
    h('div', { class: 'game-body' },
      nameSection.el, bgg, facts,
      h('section', { class: 'game-sec' }, h('h3', {}, 'Where is it?'), where,
        h('div', { class: 'game-actions' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => showOnMap(id) }, 'Show on map'),
          moveBtn),
        moveHint),
      ...sections.slice(1).map((s) => s.el),
      h('section', { class: 'game-sec game-danger' },
        h('button', { type: 'button', class: 'btn btn-danger', onclick: deleteGame }, 'Delete game…'))));

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
    const blocked = moveBlockedReason(g);
    moveBtn.disabled = !!blocked;
    if (blocked) moveBtn.setAttribute('aria-describedby', moveHintId);
    else moveBtn.removeAttribute('aria-describedby');
    moveHint.textContent = blocked ?? '';
    where.textContent = describeLocation2(store.locate2(id), (gid) => store.getGame(gid)?.title ?? gid);
    for (const s of sections) s.refresh(g);
  }

  refresh();
  const off = on('store:changed', refresh);
  // After a field loses focus, show the saved (tidied) value in it.
  dlg.addEventListener('focusout', () => setTimeout(() => { if (dlg.isConnected) refresh(); }, 0));
  dlg.addEventListener('close', () => {
    off();
    if (store.getGame(id)) for (const s of sections) s.flush?.(); // (a deleted game has nothing to save)
    // Esc or Back while typing must not lose the edit
    if (opener?.isConnected) opener.focus?.();
  }, { once: true });
  showPanel(dlg);
}
