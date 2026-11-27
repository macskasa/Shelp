// Route helpers of the app frame (Part C). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHash, parseHash, resolveRoute, sortScreens } from '../js/shell/routes.js';

const screens = [
  { id: 'map', title: 'Shelves', order: 10 },
  { id: 'catalog', title: 'Games', order: 20 },
  { id: 'cupboard', title: 'Cupboard', order: 30 },
  { id: 'data', title: 'Data', order: 40 },
];

test('toHash: plain screen, with params, and without empty values', () => {
  assert.equal(toHash('map'), '#/map');
  assert.equal(toHash('map', { game: 'g042' }), '#/map?game=g042');
  assert.equal(toHash('catalog', { q: '', cat: null, players: undefined }), '#/catalog');
  assert.equal(toHash('catalog', { q: 'fold', players: 4 }), '#/catalog?q=fold&players=4');
});

test('parseHash: screen, params, empty hash', () => {
  assert.deepEqual(parseHash('#/map?game=g042'), { id: 'map', params: { game: 'g042' } });
  assert.deepEqual(parseHash('#/catalog'), { id: 'catalog', params: {} });
  assert.deepEqual(parseHash(''), { id: '', params: {} });
  assert.deepEqual(parseHash('#'), { id: '', params: {} });
  assert.deepEqual(parseHash('#map'), { id: 'map', params: {} }); // a hash without the slash still works
});

test('hash round trip keeps accents, spaces and odd characters in params', () => {
  const params = { q: 'Föld és víz', cat: 'party,coop', note: 'a?b&c=d#e' };
  assert.deepEqual(parseHash(toHash('catalog', params)).params, params);
});

test('a second "?" inside the query does not cut the params short', () => {
  assert.deepEqual(parseHash('#/catalog?q=a?b').params, { q: 'a?b' });
});

test('resolveRoute: known route', () => {
  const r = resolveRoute(screens, '#/catalog?q=azul', 'map');
  assert.equal(r.screen, screens[1]);
  assert.equal(r.id, 'catalog');
  assert.deepEqual(r.params, { q: 'azul' });
  assert.equal(r.redirected, false);
});

test('resolveRoute: unknown and empty routes fall back to the default screen without params', () => {
  for (const hash of ['', '#', '#/nope', '#/nope?game=g1']) {
    const r = resolveRoute(screens, hash, 'map');
    assert.equal(r.id, 'map', hash);
    assert.deepEqual(r.params, {}, hash);
    assert.equal(r.redirected, true, hash);
  }
});

test('resolveRoute: no screens at all gives no screen', () => {
  assert.equal(resolveRoute([], '#/map', 'map').screen, undefined);
});

test('sortScreens orders by `order`, unordered last, and leaves the input alone', () => {
  const input = [{ id: 'z' }, { id: 'b', order: 20 }, { id: 'a', order: 10 }];
  assert.deepEqual(sortScreens(input).map((s) => s.id), ['a', 'b', 'z']);
  assert.deepEqual(input.map((s) => s.id), ['z', 'b', 'a']);
});
