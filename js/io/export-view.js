// The "Export to spreadsheet" section of the Data screen (story E3). Owner: Stephen (Part A).
import { h, toast } from '../core/dom.js';
import * as store from '../core/store.js';
import { download } from './download.js';
import { catalogFileName, catalogRows, planFileName, planRows, toCsv } from './export.js';

export function exportSection() {
  const save = (name, rows) => {
    try {
      download(name, toCsv(rows), 'text/csv;charset=utf-8');
      toast(`${name} downloaded`);
    } catch (err) {
      toast(err.message, { error: true });
    }
  };
  return h('section', { class: 'card io-section' },
    h('h2', {}, 'Export to spreadsheet'),
    h('p', { class: 'muted' }, 'Two CSV files with the same columns as the tabs of the planning workbook, so you can paste them back in. Accents work in Google Sheets and Excel.'),
    h('div', { class: 'io-buttons io-start io-wrap' },
      h('button', { type: 'button', class: 'btn', onclick: () => save(catalogFileName(), catalogRows(store.getGames(), store.locate2)) }, 'Download catalog (CSV)'),
      h('button', { type: 'button', class: 'btn', onclick: () => save(planFileName(), planRows(store.getGames(), store.getPlan2())) }, 'Download shelf plan (CSV)')));
}
