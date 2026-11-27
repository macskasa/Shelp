// Searching games by title: plain functions, no DOM, tested in Node. Owner: Peter (Part C). Stories A6 and C4.
//
// Text is *folded* before it is compared: capital letters, accents and punctuation do not matter,
// so "ejszaka" finds "A rettegés éjszakája", "fold" finds "Föld és víz" and "dune" finds "Dűne".
// A search matches when every word you typed is found in the title or in the BGG name.
// Ranking (lower = better): exact title, title starts with it, every word starts a word of the
// title, every word is somewhere in the title, then the same two steps over title + BGG name + family name.

const EXTRA = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ł: 'l', ı: 'i' };

/** "Föld és víz – 2." -> "fold es viz 2" (no accents, lower case, only letters, digits and single spaces). */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[ßæœøđłı]/g, (c) => EXTRA[c])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** What is searched for one game. Build it once per game (not per keystroke). */
export function searchKey(game) {
  const title = fold(game.title);
  const bgg = game.bggName ? fold(game.bggName) : '';
  const key = { title, bgg: bgg === title ? '' : bgg };
  const family = game.family ? fold(game.family) : '';
  if (family) key.family = family; // "Mars" finds the games of the family "Terraforming Mars"
  return key;
}

/** What you typed, ready for matchScore(). An empty query (or only punctuation) has no tokens. */
export function parseQuery(text) {
  const q = fold(text);
  return { text: q, tokens: q ? q.split(' ') : [] };
}

const startsWord = (hay, token) => hay.startsWith(token) || hay.includes(` ${token}`);

/** How well a game (its searchKey) matches a parsed query: 0 is best, null = no match. An empty query matches with 0. */
export function matchScore(key, query) {
  const { text, tokens } = query;
  if (!tokens.length) return 0;
  const { title } = key;
  if (title === text) return 0;
  if (title.startsWith(text)) return 1;
  if (tokens.every((t) => startsWord(title, t))) return 2;
  if (tokens.every((t) => title.includes(t))) return 3;
  const both = [title, key.bgg, key.family].filter(Boolean).join(' ');
  if (tokens.every((t) => startsWord(both, t))) return 4;
  if (tokens.every((t) => both.includes(t))) return 5;
  return null;
}

/** For the catalog filter: does this game's key match the query at all? */
export function matchesQuery(key, query) {
  return matchScore(key, query) !== null;
}

/**
 * Best matches first. items = [{ game, key }] (key from searchKey); returns the matching items.
 * Ties go to the shorter title, then to the order the games came in (the store sorts by title).
 */
export function rankMatches(items, text, limit = Infinity) {
  const query = parseQuery(text);
  if (!query.tokens.length) return [];
  const scored = [];
  items.forEach((item, order) => {
    const score = matchScore(item.key, query);
    if (score !== null) scored.push({ item, score, order });
  });
  scored.sort((a, b) => a.score - b.score
    || a.item.key.title.length - b.item.key.title.length
    || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.item);
}
