// Apply a planned BGG import to the store, all in one batch. Owner: Stephen (Part A).
import * as store from '../core/store.js';
import { newGameFields } from './bgg.js';

/**
 * plan:    from planImport()
 * choices: { addIds, keepIds, deleteIds }
 *   addIds     bggIds of the new (or earlier ignored) rows Adam ticked; the other new rows are remembered as ignored
 *   keepIds    ids of missing games to keep, marked as not in BGG
 *   deleteIds  ids of missing games to delete (the only way anything is ever deleted)
 *   Missing games that are in neither list are left alone.
 * Returns { updated, added, kept, deleted }. Throws (and changes nothing) if the store refuses a change.
 */
export function applyImport(plan, { addIds = [], keepIds = [], deleteIds = [] } = {}, now = new Date()) {
  const add = new Set(addIds);
  const ignored = new Set(plan.prevIgnored);
  let added = 0;

  store.batch(() => {
    for (const u of plan.updates) store.updateGame(u.id, u.patch);

    for (const row of [...plan.fresh, ...plan.ignored]) {
      if (add.has(row.bggId)) {
        store.addGame(newGameFields(row));
        ignored.delete(row.bggId);
        added++;
      } else {
        ignored.add(row.bggId);
      }
    }
    const nextIgnored = [...ignored].sort((a, b) => a - b);
    if (JSON.stringify(nextIgnored) !== JSON.stringify(plan.prevIgnored)) store.setMeta('bggIgnored', nextIgnored);

    for (const id of keepIds) store.updateGame(id, { inBgg: false });
    for (const id of deleteIds) store.removeGame(id);
    store.setMeta('lastImport', now.toISOString());
  });
  return { updated: plan.updates.length, added, kept: keepIds.length, deleted: deleteIds.length };
}
