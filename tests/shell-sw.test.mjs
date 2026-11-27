// Service worker helpers, manifest and icons (Part C, story E1). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// sw.js is a classic script: give it a fake `self`, then use the helpers it exports for Node.
globalThis.self = {
  addEventListener() {},
  registration: { scope: 'https://example.com/Shelp/' },
  location: { origin: 'https://example.com' },
};
const sw = createRequire(import.meta.url)('../sw.js');

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const manifest = JSON.parse(read('manifest.webmanifest').toString('utf8'));

/** Width and height of a PNG, from its header. */
function pngSize(path) {
  const b = read(path);
  assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG', `${path} is not a PNG`);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

// ---------------------------------------------------------------- shell list

test('every file the worker caches at install exists', () => {
  for (const path of sw.SHELL) assert.ok(existsSync(new URL(path, root)), `${path} is in SHELL but missing`);
});

test('the shell contains what the app needs to start, and what the manifest points to', () => {
  const shell = new Set(sw.SHELL);
  for (const need of ['index.html', 'css/base.css', 'js/app.js', 'data/seed.json', 'manifest.webmanifest']) {
    assert.ok(shell.has(need), `${need} should be in SHELL`);
  }
  for (const icon of manifest.icons) assert.ok(shell.has(icon.src), `${icon.src} (manifest) should be in SHELL`);
});

test('cache name is versioned', () => {
  assert.match(sw.VERSION, /^v\d+$/);
  assert.equal(sw.CACHE, `shelp-${sw.VERSION}`);
});

// ---------------------------------------------------------------- manifest and icons

test('manifest has what Chrome needs to install the app (WebAPK)', () => {
  assert.ok(manifest.name && manifest.short_name);
  assert.ok(manifest.id, 'id');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
});

test('manifest icons: 192 and 512 PNG, one maskable, sizes are real', () => {
  const find = (size, purpose) => manifest.icons.find((i) => i.sizes === size && i.type === 'image/png' && i.purpose === purpose);
  assert.ok(find('192x192', 'any'), '192 any');
  assert.ok(find('512x512', 'any'), '512 any');
  assert.ok(find('512x512', 'maskable'), '512 maskable');
  for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
    assert.equal(pngSize(icon.src), icon.sizes, `${icon.src} is not ${icon.sizes}`);
  }
});

test('index.html links the manifest and an apple touch icon that exists', () => {
  const html = read('index.html').toString('utf8');
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  const icon = /rel="apple-touch-icon" href="([^"]+)"/.exec(html)?.[1];
  assert.ok(icon && existsSync(new URL(icon, root)), `apple-touch-icon ${icon} is missing`);
});

// ---------------------------------------------------------------- helpers

const fakeRequest = (url, extra = {}) => ({ method: 'GET', url, headers: new Headers(), cache: 'default', mode: 'cors', ...extra });

test('handles: only same-origin GET requests', () => {
  const origin = 'https://example.com';
  assert.equal(sw.handles(fakeRequest('https://example.com/Shelp/js/app.js'), origin), true);
  assert.equal(sw.handles(fakeRequest('https://example.com/Shelp/js/app.js', { method: 'POST' }), origin), false);
  assert.equal(sw.handles(fakeRequest('https://other.example/lib.js'), origin), false);
  assert.equal(sw.handles(fakeRequest('https://example.com/video.mp4', { headers: new Headers({ range: 'bytes=0-1' }) }), origin), false);
  assert.equal(sw.handles(fakeRequest('https://example.com/a.js', { cache: 'only-if-cached', mode: 'cors' }), origin), false);
  assert.equal(sw.handles(fakeRequest('https://example.com/a.js', { cache: 'only-if-cached', mode: 'same-origin' }), origin), true);
});

test('isCacheable: only complete, successful, non-opaque responses', () => {
  assert.equal(sw.isCacheable(new Response('ok')), true);
  assert.equal(sw.isCacheable(new Response('nope', { status: 404 })), false);
  assert.equal(sw.isCacheable(new Response('part', { status: 206 })), false);
  assert.equal(sw.isCacheable({ status: 0, type: 'opaque' }), false);
  assert.equal(sw.isCacheable(null), false);
});

test('differs: same ETag = unchanged; otherwise the bytes decide', async () => {
  const res = (body, etag) => new Response(body, { headers: etag ? { etag } : {} });
  assert.equal(await sw.differs(res('a', '"1"'), res('a', '"1"')), false);
  assert.equal(await sw.differs(res('a', '"1"'), res('b', '"2"')), true);
  assert.equal(await sw.differs(res('abc', '"1"'), res('abc', '"2"')), false, 'new ETag but the same bytes is not an update');
  assert.equal(await sw.differs(res('abc'), res('abc')), false);
  assert.equal(await sw.differs(res('abc'), res('abd')), true);
  assert.equal(await sw.differs(res('abc'), res('abcd')), true);
});

test('differs leaves both responses readable (the page may still be using one)', async () => {
  const a = new Response('hello');
  const b = new Response('hellO');
  await sw.differs(a, b);
  assert.equal(await a.text(), 'hello');
  assert.equal(await b.text(), 'hellO');
});
