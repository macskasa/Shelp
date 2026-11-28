// Join two stacks (part-b6 item 1), the parts without DOM, so Node can test them. Owner: Bruce (Part B).
//   joinNeighbours(plan, id)  the stacks right next to it on its shelf: { left, right } ids or null
//   joinText(plan, a, b)      the confirmation: title, text and the toast, left one first
//   joinFn(store, a, b)       the store call, for store.preview (checkMove) and the real write
// The store decides whether two stacks can be joined (another shelf, a stack between, an overlap, a
// topper); its message is shown as it is.

const byX = (a, b) => a.x - b.x || a.id.localeCompare(b.id);

/** The nearest stack to the left and to the right of a stack on its shelf, or null. */
export function joinNeighbours(plan, stackId) {
  const st = plan?.stacks?.find((s) => s.id === stackId);
  if (!st) return { left: null, right: null };
  const row = plan.stacks.filter((s) => s.zone === st.zone).sort(byX);
  const i = row.indexOf(st);
  return { left: row[i - 1]?.id ?? null, right: row[i + 1]?.id ?? null };
}

/**
 * What the confirmation and the toast say. The left stack keeps its id, whichever was tapped.
 * @returns {{ left, right, title, text, done }}
 */
export function joinText(plan, aId, bId) {
  const a = plan.stacks.find((s) => s.id === aId);
  const b = plan.stacks.find((s) => s.id === bId);
  const [left, right] = a && b && b.x < a.x ? [bId, aId] : [aId, bId];
  return {
    left,
    right,
    title: `Join ${left} and ${right}?`,
    text: `They become one stack, ${left}. Every box stays where it is, and you can then put a box across both tops.`,
    done: `Joined ${right} into ${left}`,
  };
}

export function joinFn(store, aId, bId) {
  return () => store.joinStacks(aId, bId);
}
