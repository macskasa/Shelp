// Catalog search and "Where's my game?" (Part C, stories A6 and C4). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { fold, searchKey, parseQuery, matchScore, matchesQuery, rankMatches } from '../js/catalog/search.js';
import { whereText } from '../js/catalog/where-text.js';
import { DEFAULT_STATE, makeEntry, matches } from '../js/catalog/filter.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const titleOf = (id) => store.getGame(id)?.title ?? id;

async function load() {
  await store.init({ seed, storage: memory() });
  return store.getGames().map((g) => ({ game: g, key: searchKey(g) }));
}
const titles = (items) => items.map((i) => i.game.title);
const find = (items, text) => titles(rankMatches(items, text));

test('fold: accents, case and punctuation do not matter', () => {
  assert.equal(fold('Föld és víz'), 'fold es viz');
  assert.equal(fold('A rettegés éjszakája: Vérfarkas'), 'a rettegés éjszakája: vérfarkas'.normalize('NFD').replace(/\p{M}/gu, '').replace(/[:]/g, ''));
  assert.equal(fold('Dűne: Impérium – Felkelés'), 'dune imperium felkeles');
  assert.equal(fold('  ŐŰ őű  '), 'ou ou');
  assert.equal(fold('Straße Ørsted Łódź Æon'), 'strasse orsted lodz aeon');
  assert.equal(fold('7 Wonders (2nd ed.)'), '7 wonders 2nd ed');
  assert.equal(fold(null), '');
  assert.equal(fold('?!'), '');
});

test('fold: the same word typed with or without accents folds to the same text', () => {
  const words = ['éjszakája', 'ejszakaja', 'ÉJSZAKÁJA', 'Éjszakája'];
  assert.equal(new Set(words.map(fold)).size, 1);
  // composed and decomposed forms of "ő" are the same letter to a person
  assert.equal(fold('ő'), fold('ő'));
});

test('the examples from the brief find their games', async () => {
  const items = await load();
  assert.ok(find(items, 'ejszaka').includes('A rettegés éjszakája: Vérfarkas'));
  assert.ok(find(items, 'fold').includes('Föld és víz'));
  assert.ok(find(items, 'FÖLD').includes('Föld és víz'));
  assert.ok(find(items, 'ÉJSZAKA').includes('A rettegés éjszakája: Vérfarkas'));
});

test('a game is found by its BGG name too', async () => {
  const items = await load();
  assert.deepEqual(find(items, 'one night ultimate'), ['A rettegés éjszakája: Vérfarkas']);
  assert.ok(find(items, 'land vs sea').includes('Föld és víz'));
  assert.ok(find(items, 'crystal mosaic').includes('Azul: Kristálymozaik'));
});

test('every typed word has to match, in any order, and words may be cut short', async () => {
  const items = await load();
  assert.deepEqual(find(items, 'vérfarkas rettegés'), ['A rettegés éjszakája: Vérfarkas']);
  assert.deepEqual(find(items, 'rett vérf'), ['A rettegés éjszakája: Vérfarkas']);
  assert.deepEqual(find(items, 'azul zzzz'), []);
  assert.deepEqual(find(items, 'kristály mozaik azul'), ['Azul: Kristálymozaik']);
});

test('punctuation in the title or in the query does not get in the way', async () => {
  const items = await load();
  assert.ok(find(items, 'dune imperium felkeles').includes('Dűne: Impérium – Felkelés'));
  assert.ok(find(items, 'dűne: impérium – felkelés').includes('Dűne: Impérium – Felkelés'));
  assert.ok(find(items, 'jég gyűjtői').includes('JÉG – gyűjtői változat'));
});

test('part of a word in the middle is found, but ranks after whole-word starts', async () => {
  const items = await load();
  const out = find(items, 'zul'); // inside "Azul"
  assert.ok(out.includes('Azul'));
  const query = parseQuery('zul');
  assert.equal(matchScore(searchKey({ title: 'Azul' }), query), 3);
  assert.equal(matchScore(searchKey({ title: 'Zulu' }), query), 1);
});

test('ranking: exact, then starts with, then word starts, then anywhere, then BGG name', () => {
  const g = (title, bggName = null) => ({ title, bggName });
  const items = [
    g('Mini Azul'), g('Azul Kids'), g('Azul'), g('Duell', 'Azul clone'), g('Sazulo'), g('Mosaic: Azul'),
  ].map((game) => ({ game, key: searchKey(game) }));
  assert.deepEqual(titles(rankMatches(items, 'azul')), ['Azul', 'Azul Kids', 'Mini Azul', 'Mosaic: Azul', 'Sazulo', 'Duell']);
});

test('ranking: ties go to the shorter title, then to the given order', () => {
  const items = ['Café B', 'Café A', 'Café Long Name'].map((title) => ({ game: { title }, key: searchKey({ title }) }));
  assert.deepEqual(titles(rankMatches(items, 'cafe')), ['Café B', 'Café A', 'Café Long Name']);
  assert.deepEqual(titles(rankMatches(items, 'cafe', 2)), ['Café B', 'Café A']); // limit
});

test('an empty search finds nothing in the panel, and does not filter the catalog', async () => {
  const items = await load();
  assert.deepEqual(rankMatches(items, ''), []);
  assert.deepEqual(rankMatches(items, '  ?! '), []);
  assert.equal(matchScore(items[0].key, parseQuery('')), 0);
  assert.equal(matchesQuery(items[0].key, parseQuery('?!')), true);
});

test('a game without a BGG name, or with the same one, is searched by its title', () => {
  const key = searchKey({ title: 'Azul', bggName: 'Azul' });
  assert.deepEqual(key, { title: 'azul', bgg: '' });
  assert.deepEqual(searchKey({ title: 'Azul', bggName: null }), { title: 'azul', bgg: '' });
  assert.equal(matchScore(key, parseQuery('azul azul')), 2);
});

test('catalog: the search text is one more filter next to the others', async () => {
  await load();
  const all = store.getGames().map((g) => makeEntry(g, store.locate(g.id), titleOf));
  const count = (patch) => all.filter((e) => matches(e, { ...DEFAULT_STATE, ...patch })).length;
  assert.equal(count({ q: '' }), seed.games.length);
  assert.equal(count({ q: 'azul' }), seed.games.filter((g) => /azul/i.test(`${g.title} ${g.bggName}`)).length);
  assert.ok(count({ q: 'azul', players: 2 }) <= count({ q: 'azul' }));
  assert.equal(count({ q: 'azul', cats: ['coop'] }), all.filter((e) => /azul/i.test(`${e.game.title} ${e.game.bggName}`) && e.game.categories.includes('coop')).length);
  assert.equal(count({ q: 'nincs ilyen játék' }), 0);
});

test('search stays fast: 200 games, 40 keystrokes', async () => {
  const items = await load();
  const text = 'a rettegés éjszakája vérfarkas';
  const t0 = performance.now();
  for (let i = 1; i <= 40; i++) rankMatches(items, text.slice(0, i), 8);
  assert.ok(performance.now() - t0 < 200, 'should be a few milliseconds');
});

// ---------------------------------------------------------------- Where's my game? (C4)

const flat = (above = []) => ({ kind: 'stack', stackId: 'B3', zone: 'bottom', orientation: 'flat', rows: 1, row: 0, index: 1, side: null, above, below: ['g001'] });

test('whereText: a flat stack says where it is and what is on top, nearest first', () => {
  const name = (id) => ({ a: 'Azul', b: 'Brass', c: 'Catan' })[id];
  const three = whereText(flat(['a', 'b', 'c']), name);
  assert.equal(three.sentence, 'Bottom shelf · stack B3 · 2nd from the bottom · 3 boxes on top');
  assert.equal(three.onTop, 'On top, nearest first: Azul, Brass, Catan');
  assert.equal(whereText(flat(['b']), name).onTop, 'On top: Brass');
  const top = whereText(flat([]), name);
  assert.equal(top.sentence, 'Bottom shelf · stack B3 · 2nd from the bottom · on top');
  assert.equal(top.onTop, 'Nothing on top');
});

test('whereText: standing games, the cupboard and unplaced games have no "on top" line', () => {
  const standing = { kind: 'stack', stackId: 'T1', zone: 'top', orientation: 'standing', rows: 1, row: 0, index: 2, side: null, above: [], below: [] };
  assert.equal(whereText(standing).onTop, null);
  assert.match(whereText(standing).sentence, /3rd from the left/);
  assert.deepEqual(whereText({ kind: 'cupboard', reason: 'rarely played' }), { sentence: 'Cupboard – rarely played', onTop: null });
  assert.deepEqual(whereText({ kind: 'unplaced' }), { sentence: 'Not placed yet', onTop: null });
  assert.deepEqual(whereText(null), { sentence: 'Unknown game', onTop: null });
});

test('whereText: an expansion inside a box says so, and what is on top of that box', () => {
  const name = (id) => ({ host: 'Lairs', x: 'Brass' })[id];
  const inside = { kind: 'inside', hostId: 'host', host: flat(['x']) };
  const t = whereText(inside, name);
  assert.equal(t.sentence, 'Inside the Lairs box (Bottom shelf · stack B3 · 2nd from the bottom · 1 box on top)');
  assert.equal(t.onTop, 'On top of the Lairs box: Brass');
  assert.equal(whereText({ kind: 'inside', hostId: 'host', host: flat([]) }, name).onTop, 'Nothing on top of the Lairs box');
  assert.equal(whereText({ kind: 'inside', hostId: 'host', host: { kind: 'cupboard', reason: '' } }, name).onTop, null);
});

test('whereText with the real seed: every game gets a sentence, and "on top" names are real titles', async () => {
  await load();
  const known = new Set(store.getGames().map((g) => g.title));
  for (const g of store.getGames()) {
    const loc = store.locate(g.id);
    const { sentence, onTop } = whereText(loc, titleOf);
    assert.ok(sentence.length > 5, g.id);
    if (loc.kind === 'stack' && loc.orientation === 'flat' && loc.above.length) {
      assert.ok(loc.above.every((id) => onTop.includes(titleOf(id))), g.id);
      assert.ok(loc.above.every((id) => known.has(titleOf(id))), g.id);
    }
  }
  // an expansion from the seed: Lairs: Box Zero lives inside Lairs
  const zero = store.getGames().find((g) => g.title === 'Lairs: Box Zero');
  const t = whereText(store.locate(zero.id), titleOf);
  assert.match(t.sentence, /^Inside the Lairs box \(/);
});
