// Catalog filtering and sorting (Part C, story A6). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import {
  DEFAULT_STATE, stateFromParams, stateToParams, activeFilterCount, makeEntry, matches, sortEntries,
  shortLocation, locationKind, countLabel, sortTitle, knownFamily, familyOptions, shownFamily, NO_FAMILY, catalogHash,
} from '../js/catalog/filter.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

const titleOf = (id) => store.getGame(id)?.title ?? id;

async function entries() {
  await store.init({ seed, storage: memory() });
  return store.getGames().map((g) => makeEntry(g, store.locate2(g.id), titleOf));
}
const filter = (all, patch) => all.filter((e) => matches(e, { ...DEFAULT_STATE, ...patch }));
const ids = (list) => list.map((e) => e.game.id).sort();
const seedIds = (pred) => seed.games.filter(pred).map((g) => g.id).sort();

test('default state shows every game', async () => {
  const all = await entries();
  assert.equal(filter(all, {}).length, seed.games.length);
});

test('state <-> URL params: round trip, defaults left out, rubbish ignored', () => {
  const state = { q: 'föld és', cats: ['party', 'other'], players: 4, time: 30, where: 'cupboard', pizza: 'any', family: null, sizeMissing: true, sort: 'time', dir: 'desc' };
  const params = stateToParams(state);
  assert.deepEqual(params, { q: 'föld és', cat: 'party,other', players: 4, time: 30, where: 'cupboard', nosize: '1', sort: 'time', dir: 'desc' });
  assert.deepEqual(stateFromParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))), state);
  assert.deepEqual(stateToParams(DEFAULT_STATE), {});
  assert.deepEqual(stateFromParams({}), DEFAULT_STATE);
  assert.deepEqual(
    stateFromParams({ cat: 'party,nope', players: 'x', time: '45', where: 'moon', sort: 'colour', dir: 'up', nosize: '0' }),
    { ...DEFAULT_STATE, cats: ['party'] },
  );
  assert.equal(stateFromParams({ players: '0' }).players, null);
  assert.equal(stateFromParams({ where: 'board' }).where, 'board');
  assert.equal(stateFromParams({ where: 'unplaced' }).where, 'board'); // links from before schema 2
  assert.equal(stateFromParams({ where: 'nowhere' }).where, 'any');
  assert.equal(stateFromParams({ q: '  azul ' }).q, 'azul'); // surrounding spaces are dropped
  assert.equal(stateFromParams({ q: 'x'.repeat(500) }).q.length, 80);
  assert.equal(activeFilterCount({ ...DEFAULT_STATE, q: 'azul' }), 0); // the search field is not a filter
});

test('activeFilterCount counts switched-on filters, not the sort', () => {
  assert.equal(activeFilterCount(DEFAULT_STATE), 0);
  assert.equal(activeFilterCount({ ...DEFAULT_STATE, cats: ['party', 'coop'], players: 3, sort: 'time' }), 2);
  assert.equal(activeFilterCount({ ...DEFAULT_STATE, cats: ['duo'], players: 2, time: 15, where: 'inside', sizeMissing: true, sort: 'title', dir: 'asc' }), 5);
});

test('short location text', async () => {
  const all = await entries();
  const byId = new Map(all.map((e) => [e.game.id, e]));
  const stack = store.getPlan2().stacks[0]; // through the store, so a schema 1 or a schema 2 seed both work
  const stacked = stack.boxes[0].game;
  assert.equal(byId.get(stacked).where, stack.id);
  assert.equal(byId.get(stacked).kind, 'shelf');
  const [exp, host] = Object.entries(seed.plan.inside)[0];
  assert.equal(byId.get(exp).where, `In ${store.getGame(host).title}`);
  assert.equal(byId.get(exp).kind, 'inside');
  const cup = seed.plan.cupboard[0].game;
  assert.equal(byId.get(cup).where, 'Cupboard');
  assert.equal(shortLocation({ kind: 'board', index: 0 }), 'Board');
  assert.equal(shortLocation(null), 'Board');
  assert.equal(locationKind({ kind: 'board', index: 0 }), 'board');
  assert.equal(locationKind(null), 'board'); // no place at all = on the board
});

test('location filter matches the plan', async () => {
  const all = await entries();
  assert.equal(filter(all, { where: 'cupboard' }).length, seed.plan.cupboard.length);
  assert.equal(filter(all, { where: 'inside' }).length, Object.keys(seed.plan.inside).length);
  assert.equal(filter(all, { where: 'board' }).length, 0);
  assert.equal(
    filter(all, { where: 'shelf' }).length,
    seed.games.length - seed.plan.cupboard.length - Object.keys(seed.plan.inside).length,
  );
  // a game just imported from BGG has no place: it is on the board
  const id = store.addGame({ title: 'Új játék' });
  const fresh = makeEntry(store.getGame(id), store.locate2(id), () => '');
  assert.equal(fresh.kind, 'board');
  assert.equal(fresh.where, 'Board');
  const all2 = store.getGames().map((g) => makeEntry(g, store.locate2(g.id), titleOf));
  assert.deepEqual(filter(all2, { where: 'board' }).map((e) => e.game.id), [id]);
  // moving a shelf game to the board shows up too
  store.moveToBoard(store.getPlan2().stacks[0].boxes[0].game);
  const all3 = store.getGames().map((g) => makeEntry(g, store.locate2(g.id), titleOf));
  assert.equal(filter(all3, { where: 'board' }).length, 2);
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

test('sortTitle ignores a leading A / Az / The, only when more text follows', () => {
  assert.equal(sortTitle('A jelszó: Vérfarkas'), 'jelszó: Vérfarkas');
  assert.equal(sortTitle('Az erdő'), 'erdő');
  assert.equal(sortTitle('The Crew: A mélytengeri küldetés'), 'Crew: A mélytengeri küldetés');
  assert.equal(sortTitle('the fox experiment'), 'fox experiment');
  assert.equal(sortTitle('A'), 'A');
  assert.equal(sortTitle('Azul'), 'Azul');
  assert.equal(sortTitle('Avalon'), 'Avalon');
  assert.equal(sortTitle('A-Z játék'), 'A-Z játék');
  assert.equal(sortTitle('7 Csoda'), '7 Csoda');
});

test('sorting: titles sort without their leading article, direction flips it', async () => {
  const all = await entries();
  const collator = new Intl.Collator('hu', { sensitivity: 'base', numeric: true });
  const want = all.map((e) => e.game.title).sort((a, b) => collator.compare(sortTitle(a), sortTitle(b)));
  const asc = sortEntries(all, 'title', 'asc').map((e) => e.game.title);
  assert.deepEqual(asc, want);
  assert.deepEqual(sortEntries(all, 'title', 'desc').map((e) => e.game.title), [...asc].reverse());
  // the point of it: "A jelszó: Vérfarkas" sits among the J titles, not among the A titles
  const at = (t) => asc.indexOf(t);
  assert.ok(at('A jelszó: Vérfarkas') > at('Avalon'));
  assert.ok(at('A jelszó: Vérfarkas') > at('Hitster Christmas'));
  assert.ok(at('Az erdő') > at('Brick Like This!')); // "Az erdő" sorts under E
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

test('pizza filter: any / pizza / not pizza, kept in the URL', () => {
  const mk = (pizza) => ({ game: { id: 'x', title: 'X', pizza, categories: [], dims: null }, kind: 'shelf', where: 'B3' });
  const yes = mk(true);
  const no = mk(false);
  const pass = (e, pizza) => matches(e, { ...DEFAULT_STATE, pizza });
  assert.deepEqual([pass(yes, 'any'), pass(no, 'any')], [true, true]);
  assert.deepEqual([pass(yes, 'yes'), pass(no, 'yes')], [true, false]);
  assert.deepEqual([pass(yes, 'no'), pass(no, 'no')], [false, true]);
  assert.deepEqual(stateToParams({ ...DEFAULT_STATE, pizza: 'yes' }), { pizza: '1' });
  assert.deepEqual(stateToParams({ ...DEFAULT_STATE, pizza: 'no' }), { pizza: '0' });
  assert.equal(stateFromParams({ pizza: '1' }).pizza, 'yes');
  assert.equal(stateFromParams({ pizza: '0' }).pizza, 'no');
  assert.equal(stateFromParams({ pizza: 'x' }).pizza, 'any');
  assert.equal(activeFilterCount({ ...DEFAULT_STATE, pizza: 'yes' }), 1);
});

test('family filter: a name, "-" for no family, URL round trip, Clear resets', async () => {
  const all = await entries();
  const [a, b, c] = store.getGames();
  store.updateGame(a.id, { family: 'Test Fam' });
  store.updateGame(b.id, { family: 'test fam' }); // letter case joins the family
  const withFam = store.getGames().map((g) => makeEntry(g, store.locate2(g.id), titleOf));
  assert.deepEqual(ids(filter(withFam, { family: 'Test Fam' })), [a.id, b.id].sort());
  assert.equal(filter(withFam, { family: NO_FAMILY }).length, all.length - 2);
  assert.equal(filter(withFam, { family: null }).length, all.length);
  assert.ok(ids(filter(withFam, { family: NO_FAMILY })).includes(c.id));
  assert.deepEqual(stateToParams({ ...DEFAULT_STATE, family: 'Test Fam' }), { family: 'Test Fam' });
  assert.deepEqual(stateToParams({ ...DEFAULT_STATE, family: NO_FAMILY }), { family: '-' });
  assert.equal(stateFromParams({ family: '-' }).family, NO_FAMILY);
  assert.equal(stateFromParams({ family: 'Test Fam' }).family, 'Test Fam');
  assert.equal(stateFromParams({ family: '  ' }).family, null);
  assert.equal(activeFilterCount({ ...DEFAULT_STATE, family: '-' }), 1);
});

test('family: unknown family falls back to Any, options list counts, shownFamily', async () => {
  await entries();
  const [a, b] = store.getGames();
  store.updateGame(a.id, { family: 'Azul' });
  store.updateGame(b.id, { family: 'Azul' });
  const fams = store.getFamilies();
  assert.equal(knownFamily({ ...DEFAULT_STATE, family: 'Gone' }, fams).family, null);
  assert.equal(knownFamily({ ...DEFAULT_STATE, family: 'Azul' }, fams).family, 'Azul');
  assert.equal(knownFamily({ ...DEFAULT_STATE, family: '-' }, fams).family, '-');
  assert.deepEqual(familyOptions(fams), ['', 'Any', 'Azul', 'Azul (2)', '-', 'No family']);
  assert.equal(shownFamily({ family: 'Azul' }), 'Azul');
  assert.equal(shownFamily({ family: '-' }), null);
  assert.equal(shownFamily({ family: null }), null);
});

test('search finds a game by its family name', () => {
  const game = { id: 'x', title: 'A Mars terraformálása', family: 'Terraforming Mars', dims: null };
  const e = makeEntry(game, null, titleOf);
  assert.ok(matches(e, { ...DEFAULT_STATE, q: 'mars' }));
  assert.ok(matches(e, { ...DEFAULT_STATE, q: 'terraforming' }));
  assert.ok(!matches(makeEntry({ ...game, family: null }, null, titleOf), { ...DEFAULT_STATE, q: 'terraforming' }));
});

test('a family that fell back to Any is not in the URL hash', () => {
  const fams = [{ name: 'Azul', ids: ['a'] }];
  const state = knownFamily({ ...DEFAULT_STATE, family: 'Gone', q: 'x' }, fams);
  assert.equal(catalogHash(state), '#/catalog?q=x');
  assert.equal(catalogHash(knownFamily({ ...DEFAULT_STATE, family: 'Azul' }, fams)), '#/catalog?family=Azul');
  assert.equal(catalogHash(DEFAULT_STATE), '#/catalog');
});
