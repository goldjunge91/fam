import type { PerishableInventoryContext } from './contracts';

export type RecipeIngredient = {
  productId: string | null;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
};

export type RecipeCandidate = {
  id: string;
  title: string;
  cookTimeMinutes: number | null;
  defaultServings: number | null;
  dietaryTags: readonly string[];
  /** null means the recipe basis has no authoritative allergen metadata. */
  allergens: readonly string[] | null;
  ingredients: readonly RecipeIngredient[];
};

export type RecipeFilterInput = {
  servings: number | null;
  maxMinutes: number | null;
  dietaryPattern: string | null;
  allergies: readonly string[];
};

export type RecipeConstraintChecks = {
  allergies: 'pass';
  dietaryPattern: 'pass' | 'unknown';
  time: 'pass' | 'unknown';
};

export type FilteredRecipeCandidate = {
  recipe: RecipeCandidate;
  constraintChecks: RecipeConstraintChecks;
};

const ALLERGEN_ALIASES = new Map([
  ['erdnuss', 'peanuts'],
  ['erdnüsse', 'peanuts'],
  ['nuss', 'tree-nuts'],
  ['nüsse', 'tree-nuts'],
]);

function normalizeTag(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('en-US');
  const separator = normalized.indexOf(':');
  return separator === -1 ? normalized : normalized.slice(separator + 1);
}

function normalizeFoodName(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE').normalize('NFKC');
}

function normalizeAllergen(value: string): string {
  const normalized = normalizeTag(value);
  return ALLERGEN_ALIASES.get(normalized) ?? normalized;
}

function hasTag(tags: readonly string[], expected: string): boolean {
  const normalizedExpected = normalizeTag(expected);
  return tags.some((tag) => normalizeTag(tag) === normalizedExpected);
}

function hasAllergy(recipe: RecipeCandidate, allergies: readonly string[]): boolean {
  if (allergies.length === 0) return false;
  if (recipe.allergens === null) return true;

  const knownAllergens = new Set(recipe.allergens.map(normalizeAllergen));
  return allergies.some((allergy) => knownAllergens.has(normalizeAllergen(allergy)));
}

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a - b;
}

function matchesHardConstraints(
  recipe: RecipeCandidate,
  input: RecipeFilterInput,
): RecipeConstraintChecks | null {
  if (hasAllergy(recipe, input.allergies)) return null;
  // A recipe with no serving metadata cannot safely promise the requested
  // portion target. Recipes with a known default are scaleable by the caller.
  if (input.servings !== null && recipe.defaultServings === null) return null;

  let dietaryPattern: RecipeConstraintChecks['dietaryPattern'] = 'unknown';
  if (input.dietaryPattern !== null) {
    if (!hasTag(recipe.dietaryTags, input.dietaryPattern)) return null;
    dietaryPattern = 'pass';
  }

  let time: RecipeConstraintChecks['time'] = 'unknown';
  if (input.maxMinutes !== null) {
    if (recipe.cookTimeMinutes === null || recipe.cookTimeMinutes > input.maxMinutes) {
      return null;
    }
    time = 'pass';
  }

  return { allergies: 'pass', dietaryPattern, time };
}

/** Applies hard recipe constraints before any model wording or ranking. */
export function filterRecipeCandidates(
  candidates: readonly RecipeCandidate[],
  input: RecipeFilterInput,
  limit = 3,
): FilteredRecipeCandidate[] {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error('Das Rezeptlimit muss eine nichtnegative Ganzzahl sein.');
  }
  if (input.servings !== null && (!Number.isInteger(input.servings) || input.servings <= 0)) {
    throw new Error('Die gewünschte Portionszahl muss eine positive Ganzzahl sein.');
  }
  if (input.maxMinutes !== null && (!Number.isInteger(input.maxMinutes) || input.maxMinutes <= 0)) {
    throw new Error('Die maximale Kochzeit muss eine positive Ganzzahl sein.');
  }

  return candidates
    .flatMap((recipe) => {
      const constraintChecks = matchesHardConstraints(recipe, input);
      return constraintChecks === null ? [] : [{ recipe, constraintChecks }];
    })
    .sort((a, b) => {
      const byTime = compareNullableNumber(a.recipe.cookTimeMinutes, b.recipe.cookTimeMinutes);
      if (byTime !== 0) return byTime;

      const byTitle = a.recipe.title.localeCompare(b.recipe.title, 'de');
      return byTitle !== 0 ? byTitle : a.recipe.id.localeCompare(b.recipe.id);
    })
    .slice(0, limit);
}

export type RecipeInventoryBinding = {
  usedLots: string[];
  missingIngredients: string[];
};

/** Binds recipe ingredients to gateway lots without fuzzy or invented matches. */
export function bindRecipeCandidateToInventory(
  recipe: RecipeCandidate,
  context: PerishableInventoryContext,
): RecipeInventoryBinding {
  const usedLotIds = new Set<string>();
  const usedLots: string[] = [];
  const missingIngredients: string[] = [];

  for (const ingredient of recipe.ingredients) {
    const normalizedName = normalizeFoodName(ingredient.normalizedName);
    const lot = context.lots.find((candidate) => {
      if (usedLotIds.has(candidate.lotId)) return false;
      if (ingredient.productId !== null) return candidate.productId === ingredient.productId;
      return (
        normalizedName.length > 0 && normalizeFoodName(candidate.normalizedName) === normalizedName
      );
    });

    if (lot === undefined) {
      missingIngredients.push(ingredient.normalizedName);
      continue;
    }

    usedLotIds.add(lot.lotId);
    usedLots.push(lot.lotId);
  }

  return { usedLots, missingIngredients };
}
