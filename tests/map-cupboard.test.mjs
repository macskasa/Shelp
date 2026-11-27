// Part B cupboard tests (story C6). Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { offShelf, stackChoices, positionChoices, previewPlacement, stackWarnings } from '../js/map/cupboard.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const mem = new Map();
await store.init({ seed, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
const getGame = store.getGame;
const byTitle = (t) => store.getGames().find((g) => g.title === t).id;

test('off the shelf: the 15 cupboard games with their reasons, nothing unplaced in the seed', () => {
  const { cupboard, unplaced } = offShelf(store.getGames(), store.locate);
  assert.equal(cupboard.length, 15);
  assert.equal(unplaced.length, 0);
  const big = cupboard.find((c) => c.game.id === 'g028');
  assert.equal(big.reason, 'No room – the bulkiest box (43.5 cm wide)');
  // listed in the store's title order
  const titles = cupboard.map((c) => c.game.title);
  assert.deepEqual(titles, store.getGames().filter((g) => titles.includes(g.title)).map((g) => g.title));
});

test('a new game (e.g. from a BGG import) shows up as not placed yet', () => {
  const games = [...store.getGames(), { id: 'gNEW', title: 'New one', dims: null, categories: [] }];
  const locate = (id) => (id === 'gNEW' ? { kind: 'unplaced' } : store.locate(id));
  const { unplaced } = offShelf(games, locate);
  assert.deepEqual(unplaced.map((u) => u.game.id), ['gNEW']);
});

test('stack choices: grouped by shelf in drawing order, left to right, with the current height', () => {
  const groups = stackChoices(store.getPlan(), getGame);
  assert.deepEqual(groups.map((g) => g.label), [
    'Top shelf', 'Middle shelf', 'Bottom shelf',
    'Under the stairs – card games', 'Under the stairs – tall part', 'Under the stairs – tall gap', 'Narrow shelf',
  ]);
  assert.deepEqual(groups[2].stacks.map((s) => s.id), ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']);
  const b3 = groups[2].stacks[2];
  assert.equal(b3.height, 27.7);
  assert.equal(b3.limit, 36.5);
  assert.equal(b3.topper, null);
  const m3 = groups[1].stacks.find((s) => s.id === 'M3');
  assert.deepEqual([m3.height, m3.limit, m3.topper], [31.8, 37.5, 'Bonsai'], 'a topper may reach the shelf above');
  assert.equal(groups[0].stacks[0].rows, 2, 'T1 is 2 deep');
  assert.equal(groups[0].stacks.at(-1).standing, true, 'T9 KLASK stands');
});

test('positions: bottom → top for flat stacks (side groups named together), left → right for standing ones', () => {
  const b3 = store.getStack('B3');
  const pos = positionChoices(b3, 0, getGame);
  assert.equal(pos.length, 5);
  assert.deepEqual(pos[0], { index: 0, label: 'At the bottom' });
  assert.equal(pos[1].label, "Above Let's Go! To Japan");
  assert.deepEqual(pos.at(-1), { index: 4, label: 'On top' });
  assert.equal(pos[3].label, 'Above Takenokolor');
  const l1 = positionChoices(store.getStack('L1'), 1, getGame);
  assert.equal(l1[0].label, 'At the left end');
  assert.equal(l1.at(-1).label, 'At the right end');
  assert.ok(l1[1].label.startsWith('Right of '));
  const empty = positionChoices({ id: 'E', orientation: 'flat', rows: [[]] }, 0, getGame);
  assert.deepEqual(empty, [{ index: 0, label: 'On the shelf' }]);
});

test('preview: a T.I.M.E Stories expansion fits on M3 under the bonsai without warnings', () => {
  const id = byTitle('T.I.M.E Stories: Lumen Fidei'); // 20.6 × 20.6 × 4 cm
  const p = previewPlacement(store.getPlan(), getGame, id, 'M3');
  assert.deepEqual(p.warnings, []);
  assert.equal(p.height, 35.8, 'today 31.8 with the bonsai, plus 4 cm');
});

test('preview: the bulkiest box on top of T2 breaks the rules, and the warnings are new', () => {
  const p = previewPlacement(store.getPlan(), getGame, 'g028', 'T2');
  const rules = p.warnings.map((w) => w.rule);
  assert.ok(rules.includes('stacking'), rules.join(','));
  assert.ok(p.warnings.every((w) => w.isNew));
  assert.ok(p.height > 29.5, 'taller than today');
  // the store's plan is not changed by a preview
  assert.ok(!store.getStack('T2').rows[0].some((it) => it.game === 'g028'));
  assert.equal(store.locate('g028').kind, 'cupboard');
});

test('preview: growing into the neighbour is caught, though the checker reports it on the neighbour', () => {
  // the 43.5 cm wide box at the bottom of T2 (23–36.5 cm) reaches far into T3
  const p = previewPlacement(store.getPlan(), getGame, 'g028', 'T2', { index: 0 });
  const overlap = p.warnings.find((w) => w.rule === 'overlap');
  assert.ok(overlap, p.warnings.map((w) => w.rule).join(','));
  assert.equal(overlap.stackId, 'T3');
  assert.equal(overlap.isNew, true);
});

test('preview: a problem the stack already had is not marked new', () => {
  const plan = structuredClone(store.getPlan());
  plan.stacks.find((s) => s.id === 'T2').rows[0].push({ game: 'g028' }); // T2 already breaks the rules
  plan.cupboard = plan.cupboard.filter((c) => c.game !== 'g028');
  const p = previewPlacement(plan, getGame, 'g001', 'T2');
  const old = p.warnings.filter((w) => !w.isNew);
  assert.ok(old.length >= 1, 'existing warnings are listed and marked');
  assert.ok(old.every((w) => w.stackId === 'T2'));
});

test('stack warnings: none on today\'s plan, overlaps included when there are some', () => {
  for (const st of store.getPlan().stacks) assert.deepEqual(stackWarnings(store.getPlan(), getGame, st.id), [], st.id);
  const plan = structuredClone(store.getPlan());
  plan.stacks.find((s) => s.id === 'T3').x = 30; // T3 now starts inside T2
  assert.ok(stackWarnings(plan, getGame, 'T3').some((w) => w.rule === 'overlap'));
});

test('preview of an unknown stack or row is empty', () => {
  assert.deepEqual(previewPlacement(store.getPlan(), getGame, 'g028', 'ZZ'), { height: 0, warnings: [] });
  assert.deepEqual(previewPlacement(store.getPlan(), getGame, 'g028', 'B3', { row: 1 }), { height: 0, warnings: [] });
});
