// Saved versions (D6): the wording and small rules. Plain functions, no DOM, tested in Node. Owner: Peter (Part C).
import { VERSION_NAME_MAX } from '../core/schema.js';

export const NAME_MAX = VERSION_NAME_MAX; // 60, the store refuses more

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');

/** "27 Nov 10:15" (local time). */
export function stamp(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** The name suggested when saving: "Version 27 Nov 10:15". */
export function defaultName(date = new Date()) {
  return `Version ${stamp(date)}`;
}

/** When a version was saved, for the list: "27 Nov 10:15", with the year when it is not this year. */
export function formatSaved(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "204 games · 34 stacks" from one entry of store.listVersions(). */
export function describeVersion(v) {
  return `${plural(v.games, 'game', 'games')} · ${plural(v.stacks, 'stack', 'stacks')}`;
}

/** The problem with a name, in words, or null if it is fine. Same rules as the store. */
export function nameProblem(text) {
  const clean = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Give the version a name.';
  if (clean.length > NAME_MAX) return `A name can be at most ${NAME_MAX} characters.`;
  return null;
}

/** The name for the copy saved just before switching: Before switching to “X” (cut to fit). */
export function autoSaveName(targetName) {
  const full = `Before switching to “${targetName}”`;
  return full.length <= NAME_MAX ? full : `${full.slice(0, NAME_MAX - 2)}…”`;
}

/** The question when switching. */
export function switchQuestion(name) {
  return `This replaces your games and shelf plan with “${name}”. You can undo it.`;
}

/** Is there room for one more saved version? list = store.listVersions(), max = store.MAX_VERSIONS. */
export function hasRoom(list, max) {
  return list.length < max;
}
