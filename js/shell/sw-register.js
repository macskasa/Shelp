// Service worker registration, update banner and persistent storage (story E1). Owner: Peter (Part C).
// The worker itself is /sw.js (see the comment there). Developing on localhost? Open the app with ?nosw
// (http://localhost:8000/?nosw) to remove the worker and its caches, so you always see your latest files.
import { h, loadCss } from '../core/dom.js';

const SW_URL = new URL('../../sw.js', import.meta.url);
const SCOPE = new URL('../../', import.meta.url);

let banner = null;
let dismissed = false;
let reloading = false;
let bannerTimer = 0;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (new URLSearchParams(location.search).has('nosw')) {
    removeWorker();
    return;
  }
  loadCss(new URL('./update.css', import.meta.url));
  askForPersistentStorage();
  window.addEventListener('appinstalled', askForPersistentStorage);

  const sw = navigator.serviceWorker;
  const wasControlled = !!sw.controller;
  // A new worker took over (after the user tapped Reload): reload once so the page and the files match.
  // The very first worker also "takes over" a page that had none: that is not an update.
  sw.addEventListener('controllerchange', () => {
    if (!wasControlled || reloading) return;
    reloading = true;
    location.reload();
  });
  // The worker found a changed file while refreshing its cache.
  sw.addEventListener('message', (e) => {
    if (e.data?.type === 'shelp:updated') offerUpdate(800); // short wait: let the other refreshes finish first
  });

  sw.register(SW_URL, { scope: SCOPE }).then((reg) => {
    if (reg.waiting && sw.controller) offerUpdate(0); // a new version was installed earlier and is waiting
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && sw.controller) offerUpdate(0);
      });
    });
    if (!wasControlled) cacheWhatWasLoaded();
  }).catch((err) => console.error('[sw] registration failed', err));
}

// ---------------------------------------------------------------- first visit

/** The first page load happened before the worker existed, so tell it which files the page used. */
async function cacheWhatWasLoaded() {
  const send = async () => {
    const reg = await navigator.serviceWorker.ready;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
    reg.active?.postMessage({ type: 'shelp:cache-urls', urls });
  };
  if (document.readyState === 'complete') send();
  else window.addEventListener('load', send, { once: true });
}

// ---------------------------------------------------------------- "New version – Reload"

function offerUpdate(delay) {
  if (banner || dismissed || bannerTimer) return;
  bannerTimer = setTimeout(() => {
    bannerTimer = 0;
    banner = h('div', { class: 'shell-update', role: 'status' },
      h('span', {}, 'New version'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: applyUpdate }, 'Reload'),
      h('button', { class: 'shell-update-close', type: 'button', 'aria-label': 'Later', onclick: dismiss }, '×'));
    document.body.append(banner);
  }, delay);
}

function dismiss() {
  dismissed = true;
  banner?.remove();
  banner = null;
}

async function applyUpdate() {
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  if (reg?.waiting) {
    reg.waiting.postMessage({ type: 'shelp:skip-waiting' }); // controllerchange then reloads the page
    setTimeout(() => { if (!reloading) location.reload(); }, 2000);
  } else {
    location.reload(); // the cache already holds the new files
  }
}

// ---------------------------------------------------------------- storage and dev switch

/** Ask the browser not to clear our data when space runs low. Chrome decides silently (no prompt). */
async function askForPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not available: nothing to do */ }
}

async function removeWorker() {
  for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
  for (const name of await caches.keys()) if (name.startsWith('shelp-')) await caches.delete(name);
  if (navigator.serviceWorker.controller) location.reload(); // this page was still served by the worker
}
