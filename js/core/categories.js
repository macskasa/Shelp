// Category tags (story B1). A game can have several. Owner: Tony (lead).
// Colours live in css/base.css as CSS variables, so SVG and HTML can both use var(--cat-party) etc.

export const CATEGORIES = [
  { id: 'party', label: 'Party', cssVar: '--cat-party' },
  { id: 'coop', label: 'Co-op', cssVar: '--cat-coop' },
  { id: 'popular', label: 'Popular', cssVar: '--cat-popular' },
  { id: 'duo', label: 'Duo', cssVar: '--cat-duo' },
];

export const OTHER = { id: 'other', label: 'Other', cssVar: '--cat-other' };

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function category(id) {
  return CATEGORIES.find((c) => c.id === id) ?? OTHER;
}

/** CSS colour values for a game's categories, in the fixed order above. ["var(--cat-other)"] if none. */
export function colorsFor(game) {
  const ids = CATEGORY_IDS.filter((id) => game.categories?.includes(id));
  return ids.length ? ids.map((id) => `var(${category(id).cssVar})`) : [`var(${OTHER.cssVar})`];
}
