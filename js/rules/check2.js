// Rule checker v2 for schema 2 plans (story D2, Phase B). Pure functions, no DOM. Owner: Stephen (Part A).
// The rules are in docs/CONTEXT.md section 3. The geometry comes from js/core/geometry.js (layoutStack2).
//
//   checkStack2(stack, getGame) -> Warning[]   one v2 stack, without the overlap rule (that needs the other stacks)
//   checkPlan2(plan, getGame)   -> Warning[]   every stack, plus overlaps between stacks of one zone
//   Warning = { stackId, gameId /* or null */, otherStackId /* overlaps, else null */, rule, severity, message }
//   severity 'block': never allowed (the moving screens offer no "place anyway")   'warn': allowed with "place anyway"
//
// One overlap warning is made per pair of stacks: stackId is the stack that starts later, otherStackId the other one.
// Use forStack() to show it on both. A stack taller than the physical shelf gap gets 'shelf-height' only, not 'height' too.
import { STACK_TOLERANCE, ZONES, bracketLimit, isEasy } from '../core/shelves.js';
import { layoutStack2 } from '../core/geometry.js';

/** Severity of every rule, in the order the rules are listed in CONTEXT section 3. */
export const SEVERITY = {
  'size-missing': 'block',
  pizza: 'block',
  overlap: 'block',
  length: 'block',
  'shelf-height': 'block',
  'bridge-level': 'block',
  height: 'warn',
  bracket: 'warn',
  stacking: 'warn',
  depth: 'warn',
  'two-deep': 'warn',
  'bridge-support': 'warn',
};
export const RULES2 = Object.keys(SEVERITY);

const SLACK = 0.01; // cm: measurements are rounded, so compare with a little room
const DEPTH_ALLOWANCE = 0.5; // a stack may stick out 0.5 cm past the front of the shelf depth
const TOPPER_GAP = 0.5; // a topper (the LEGO castle) may go up to 0.5 cm below the shelf above
const BRACKET_HALF = 0.2; // brackets are 0.4 cm wide, centred on the joint
const BRIDGE_LEVEL = 0.5; // the two supports of a bridge may differ by this much in height
const BRIDGE_GAP = 1 / 3; // the gap between the two supports, as a share of the bridge's width

const fmt = (n) => String(Math.round(n * 10) / 10);
const sizeText = (w, d) => `${fmt(Math.max(w, d))} × ${fmt(Math.min(w, d))}`;
const UP_TEXT = { s: 'flat', m: 'on its side', l: 'on end' };

/** Checks of one stack. */
export function checkStack2(stack, getGame) {
  const zone = ZONES[stack.zone];
  if (!zone) return [];
  const layout = layoutStack2(stack, getGame);
  const title = (id) => getGame(id)?.title ?? id;
  const names = (boxes) => boxes.map((b) => title(b.gameId)).join(' + ');
  const out = [];
  const add = (rule, message, gameId = null) =>
    out.push({ stackId: stack.id, gameId, otherStackId: null, rule, severity: SEVERITY[rule], message });
  const byGame = new Map(layout.boxes.map((b) => [b.gameId, b]));
  const missing = new Set(layout.boxes.filter((b) => getGame(b.gameId)?.dims == null).map((b) => b.gameId));
  const end = stack.x + layout.w;

  // block: a game without a box size cannot be on a shelf (the store refuses it too: a safety net)
  for (const b of layout.boxes) {
    if (missing.has(b.gameId)) add('size-missing', `${title(b.gameId)} has no box size yet, so it cannot be on stack ${stack.id}.`, b.gameId);
  }

  // block: a pizza game only lies flat
  for (const b of layout.boxes) {
    if (getGame(b.gameId)?.pizza === true && b.up !== 's') {
      add('pizza', `${title(b.gameId)} is a pizza game and may only lie flat, but it is ${UP_TEXT[b.up] ?? b.up} in stack ${stack.id}.`, b.gameId);
    }
  }

  // block: length, up to the wall end plus the overhang
  const lastX = zone.length + zone.overhang;
  if (end > lastX + SLACK) {
    add('length', `Stack ${stack.id} reaches ${fmt(end)} cm, but the ${zone.label} ends at ${fmt(lastX)} cm.`);
  }

  // block: taller than the physical shelf gap (a topper counts)
  const tooTall = layout.h > zone.height + SLACK;
  if (tooTall) {
    add('shelf-height', `Stack ${stack.id} is ${fmt(layout.h)} cm tall${stack.topper ? ` with the ${stack.topper.label}` : ''}, but the ${zone.label} is only ${fmt(zone.height)} cm high.`);
  }

  // block: a bridge whose two supports differ in height would tilt
  const bridges = [];
  for (const b of layout.boxes) {
    if (b.on.length !== 2) continue;
    const [p1, p2] = b.on.map((id) => byGame.get(id)).filter(Boolean).sort((a, c) => a.x - c.x);
    if (!p1 || !p2 || [b.gameId, p1.gameId, p2.gameId].some((id) => missing.has(id))) continue;
    bridges.push({ b, p1, p2 });
    const diff = Math.abs(p1.y + p1.h - (p2.y + p2.h));
    if (diff > BRIDGE_LEVEL + SLACK) {
      add('bridge-level', `${title(b.gameId)} lies across ${title(p1.gameId)} and ${title(p2.gameId)}, but their tops differ by ${fmt(diff)} cm (at most ${fmt(BRIDGE_LEVEL)} cm), so it would tilt.`, b.gameId);
    }
  }

  // warn: usable height (a topper may go right up to the shelf above). Not repeated when the shelf-height block fired.
  const limit = stack.topper ? zone.height - TOPPER_GAP : zone.usable;
  if (!tooTall && layout.h > limit + SLACK) {
    add('height', `Stack ${stack.id} is ${fmt(layout.h)} cm tall${stack.topper ? ` with the ${stack.topper.label}` : ''}, but the ${zone.label} allows ${fmt(limit)} cm.`);
  }

  // warn: where the stack crosses a bracket it must be low enough for its depth
  const crossed = zone.brackets.filter((bx) => stack.x + SLACK < bx + BRACKET_HALF && end - SLACK > bx - BRACKET_HALF);
  const bracketMax = bracketLimit(zone, layout.d);
  if (crossed.length && layout.h > bracketMax + SLACK) {
    add('bracket', `Stack ${stack.id} is ${fmt(layout.h)} cm tall where it crosses the bracket at ${crossed.map(fmt).join(' and ')} cm, but ${fmt(bracketMax)} cm is the most for a stack ${fmt(layout.d)} cm deep.`);
  }

  // warn: the 1 cm rule. The boxes resting on one box together stay within its width + 1 cm and its depth + 1 cm.
  // A bridge is measured from the outer edges of its two supports.
  const over = (spanLo, spanHi, spanD, kids) => {
    const lo = Math.min(...kids.map((k) => k.x));
    const hi = Math.max(...kids.map((k) => k.x + k.w));
    return {
      side: Math.max(0, spanLo - lo) + Math.max(0, hi - spanHi), // how far they stick out along the shelf
      deep: Math.max(0, Math.max(...kids.map((k) => k.d)) - spanD), // and at the back
    };
  };
  const stickOut = (kids, under, { side, deep }) => {
    if (side <= STACK_TOLERANCE + SLACK && deep <= STACK_TOLERANCE + SLACK) return;
    const parts = [];
    if (side > STACK_TOLERANCE + SLACK) parts.push(`${fmt(side)} cm along the shelf`);
    if (deep > STACK_TOLERANCE + SLACK) parts.push(`${fmt(deep)} cm at the back`);
    add('stacking',
      `${names(kids)} (${sizeText(kids.reduce((s, k) => s + k.w, 0), Math.max(...kids.map((k) => k.d)))}) stick${kids.length === 1 ? 's' : ''} out ${parts.join(' and ')} over ${under}, but ${fmt(STACK_TOLERANCE)} cm is the most.`,
      kids[0].gameId);
  };
  const resting = new Map(); // support id -> boxes that rest on this one box only
  for (const b of layout.boxes) {
    if (b.on.length !== 1 || !byGame.has(b.on[0])) continue;
    resting.set(b.on[0], [...(resting.get(b.on[0]) ?? []), b]);
  }
  for (const [id, kids] of resting) {
    const p = byGame.get(id);
    if (missing.has(id) || kids.some((k) => missing.has(k.gameId))) continue; // sizes are guesses
    stickOut(kids, title(id), over(p.x, p.x + p.w, p.d, kids));
  }
  for (const { b, p1, p2 } of bridges) {
    const spanLo = Math.min(p1.x, p2.x);
    const spanHi = Math.max(p1.x + p1.w, p2.x + p2.w);
    stickOut([b], `${title(p1.gameId)} and ${title(p2.gameId)}`, over(spanLo, spanHi, Math.max(p1.d, p2.d), [b]));
  }

  // warn: deeper than the shelf (a stack of one standing box, like KLASK, may stick out)
  const lone = layout.boxes.length === 1 && layout.boxes[0].up !== 's';
  if (!lone && layout.d > zone.depth + DEPTH_ALLOWANCE + SLACK) {
    add('depth', `Stack ${stack.id} is ${fmt(layout.d)} cm deep, but the ${zone.label} is ${fmt(zone.depth)} cm deep (up to ${fmt(zone.depth + DEPTH_ALLOWANCE)} cm is allowed).`);
  }

  // warn: two rows only where it is easy to reach
  if (layout.rows === 2 && !isEasy(stack.zone, stack.x, layout.w)) {
    add('two-deep', `Stack ${stack.id} is two rows deep, but ${fmt(stack.x)}–${fmt(end)} cm on the ${zone.label} is hard to reach.`);
  }

  // warn: a bridge needs its centre over the supports and a small gap between them
  for (const { b, p1, p2 } of bridges) {
    const spanLo = Math.min(p1.x, p2.x);
    const spanHi = Math.max(p1.x + p1.w, p2.x + p2.w);
    const gap = Math.max(0, p2.x - (p1.x + p1.w));
    const centre = b.x + b.w / 2;
    const reasons = [];
    if (centre < spanLo - SLACK || centre > spanHi + SLACK) reasons.push('its centre is not over the supports');
    if (gap > b.w * BRIDGE_GAP + SLACK) reasons.push(`the gap between them is ${fmt(gap)} cm, more than a third of its ${fmt(b.w)} cm width`);
    if (reasons.length) {
      add('bridge-support', `${title(b.gameId)} lies across ${title(p1.gameId)} and ${title(p2.gameId)}, but ${reasons.join(' and ')}.`, b.gameId);
    }
  }
  return out;
}

/** Overlaps: within a zone two stacks may not share space. One warning per pair, on the stack that starts later. */
function overlaps2(plan, getGame) {
  const found = new Map(); // stackId -> warnings
  const byZone = new Map();
  for (const st of plan.stacks) {
    if (!st.boxes?.length) continue;
    byZone.set(st.zone, [...(byZone.get(st.zone) ?? []), { st, end: st.x + layoutStack2(st, getGame).w }]);
  }
  for (const list of byZone.values()) {
    const sorted = [...list].sort((a, b) => a.st.x - b.st.x);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].st.x < sorted[i].end - SLACK; j++) {
        const [a, b] = [sorted[i], sorted[j]];
        found.set(b.st.id, [...(found.get(b.st.id) ?? []), {
          stackId: b.st.id, gameId: null, otherStackId: a.st.id, rule: 'overlap', severity: SEVERITY.overlap,
          message: `Stack ${b.st.id} starts at ${fmt(b.st.x)} cm, but stack ${a.st.id} still takes space until ${fmt(a.end)} cm.`,
        }]);
      }
    }
  }
  return found;
}

const blocksFirst = (list) => [...list.filter((w) => w.severity === 'block'), ...list.filter((w) => w.severity !== 'block')];

/** Checks of the whole plan: every stack, and overlaps. Warnings of one stack stay together, in plan order, blocks first. */
export function checkPlan2(plan, getGame) {
  const over = overlaps2(plan, getGame);
  return plan.stacks.flatMap((st) => blocksFirst([...checkStack2(st, getGame), ...(over.get(st.id) ?? [])]));
}

/** The blocking warnings only. A plan with any of these may not be saved or imported. */
export const blocking = (warnings) => warnings.filter((w) => w.severity === 'block');

/** The warnings that concern one stack: its own, and overlaps where it is the other stack. */
export const forStack = (warnings, stackId) => warnings.filter((w) => w.stackId === stackId || w.otherStackId === stackId);

/** For the Plan check card: warnings grouped by severity and then by stack, in plan order. */
export function groupWarnings(warnings) {
  const out = { block: [], warn: [] };
  for (const w of warnings) {
    const groups = out[w.severity === 'block' ? 'block' : 'warn'];
    const group = groups.find((g) => g.stackId === w.stackId);
    if (group) group.list.push(w);
    else groups.push({ stackId: w.stackId, list: [w] });
  }
  return out;
}

/** "3 games are on the board" – empty text when none are. */
export function boardLine(count) {
  if (!count) return '';
  return count === 1 ? '1 game is on the board' : `${count} games are on the board`;
}
