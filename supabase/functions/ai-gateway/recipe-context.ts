import type { GatewayRecipe } from './handler.ts';

export const AI_GATEWAY_CONTEXT_LIMITS = {
  relevantProductIds: 100,
  catalogCandidateItems: 500,
  catalogRecipes: 50,
  catalogIngredientItems: 2_000,
  householdRecipes: 50,
  mealPlanEntries: 21,
  shoppingListItems: 100,
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
  return [...new Set(productIds.map(nonEmptyString).filter((id): id is string => id !== null))]
    .sort()
    .slice(0, AI_GATEWAY_CONTEXT_LIMITS.relevantProductIds);
}

function queryFailure(
  error: { message: string } | null,
  code: CatalogLookupError,
): CatalogLookupResult | null {
  return error ? { ok: false, error: code, message: error.message } : null;
}

export async function loadRelevantCatalogRecipes(
  client: RecipeContextClient,
  productIds: readonly (string | null | undefined)[],
): Promise<CatalogLookupResult> {
  const relevantProductIds = selectRelevantProductIds(productIds);
  if (relevantProductIds.length === 0) return { ok: true, recipes: [] };

  const candidateResult = await client
    .from('catalog_recipe_component_items')
    .select('id, recipe_id, product_id, position')
    .in('product_id', relevantProductIds)
    .order('recipe_id', { ascending: true })
    .order('position', { ascending: true })
    .order('id', { ascending: true })
    .limit(AI_GATEWAY_CONTEXT_LIMITS.catalogCandidateItems);
  const candidateFailure = queryFailure(
    candidateResult.error,
    'recipe_ingredients_lookup_failed',
  );
  if (candidateFailure) return candidateFailure;

  const candidateRecipeIds = [
    ...new Set(
      (candidateResult.data ?? [])
        .slice(0, AI_GATEWAY_CONTEXT_LIMITS.catalogCandidateItems)
        .filter(isRecord)
        .map((row) => nonEmptyString(row.recipe_id))
        .filter((id): id is string => id !== null),
    ),
  ].sort().slice(0, AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes);
  if (candidateRecipeIds.length === 0) return { ok: true, recipes: [] };

  const recipeResult = await client
    .from('catalog_recipes')
    .select('id, title, cook_time_minutes, default_servings, dietary_tags, sort_order')
    .eq('status', 'published')
    .in('id', candidateRecipeIds)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })
    .order('id', { ascending: true })
    .limit(AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes);
  const recipeFailure = queryFailure(recipeResult.error, 'recipe_lookup_failed');
  if (recipeFailure) return recipeFailure;

  const candidateRecipeIdSet = new Set(candidateRecipeIds);
  const catalogRows = (recipeResult.data ?? [])
    .slice(0, AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes)
    .filter(isRecord)
    .filter((row) => {
      const recipeId = nonEmptyString(row.id);
      return recipeId !== null && candidateRecipeIdSet.has(recipeId);
    });
  const recipeIds = catalogRows
    .map((row) => nonEmptyString(row.id))
    .filter((id): id is string => id !== null);
  if (recipeIds.length === 0) return { ok: true, recipes: [] };

  const ingredientResult = await client
    .from('catalog_recipe_component_items')
    .select(
      'id, recipe_id, product_id, ingredient_name, quantity, unit, position, products(name)',
    )
    .in('recipe_id', recipeIds)
    .order('recipe_id', { ascending: true })
    .order('position', { ascending: true })
    .order('id', { ascending: true })
    .limit(AI_GATEWAY_CONTEXT_LIMITS.catalogIngredientItems);
  const ingredientFailure = queryFailure(
    ingredientResult.error,
    'recipe_ingredients_lookup_failed',
  );
  if (ingredientFailure) return ingredientFailure;

  const recipeIdSet = new Set(recipeIds);
  const ingredientsByRecipe = new Map<string, GatewayRecipe['ingredients']>();
  for (
    const row of (ingredientResult.data ?? [])
      .slice(0, AI_GATEWAY_CONTEXT_LIMITS.catalogIngredientItems)
      .filter(isRecord)
  ) {
    const recipeId = nonEmptyString(row.recipe_id);
    if (!recipeId || !recipeIdSet.has(recipeId)) continue;
    const productId = nonEmptyString(row.product_id);
    const name = nonEmptyString(row.ingredient_name) ?? relationProductName(row.products);
    if (!name) continue;
    const ingredients = ingredientsByRecipe.get(recipeId) ?? [];
    ingredients.push({
      productId,
      normalizedName: name,
      quantity: numberOrNull(row.quantity),
      unit: nonEmptyString(row.unit),
    });
    ingredientsByRecipe.set(recipeId, ingredients);
  }

  const recipes: GatewayRecipe[] = catalogRows.flatMap((row) => {
    const recipeId = nonEmptyString(row.id);
    const title = nonEmptyString(row.title);
    if (!recipeId || !title) return [];
    return [
      {
        recipeId,
        title,
        estimatedMinutes: numberOrNull(row.cook_time_minutes),
        servings: numberOrNull(row.default_servings),
        dietaryTags: Array.isArray(row.dietary_tags)
          ? row.dietary_tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        allergens: null,
        ingredients: ingredientsByRecipe.get(recipeId) ?? [],
      } satisfies GatewayRecipe,
    ];
  });

  return { ok: true, recipes };
}
