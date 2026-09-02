export type Perishability = 'perishable' | 'non_perishable' | 'unknown';

// Deliberately explicit suffixes. Unknown taxonomy values must not be guessed.
const PERISHABLE_TAGS = new Set([
  'dairy',
  'dairy-products',
  'eggs',
  'fish-and-seafood',
  'fresh-foods',
  'fruits',
  'fruits-and-vegetables',
  'meat',
  'meats',
  'milchprodukte',
  'poultry',
  'refrigerated-foods',
  'seafood',
  'vegetables',
  'yogurts',
]);

const NON_PERISHABLE_TAGS = new Set([
  'beverages',
  'canned-foods',
  'cereals-and-potatoes',
  'oils-and-fats',
  'pasta',
  'pastas',
  'rice',
  'snacks',
  'spices',
  'sugars-and-sweeteners',
]);

function tagSuffix(tag: string): string {
  const normalized = tag.trim().toLocaleLowerCase('en-US');
  const separator = normalized.indexOf(':');
  return separator === -1 ? normalized : normalized.slice(separator + 1);
}

/** Classifies only explicit OFF taxonomy signals and never infers from names. */
export function classifyPerishability(tags: readonly string[]): Perishability {
  let hasPerishableSignal = false;
  let hasNonPerishableSignal = false;

  for (const tag of tags) {
    const suffix = tagSuffix(tag);
    hasPerishableSignal ||= PERISHABLE_TAGS.has(suffix);
    hasNonPerishableSignal ||= NON_PERISHABLE_TAGS.has(suffix);
  }

  if (hasPerishableSignal === hasNonPerishableSignal) return 'unknown';
  return hasPerishableSignal ? 'perishable' : 'non_perishable';
}
