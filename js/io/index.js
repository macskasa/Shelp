// Part A – Data in and out: BGG CSV import, backup, restore, plan import. Owner: Stephen. Stories A1, E2.
import { h, loadCss, toast } from '../core/dom.js';
import { on } from '../core/bus.js';
import * as store from '../core/store.js';
import { bggSection } from './bgg-view.js';
import { backupSection } from './backup-view.js';
import { checkSection } from './check-view.js';
import { exportSection } from './export-view.js';

const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

export const screens = [
  {
    id: 'data',
    title: 'Data',
    order: 40,
    mount(el) {
      loadCss(new URL('./io.css', import.meta.url));
      const counts = h('p', { class: 'muted' });
      const bgg = bggSection();
      const backup = backupSection();
      const check = checkSection();
      const showCounts = () => {
        const p = store.getPlan();
        counts.textContent = `${store.getGames().length} games · plan “${p.name}” · ${p.stacks.length} stacks · ${p.cupboard.length} in the cupboard`;
      };
      showCounts();
      const root = h('div', { class: 'io-screen' },
        counts,
        check.el,
        bgg.el,
        backup.el,
        exportSection());

      // Desktop: drop a BGG .csv or a backup .json anywhere on the screen. It goes through the same checks as the pickers.
      let depth = 0;
      root.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; root.classList.add('io-dropping'); } });
      root.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
      root.addEventListener('dragleave', (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; root.classList.remove('io-dropping'); } });
      root.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth = 0;
        root.classList.remove('io-dropping');
        const file = e.dataTransfer.files[0];
        const ext = file?.name.toLowerCase().split('.').pop();
        if (ext === 'csv') bgg.loadFile(file);
        else if (ext === 'json') backup.loadFile(file);
        else toast('Drop a .csv file from BGG or a .json backup.', { error: true });
      });

      el.append(root);
      const off = on('store:changed', () => { showCounts(); check.refresh(); bgg.refresh(); backup.refresh(); });
      return off;
    },
  },
];
