// Game panel logic. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import {
  parseDecimal, parseDims, dimsToInputs, sameDims, textOrNull, sizeSources, toggleCategory,
  gamesInside, hostChoices, takenOutReason, bggPage, bggVersions, bggSearch,
} from '../js/game/logic.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const byTitle = (t) => {
  const g = store.getGames().find((x) => x.title === t);
  assert.ok(g, `no game "${t}"`);
  return g;
};

test('parseDecimal accepts dot and comma, rejects the rest', () => {
  assert.equal(parseDecimal('22.6'), 22.6);
  assert.equal(parseDecimal('22,6'), 22.6);
  assert.equal(parseDecimal(' 5 '), 5);
  assert.equal(parseDecimal('.5'), 0.5);
  for (const bad of ['', 'abc', '0', '-3', '1,2,3', '1.2.3', '1e3', '22,6cm', null, undefined]) {
    assert.ok(Number.isNaN(parseDecimal(bad)), `"${bad}" should be rejected`);
  }
});

test('parseDims sorts, allows comma, clears, and explains problems', () => {
  assert.deepEqual(parseDims(['22,6', '14.6', '5,6']), { dims: [5.6, 14.6, 22.6] });
  assert.deepEqual(parseDims(['', ' ', '']), { dims: null });
  assert.match(parseDims(['22.6', '', '5']).error, /all three/);
  assert.equal(parseDims(['22.6', '', '5']).incomplete, true);
  assert.equal(parseDims(['22.6', 'x', '5']).incomplete, undefined);
  assert.match(parseDims(['22.6', 'x', '5']).error, /positive numbers/);
  assert.match(parseDims(['22.6', '0', '5']).error, /positive numbers/);
});

test('dimsToInputs and sameDims', () => {
  assert.deepEqual(dimsToInputs([5.6, 14.6, 22.6]), ['22.6', '14.6', '5.6']);
  assert.deepEqual(dimsToInputs(null), ['', '', '']);
  assert.ok(sameDims([1, 2, 3], [3, 2, 1]));
  assert.ok(sameDims(null, null));
  assert.ok(!sameDims(null, [1, 2, 3]));
  assert.ok(!sameDims([1, 2, 3], [1, 2, 4]));
});

test('textOrNull, sizeSources, toggleCategory', () => {
  assert.equal(textOrNull('  '), null);
  assert.equal(textOrNull(' hi '), 'hi');
  const sources = sizeSources([{ sizeSource: 'EN' }, { sizeSource: 'HU' }, { sizeSource: 'EN' }, { sizeSource: null }]);
  assert.deepEqual(sources, ['EN', 'HU']);
  assert.deepEqual(toggleCategory(['party'], 'duo'), ['party', 'duo']);
  assert.deepEqual(toggleCategory(['duo'], 'party'), ['party', 'duo']);
  assert.deepEqual(toggleCategory(['party', 'duo'], 'party'), ['duo']);
});

test('BGG links', () => {
  assert.equal(bggPage({ bggId: 98 }), 'https://boardgamegeek.com/boardgame/98');
  assert.equal(bggVersions({ bggId: 98 }), 'https://boardgamegeek.com/boardgame/98/versions');
  assert.equal(bggPage({ bggId: null }), null);
  assert.match(bggSearch({ bggName: 'Ethiq', title: 'Ethiq: Morális játszmák' }), /q=Ethiq$/);
  assert.match(bggSearch({ bggName: null, title: 'A & B' }), /q=A%20%26%20B$/);
});

test('acceptance: Ethiq size can be corrected and the store sorts it', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const ethiq = byTitle('Ethiq: Morális játszmák');
  const patch = parseDims(['22,6', '14,6', '5,6']);
  store.updateGame(ethiq.id, patch);
  assert.deepEqual(store.getGame(ethiq.id).dims, [5.6, 14.6, 22.6]);
  store.updateGame(ethiq.id, { sizeSource: textOrNull('measured by you') });
  assert.equal(store.getGame(ethiq.id).sizeSource, 'measured by you');
});

test('acceptance: Lairs holds Box Zero, and the location reads "Inside the Lairs box"', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const lairs = byTitle('Lairs');
  const zero = byTitle('Lairs: Box Zero');
  assert.deepEqual(gamesInside(store.getPlan(), lairs.id, store.getGames()), [zero.id]);
  assert.equal(store.locate(zero.id).kind, 'inside');
});

test('hostChoices follows the one-level rule', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const games = store.getGames();
  const plan = store.getPlan();
  const lairs = byTitle('Lairs');
  const zero = byTitle('Lairs: Box Zero');

  // A host cannot go inside another box
  assert.match(hostChoices(lairs.id, games, plan).blocked, /cannot go inside/);

  // A game that is inside something is not offered as a host, and a game is never its own host
  const { hosts } = hostChoices(byTitle('Ark Nova').id, games, plan);
  assert.ok(hosts.every((g) => !plan.inside[g.id]));
  assert.ok(!hosts.some((g) => g.id === byTitle('Ark Nova').id));
  assert.ok(!hosts.some((g) => g.id === zero.id));
  assert.ok(hosts.some((g) => g.id === lairs.id));

  // Every offered host is accepted by the store
  const target = byTitle('Ark Nova');
  store.setInside(target.id, hosts[0].id);
  assert.equal(store.locate(target.id).kind, 'inside');
});

test('taking a game out sends it to the cupboard with a reason', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const zero = byTitle('Lairs: Box Zero');
  store.moveToCupboard(zero.id, takenOutReason('Lairs'));
  assert.deepEqual(store.locate(zero.id), { kind: 'cupboard', reason: 'Taken out of the Lairs box' });
  assert.deepEqual(gamesInside(store.getPlan(), byTitle('Lairs').id, store.getGames()), []);
});
