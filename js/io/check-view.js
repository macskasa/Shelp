// The "Plan check" card on the Data screen (story D2). Owner: Stephen (Part A).
import { h, clear } from '../core/dom.js';
import * as store from '../core/store.js';
import { showStack } from '../core/contracts.js';
import { ZONES } from '../core/shelves.js';
import { checkPlan } from '../rules/index.js';

export function checkSection() {
  const body = h('div', { class: 'io-check', 'aria-live': 'polite' });

  function refresh() {
    const plan = store.getPlan();
    const warnings = checkPlan(plan, store.getGame);
    const groups = new Map(); // stackId -> warnings, in plan order
    for (const w of warnings) groups.set(w.stackId, [...(groups.get(w.stackId) ?? []), w]);

    if (!warnings.length) {
      clear(body).append(h('p', { class: 'io-ok' }, '✓ No problems found'),
        h('p', { class: 'muted' }, `${plan.stacks.length} stacks checked against the shelf rules.`));
      return;
    }
    clear(body).append(
      h('p', { class: 'io-summary' }, h('strong', {}, `${warnings.length} warning${warnings.length > 1 ? 's' : ''} in ${groups.size} stack${groups.size > 1 ? 's' : ''}`)),
      ...[...groups].map(([stackId, list]) => {
        const stack = store.getStack(stackId);
        return h('div', { class: 'io-group io-check-group' },
          h('div', { class: 'io-check-head' },
            h('strong', {}, `Stack ${stackId}`), h('span', { class: 'muted' }, ` · ${ZONES[stack?.zone]?.label ?? ''}`),
            h('button', { type: 'button', class: 'btn', onclick: () => showStack(stackId) }, 'Show stack')),
          h('ul', { class: 'io-changes' }, list.map((w) => h('li', {}, w.message))));
      }));
  }

  refresh();
  return {
    el: h('section', { class: 'card io-section' },
      h('h2', {}, 'Plan check'),
      h('p', { class: 'muted' }, 'Checks the shelf plan against the stacking, height, bracket, length, depth and reach rules from the planning chat.'),
      body),
    refresh,
  };
}
