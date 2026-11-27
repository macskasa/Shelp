// Service worker for Shelp (story E1). Owner: Peter (Part C).
//
// 1. Install: the app shell (SHELL below) is cached, so the app starts without a network.
// 2. Every other same-origin GET is answered from the cache at once and refreshed in the background
//    (stale-while-revalidate). Files that other parts add are cached the first time they are used,
//    nobody keeps a list. Requests to other sites are left alone (nothing may load from them).
// 3. When a refresh finds a changed file, the open pages are told ("shelp:updated") and offer
//    "New version – Reload". The cache already holds the new file by then, so a reload is enough.
// 4. A new version of this file waits until the user taps Reload ("shelp:skip-waiting"), so a running
//    page never gets half of one release and half of another.
//
// Bump VERSION when SHELL changes, or to make every phone fetch everything again.
// All URLs are relative to the scope, so it works under https://macskasa.github.io/Shelp/ and on localhost.
'use strict';

const VERSION = 'v1';
const CACHE = `shelp-${VERSION}`;
const SHELL = [
  './',
  'index.html',
  'css/base.css',
  'js/app.js',
  'data/seed.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

const inScope = (path) => new URL(path, self.registration.scope).href;

// ---------------------------------------------------------------- pure helpers (tested in Node)

/** Same-origin GET requests are ours; everything else goes to the network untouched. */
function handles(request, origin) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('range')) return false;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return false;
  return new URL(request.url).origin === origin;
}

/** Only complete, successful responses are stored (no 404s, no partial content, nothing opaque). */
function isCacheable(response) {
  return !!response && response.status === 200 && response.type !== 'opaque';
}

/** Did the file change? Same ETag means no; otherwise the bytes decide (so a new timestamp alone is not an update). */
async function differs(a, b) {
  const tagA = a.headers.get('etag');
  const tagB = b.headers.get('etag');
  if (tagA && tagB && tagA === tagB) return false;
  const [x, y] = await Promise.all([a.clone().arrayBuffer(), b.clone().arrayBuffer()]);
  if (x.byteLength !== y.byteLength) return true;
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return true;
  return false;
}

// ---------------------------------------------------------------- worker

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages allows 10 minutes), so the shell is really fresh.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((p) => new Request(inScope(p), { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('shelp-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (handles(event.request, self.location.origin)) event.respondWith(respond(event));
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg?.type === 'shelp:skip-waiting') self.skipWaiting();
  else if (msg?.type === 'shelp:cache-urls' && Array.isArray(msg.urls)) event.waitUntil(cacheUrls(msg.urls));
});

/** Cache first, refresh in the background. Page loads always get the app shell (index.html). */
async function respond(event) {
  const isPage = event.request.mode === 'navigate';
  const url = isPage ? inScope('index.html') : event.request.url;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(url);
  const refreshing = refresh(cache, url);
  event.waitUntil(refreshing);
  if (cached) return cached;
  return (await refreshing) ?? Response.error();
}

/** Fetch the file again (asking the server whether it changed), store it, tell the pages if it did. Never throws. */
async function refresh(cache, url) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!isCacheable(response)) return response;
    const old = await cache.match(url); // its own copy: the page may still be reading the one we answered with
    const changed = old ? await differs(old, response) : false;
    await cache.put(url, response.clone());
    if (changed) await tellPages(url);
    return response;
  } catch {
    return null; // offline: the cached copy (if any) has already been served
  }
}

async function tellPages(url) {
  for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'shelp:updated', url });
}

/** The first visit happens before the worker controls the page, so the page lists what it loaded and we cache it. */
async function cacheUrls(urls) {
  const cache = await caches.open(CACHE);
  const wanted = new Set(urls.map((u) => new URL(u, self.registration.scope)).filter((u) => u.origin === self.location.origin).map((u) => u.origin + u.pathname + u.search));
  wanted.delete(inScope('sw.js'));
  await Promise.all([...wanted].map(async (url) => {
    if (await cache.match(url)) return;
    try {
      const response = await fetch(url);
      if (isCacheable(response)) await cache.put(url, response);
    } catch { /* offline or gone: skip it */ }
  }));
}

// Lets the Node tests (tests/shell-sw.test.mjs) reach the pure helpers. In a browser `module` does not exist.
if (typeof module !== 'undefined' && module.exports) module.exports = { VERSION, CACHE, SHELL, handles, isCacheable, differs };
