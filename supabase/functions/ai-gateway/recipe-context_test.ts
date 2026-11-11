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
    const data = this.call.limit !== null && Array.isArray(this.response.data)
      ? this.response.data.slice(0, this.call.limit)
      : this.response.data;
    return Promise.resolve({ ...this.response, data }).then(onfulfilled, onrejected);
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

Deno.test('selectRelevantProductIds preserves source priority, deduplicates, and caps product references', () => {
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
    catalogIngredientItems: 1_000,
    catalogIngredientsPerRecipe: 100,
    householdRecipes: 50,
    mealPlanEntries: 21,
    shoppingListItems: 100,
  });
  assertEquals(selected.length, AI_GATEWAY_CONTEXT_LIMITS.relevantProductIds);
  assertEquals(selected.slice(0, 3), ['product-z', 'product-a', 'product-010']);
  assertEquals(new Set(selected).size, selected.length);
  assertEquals(selected.includes(''), false);
});

Deno.test('returns an empty catalog context without querying when no product is relevant', async () => {
  const { client, calls } = fakeClient({});

  const result = await loadRelevantCatalogRecipes(client, [null, undefined, '']);

  assertEquals(result, { ok: true, recipes: [] });
  assertEquals(calls, []);
});

Deno.test('selects fair, relevant catalog candidates and keeps every included recipe complete', async () => {
  const recipeRows = Array.from(
    { length: AI_GATEWAY_CONTEXT_LIMITS.catalogCandidateItems },
    (_, index) => ({
      id: `recipe-${String(index).padStart(3, '0')}`,
      title: `Rezept ${index}`,
      cook_time_minutes: 20,
      default_servings: 2,
      dietary_tags: ['vegetarian'],
      sort_order: index,
    }),
  );
  const ingredientResponses = recipeRows.slice(0, AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes).map((
    row,
  ) => ({
    data: [{
      id: `item-${row.id}`,
      recipe_id: row.id,
      product_id: 'product-a',
      ingredient_name: null,
      quantity: 1,
      unit: 'piece',
      position: 0,
      products: { name: 'Tomate' },
    }],
    error: null,
  }));
  const { client, calls } = fakeClient({
    catalog_recipes: [
      { data: [], error: null },
      { data: recipeRows, error: null },
    ],
    catalog_recipe_component_items: ingredientResponses,
  });

  const result = await loadRelevantCatalogRecipes(client, [
    'product-b',
    'product-a',
    'product-b',
  ]);

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected catalog lookup to succeed');
  assertEquals(result.recipes.length, AI_GATEWAY_CONTEXT_LIMITS.catalogRecipes);
  assertEquals(result.recipes.every((recipe) => recipe.ingredients.length === 1), true);
  assertEquals(result.recipes[0]?.ingredients[0]?.normalizedName, 'Tomate');

  const candidateCalls = calls.slice(0, 2);
  assertEquals(candidateCalls.map((call) => call.table), ['catalog_recipes', 'catalog_recipes']);
  assertEquals(
    candidateCalls.every((call) =>
      call.select?.includes('matched_items:catalog_recipe_component_items!inner()')
    ),
    true,
  );
  assertEquals(candidateCalls.map((call) => call.filters), [
    [
      { kind: 'eq', column: 'status', value: 'published' },
      { kind: 'eq', column: 'matched_items.product_id', value: 'product-b' },
    ],
    [
      { kind: 'eq', column: 'status', value: 'published' },
      { kind: 'eq', column: 'matched_items.product_id', value: 'product-a' },
    ],
  ]);
  assertEquals(candidateCalls.map((call) => call.limit), [250, 250]);
  assertEquals(
    candidateCalls.map((call) => call.orders),
    Array.from({ length: 2 }, () => [
      { column: 'sort_order', ascending: true },
      { column: 'title', ascending: true },
      { column: 'id', ascending: true },
    ]),
  );
  const ingredientCall = calls[2];
  assertEquals(ingredientCall?.table, 'catalog_recipe_component_items');
  assertEquals(
    ingredientCall?.limit,
    AI_GATEWAY_CONTEXT_LIMITS.catalogIngredientsPerRecipe + 1,
  );
  assertEquals(ingredientCall?.select?.includes('products(name)'), true);
  assertEquals(ingredientCall?.filters.some((filter) => filter.column === 'product_id'), false);
});

Deno.test('ranks catalog recipes by distinct matched products before the stable title and id tie-break', async () => {
  const ingredient = (recipeId: string) => ({
    id: `item-${recipeId}`,
    recipe_id: recipeId,
    product_id: 'product-a',
    ingredient_name: 'Zutat',
    quantity: 1,
    unit: 'piece',
    position: 0,
    products: null,
  });
  const recipeHigh = {
    id: 'recipe-high',
    title: 'Z-Rezept',
    sort_order: 20,
    cook_time_minutes: 10,
    default_servings: 2,
  };
  const recipeLow = {
    id: 'recipe-low',
    title: 'A-Rezept',
    sort_order: 10,
    cook_time_minutes: 10,
    default_servings: 2,
  };
  const { client } = fakeClient({
    catalog_recipes: [
      { data: [recipeLow, recipeHigh], error: null },
      { data: [recipeHigh], error: null },
    ],
    catalog_recipe_component_items: [
      { data: [ingredient('recipe-high')], error: null },
      { data: [ingredient('recipe-low')], error: null },
    ],
  });

  const result = await loadRelevantCatalogRecipes(client, ['product-a', 'product-b']);

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected catalog lookup to succeed');
  assertEquals(result.recipes.map((recipe) => recipe.recipeId), ['recipe-high', 'recipe-low']);
});

Deno.test('uses editorial sort order before title and id for equally relevant recipes', async () => {
  const ingredient = (recipeId: string) => ({
    id: `item-${recipeId}`,
    recipe_id: recipeId,
    product_id: 'product-a',
    ingredient_name: 'Zutat',
    quantity: 1,
    unit: 'piece',
    position: 0,
    products: null,
  });
  const { client } = fakeClient({
    catalog_recipes: [{
      data: [
        {
          id: 'recipe-later',
          title: 'A-Rezept',
          sort_order: 20,
          cook_time_minutes: 10,
          default_servings: 2,
        },
        {
          id: 'recipe-first',
          title: 'Z-Rezept',
          sort_order: 10,
          cook_time_minutes: 10,
          default_servings: 2,
        },
      ],
      error: null,
    }],
    catalog_recipe_component_items: [
      { data: [ingredient('recipe-first')], error: null },
      { data: [ingredient('recipe-later')], error: null },
    ],
  });

  const result = await loadRelevantCatalogRecipes(client, ['product-a']);

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected catalog lookup to succeed');
  assertEquals(result.recipes.map((recipe) => recipe.recipeId), [
    'recipe-first',
    'recipe-later',
  ]);
});

Deno.test('excludes a catalog recipe when its ingredient rows overflow the per-recipe cap', async () => {
  const ingredientRows = Array.from(
    { length: AI_GATEWAY_CONTEXT_LIMITS.catalogIngredientsPerRecipe + 1 },
    (_, index) => ({
      id: `item-${index}`,
      recipe_id: 'recipe-overflow',
      product_id: 'product-a',
      ingredient_name: 'Tomate',
      quantity: 1,
      unit: 'piece',
      position: index,
      products: null,
    }),
  );
  const { client } = fakeClient({
    catalog_recipes: [{
      data: [{
        id: 'recipe-overflow',
        title: 'Überlauf',
        sort_order: 0,
        cook_time_minutes: 10,
        default_servings: 2,
      }],
      error: null,
    }],
    catalog_recipe_component_items: [{ data: ingredientRows, error: null }],
  });

  assertEquals(
    await loadRelevantCatalogRecipes(client, ['product-a']),
    { ok: true, recipes: [] },
  );
});

Deno.test('propagates candidate and ingredient query failures with stable error codes', async () => {
  const candidateFailure = fakeClient({
    catalog_recipes: [{
      data: null,
      error: { message: 'candidate failed' },
    }],
  });
  assertEquals(
    await loadRelevantCatalogRecipes(candidateFailure.client, ['product-a']),
    { ok: false, error: 'recipe_lookup_failed', message: 'candidate failed' },
  );

  const ingredientFailure = fakeClient({
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
    catalog_recipe_component_items: [{
      data: null,
      error: { message: 'ingredient failed' },
    }],
  });
  assertEquals(
    await loadRelevantCatalogRecipes(ingredientFailure.client, ['product-a']),
    { ok: false, error: 'recipe_ingredients_lookup_failed', message: 'ingredient failed' },
  );
});
