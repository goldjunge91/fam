import type { GatewayRecipe } from './handler.ts';
import { CONTEXT_LIMITS, limitContextString } from './context-limits.ts';

export const AI_GATEWAY_CONTEXT_LIMITS = {
  relevantProductIds: CONTEXT_LIMITS.relevantProductIds,
  catalogCandidateItems: CONTEXT_LIMITS.catalogCandidateItems,
  catalogRecipes: CONTEXT_LIMITS.catalogRecipes,
  catalogIngredientItems: CONTEXT_LIMITS.catalogIngredientItems,
  catalogIngredientsPerRecipe: CONTEXT_LIMITS.catalogIngredientsPerRecipe,
  householdRecipes: CONTEXT_LIMITS.householdRecipes,
  mealPlanEntries: CONTEXT_LIMITS.mealPlanEntries,
  shoppingListItems: CONTEXT_LIMITS.shoppingListItems,
} as const;

export type RecipeContextQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type RecipeContextQueryBuilder = {
  select(columns: string): RecipeContextFilterBuilder;
};

export type RecipeContextFilterBuilder = {
  eq(column: string, value: string): RecipeContextFilterBuilder;
  in(column: string, values: string[]): RecipeContextFilterBuilder;
  order(column: string, options?: { ascending?: boolean }): RecipeContextFilterBuilder;
  limit(count: number): RecipeContextFilterBuilder;
  then<TResult1 = RecipeContextQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: RecipeContextQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type RecipeContextClient = {
  from(table: string): RecipeContextQueryBuilder;
};

type CatalogLookupError = 'recipe_lookup_failed' | 'recipe_ingredients_lookup_failed';

type CatalogLookupResult =
  | { ok: true; recipes: GatewayRecipe[] }
  | { ok: false; error: CatalogLookupError; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function relationProductName(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value.find(isRecord);
    return first ? nonEmptyString(first.name) : null;
  }
  return isRecord(value) ? nonEmptyString(value.name) : null;
}

export function selectRelevantProductIds(
  productIds: readonly (string | null | undefined)[],
): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const value of productIds) {
    const id = nonEmptyString(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selected.push(id);
    if (selected.length === CONTEXT_LIMITS.relevantProductIds) break;
  }
  return selected;
}

function queryFailure(
  error: { message: string } | null,
  code: CatalogLookupError,
): CatalogLookupResult | null {
  return error ? { ok: false, error: code, message: error.message } : null;
}

function candidateQuota(total: number, index: number, count: number): number {
  const base = Math.floor(total / count);
  return base + (index < total % count ? 1 : 0);
}

type CatalogCandidateMatch = {
  productId: string;
  recipe: Record<string, unknown>;
};

function scoreCandidateRecipes(
  candidateMatches: readonly CatalogCandidateMatch[],
): Record<string, unknown>[] {
  const candidatesByRecipeId = new Map<
    string,
    { recipe: Record<string, unknown>; productIds: Set<string> }
  >();
  for (const match of candidateMatches) {
    const recipeId = nonEmptyString(match.recipe.id);
    if (!recipeId) continue;
    const candidate = candidatesByRecipeId.get(recipeId) ?? {
      recipe: match.recipe,
      productIds: new Set<string>(),
    };
    candidate.productIds.add(match.productId);
    candidatesByRecipeId.set(recipeId, candidate);
  }

  return [...candidatesByRecipeId.values()]
    .sort((left, right) => {
      const scoreDifference = right.productIds.size - left.productIds.size;
      if (scoreDifference !== 0) return scoreDifference;
      const sortOrderDifference =
        (numberOrNull(left.recipe.sort_order) ?? Number.MAX_SAFE_INTEGER) -
        (numberOrNull(right.recipe.sort_order) ?? Number.MAX_SAFE_INTEGER);
      if (sortOrderDifference !== 0) return sortOrderDifference;
      const titleDifference = (nonEmptyString(left.recipe.title) ?? '').localeCompare(
        nonEmptyString(right.recipe.title) ?? '',
        'de',
      );
      if (titleDifference !== 0) return titleDifference;
      return (nonEmptyString(left.recipe.id) ?? '').localeCompare(
        nonEmptyString(right.recipe.id) ?? '',
      );
    })
    .map((candidate) => candidate.recipe);
}

export async function loadRelevantCatalogRecipes(
  client: RecipeContextClient,
  productIds: readonly (string | null | undefined)[],
): Promise<CatalogLookupResult> {
  const relevantProductIds = selectRelevantProductIds(productIds);
  if (relevantProductIds.length === 0) return { ok: true, recipes: [] };

  const candidateResults = await Promise.all(
    relevantProductIds.map((productId, index) =>
      client
        .from('catalog_recipes')
        .select(
          'id, title, cook_time_minutes, default_servings, dietary_tags, sort_order, matched_items:catalog_recipe_component_items!inner()',
        )
        .eq('status', 'published')
        .eq('matched_items.product_id', productId)
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true })
        .order('id', { ascending: true })
        .limit(
          candidateQuota(CONTEXT_LIMITS.catalogCandidateItems, index, relevantProductIds.length),
        )
    ),
  );
  for (const candidateResult of candidateResults) {
    const candidateFailure = queryFailure(candidateResult.error, 'recipe_lookup_failed');
    if (candidateFailure) return candidateFailure;
  }

  const candidateMatches = candidateResults.flatMap((result, index) =>
    (result.data ?? []).filter(isRecord).map((recipe) => ({
      productId: relevantProductIds[index]!,
      recipe,
    }))
  );
  const rankedCatalogRows = scoreCandidateRecipes(candidateMatches).slice(
    0,
    CONTEXT_LIMITS.catalogRecipes,
  );
  if (rankedCatalogRows.length === 0) return { ok: true, recipes: [] };

  const recipes: GatewayRecipe[] = [];
  let totalIngredientItems = 0;
  for (const row of rankedCatalogRows) {
    const recipeId = nonEmptyString(row.id);
    const title = nonEmptyString(row.title);
    if (!recipeId || !title) continue;

    const ingredientResult = await client
      .from('catalog_recipe_component_items')
      .select(
        'id, recipe_id, product_id, ingredient_name, quantity, unit, position, products(name)',
      )
      .eq('recipe_id', recipeId)
      .order('position', { ascending: true })
      .order('id', { ascending: true })
      .limit(CONTEXT_LIMITS.catalogIngredientsPerRecipe + 1);
    const ingredientFailure = queryFailure(
      ingredientResult.error,
      'recipe_ingredients_lookup_failed',
    );
    if (ingredientFailure) return ingredientFailure;

    const rows = (ingredientResult.data ?? []).filter(isRecord);
    if (
      rows.length === 0 ||
      rows.length > CONTEXT_LIMITS.catalogIngredientsPerRecipe ||
      totalIngredientItems + rows.length > CONTEXT_LIMITS.catalogIngredientItems
    ) continue;

    const ingredients: GatewayRecipe['ingredients'] = [];
    let complete = true;
    for (const ingredientRow of rows) {
      const name = nonEmptyString(ingredientRow.ingredient_name) ??
        relationProductName(ingredientRow.products);
      if (!name) {
        complete = false;
        break;
      }
      ingredients.push({
        itemId: limitContextString(nonEmptyString(ingredientRow.id)),
        productId: nonEmptyString(ingredientRow.product_id),
        normalizedName: limitContextString(name),
        quantity: numberOrNull(ingredientRow.quantity),
        unit: nonEmptyString(ingredientRow.unit)
          ? limitContextString(nonEmptyString(ingredientRow.unit))
          : null,
      });
    }
    if (!complete) continue;

    totalIngredientItems += ingredients.length;
    recipes.push({
      recipeId: limitContextString(recipeId),
      title: limitContextString(title),
      estimatedMinutes: numberOrNull(row.cook_time_minutes),
      servings: numberOrNull(row.default_servings),
      dietaryTags: Array.isArray(row.dietary_tags)
        ? row.dietary_tags
          .filter((tag): tag is string => typeof tag === 'string')
          .map((tag) => limitContextString(tag))
        : [],
      allergens: null,
      ingredients,
      ingredientDataComplete: true,
    });
  }

  return { ok: true, recipes };
}
