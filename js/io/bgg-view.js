// The BGG import section of the Data screen (story A1). Owner: Stephen (Part A).
import { h, clear, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { afterImportHints, parseBggCsv, planImport } from './bgg.js';
import { applyImport } from './apply.js';
import { reviewView } from './bgg-review.js';
import { confirmPanel } from './confirm.js';
import { when } from './time.js';

export function bggSection() {
  const fileId = 'io-bgg-file';
  const lastLine = h('p', { class: 'muted' });
  const out = h('div', { class: 'io-out', 'aria-live': 'polite' });
  const input = h('input', {
    type: 'file', id: fileId, accept: '.csv,text/csv,text/comma-separated-values',
    onchange: async () => {
      const file = input.files?.[0];
      if (file) await loadFile(file);
      input.value = ''; // so the same file can be picked again
    },
  });

  const refresh = () => {
    const t = when(store.getMeta().lastImport);
    lastLine.textContent = t ? `Last import: ${t}` : 'No import yet.';
  };

  async function loadFile(file) {
    try {
      const { rows, notOwned } = parseBggCsv(await file.text());
      review(file.name, rows, notOwned);
    } catch (err) {
      clear(out).append(h('p', { class: 'io-error', role: 'alert' }, err.message));
    }
  }

  function review(fileName, rows, notOwned) {
    const plan = planImport(rows, store.getGames(), store.getMeta());
    const nothing = !plan.updates.length && !plan.fresh.length && !plan.ignored.length && !plan.missing.length;
    if (nothing) {
      clear(out).append(h('p', { class: 'io-ok' }, `Everything is up to date (${rows.length} games in ${fileName}).`));
      return;
    }

    const note = h('p', { class: 'muted io-apply-note' });
    const applyBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: apply }, 'Apply import');
    const view = reviewView(plan, refreshNote);
    function refreshNote() {
      const c = view.choices();
      note.textContent = `This will update ${plan.updates.length}, add ${c.addIds.length}, keep ${c.keepIds.length}, delete ${c.deleteIds.length}.`;
    }

    async function apply() {
      const choices = view.choices();
      if (choices.deleteIds.length) {
        applyBtn.disabled = true;
        const ok = await confirmPanel({
          title: `Delete ${choices.deleteIds.length} game${choices.deleteIds.length > 1 ? 's' : ''}?`,
          lines: ['They disappear from the app and from the shelf plan. Boxes stored inside them go to the cupboard. A backup lets you undo this.'],
          items: choices.deleteIds.map((id) => store.getGame(id)?.title ?? id),
          confirmLabel: 'Delete', danger: true,
        });
        applyBtn.disabled = false;
        if (!ok) return;
      }
      try {
        const r = applyImport(plan, choices);
        const added = [...plan.fresh, ...plan.ignored].filter((row) => choices.addIds.includes(row.bggId));
        done({ ...r, hints: afterImportHints(added) });
      } catch (err) {
        toast(err.message, { error: true });
      }
    }

    function done(r) {
      refresh();
      clear(out).append(h('p', { class: 'io-ok' },
        `Imported: ${r.updated} updated · ${r.added} added · ${r.kept} kept · ${r.deleted} deleted.`,
        ...r.hints.map((t) => ` ${t}`)));
      toast('BGG import applied');
    }

    const summary = `${plan.updates.length} updated · ${plan.fresh.length} new · ${plan.missing.length} missing`;
    clear(out).append(
      h('p', { class: 'io-summary' }, h('strong', {}, summary), h('span', { class: 'muted' }, ` (${plan.unchanged} already up to date)`)),
      h('p', { class: 'muted' }, `${fileName}: ${rows.length} games you own${notOwned ? `, ${notOwned} rows skipped because you do not own them` : ''}.`),
      view.el,
      h('div', { class: 'io-actions' }, note, h('div', { class: 'io-buttons' },
        h('button', { type: 'button', class: 'btn', onclick: () => clear(out) }, 'Cancel'), applyBtn)));
    refreshNote();
  }

  refresh();
  const el = h('section', { class: 'card io-section' },
    h('h2', {}, 'BoardGameGeek collection'),
    h('p', { class: 'muted' }, 'On BoardGameGeek open your collection and use Export collection as CSV. Then pick that file here. You see what would change before anything is saved.'),
    lastLine,
    h('label', { class: 'io-label', for: fileId }, 'BGG collection file (.csv)'),
    input,
    out);
  return { el, refresh, loadFile };
}
