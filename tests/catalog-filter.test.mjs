// Catalog filtering and sorting (Part C, story A6). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import {
  DEFAULT_STATE, stateFromParams, stateToParams, activeFilterCount, makeEntry, matches, sortEntries,
  shortLocation, locationKind, countLabel,
} from '../js/catalog/filter.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

async function entries() {
  await store.init({ seed, storage: memory() });
  const title = (id) => store.getGame(id)?.title ?? id;
  return store.getGames().map((g) => makeEntry(g, store.locate(g.id), title));
}
const filter = (all, patch) => all.filter((e) => matches(e, { ...DEFAULT_STATE, ...patch }));
const ids = (list) => list.map((e) => e.game.id).sort();
const seedIds = (pred) => seed.games.filter(pred).map((g) => g.id).sort();

test('default state shows every game', async () => {
  const all = await entries();
  assert.equal(filter(all, {}).length, seed.games.length);
});

test('state <-> URL params: round trip, defaults left out, rubbish ignored', () => {
  const state = { cats: ['party', 'other'], players: 4, time: 30, where: 'cupboard', sizeMissing: true, sort: 'time', dir: 'desc' };
  const params = stateToParams(state);
  assert.deepEqual(params, { cat: 'party,other', players: 4, time: 30, where: 'cupboard', nosize: '1', sort: 'time', dir: 'desc' });
  assert.deepEqual(stateFromParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))), state);
  assert.deepEqual(stateToParams(DEFAULT_STATE), {});
  assert.deepEqual(stateFromParams({}), DEFAULT_STATE);
  assert.deepEqual(
    stateFromParams({ cat: 'party,nope', players: 'x', time: '45', where: 'moon', sort: 'colour', dir: 'up', nosize: '0' }),
    { ...DEFAULT_STATE, cats: ['party'] },
  );
  assert.equal(stateFromParams({ players: '0' }).players, null);
});

test('activeFilterCount counts switched-on filters, not the sort', () => {
  assert.equal(activeFilterCount(DEFAULT_STATE), 0);
  assert.equal(activeFilterCount({ ...DEFAULT_STATE, cats: ['party', 'coop'], players: 3, sort: 'time' }), 2);
  assert.equal(activeFilterCount({ cats: ['duo'], players: 2, time: 15, where: 'inside', sizeMissing: true, sort: 'title', dir: 'asc' }), 5);
});

test('short location text', async () => {
  const all = await entries();
  const byId = new Map(all.map((e) => [e.game.id, e]));
  const stacked = seed.plan.stacks[0].rows[0][0].game ?? seed.plan.stacks[0].rows[0][0].side[0].game;
  assert.equal(byId.get(stacked).where, seed.plan.stacks[0].id);
  assert.equal(byId.get(stacked).kind, 'shelf');
  const [exp, host] = Object.entries(seed.plan.inside)[0];
  assert.equal(byId.get(exp).where, `In ${store.getGame(host).title}`);
  assert.equal(byId.get(exp).kind, 'inside');
  const cup = seed.plan.cupboard[0].game;
  assert.equal(byId.get(cup).where, 'Cupboard');
  assert.equal(shortLocation({ kind: 'unplaced' }), 'Not placed');
  assert.equal(shortLocation(null), 'Not placed');
  assert.equal(locationKind(null), 'unplaced');
});

test('location filter matches the plan', async () => {
  const all = await entries();
  assert.equal(filter(all, { where: 'cupboard' }).length, seed.plan.cupboard.length);
  assert.equal(filter(all, { where: 'inside' }).length, Object.keys(seed.plan.inside).length);
  assert.equal(filter(all, { where: 'unplaced' }).length, 0);
  assert.equal(
    filter(all, { where: 'shelf' }).length,
    seed.games.length - seed.plan.cupboard.length - Object.keys(seed.plan.inside).length,
  );
  // a game just imported from BGG is not placed yet
  const id = store.addGame({ title: 'Új játék' });
  const fresh = makeEntry(store.getGame(id), store.locate(id), () => '');
  assert.equal(fresh.kind, 'unplaced');
  assert.equal(fresh.where, 'Not placed');
});

test('players filter: games that support that count; unknown players never match', async () => {
  const all = await entries();
  for (const n of [1, 2, 4, 7]) {
    const want = seedIds((g) => g.players && g.players.min <= n && n <= g.players.max);
    assert.deepEqual(ids(filter(all, { players: n })), want, `players ${n}`);
  }
  const unknown = seed.games.filter((g) => !g.players).map((g) => g.id);
  assert.ok(unknown.length > 0);
  assert.ok(!ids(filter(all, { players: 2 })).some((id) => unknown.includes(id)));
});

test('time filter: the whole range must fit; unknown time never matches', async () => {
  const all = await entries();
  for (const t of [15, 30, 60, 120]) {
    assert.deepEqual(ids(filter(all, { time: t })), seedIds((g) => g.time && g.time.max <= t), `≤ ${t}`);
  }
  assert.ok(filter(all, { time: 15 }).length < filter(all, { time: 30 }).length);
});

test('category filter: several categories mean "any of them"; other = no category', async () => {
  const all = await entries();
  assert.deepEqual(ids(filter(all, { cats: ['party'] })), seedIds((g) => g.categories.includes('party')));
  assert.deepEqual(
    ids(filter(all, { cats: ['party', 'coop'] })),
    seedIds((g) => g.categories.includes('party') || g.categories.includes('coop')),
  );
  assert.deepEqual(ids(filter(all, { cats: ['other'] })), seedIds((g) => g.categories.length === 0));
  assert.deepEqual(
    ids(filter(all, { cats: ['duo', 'other'] })),
    seedIds((g) => g.categories.length === 0 || g.categories.includes('duo')),
  );
});

test('size missing finds the games without box dimensions', async () => {
  const all = await entries();
  const found = filter(all, { sizeMissing: true });
  assert.deepEqual(ids(found), seedIds((g) => g.dims === null));
  assert.ok(found.length > 0);
});

test('filters combine (all must hold)', async () => {
  const all = await entries();
  const want = seedIds((g) => g.players && g.players.min <= 2 && 2 <= g.players.max && g.time && g.time.max <= 30 && g.categories.includes('duo'));
  assert.deepEqual(ids(filter(all, { players: 2, time: 30, cats: ['duo'] })), want);
});

test('sorting: title keeps the Hungarian order, direction flips it', async () => {
  const all = await entries();
  const asc = sortEntries(all, 'title', 'asc').map((e) => e.game.title);
  assert.deepEqual(asc, all.map((e) => e.game.title)); // the store already sorts by title
  assert.deepEqual(sortEntries(all, 'title', 'desc').map((e) => e.game.title), [...asc].reverse());
});

test('sorting: unknown players and times always come last, in both directions', async () => {
  const all = await entries();
  for (const sort of ['players', 'time']) {
    const field = sort;
    for (const dir of ['asc', 'desc']) {
      const out = sortEntries(all, sort, dir);
      const firstUnknown = out.findIndex((e) => !e.game[field]);
      assert.ok(firstUnknown > 0, `${sort} ${dir}: unknown ones exist`);
      assert.ok(out.slice(firstUnknown).every((e) => !e.game[field]), `${sort} ${dir}: unknown ones are all at the end`);
    }
  }
  const byTime = sortEntries(all, 'time', 'asc').filter((e) => e.game.time).map((e) => e.game.time.max);
  assert.deepEqual(byTime, [...byTime].sort((a, b) => a - b));
  const byTimeDesc = sortEntries(all, 'time', 'desc').filter((e) => e.game.time).map((e) => e.game.time.max);
  assert.deepEqual(byTimeDesc, [...byTimeDesc].sort((a, b) => b - a));
});

test('sorting by location is natural: B2 before B10', () => {
  const mk = (title, where) => ({ game: { title, players: null, time: null }, kind: 'shelf', where });
  const out = sortEntries([mk('a', 'B10'), mk('b', 'B2'), mk('c', 'Cupboard'), mk('d', 'B1')], 'where', 'asc');
  assert.deepEqual(out.map((e) => e.where), ['B1', 'B2', 'B10', 'Cupboard']);
});

test('sorting does not change its input, and ties fall back to the title', () => {
  const mk = (title, max) => ({ game: { title, players: { min: 2, max }, time: null }, kind: 'shelf', where: 'B1' });
  const input = [mk('Zebra', 4), mk('Alma', 4), mk('Körte', 2)];
  const out = sortEntries(input, 'players', 'desc');
  assert.deepEqual(out.map((e) => e.game.title), ['Alma', 'Zebra', 'Körte']);
  assert.deepEqual(input.map((e) => e.game.title), ['Zebra', 'Alma', 'Körte']);
});

test('countLabel', () => {
  assert.equal(countLabel(0), '0 games');
  assert.equal(countLabel(1), '1 game');
  assert.equal(countLabel(37), '37 games');
});
