import { assertEquals } from 'jsr:@std/assert@1';

import {
  AI_GATEWAY_CONTEXT_LIMITS,
  loadRelevantCatalogRecipes,
  type RecipeContextClient,
  type RecipeContextFilterBuilder,
  type RecipeContextQueryBuilder,
  type RecipeContextQueryResult,
  selectRelevantProductIds,
} from './recipe-context.ts';

type QueryCall = {
  table: string;
  select: string | null;
  filters: Array<{
    kind: 'eq' | 'in';
    column: string;
    value: string | string[];
  }>;
  orders: Array<{ column: string; ascending: boolean }>;
  limit: number | null;
};

class FakeQueryBuilder implements RecipeContextQueryBuilder, RecipeContextFilterBuilder {
  constructor(
    private readonly call: QueryCall,
    private readonly response: RecipeContextQueryResult,
  ) {}

  select(columns: string): RecipeContextFilterBuilder {
    this.call.select = columns;
    return this;
  }

  eq(column: string, value: string): RecipeContextFilterBuilder {
    this.call.filters.push({ kind: 'eq', column, value });
    return this;
  }

  in(column: string, values: string[]): RecipeContextFilterBuilder {
    this.call.filters.push({ kind: 'in', column, value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): RecipeContextFilterBuilder {
    this.call.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number): RecipeContextFilterBuilder {
    this.call.limit = count;
    return this;
  }

  then<TResult1 = RecipeContextQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: RecipeContextQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function fakeClient(
  responses: Record<string, RecipeContextQueryResult[]>,
): { client: RecipeContextClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const client: RecipeContextClient = {
    from(table) {
      const call: QueryCall = {
        table,
        select: null,
        filters: [],
        orders: [],
        limit: null,
      };
      calls.push(call);
      const response = responses[table]?.shift() ?? { data: [], error: null };
      return new FakeQueryBuilder(call, response);
    },
  };
  return { client, calls };
}

Deno.test('selectRelevantProductIds sorts, deduplicates, and caps product references', () => {
  const input = [
    'product-z',
    'product-a',
    'product-z',
    null,
    '',
    ...Array.from(
      { length: AI_GATEWAY_CONTEXT_LIMITS.relevantProductIds + 4 },
      (_, index) => `product-${String(index + 10).padStart(3, '0')}`,
    ),
  ];

  const selected = selectRelevantProductIds(input);

  assertEquals(AI_GATEWAY_CONTEXT_LIMITS, {
    relevantProductIds: 100,
    catalogCandidateItems: 500,
    catalogRecipes: 50,
    catalogIngredientItems: 2_000,
    householdRecipes: 50,
    mealPlanEntries: 21,
    shoppingListItems: 100,
  });
  assertEquals(selected.length, AI_GATEWAY_CONTEXT_LIMITS.relevantProductIds);
  assertEquals(selected, [...selected].sort());
  assertEquals(new Set(selected).size, selected.length);
  assertEquals(selected.includes('product-z'), false);
  assertEquals(selected.includes(''), false);
});

Deno.test('returns an empty catalog context without querying when no product is relevant', async () => {
  const { client, calls } = fakeClient({});

  const result = await loadRelevantCatalogRecipes(client, [null, undefined, '']);

  assertEquals(result, { ok: true, recipes: [] });
  assertEquals(calls, []);
});

Deno.test('uses bounded candidate and recipe filters and resolves product names relationally', async () => {
  const candidateRows = Array.from(
    { length: AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes + 5 },
    (_, index) => ({
      recipe_id: `recipe-${String(index).padStart(2, '0')}`,
      product_id: 'product-a',
      position: index,
    }),
  );
  const recipeRows = Array.from(
    { length: AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes + 5 },
    (_, index) => ({
      id: `recipe-${String(index).padStart(2, '0')}`,
      title: `Rezept ${index}`,
      cook_time_minutes: 20,
      default_servings: 2,
      dietary_tags: ['vegetarian'],
      sort_order: index,
    }),
  );
  const ingredientRows = Array.from(
    { length: AI_GATEWAY_CONTEXT_LIMITS.catalogIngredientItems + 1 },
    (_, index) => ({
      id: `item-${index}`,
      recipe_id: 'recipe-00',
      product_id: 'product-a',
      ingredient_name: null,
      quantity: 1,
      unit: 'piece',
      position: index,
      products: { name: 'Tomate' },
    }),
  );
  const { client, calls } = fakeClient({
    catalog_recipe_component_items: [
      { data: candidateRows, error: null },
      { data: ingredientRows, error: null },
    ],
    catalog_recipes: [{ data: recipeRows, error: null }],
  });

  const result = await loadRelevantCatalogRecipes(client, [
    'product-b',
    'product-a',
    'product-b',
  ]);

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected catalog lookup to succeed');
  assertEquals(result.recipes.length, AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes);
  assertEquals(
    result.recipes[0]?.ingredients.length,
    AI_GATEWAY_CONTEXT_LIMITS.catalogIngredientItems,
  );

  const candidateCall = calls[0];
  const recipeCall = calls[1];
  const ingredientCall = calls[2];
  assertEquals(candidateCall?.table, 'catalog_recipe_component_items');
  assertEquals(candidateCall?.limit, AI_GATEWAY_CONTEXT_LIMITS.catalogCandidateItems);
  assertEquals(candidateCall?.filters, [{
    kind: 'in',
    column: 'product_id',
    value: ['product-a', 'product-b'],
  }]);
  assertEquals(recipeCall?.table, 'catalog_recipes');
  assertEquals(recipeCall?.limit, AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes);
  const recipeFilter = recipeCall?.filters.find((filter) => filter.kind === 'in');
  assertEquals(recipeFilter?.column, 'id');
  assertEquals(Array.isArray(recipeFilter?.value), true);
  if (!recipeFilter || !Array.isArray(recipeFilter.value)) {
    throw new Error('expected a bounded recipe id filter');
  }
  assertEquals(recipeFilter.value.length, AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes);
  assertEquals(ingredientCall?.table, 'catalog_recipe_component_items');
  assertEquals(ingredientCall?.limit, AI_GATEWAY_CONTEXT_LIMITS.catalogIngredientItems);
  const ingredientFilter = ingredientCall?.filters.find((filter) => filter.kind === 'in');
  assertEquals(ingredientFilter?.column, 'recipe_id');
  assertEquals(ingredientCall?.select?.includes('products(name)'), true);
  assertEquals(ingredientCall?.filters.some((filter) => filter.column === 'product_id'), false);
  assertEquals(result.recipes[0]?.ingredients[0]?.normalizedName, 'Tomate');
});

Deno.test('propagates candidate, recipe, and ingredient query failures with stable error codes', async () => {
  const candidateFailure = fakeClient({
    catalog_recipe_component_items: [{
      data: null,
      error: { message: 'candidate failed' },
    }],
  });
  assertEquals(
    await loadRelevantCatalogRecipes(candidateFailure.client, ['product-a']),
    { ok: false, error: 'recipe_ingredients_lookup_failed', message: 'candidate failed' },
  );

  const recipeFailure = fakeClient({
    catalog_recipe_component_items: [{
      data: [{ recipe_id: 'recipe-1', product_id: 'product-a', position: 0 }],
      error: null,
    }],
    catalog_recipes: [{ data: null, error: { message: 'recipe failed' } }],
  });
  assertEquals(
    await loadRelevantCatalogRecipes(recipeFailure.client, ['product-a']),
    { ok: false, error: 'recipe_lookup_failed', message: 'recipe failed' },
  );

  const ingredientFailure = fakeClient({
    catalog_recipe_component_items: [
      {
        data: [{ recipe_id: 'recipe-1', product_id: 'product-a', position: 0 }],
        error: null,
      },
      { data: null, error: { message: 'ingredient failed' } },
    ],
    catalog_recipes: [{
      data: [{
        id: 'recipe-1',
        title: 'Rezept',
        cook_time_minutes: 10,
        default_servings: 2,
        dietary_tags: [],
        sort_order: 0,
      }],
      error: null,
    }],
  });
  assertEquals(
    await loadRelevantCatalogRecipes(ingredientFailure.client, ['product-a']),
    { ok: false, error: 'recipe_ingredients_lookup_failed', message: 'ingredient failed' },
  );
});
