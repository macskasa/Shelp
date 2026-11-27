// The backup, restore and plan import section of the Data screen (story E2). Owner: Stephen (Part A).
import { h, clear, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { backupFileName, describeImport, problemLines, readJson } from './backup.js';
import { confirmPanel } from './confirm.js';
import { when } from './time.js';

/** Hand a text file to the browser as a download (works in Chrome and in the installed app). */
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function backupSection() {
  const fileId = 'io-restore-file';
  const lastLine = h('p', { class: 'muted' });
  const out = h('div', { class: 'io-out', 'aria-live': 'polite' });
  const input = h('input', {
    type: 'file', id: fileId, accept: '.json,application/json',
    onchange: async () => {
      const file = input.files?.[0];
      if (file) await loadFile(file);
      input.value = '';
    },
  });

  const refresh = () => {
    const t = when(store.getMeta().lastBackup);
    lastLine.textContent = t ? `Last backup downloaded: ${t}` : 'No backup downloaded yet.';
  };

  function downloadBackup() {
    try {
      store.setMeta('lastBackup', new Date().toISOString()); // first, so the file itself carries it
      download(backupFileName(), JSON.stringify(store.exportData(), null, 2));
      toast('Backup downloaded');
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  const showError = (text, problems = []) => {
    const { shown, more } = problemLines(problems);
    clear(out).append(h('div', { class: 'io-error', role: 'alert' },
      h('p', {}, text),
      shown.length ? h('ul', { class: 'io-problems' }, shown.map((p) => h('li', {}, p))) : null,
      more ? h('p', {}, `…and ${more} more.`) : null));
  };

  async function loadFile(file) {
    clear(out);
    let obj;
    try {
      obj = readJson(await file.text());
    } catch (err) {
      showError(err.message);
      return;
    }
    const problems = store.validate(obj);
    if (problems.length) {
      showError(`This file cannot be imported (${problems.length} problem${problems.length > 1 ? 's' : ''}). Nothing was changed.`, problems);
      return;
    }
    const plan = store.getPlan();
    const info = describeImport(obj, { games: store.getGames().length, stacks: plan.stacks.length, planName: plan.name });
    const ok = await confirmPanel({ title: info.title, lines: info.lines, confirmLabel: info.confirmLabel, danger: true });
    if (!ok) return;
    try {
      const kind = store.importData(obj);
      const text = kind === 'all'
        ? `Backup restored: ${obj.games.length} games, ${obj.plan?.stacks?.length ?? 0} stacks.`
        : `Shelf plan “${obj.plan.name ?? 'imported plan'}” imported. Your games are unchanged.`;
      clear(out).append(h('p', { class: 'io-ok' }, text));
      toast(kind === 'all' ? 'Backup restored' : 'Plan imported');
    } catch (err) {
      showError(err.message, err.problems ?? []);
    }
  }

  async function reset() {
    const ok = await confirmPanel({
      title: 'Reset to the original data?',
      lines: [
        'Everything you changed is replaced by the data the app came with: box sizes, categories, notes, games added from BGG and the shelf plan.',
        'Download a backup first if you want to be able to get your changes back.',
      ],
      confirmLabel: 'Reset', danger: true,
    });
    if (!ok) return;
    try {
      await store.resetToSeed();
      clear(out).append(h('p', { class: 'io-ok' }, 'Back to the original data.'));
      toast('Data reset');
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  refresh();
  return {
    el: h('section', { class: 'card io-section' },
      h('h2', {}, 'Backup and restore'),
      h('p', { class: 'muted' }, 'Your data lives only in this browser. Download a backup now and then; it is one small file.'),
      lastLine,
      h('div', { class: 'io-buttons io-start' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: downloadBackup }, 'Download backup')),
      h('label', { class: 'io-label', for: fileId }, 'Restore a backup or import a plan (.json)'),
      input,
      h('p', { class: 'muted' }, 'A full backup replaces everything. A plan file made in the planning chat replaces only the shelf plan. You see what will happen and confirm first.'),
      out,
      h('div', { class: 'io-buttons io-start io-danger-zone' },
        h('button', { type: 'button', class: 'btn btn-danger', onclick: reset }, 'Reset to the original data…'))),
    refresh,
    loadFile,
  };
}
