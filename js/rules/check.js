// Rule checker (story D2). Pure functions, no DOM. Owner: Stephen (Part A).
// The rules come from the planning sessions (docs/part-a2.md). The geometry comes from js/map/model.js, read-only.
//
//   checkStack(stack, getGame) -> Warning[]   one stack, without the overlap rule (that needs the other stacks)
//   checkPlan(plan, getGame)   -> Warning[]   every stack, plus overlaps between stacks of one zone
//   Warning = { stackId, gameId /* or null */, rule, message }
import { STACK_TOLERANCE, ZONES, bracketLimit, isEasy } from '../core/shelves.js';
import { layoutStack } from '../map/model.js';

export const RULES = ['size-missing', 'stacking', 'height', 'bracket', 'length', 'overlap', 'depth', 'two-deep', 'standing'];

const SLACK = 0.01; // cm: measurements are rounded, so compare with a little room
const DEPTH_ALLOWANCE = 0.5; // a stack may stick out 0.5 cm past the front of the shelf depth
const TOPPER_GAP = 0.5; // a topper (the LEGO castle) may go up to 0.5 cm below the shelf above
const BRACKET_HALF = 0.2; // brackets are 0.4 cm wide, centred on the joint

const fmt = (n) => String(Math.round(n * 10) / 10);
const sizeText = (w, d) => `${fmt(Math.max(w, d))} × ${fmt(Math.min(w, d))}`;

/** One level of a flat stack: the boxes that share a floor. Width adds up, depth is the deepest box. */
function levels(layout, rowCount) {
  const out = [];
  for (let r = 0; r < rowCount; r++) {
    const rowBoxes = layout.boxes.filter((b) => b.row === r);
    const last = rowBoxes.reduce((m, b) => Math.max(m, b.index), -1);
    const list = [];
    for (let i = 0; i <= last; i++) {
      const boxes = rowBoxes.filter((b) => b.index === i);
      if (boxes.length) list.push({ boxes, w: boxes.reduce((s, b) => s + b.w, 0), d: Math.max(...boxes.map((b) => b.d)) });
    }
    out.push(list);
  }
  return out;
}

/** Checks of one stack. */
export function checkStack(stack, getGame) {
  const zone = ZONES[stack.zone];
  if (!zone) return [];
  const layout = layoutStack(stack, getGame);
  const title = (id) => getGame(id)?.title ?? id;
  const names = (level) => level.boxes.map((b) => title(b.gameId)).join(' + ');
  const out = [];
  const warn = (rule, message, gameId = null) => out.push({ stackId: stack.id, gameId, rule, message });
  const flat = stack.orientation !== 'standing';
  const boxCount = layout.boxes.length;
  const end = stack.x + layout.w;

  // 1. size missing
  for (const b of layout.boxes) {
    if (b.missing) warn('size-missing', `${title(b.gameId)} has no box size yet, so stack ${stack.id} cannot be fully checked.`, b.gameId);
  }

  // 2. stacking: each level at most 1 cm wider and 1 cm deeper than the one under it (each row on its own)
  if (flat) {
    for (const row of levels(layout, stack.rows.length)) {
      for (let i = 1; i < row.length; i++) {
        const [under, over] = [row[i - 1], row[i]];
        if (over.boxes.some((b) => b.missing) || under.boxes.some((b) => b.missing)) continue; // sizes are guesses
        if (over.w > under.w + STACK_TOLERANCE + SLACK || over.d > under.d + STACK_TOLERANCE + SLACK) {
          warn('stacking',
            `${names(over)} (${sizeText(over.w, over.d)}) is more than ${fmt(STACK_TOLERANCE)} cm wider or deeper than ${names(under)} (${sizeText(under.w, under.d)}) under it.`,
            over.boxes[0].gameId);
        }
      }
    }
  }

  // 3. height (a topper may go right up to the shelf above)
  const limit = stack.topper ? zone.height - TOPPER_GAP : zone.usable;
  if (layout.h > limit + SLACK) {
    warn('height', `Stack ${stack.id} is ${fmt(layout.h)} cm tall${stack.topper ? ` with the ${stack.topper.label}` : ''}, but the ${zone.label} allows ${fmt(limit)} cm.`);
  }

  // 4. brackets: where the stack crosses one it must be low enough for its depth
  const crossed = zone.brackets.filter((bx) => stack.x + SLACK < bx + BRACKET_HALF && end - SLACK > bx - BRACKET_HALF);
  const bracketMax = bracketLimit(zone, layout.d);
  if (crossed.length && layout.h > bracketMax + SLACK) {
    warn('bracket', `Stack ${stack.id} is ${fmt(layout.h)} cm tall where it crosses the bracket at ${crossed.map(fmt).join(' and ')} cm, but ${fmt(bracketMax)} cm is the most for a stack ${fmt(layout.d)} cm deep.`);
  }

  // 5. length: up to the wall end plus the overhang
  const lastX = zone.length + zone.overhang;
  if (end > lastX + SLACK) {
    warn('length', `Stack ${stack.id} reaches ${fmt(end)} cm, but the ${zone.label} ends at ${fmt(lastX)} cm.`);
  }

  // 7. depth (a single standing box such as KLASK sticks out on purpose)
  const single = !flat && boxCount === 1;
  if (!single && layout.d > zone.depth + DEPTH_ALLOWANCE + SLACK) {
    warn('depth', `Stack ${stack.id} is ${fmt(layout.d)} cm deep, but the ${zone.label} is ${fmt(zone.depth)} cm deep (up to ${fmt(zone.depth + DEPTH_ALLOWANCE)} cm is allowed).`);
  }

  // 8. two deep only where it is easy to reach
  if (stack.rows.length === 2 && !isEasy(stack.zone, stack.x, layout.w)) {
    warn('two-deep', `Stack ${stack.id} is two rows deep, but ${fmt(stack.x)}–${fmt(end)} cm on the ${zone.label} is hard to reach.`);
  }

  // 9. standing only where it belongs
  if (zone.standingOnly && flat) {
    warn('standing', `Stack ${stack.id} lies flat, but the ${zone.label} only takes games standing like books.`);
  } else if (!flat && !zone.standingOnly && boxCount !== 1) {
    warn('standing', `Stack ${stack.id} stands like books, but only the card-game shelf under the stairs and single tall boxes (KLASK, Ice Cool) may.`);
  }
  return out;
}

/** Rule 6: within a zone, every stack starts at or after the end of the one before it. */
function overlaps(plan, getGame) {
  const found = new Map(); // stackId -> warning
  const byZone = new Map();
  for (const st of plan.stacks) byZone.set(st.zone, [...(byZone.get(st.zone) ?? []), st]);
  for (const list of byZone.values()) {
    const sorted = [...list].sort((a, b) => a.x - b.x);
    let prev = null; // the stack that reaches furthest so far
    let prevEnd = -Infinity;
    for (const st of sorted) {
      if (prev && st.x < prevEnd - SLACK) {
        found.set(st.id, {
          stackId: st.id, gameId: null, rule: 'overlap',
          message: `Stack ${st.id} starts at ${fmt(st.x)} cm, but stack ${prev.id} still takes space until ${fmt(prevEnd)} cm.`,
        });
      }
      const stEnd = st.x + layoutStack(st, getGame).w;
      if (stEnd > prevEnd) { prev = st; prevEnd = stEnd; }
    }
  }
  return found;
}

/** Checks of the whole plan: every stack, and overlaps. Warnings of one stack stay together, in plan order. */
export function checkPlan(plan, getGame) {
  const over = overlaps(plan, getGame);
  return plan.stacks.flatMap((st) => [...checkStack(st, getGame), ...(over.has(st.id) ? [over.get(st.id)] : [])]);
}
