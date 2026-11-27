// "Compare" panel: what is different between two saved versions, or a saved version and now. Owner: Peter (Part C).
// The data comes from compareVersions() in compare.js; this file only draws it.
import { h, loadCss, showPanel } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { openGame } from '../core/contracts.js';
import { fitToVisualViewport } from '../shell/viewport.js';
import { formatSaved } from './logic.js';
import { compareVersions, summarize } from './compare.js';

loadCss(new URL('./versions.css', import.meta.url));

const NOW = 'now';

/** One side of the comparison, or null when that version is gone. */
function sideOf(id) {
  if (id === NOW) return { label: 'now', games: store.getGames(), plan: store.getPlan2() };
  const v = store.getVersion(id);
  return v ? { label: `“${v.name}”`, games: v.games, plan: v.plan } : null;
}

/** One line: the title in bold, then what changed. It opens the game when the game still exists. */
function line(entry) {
  const rest = entry.text.startsWith(`${entry.title}: `) ? entry.text.slice(entry.title.length + 2) : entry.text;
  const body = [h('strong', {}, entry.title), `: ${rest}`];
  if (!store.getGame(entry.id)) return h('li', {}, h('div', { class: 'ver-line ver-line-static' }, ...body));
  return h('li', {}, h('button', { type: 'button', class: 'ver-line', onclick: () => openGame(entry.id) }, ...body));
}

function group(title, entries, caption = null) {
  if (!entries.length) return null;
  return h('section', { class: 'ver-group' },
    h('h3', {}, `${title} (${entries.length})`),
    caption && h('p', { class: 'muted ver-caption' }, caption),
    h('ul', { class: 'ver-lines' }, ...entries.map(line)));
}

/**
 * Open the compare panel. `from` is a saved version's id (default: the newest); `to` defaults to "now".
 * It follows store:changed, and falls back when a picked version is deleted.
 */
export function openCompare({ from = null, to = NOW } = {}) {
  let fromId = from;
  let toId = to;
  let signature = '';

  const fromSel = h('select', { class: 'ver-select', id: 'ver-from' });
  const toSel = h('select', { class: 'ver-select', id: 'ver-to' });
  const swap = h('button', { class: 'btn ver-swap', type: 'button', 'aria-label': 'Swap the two', onclick: () => { [fromId, toId] = [toId, fromId]; render(); } }, '⇅ Swap');
  const status = h('p', { class: 'ver-summary', role: 'status' });
  const results = h('div', { class: 'ver-results' });

  const dlg = h('dialog', { class: 'panel ver-panel ver-compare', 'aria-label': 'Compare versions' },
    h('div', { class: 'ver-head' },
      h('h2', {}, 'Compare'),
      h('form', { method: 'dialog' }, h('button', { class: 'btn ver-close', type: 'submit' }, 'Close'))),
    h('div', { class: 'ver-pick' },
      h('label', { for: 'ver-from' }, h('span', { class: 'muted' }, 'From'), fromSel),
      h('label', { for: 'ver-to' }, h('span', { class: 'muted' }, 'To'), toSel),
      swap),
    status, results);

  fromSel.addEventListener('change', () => { fromId = fromSel.value; render(); });
  toSel.addEventListener('change', () => { toId = toSel.value; render(); });

  function fillSelects(versions) {
    const key = versions.map((v) => `${v.id}\n${v.name}\n${v.savedAt}`).join('\n');
    if (key !== signature) {
      signature = key;
      const options = () => [
        h('option', { value: NOW }, 'Now'),
        ...versions.map((v) => h('option', { value: v.id }, `${v.name} · ${formatSaved(v.savedAt)}`)),
      ];
      fromSel.replaceChildren(...options());
      toSel.replaceChildren(...options());
    }
    fromSel.value = fromId;
    toSel.value = toId;
  }

  function render() {
    const versions = store.listVersions();
    const known = new Set([NOW, ...versions.map((v) => v.id)]);
    if (!known.has(fromId)) fromId = versions[0]?.id ?? NOW;
    if (!known.has(toId)) toId = NOW;
    fillSelects(versions);

    if (fromId === toId) {
      status.textContent = 'Pick two different ones to compare.';
      results.replaceChildren();
      return;
    }
    const a = sideOf(fromId);
    const b = sideOf(toId);
    const diff = compareVersions(a, b);
    status.textContent = `From ${a.label} to ${b.label}: ${summarize(diff)}`;
    results.replaceChildren(...[
      group('Moved', diff.moved),
      group('Turned', diff.turned),
      diff.removed.length || diff.added.length
        ? h('section', { class: 'ver-group' },
          h('h3', {}, `Only in one of them (${diff.removed.length + diff.added.length})`),
          group(`Only in ${a.label}`, diff.removed),
          group(`Only in ${b.label}`, diff.added))
        : null,
    ].filter(Boolean));
  }

  const off = on('store:changed', render);
  dlg.addEventListener('close', off, { once: true });
  render();
  fitToVisualViewport(dlg);
  showPanel(dlg);
  return dlg;
}
