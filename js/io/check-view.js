// The "Plan check" card on the Data screen (story D2). Owner: Stephen (Part A).
// Schema 2: problems are grouped into "Must fix" (block) and "Warnings" (warn).
import { h, clear } from '../core/dom.js';
import * as store from '../core/store.js';
import { showStack } from '../core/contracts.js';
import { ZONES } from '../core/shelves.js';
import { checkPlan2, groupWarnings, boardLine } from '../rules/index.js';

export function checkSection() {
  const body = h('div', { class: 'io-check', 'aria-live': 'polite' });

  function stackGroup({ stackId, list }) {
    const stack = store.getStack2(stackId);
    return h('div', { class: 'io-group io-check-group' },
      h('div', { class: 'io-check-head' },
        h('strong', {}, `Stack ${stackId}`), h('span', { class: 'muted' }, ` · ${ZONES[stack?.zone]?.label ?? ''}`),
        h('button', { type: 'button', class: 'btn', onclick: () => showStack(stackId) }, 'Show stack')),
      h('ul', { class: 'io-changes' }, list.map((w) => h('li', {}, w.message))));
  }

  function refresh() {
    const plan = store.getPlan2();
    const warnings = checkPlan2(plan, store.getGame);
    const { block, warn } = groupWarnings(warnings);
    const onBoard = boardLine(store.getBoard().length);
    const info = onBoard ? h('p', { class: 'io-info' }, `ℹ ${onBoard}`) : null;

    if (!warnings.length) {
      clear(body).append(h('p', { class: 'io-ok' }, '✓ No problems found'),
        h('p', { class: 'muted' }, `${plan.stacks.length} stacks checked against the shelf rules.`), info);
      return;
    }
    const count = (groups) => groups.reduce((n, g) => n + g.list.length, 0);
    const section = (title, groups, cls) => (groups.length
      ? h('div', { class: `io-check-section ${cls}` },
        h('h3', {}, `${title} (${count(groups)})`),
        ...groups.map(stackGroup))
      : null);
    clear(body).append(
      section('Must fix', block, 'io-check-block'),
      section('Warnings', warn, 'io-check-warn'),
      info);
  }

  refresh();
  return {
    el: h('section', { class: 'card io-section' },
      h('h2', {}, 'Plan check'),
      h('p', { class: 'muted' }, 'Checks the shelf plan against the shelf rules from the planning chat. "Must fix" problems are never allowed; warnings can stay if you accept them.'),
      body),
    refresh,
  };
}
