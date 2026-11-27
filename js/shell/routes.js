// Pure route helpers (no DOM), so they can be tested in Node. Owner: Peter (Part C).
// Routes are hashes:  #/map   #/map?game=g042   #/catalog?q=fold&cat=party

/** toHash('map', { game: 'g042' }) -> "#/map?game=g042". Empty, null and undefined values are left out. */
export function toHash(id, params = {}) {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v != null && v !== '');
  const q = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  return `#/${id}${q ? `?${q}` : ''}`;
}

/** parseHash('#/map?game=g042') -> { id: 'map', params: { game: 'g042' } }. id is '' for an empty hash. */
export function parseHash(hash = '') {
  const rest = String(hash).replace(/^#\/?/, '');
  const cut = rest.indexOf('?');
  const path = cut < 0 ? rest : rest.slice(0, cut);
  const query = cut < 0 ? '' : rest.slice(cut + 1);
  return { id: path, params: Object.fromEntries(new URLSearchParams(query)) };
}

/**
 * Work out which screen a hash means.
 * Unknown or empty routes fall back to `fallbackId` with no params, and `redirected` is true,
 * so the router can rewrite the address bar.
 * -> { screen, id, params, redirected }   (screen is undefined only if there is no fallback screen either)
 */
export function resolveRoute(screens, hash, fallbackId) {
  const { id, params } = parseHash(hash);
  const screen = screens.find((s) => s.id === id);
  if (screen) return { screen, id, params, redirected: false };
  const fb = screens.find((s) => s.id === fallbackId);
  return { screen: fb, id: fb?.id, params: {}, redirected: true };
}

/** Screens in navigation order (by `order`, unordered ones last). Does not change the input. */
export function sortScreens(list) {
  return [...list].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
