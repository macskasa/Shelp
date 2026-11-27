// Backup, restore and plan import (story E2): the parts that need no DOM. Owner: Stephen (Part A).
import { checkData, knownFrom } from '../core/schema.js';
import { blocking, checkPlan2 } from '../rules/index.js';
import { localDate, when } from './time.js';

const count = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

export const backupFileName = (date = new Date()) => `shelp-backup-${localDate(date)}.json`;

/** Parse the text of a .json file. Throws an Error with a readable message. */
export function readJson(text) {
  try {
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new Error('This file is not valid JSON, so it cannot be a Shelp backup or plan.');
  }
}

/** The first `max` problems, and how many more there are. */
export function problemLines(problems, max = 20) {
  return { shown: problems.slice(0, max), more: Math.max(0, problems.length - max) };
}

/**
 * Run the rule checker on the plan of a file that already passed store.validate().
 * The file is upgraded to schema 2 first (checkData); a plan-only file is checked against the games you have now,
 * a full backup against its own games.
 * Returns { blocks, warnings } (lists of checker warnings). blocks are never allowed: the import must stop.
 */
export function reviewImport(obj, currentGames) {
  const { problems, data } = checkData(structuredClone(obj), knownFrom(currentGames));
  if (problems.length || !data?.plan) return { blocks: [], warnings: [] };
  const byId = new Map((data.games ?? currentGames).map((g) => [g.id, g]));
  const found = checkPlan2(data.plan, (id) => byId.get(id));
  const blocks = blocking(found);
  return { blocks, warnings: found.filter((w) => !blocks.includes(w)) };
}

/** The sentence above the list when blocking problems stop an import. */
export const refusalText = (blocks) =>
  `The shelf plan in this file breaks ${blocks.length === 1 ? 'a rule' : `${blocks.length} rules`} that the shelves never allow, so it cannot be imported. Nothing was changed.`;

/** A file with a games list replaces everything; a file with only a plan replaces the plan (same rule as store.importData). */
export const importKind = (obj) => (Array.isArray(obj?.games) ? 'all' : 'plan');

/**
 * What will happen if this (already validated) file is imported?
 * current = { games, stacks, planName } of what the app holds now.
 * review = what reviewImport() found: its warnings are listed in `items` (they do not stop the import).
 * Returns { kind, title, lines, items, confirmLabel }.
 */
export function describeImport(obj, current, review = { warnings: [] }) {
  const stacks = obj.plan?.stacks?.length ?? 0;
  const planName = obj.plan?.name ?? 'unnamed plan';
  const made = when(obj.exportedAt);
  const { shown, more } = problemLines(review.warnings.map((w) => w.message), 8);
  const items = more ? [...shown, `…and ${more} more.`] : shown;
  const note = items.length ? [`The rule checker found ${count(review.warnings.length, 'warning')} in this plan. They do not stop the import:`] : [];
  if (importKind(obj) === 'all') {
    return {
      kind: 'all',
      title: 'Restore this backup?',
      confirmLabel: 'Replace everything',
      lines: [
        `${made ? `Backup made ${made}. ` : ''}It has ${count(obj.games.length, 'game')} and ${count(stacks, 'stack')} (plan “${planName}”).`,
        `It replaces everything you have now: ${current.games} games with their sizes, categories and notes, and the shelf plan (${count(current.stacks, 'stack')}).`,
        'Download a backup first if you may want the current data back.',
        ...note,
      ],
      items,
    };
  }
  const cupboard = obj.plan?.cupboard?.length ?? 0;
  return {
    kind: 'plan',
    title: 'Replace the shelf plan?',
    confirmLabel: 'Replace the plan',
    lines: [
      `This file only holds a shelf plan: “${planName}” with ${count(stacks, 'stack')} and ${count(cupboard, 'game')} in the cupboard.`,
      `It replaces the current plan “${current.planName}” (${count(current.stacks, 'stack')}). Your games, sizes and categories stay as they are.`,
      ...note,
    ],
    items,
  };
}
