// Game panel logic. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { describeLocation2 } from '../js/core/format.js';
import {
  findByBggId, parseBggId, parseGameForm, parseRange, cleanTitle, parseDecimal, parseDims, dimsToInputs, sameDims, textOrNull, sizeSources, toggleCategory,
  gamesInside, hostChoices, takenOutReason, bggPage, bggVersions, bggSearch, setPizza,
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

test('cleanTitle trims and refuses blank names', () => {
  assert.equal(cleanTitle('  Ethiq: Morális játszmák '), 'Ethiq: Morális játszmák');
  assert.equal(cleanTitle('   '), null);
  assert.equal(cleanTitle(null), null);
});

test('a game can be renamed through the store, and an empty name is refused', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const g = byTitle('Fluxx');
  store.updateGame(g.id, { title: cleanTitle(' Fluxx (magyar) ') });
  assert.equal(store.getGame(g.id).title, 'Fluxx (magyar)');
  assert.throws(() => store.updateGame(g.id, { title: '' }));
  assert.equal(store.getGame(g.id).title, 'Fluxx (magyar)');
});

// ---------------------------------------------------------------- A4: add a game

test('parseBggId: empty is fine, whole numbers only', () => {
  assert.deepEqual(parseBggId(''), { id: null });
  assert.deepEqual(parseBggId(' 342942 '), { id: 342942 });
  for (const bad of ['abc', '12.5', '-3', '0', '12 34']) assert.match(parseBggId(bad).error, /whole number/);
});

test('parseRange: both empty, one value, two values, and mistakes', () => {
  assert.deepEqual(parseRange('', '', 'players'), { value: null });
  assert.deepEqual(parseRange('2', '', 'players'), { value: { min: 2, max: 2 } });
  assert.deepEqual(parseRange('2', '6', 'players'), { value: { min: 2, max: 6 } });
  assert.match(parseRange('', '6', 'number of players').error, /lowest number of players too/);
  assert.match(parseRange('6', '2', 'play time').error, /cannot be more/);
  assert.match(parseRange('x', '2', 'play time').error, /whole numbers/);
  assert.match(parseRange('0', '2', 'play time').error, /whole numbers/);
});

const emptyForm = () => ({ title: '', bggId: '', dims: ['', '', ''], players: ['', ''], time: ['', ''], type: 'base', categories: [], inBgg: false });

test('parseGameForm: Fantasy Fluxx', () => {
  const { fields, errors } = parseGameForm({
    ...emptyForm(), title: ' Fantasy Fluxx ', dims: ['9,4', '12,4', '2,8'], players: ['2', '6'], time: ['10', '30'],
    categories: ['popular', 'party'],
  });
  assert.equal(errors, undefined);
  assert.deepEqual(fields, {
    title: 'Fantasy Fluxx', bggId: null, type: 'base', dims: [2.8, 9.4, 12.4], players: { min: 2, max: 6 },
    time: { min: 10, max: 30 }, categories: ['party', 'popular'], inBgg: false,
  });
});

test('parseGameForm: only the title is required, and every mistake is named', () => {
  assert.deepEqual(parseGameForm({ ...emptyForm(), title: 'X' }).fields.dims, null);
  const { errors } = parseGameForm({ ...emptyForm(), bggId: 'abc', dims: ['1', '', ''], players: ['', '4'], time: ['9', '3'] });
  assert.deepEqual(Object.keys(errors).sort(), ['bggId', 'dims', 'players', 'time', 'title']);
  assert.match(errors.dims, /^Fill in all three sizes/);
  assert.equal(parseGameForm({ ...emptyForm(), title: 'E', type: 'expansion', inBgg: true }).fields.type, 'expansion');
});

test('findByBggId finds the game that already has the id', async () => {
  await store.init({ seed, storage: memoryStorage() });
  assert.equal(findByBggId(store.getGames(), 404883).title, 'Lairs');
  assert.equal(findByBggId(store.getGames(), 1), undefined);
  assert.equal(findByBggId(store.getGames(), null), undefined);
});

test('acceptance: Fantasy Fluxx is added unplaced with its size', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const { fields } = parseGameForm({ ...emptyForm(), title: 'Fantasy Fluxx', dims: ['9.4', '12.4', '2.8'] });
  const newId = store.addGame(fields);
  const game = store.getGame(newId);
  assert.deepEqual(game.dims, [2.8, 9.4, 12.4]);
  assert.equal(game.inBgg, false);
  assert.equal(store.locate2(newId).kind, 'board');
  assert.equal(describeLocation2(store.locate2(newId)), 'On the board');
  assert.ok(store.getGames().some((g) => g.title === 'Fantasy Fluxx'));
});

test('setPizza: a flat game can be switched both ways', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const lairs = byTitle('Lairs'); // lies flat on a shelf, pizza from the start
  assert.equal(lairs.pizza, true);
  assert.deepEqual(setPizza(store, lairs.id, false), { ok: true });
  assert.equal(store.getGame(lairs.id).pizza, false);
  assert.deepEqual(setPizza(store, lairs.id, true), { ok: true });
  assert.equal(store.getGame(lairs.id).pizza, true);
});

test('setPizza: the store refuses a game that stands or lies on its side, and its message is passed on', async () => {
  await store.init({ seed, storage: memoryStorage() });
  for (const title of ['Ice Cool', 'KLASK', 'Trio']) {
    const g = byTitle(title);
    assert.equal(g.pizza, false);
    const r = setPizza(store, g.id, true);
    assert.equal(r.ok, false);
    assert.equal(r.pizza, false, 'what is really stored');
    assert.match(r.message, /does not lie flat on the shelf/);
    assert.match(r.message, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(store.getGame(g.id).pizza, false, 'nothing changed');
  }
});

test('setPizza: a standing game on the board or in the cupboard may become pizza; switching it off is always fine', async () => {
  await store.init({ seed, storage: memoryStorage() });
  const klask = byTitle('KLASK');
  store.moveToBoard(klask.id);
  assert.deepEqual(setPizza(store, klask.id, true), { ok: true });
  assert.equal(store.getGame(klask.id).pizza, true);
  // …but then it cannot be stood up on a shelf again without switching pizza off
  assert.deepEqual(setPizza(store, klask.id, false), { ok: true });
  assert.equal(store.getGame(klask.id).pizza, false);
});
