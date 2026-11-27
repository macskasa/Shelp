// The "Game families" section of the Data screen (story B2). Owner: Stephen (Part A).
// Suggested: groups of games without a family whose names start the same; tick, rename, Link (one undo step).
// Families: the existing ones; tap one to open its first game.
import { h, clear, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { openGame, showFamily } from '../core/contracts.js';
import { suggestFamilies, familyLine } from '../game/family.js';

let uniq = 0;

export function familiesSection() {
  const suggestedBody = h('div', { class: 'io-fam-list' });
  const familiesBody = h('div', { class: 'io-fam-names' });
  const suggestedHead = h('summary', {});
  const familiesHead = h('summary', {});
  const edits = new Map(); // original suggested name -> { name, off: Set of unticked ids } (kept while the list re-renders)

  function link(group, nameInput) {
    const e = edits.get(group.name);
    const name = nameInput.value.trim();
    const ids = group.ids.filter((id) => !e?.off.has(id));
    if (!name) { toast('Give the family a name.', { error: true }); return; }
    if (!ids.length) { toast('Tick at least one game.', { error: true }); return; }
    try {
      store.batch(() => { for (const id of ids) store.updateGame(id, { family: name }); });
    } catch (err) {
      toast(err.message, { error: true });
      return;
    }
    edits.delete(group.name);
    const shown = store.getGame(ids[0])?.family ?? name;
    toast(`Linked ${ids.length} ${ids.length === 1 ? 'game' : 'games'} to “${shown}”`, { action: { label: 'Undo', run: store.undo } });
  }

  function groupCard(group) {
    const e = edits.get(group.name) ?? { name: group.name, off: new Set() };
    edits.set(group.name, e);
    const nameId = `io-fam-name-${++uniq}`;
    const nameInput = h('input', {
      type: 'text', id: nameId, value: e.name, maxlength: 40, autocomplete: 'off',
      oninput: () => { e.name = nameInput.value; },
    });
    const linkBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => link(group, nameInput) });
    const count = () => group.ids.filter((id) => !e.off.has(id)).length;
    const updateBtn = () => { linkBtn.textContent = `Link ${count()}`; linkBtn.disabled = !count(); };
    const rows = group.ids.map((id) => {
      const g = store.getGame(id);
      const box = h('input', {
        type: 'checkbox', checked: !e.off.has(id),
        onchange: () => { if (box.checked) e.off.delete(id); else e.off.add(id); updateBtn(); },
      });
      return h('label', { class: 'io-row io-fam-row' }, box,
        h('span', { class: 'io-row-text' }, h('span', {}, g.title),
          g.bggName && g.bggName !== g.title ? h('span', { class: 'muted' }, g.bggName) : null));
    });
    updateBtn();
    return h('div', { class: 'io-group io-fam-group' },
      h('label', { class: 'io-label', for: nameId }, 'Family name'), nameInput,
      h('div', { class: 'io-list' }, rows),
      h('div', { class: 'io-buttons io-start' }, linkBtn));
  }

  function refresh() {
    const suggested = suggestFamilies(store.getGames());
    for (const k of [...edits.keys()]) if (!suggested.some((s) => s.name === k)) edits.delete(k);
    suggestedHead.textContent = `Suggested (${suggested.length})`;
    // keep a name field the user is typing in: only rebuild when the groups changed
    const sig = JSON.stringify(suggested);
    if (sig !== suggestedBody.dataset.sig) {
      suggestedBody.dataset.sig = sig;
      clear(suggestedBody).append(...(suggested.length ? suggested.map(groupCard) : [h('p', { class: 'muted' }, 'No more suggestions: every group of games with a similar name is linked.')]));
    }
    const families = store.getFamilies();
    familiesHead.textContent = `Families (${families.length})`;
    clear(familiesBody).append(...(families.length
      ? families.map((f) => h('div', { class: 'io-fam-item' },
        h('button', { type: 'button', class: 'btn io-fam-open', onclick: () => openGame(f.ids[0]) }, familyLine(f)),
        h('button', { type: 'button', class: 'btn io-fam-map', onclick: () => showFamily(f.name) }, 'Show on map')))
      : [h('p', { class: 'muted' }, 'No families yet.')]));
  }

  refresh();
  return {
    el: h('section', { class: 'card io-section' },
      h('h2', {}, 'Game families'),
      h('p', { class: 'muted' }, 'Games of one family belong together, like Azul and Azul Kids. The rule checker warns when a family is spread out on the shelves. Untick what does not belong, then Link.'),
      h('details', { open: true }, suggestedHead, suggestedBody),
      h('details', {}, familiesHead, familiesBody)),
    refresh,
  };
}
