// Game families (B2): suggestions for the game panel and the Data screen. Plain functions, no DOM, tested in Node.
// Owner: Stephen (Part A). The family field itself lives in the store (CONTEXT section 4).
import { foldText } from './logic.js';

const MAX_CHIPS = 4;
const MAX_NAME = 40;
// A trailing edition word is not part of the family name: "Tokaido Duo" and "Azul Kids" belong to Tokaido and Azul.
const EDITION_WORDS = ['big box', 'deluxe edition', 'junior', 'kids', 'duo'];
const SMALL_WORDS = new Set(['the', 'and', 'for', 'of', 'a', 'an', 'to', 'in', 'on', 'de', 'la', 'le', 'a', 'az', 'egy']);

/** The start of a name, before ":", " – " or "(", without a trailing edition word. "Azul: Crystal Mosaic" -> "Azul", "Tokaido Duo" -> "Tokaido". */
export function familyBase(name) {
  let t = String(name ?? '').split(/:| [–—-] |\(/)[0].trim();
  for (let again = true; again;) {
    again = false;
    for (const w of EDITION_WORDS) {
      const m = t.match(new RegExp(`^(.+?)\\s+${w.replace(' ', '\\s+')}(?:\\s+\\d+)?$`, 'i'));
      if (m && m[1].trim()) { t = m[1].trim(); again = true; break; }
    }
  }
  return t.length > MAX_NAME ? '' : t;
}

/** The name a game is grouped by: its BGG name, or its title when it has none. */
const nameOf = (g) => g.bggName || g.title;

const words = (text) => foldText(text).split(' ').filter((w) => w.length >= 3 && !SMALL_WORDS.has(w));

/**
 * Family names to offer for a game, at most 4, best first (CONTEXT: B2):
 *  1. the start of its BGG name (title when there is none),
 *  2. the family of the box it is stored inside,
 *  3. existing families that share a word with its title or BGG name.
 * Never the family it already has. `inside` is plan.inside (game id -> host id).
 */
export function suggestFamilyNames(game, games, inside = {}) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const existing = [...new Set(games.filter((g) => g.family).map((g) => g.family))];
  const spell = (name) => existing.find((f) => f.toLocaleLowerCase('hu') === name.toLocaleLowerCase('hu')) ?? name;
  const out = [];
  const add = (name) => {
    if (!name) return;
    const n = spell(name);
    const k = n.toLocaleLowerCase('hu');
    if (game.family && game.family.toLocaleLowerCase('hu') === k) return;
    if (!out.some((o) => o.toLocaleLowerCase('hu') === k)) out.push(n);
  };
  add(familyBase(nameOf(game)));
  const host = byId.get(inside[game.id]);
  if (host?.family) add(host.family);
  const mine = new Set([...words(game.title), ...words(game.bggName)]);
  for (const f of existing.sort((a, b) => a.localeCompare(b, 'hu'))) {
    if (words(f).some((w) => mine.has(w))) add(f);
  }
  return out.slice(0, MAX_CHIPS);
}

/**
 * Groups of 2 or more games without a family whose names start the same (same rule as the first chip):
 * [{ name, ids }], by name; ids in the order of `games`. The name uses the most common spelling in the group.
 */
export function suggestFamilies(games) {
  const groups = new Map(); // folded base -> { names: Map<spelling, n>, ids }
  for (const g of games) {
    if (g.family) continue;
    const base = familyBase(nameOf(g));
    const key = foldText(base);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { names: new Map(), ids: [] });
    const grp = groups.get(key);
    grp.names.set(base, (grp.names.get(base) ?? 0) + 1);
    grp.ids.push(g.id);
  }
  return [...groups.values()]
    .filter((grp) => grp.ids.length >= 2)
    .map((grp) => ({ name: [...grp.names].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0], ids: grp.ids }))
    .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
}

/** The other games of a game's family: [{ id, title }] in title order. Empty when it has no family. */
export function alsoIn(game, families) {
  const fam = families.find((f) => f.name === game.family);
  return fam ? fam.ids.filter((id) => id !== game.id) : [];
}

/** "Also in Azul: " text parts are built by the panel; this is the label for a family line on the Data screen: "Azul · 3 games". */
export const familyLine = (f) => `${f.name} · ${f.ids.length} ${f.ids.length === 1 ? 'game' : 'games'}`;
