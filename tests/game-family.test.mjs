// Game families (B2): chips for the panel, suggested families for the Data screen. Run from the repo root: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { familyBase, suggestFamilyNames, suggestFamilies, alsoIn, familyLine } from '../js/game/family.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const g = (id, title, bggName, extra = {}) => ({ id, title, bggName, family: null, ...extra });

test('familyBase: the start before ":", a dash or "(", without a trailing edition word', () => {
  assert.equal(familyBase('Azul: Crystal Mosaic'), 'Azul');
  assert.equal(familyBase('Harry Potter: Hogwarts Battle – expansion'), 'Harry Potter');
  assert.equal(familyBase('Parks (Second Edition)'), 'Parks');
  assert.equal(familyBase('Tokaido Duo'), 'Tokaido');
  assert.equal(familyBase('Azul Kids'), 'Azul');
  assert.equal(familyBase('Port Royal: Big Box'), 'Port Royal');
  assert.equal(familyBase('Tokaido: Deluxe Edition'), 'Tokaido');
  assert.equal(familyBase('Port Royal Big Box'), 'Port Royal');
  assert.equal(familyBase('Duo'), 'Duo', 'never an empty name');
  assert.equal(familyBase('x'.repeat(41)), '', 'too long for a family name');
  assert.equal(familyBase(null), '');
});

test('chips: BGG name start, the host\'s family, families sharing a word; none for its own family; at most 4', () => {
  const games = [
    g('a', 'Azul', 'Azul', { family: 'Azul' }),
    g('b', 'Azul Kids', 'Azul Kids'),
    g('c', 'Azul: Kristálymozaik', 'Azul: Crystal Mosaic', { type: 'expansion' }),
    g('m', 'A Mars terraformálása', 'Terraforming Mars', { family: 'Terraforming Mars' }),
    g('n', 'Mars Base', 'Mars Base'),
  ];
  assert.deepEqual(suggestFamilyNames(games[1], games), ['Azul']);
  assert.deepEqual(suggestFamilyNames(games[0], games), [], 'no chip for the family it already has');
  assert.deepEqual(suggestFamilyNames(games[2], games, { c: 'a' }), ['Azul']);
  assert.deepEqual(suggestFamilyNames(games[4], games), ['Mars Base', 'Terraforming Mars']);
  const many = [g('x', 'Star Quest', 'Star Quest'), ...['Star A', 'Star B', 'Star C', 'Star D', 'Star E'].map((f, i) => g(`f${i}`, f, f, { family: f }))];
  assert.equal(suggestFamilyNames(many[0], many).length, 4);
  // letter case: the existing spelling is used
  assert.deepEqual(suggestFamilyNames(g('q', 'azul duo', 'azul duo'), games), ['Azul']);
});

test('suggestFamilies on the seed: the families the brief names, none for a game that has one already', async () => {
  await store.init({ seed, storage: mem() });
  const found = suggestFamilies(store.getGames());
  const names = found.map((f) => f.name);
  for (const n of ['7 Wonders', 'Azul', 'Root', 'SETI', 'Sky Team', 'Terraforming Mars', 'Tokaido']) assert.ok(names.includes(n), n);
  const tokaido = found.find((f) => f.name === 'Tokaido');
  assert.deepEqual(tokaido.ids.map((id) => store.getGame(id).title).sort(), ['Tokaido Duo', 'Tokaido: Deluxe Edition']);
  assert.ok(found.every((f) => f.ids.length >= 2));
  const [first] = found;
  store.updateGame(first.ids[0], { family: first.name });
  assert.ok(!suggestFamilies(store.getGames()).some((f) => f.name === first.name && f.ids.includes(first.ids[0])));
});

test('alsoIn and familyLine', async () => {
  await store.init({ seed, storage: mem() });
  const [a, b, c] = store.getGames();
  store.batch(() => { for (const x of [a, b, c]) store.updateGame(x.id, { family: 'Trio' }); });
  assert.deepEqual(alsoIn(store.getGame(a.id), store.getFamilies()), [b.id, c.id]);
  assert.deepEqual(alsoIn(store.getGame(store.getGames()[5].id), store.getFamilies()), []);
  assert.equal(familyLine(store.getFamilies()[0]), 'Trio · 3 games');
  assert.equal(familyLine({ name: 'Solo', ids: ['x'] }), 'Solo · 1 game');
});
