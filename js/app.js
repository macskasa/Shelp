// App entry point: loads data, starts every part, wires the screens. Owner: Tony (lead).
// Each part exposes  js/<part>/index.js  with optional  `screens`  and  `init()`.
import * as store from './core/store.js';
import { on } from './core/bus.js';
import { toast } from './core/dom.js';
import { startRouter } from './shell/router.js';
import { renderNav } from './shell/nav.js';
import { registerServiceWorker } from './shell/sw-register.js';
import * as map from './map/index.js'; // Part B – Bruce
import * as catalog from './catalog/index.js'; // Part C – Peter
import * as io from './io/index.js'; // Part A – Stephen
import * as game from './game/index.js'; // Part A – Stephen
import * as space from './space/index.js'; // Part C – Peter

const PARTS = { map, catalog, io, game, space };

async function main() {
  const root = document.getElementById('app-main');
  try {
    await store.init();
  } catch (err) {
    console.error(err);
    root.textContent = `Shelp could not load its data: ${err.message}`;
    return;
  }
  for (const [name, part] of Object.entries(PARTS)) {
    try {
      part.init?.();
    } catch (err) {
      console.error(`[app] init of ${name} failed`, err);
    }
  }
  on('store:error', ({ message }) => toast(message, { error: true }));
  const screens = Object.values(PARTS).flatMap((p) => p.screens ?? []);
  renderNav(document.getElementById('app-nav'), screens);
  startRouter(screens, root, { defaultScreen: 'map' });
  registerServiceWorker();
}

main();
