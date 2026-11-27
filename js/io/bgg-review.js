// The review lists of a BGG import: updated, new, missing. Owner: Stephen (Part A).
// reviewView(plan, onChange) -> { el, choices() }   choices() = { addIds, keepIds, deleteIds }, see apply.js
import { h } from '../core/dom.js';
import { formatRange } from '../core/format.js';

const rowMeta = (r) => [r.type === 'expansion' ? 'Expansion' : 'Base game', r.players && `${formatRange(r.players)} players`]
  .filter(Boolean).join(' · ');

export function reviewView(plan, onChange) {
  const boxes = new Map(); // bggId -> checkbox
  const picks = new Map(); // game id -> select

  const candidate = (row, checked) => {
    const box = h('input', { type: 'checkbox', checked, onchange: onChange });
    boxes.set(row.bggId, box);
    return h('label', { class: 'io-row' }, box,
      h('span', { class: 'io-row-text' }, h('strong', {}, row.name), h('span', { class: 'muted' }, rowMeta(row))));
  };

  const missingRow = (m) => {
    const select = h('select', { 'aria-label': `What to do with ${m.title}`, onchange: onChange },
      h('option', { value: 'later' }, 'Decide later'),
      h('option', { value: 'keep' }, 'Keep, not in BGG'),
      h('option', { value: 'delete' }, 'Delete game'));
    picks.set(m.id, select);
    return h('div', { class: 'io-row' }, h('span', { class: 'io-row-text' }, h('strong', {}, m.title)), select);
  };

  const setAll = (value) => () => {
    for (const s of picks.values()) s.value = value;
    onChange();
  };

  const parts = [];

  if (plan.updates.length) {
    parts.push(h('details', { class: 'io-group' },
      h('summary', {}, `${plan.updates.length} updated`),
      h('ul', { class: 'io-changes' },
        plan.updates.map((u) => h('li', {}, h('strong', {}, u.title), ': ', u.changes.join(', '))))));
  }

  if (plan.fresh.length || plan.ignored.length) {
    const ignoredList = h('div', { class: 'io-list', hidden: true },
      h('p', { class: 'muted' }, 'You skipped these in an earlier import. Tick one to add it now.'),
      plan.ignored.map((r) => candidate(r, false)));
    parts.push(h('fieldset', { class: 'io-group' },
      h('legend', {}, `${plan.fresh.length} new in BGG`),
      plan.fresh.length
        ? h('p', { class: 'muted' }, 'Tick the ones to add. They start without a place on the shelves. Unticked ones are remembered, so the next import does not ask again.')
        : h('p', { class: 'muted' }, 'Nothing new.'),
      h('div', { class: 'io-list' }, plan.fresh.map((r) => candidate(r, true))),
      plan.ignored.length
        ? h('button', {
          type: 'button', class: 'btn', 'aria-expanded': 'false',
          onclick: (e) => {
            ignoredList.hidden = !ignoredList.hidden;
            e.currentTarget.setAttribute('aria-expanded', String(!ignoredList.hidden));
            e.currentTarget.textContent = ignoredList.hidden ? `Show ignored (${plan.ignored.length})` : 'Hide ignored';
          },
        }, `Show ignored (${plan.ignored.length})`)
        : null,
      ignoredList));
  }

  if (plan.missing.length) {
    parts.push(h('fieldset', { class: 'io-group' },
      h('legend', {}, `${plan.missing.length} missing from BGG`),
      h('p', { class: 'muted' }, 'In the app as BGG games, but not in this file. Nothing is deleted unless you choose “Delete game”.'),
      h('div', { class: 'io-bulk' },
        h('button', { type: 'button', class: 'btn', onclick: setAll('keep') }, 'Keep all'),
        h('button', { type: 'button', class: 'btn', onclick: setAll('later') }, 'Decide all later')),
      h('div', { class: 'io-list' }, plan.missing.map(missingRow))));
  }

  return {
    el: h('div', { class: 'io-review' }, parts),
    choices() {
      const ids = (value) => [...picks].filter(([, s]) => s.value === value).map(([id]) => id);
      return {
        addIds: [...boxes].filter(([, b]) => b.checked).map(([bggId]) => bggId),
        keepIds: ids('keep'),
        deleteIds: ids('delete'),
      };
    },
  };
}
