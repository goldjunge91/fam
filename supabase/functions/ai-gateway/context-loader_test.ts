import { assertEquals } from 'jsr:@std/assert@1';

import { CONTEXT_LIMITS } from './context-limits.ts';

type FakeResponse = {
  data: unknown[] | Record<string, unknown> | null;
  error: { message: string } | null;
  count?: number;
};

type FakeCall = {
  table: string;
  select: string | null;
  filters: Array<{ kind: string; column: string; value: unknown }>;
  limit: number | null;
};

class FakeQuery {
  constructor(
    private readonly call: FakeCall,
    private readonly response: FakeResponse,
  ) {}

  select(columns: string): this {
    this.call.select = columns;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'eq', column, value });
    return this;
  }

  is(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'is', column, value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'gt', column, value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'gte', column, value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'lte', column, value });
    return this;
  }

  in(column: string, value: string[]): this {
    this.call.filters.push({ kind: 'in', column, value });
    return this;
  }

  order(): this {
    return this;
  }

  limit(value: number): this {
    this.call.limit = value;
    return this;
  }

  maybeSingle(): Promise<FakeResponse> {
    return Promise.resolve(this.response);
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?: ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function fakeClient(
  responses: Record<string, FakeResponse[]>,
): { client: unknown; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  return {
    client: {
      from(table: string) {
        const call: FakeCall = { table, select: null, filters: [], limit: null };
        calls.push(call);
        const response = responses[table]?.shift() ?? { data: [], error: null };
        return new FakeQuery(call, response);
      },
    },
    calls,
  };
}

function pageRecipeData() {
  return {
    id: 'recipe-page',
    title: 'Seitengericht',
    prep_time_minutes: 5,
    cook_time_minutes: 10,
    default_servings: 2,
    dietary_tags: ['vegetarian'],
    updated_at: '2026-11-01T00:00:00.000Z',
  };
}

function recipeRows() {
  return {
    recipe_components: [{
      data: [{ id: 'component-1', recipe_id: 'recipe-page', name: 'Hauptzutat' }],
      error: null,
    }],
    recipe_component_items: [{
      data: [{
        id: 'item-1',
        recipe_id: 'recipe-page',
        product_id: 'product-tomato',
        sub_component_id: null,
        quantity: 1,
        unit: 'piece',
        ingredient_mapping: {
          version: 1,
          status: 'unknown',
          ingredientIds: [],
          complete: false,
        },
        ingredient_source_type: null,
        ingredient_source_id: null,
        ingredient_source_url: null,
        ingredient_source_version: null,
        ingredient_source_license: null,
        products: { name: 'Tomate' },
      }],
      error: null,
    }],
  };
}

async function loadContextModule() {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.set('SUPABASE_ANON_KEY', 'local-anon');
  Deno.env.set('SUPABASE_SECRET_KEY', 'local-service');
  return await import('./index.ts');
}

Deno.test('loads only the explicit page recipe and keeps shopping names as bounded snapshots', async () => {
  const { loadCookingContext } = await loadContextModule();
  const shoppingNames = Array.from(
    { length: CONTEXT_LIMITS.recipeNamesPerShoppingItem + 2 },
    (_, index) => `Rezept ${index}`,
  );
  const { client, calls } = fakeClient({
    profile_food_rules: [{ data: null, error: null }],
    fridge_items: [{ data: [], error: null, count: 0 }],
    shopping_list_items: [{
      data: [{
        id: 'shopping-1',
        product_id: null,
        name: 'Tomaten',
        quantity: 1,
        unit: 'piece',
        category_id: null,
        store_id: null,
        checked_at: null,
        recipe_names: shoppingNames,
      }],
      error: null,
      count: 1,
    }],
    recipes: [{ data: [pageRecipeData()], error: null }],
    ...recipeRows(),
  });

  const result = await loadCookingContext(
    'user-1',
    'household-1',
    'Bearer user-token',
    true,
    [],
    { kind: 'recipe', recipeId: 'recipe-page' },
    client as never,
  );

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected context to load');
  assertEquals(result.context.householdRecipes?.map((recipe) => recipe.recipeId), ['recipe-page']);
  assertEquals(
    result.context.shoppingList?.[0]?.recipeNames.length,
    CONTEXT_LIMITS.recipeNamesPerShoppingItem,
  );
  assertEquals(result.context.shoppingList?.[0]?.recipeNamesTruncated, true);
  assertEquals(result.context.shoppingList?.[0]?.recipeNamesOmittedCount, 2);
  assertEquals(result.context.shoppingList?.[0]?.productId, null);
  assertEquals(result.context.recipes, []);
  assertEquals(calls.filter((call) => call.table === 'recipes').length, 1);
  assertEquals(calls.some((call) => call.table === 'catalog_recipe_component_items'), false);
});

Deno.test('loads visible meal-plan recipes in date order without an unrelated household fallback', async () => {
  const { loadCookingContext } = await loadContextModule();
  const mealEntries = Array.from({ length: CONTEXT_LIMITS.mealPlanEntries + 1 }, (_, index) => ({
    id: `entry-${index}`,
    entry_date: `2026-11-${String(9 + Math.min(index, 6)).padStart(2, '0')}`,
    meal_slot: 'dinner',
    recipe_id: 'recipe-page',
    custom_title: null,
    custom_ingredients: [],
    portions: 2,
  }));
  const { client, calls } = fakeClient({
    fridge_items: [{ data: [], error: null, count: 0 }],
    shopping_list_items: [{ data: [], error: null, count: 0 }],
    meal_plans: [{
      data: { id: 'plan-1', name: 'Woche', week_start_date: '2026-11-09' },
      error: null,
    }],
    meal_plan_entries: [{ data: mealEntries, error: null, count: mealEntries.length }],
    recipes: [{ data: [pageRecipeData()], error: null }],
    ...recipeRows(),
  });

  const result = await loadCookingContext(
    'user-1',
    'household-1',
    'Bearer user-token',
    false,
    [],
    { kind: 'meal_plan', weekStartDate: '2026-11-09' },
    client as never,
  );

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected context to load');
  assertEquals(result.context.mealPlan?.entries.length, CONTEXT_LIMITS.mealPlanEntries);
  assertEquals(result.context.mealPlan?.truncated, true);
  assertEquals(result.context.mealPlan?.omittedCount, 1);
  assertEquals(result.context.householdRecipes?.map((recipe) => recipe.recipeId), ['recipe-page']);
  assertEquals(calls.filter((call) => call.table === 'recipes').length, 1);
});
