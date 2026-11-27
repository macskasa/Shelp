// Part C – Catalog list with filters and search (A6) and "Where's my game?" (C4). Owner: Peter.
import { mountCatalog } from './view.js';
import { openWhere } from './where.js';
import { openVersions } from '../versions/panel.js';
import { renderTools } from '../shell/tools.js';

let view = null;

/** app.js calls this once, before the screens are drawn: put the "Where's my game?" button in the header. */
export function init() {
  const tools = document.getElementById('app-tools');
  if (tools) renderTools(tools, { where: openWhere, versions: openVersions });
}

export const screens = [
  {
    id: 'catalog',
    title: 'Games',
    order: 20,
    mount(el, params) {
      view = mountCatalog(el, params);
      return () => {
        view?.destroy();
        view = null;
      };
    },
    update(params) {
      view?.setParams(params);
    },
  },
];
