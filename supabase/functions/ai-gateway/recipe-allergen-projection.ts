import { EU_ALLERGEN_IDS, type EuAllergenId } from './ingredient-knowledge.ts';

type RecipeAllergenProjectionInput = {
  recipes: ReadonlyArray<{ recipeId: string }>;
  items: ReadonlyArray<{ itemId: string; recipeId: string }>;
  links: ReadonlyArray<{
    catalogItemId: string;
    ingredientId: string;
    confidence: string;
    reviewedAt: string | null;
  }>;
  ingredients: ReadonlyArray<{
    ingredientId: string;
    allergenReviewedAt: string | null;
  }>;
  mappings: ReadonlyArray<{
    ingredientId: string;
    allergenId: string;
    relation: string;
  }>;
};

type RecipeAllergenProjection = Map<string, EuAllergenId[] | null>;

const ALLERGEN_IDS = new Set<string>(EU_ALLERGEN_IDS);
const ALLERGEN_RELATIONS = new Set(['contains', 'derived_from', 'may_contain']);

function hasReviewTimestamp(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value));
}

/** Returns a known allergen set only when every recipe item has reviewed evidence. */
export function projectRecipeAllergens(
  input: RecipeAllergenProjectionInput,
): RecipeAllergenProjection {
  const itemsByRecipe = new Map<string, string[]>();
  for (const item of input.items) {
    const current = itemsByRecipe.get(item.recipeId) ?? [];
    current.push(item.itemId);
    itemsByRecipe.set(item.recipeId, current);
  }

  const linksByItem = new Map<string, RecipeAllergenProjectionInput['links'][number][]>();
  for (const link of input.links) {
    const current = linksByItem.get(link.catalogItemId) ?? [];
    current.push(link);
    linksByItem.set(link.catalogItemId, current);
  }

  const ingredientsById = new Map(
    input.ingredients.map((ingredient) => [ingredient.ingredientId, ingredient]),
  );
  const allergenIdsByIngredient = new Map<string, Set<EuAllergenId>>();
  const invalidIngredientMappings = new Set<string>();
  for (const mapping of input.mappings) {
    if (
      !ALLERGEN_IDS.has(mapping.allergenId) ||
      !ALLERGEN_RELATIONS.has(mapping.relation)
    ) {
      invalidIngredientMappings.add(mapping.ingredientId);
      continue;
    }

    const allergenId = mapping.allergenId as EuAllergenId;
    const allergenIds = allergenIdsByIngredient.get(mapping.ingredientId) ?? new Set();
    allergenIds.add(allergenId);
    allergenIdsByIngredient.set(mapping.ingredientId, allergenIds);
  }

  const projections: RecipeAllergenProjection = new Map();
  for (const recipe of input.recipes) {
    const itemIds = itemsByRecipe.get(recipe.recipeId) ?? [];
    const allergenIds = new Set<EuAllergenId>();
    let complete = itemIds.length > 0;

    for (const itemId of itemIds) {
      const links = linksByItem.get(itemId) ?? [];
      const ingredientIds = [...new Set(links.map((link) => link.ingredientId))];
      if (ingredientIds.length !== 1) {
        complete = false;
        break;
      }

      const [ingredientId] = ingredientIds;
      const ingredientLinks = links.filter((link) => link.ingredientId === ingredientId);
      const hasVerifiedLink = ingredientLinks.some(
        (link) => link.confidence === 'verified' && hasReviewTimestamp(link.reviewedAt),
      );
      const ingredient = ingredientsById.get(ingredientId);
      if (
        !hasVerifiedLink ||
        !ingredient ||
        !hasReviewTimestamp(ingredient.allergenReviewedAt) ||
        invalidIngredientMappings.has(ingredientId)
      ) {
        complete = false;
        break;
      }

      for (const allergenId of allergenIdsByIngredient.get(ingredientId) ?? []) {
        allergenIds.add(allergenId);
      }
    }

    projections.set(
      recipe.recipeId,
      complete ? EU_ALLERGEN_IDS.filter((id) => allergenIds.has(id)) : null,
    );
  }

  return projections;
}
