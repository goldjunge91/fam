export type TemporaryIngredientSwap = {
  ingredientName: string;
  replacement: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceIngredientInText(
  text: string,
  swap: TemporaryIngredientSwap | null,
): string {
  if (!swap?.ingredientName.trim() || !swap.replacement.trim()) return text;
  const pattern = new RegExp(
    `(^|[^\\p{L}])(@?)${escapeRegExp(swap.ingredientName.trim())}(?![\\p{L}])`,
    'giu',
  );
  return text.replace(
    pattern,
    (_match, prefix: string, marker: string) => `${prefix}${marker}${swap.replacement.trim()}`,
  );
}

export function replaceIngredientName(name: string, swap: TemporaryIngredientSwap | null): string {
  if (
    !swap ||
    name.trim().toLocaleLowerCase('de-DE') !== swap.ingredientName.trim().toLocaleLowerCase('de-DE')
  ) {
    return name;
  }
  return swap.replacement.trim();
}
