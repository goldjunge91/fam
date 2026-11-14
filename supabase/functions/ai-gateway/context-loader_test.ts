import { assertEquals } from 'jsr:@std/assert@1';

import { CONTEXT_LIMITS } from './context-limits.ts';

type FakeResponse = {
  data: unknown[] | Record<string, unknown> | null;
  error: { message: string } | null;
  count?: number;
};

type FakeOrder = {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
};

type FakeCall = {
  table: string;
  select: string | null;
  filters: Array<{ kind: string; column: string; value: unknown }>;
  orders: FakeOrder[];
  limit: number | null;
};

function compareFakeValues(left: unknown, right: unknown, order: FakeOrder): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return order.nullsFirst ? -1 : 1;
  if (right === null || right === undefined) return order.nullsFirst ? 1 : -1;

  const comparison = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), 'de');
  return order.ascending ? comparison : -comparison;
}

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

  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): this {
    const ascending = options?.ascending ?? true;
    this.call.orders.push({
      column,
      ascending,
      nullsFirst: options?.nullsFirst ?? !ascending,
    });
    return this;
  }

  limit(value: number): this {
    this.call.limit = value;
    return this;
  }

  private materializedResponse(): FakeResponse {
    if (!Array.isArray(this.response.data)) return this.response;

    const data = [...this.response.data].sort((left, right) => {
      if (
        typeof left !== 'object' || left === null || Array.isArray(left) ||
        typeof right !== 'object' || right === null || Array.isArray(right)
      ) return 0;
      for (const order of this.call.orders) {
        const comparison = compareFakeValues(
          (left as Record<string, unknown>)[order.column],
          (right as Record<string, unknown>)[order.column],
          order,
        );
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
    return {
      ...this.response,
      data: this.call.limit === null ? data : data.slice(0, this.call.limit),
    };
  }

  maybeSingle(): Promise<FakeResponse> {
    return Promise.resolve(this.materializedResponse());
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?: ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.materializedResponse()).then(onfulfilled, onrejected);
  }
}

function fakeClient(
  responses: Record<string, FakeResponse[]>,
): { client: unknown; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  return {
    client: {
      from(table: string) {
        const call: FakeCall = { table, select: null, filters: [], orders: [], limit: null };
        calls.push(call);
        const response = responses[table]?.shift() ?? { data: [], error: null };
        return new FakeQuery(call, response);
      },
    },
    calls,
  };
}

function pageRecipeData(recipeId = 'recipe-page', title = 'Seitengericht') {
  return {
    id: recipeId,
    household_id: 'household-1',
    title,
    prep_time_minutes: 5,
    cook_time_minutes: 10,
    default_servings: 2,
    dietary_tags: ['vegetarian'],
    deleted_at: null,
    updated_at: '2026-11-01T00:00:00.000Z',
  };
}

function recipeRows(recipeId = 'recipe-page') {
  return {
    recipe_components: [{
      data: [{ id: `component-${recipeId}`, recipe_id: recipeId, name: 'Hauptzutat' }],
      error: null,
    }],
    recipe_component_items: [{
      data: [{
        id: `item-${recipeId}`,
        recipe_id: recipeId,
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
    undefined,
    { mode: 'all' },
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

Deno.test('loads a bounded and stable household recipe selection for the general assistant', async () => {
  const { loadCookingContext } = await loadContextModule();
  const alphaRows = recipeRows('recipe-alpha');
  const zetaRows = recipeRows('recipe-zeta');
  const { client, calls } = fakeClient({
    fridge_items: [{ data: [], error: null, count: 0 }],
    shopping_list_items: [{ data: [], error: null, count: 0 }],
    recipes: [{
      data: [
        pageRecipeData('recipe-zeta', 'Zeta'),
        { ...pageRecipeData('recipe-global', 'Global'), household_id: 'household-2' },
        pageRecipeData('recipe-alpha', 'Alpha'),
      ],
      error: null,
    }],
    recipe_components: [
      ...alphaRows.recipe_components,
      ...zetaRows.recipe_components,
    ],
    recipe_component_items: [
      ...alphaRows.recipe_component_items,
      ...zetaRows.recipe_component_items,
    ],
  });

  const result = await loadCookingContext(
    'user-1',
    'household-1',
    'Bearer user-token',
    false,
    [],
    undefined,
    client as never,
    undefined,
    { mode: 'all' },
  );

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected context to load');
  assertEquals(result.context.householdRecipes?.map((recipe) => recipe.recipeId), [
    'recipe-alpha',
    'recipe-zeta',
  ]);
  const recipeCall = calls.find((call) => call.table === 'recipes');
  assertEquals(recipeCall?.filters, [
    { kind: 'eq', column: 'household_id', value: 'household-1' },
    { kind: 'is', column: 'deleted_at', value: null },
  ]);
  assertEquals(recipeCall?.orders, [
    { column: 'title', ascending: true, nullsFirst: false },
    { column: 'id', ascending: true, nullsFirst: false },
  ]);
  assertEquals(recipeCall?.limit, CONTEXT_LIMITS.householdRecipes);
});

Deno.test('resolves proposal recipe ids only from active recipes in the requested household', async () => {
  const { loadCookingContext } = await loadContextModule();
  const targetRows = recipeRows('recipe-target');
  const { client, calls } = fakeClient({
    fridge_items: [{ data: [], error: null, count: 0 }],
    shopping_list_items: [{ data: [], error: null, count: 0 }],
    recipes: [{
      data: [
        pageRecipeData('recipe-target', 'Ziel'),
        { ...pageRecipeData('recipe-global', 'Ziel'), household_id: 'household-2' },
        { ...pageRecipeData('recipe-deleted', 'Ziel'), deleted_at: '2026-11-01T00:00:00.000Z' },
      ],
      error: null,
    }],
    recipe_components: targetRows.recipe_components,
    recipe_component_items: targetRows.recipe_component_items,
  });

  const result = await loadCookingContext(
    'user-1',
    'household-1',
    'Bearer user-token',
    false,
    [],
    undefined,
    client as never,
    undefined,
    { mode: 'ids', recipeIds: ['recipe-target'] },
  );

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected context to load');
  assertEquals(result.context.householdRecipes?.map((recipe) => recipe.recipeId), [
    'recipe-target',
  ]);
  const recipeCall = calls.find((call) => call.table === 'recipes');
  assertEquals(recipeCall?.filters, [
    { kind: 'eq', column: 'household_id', value: 'household-1' },
    { kind: 'is', column: 'deleted_at', value: null },
    { kind: 'in', column: 'id', value: ['recipe-target'] },
  ]);
  assertEquals(recipeCall?.orders, []);
});

Deno.test('keeps page-context recipe priority over an additional household selection', async () => {
  const { loadCookingContext } = await loadContextModule();
  const { client } = fakeClient({
    fridge_items: [{ data: [], error: null, count: 0 }],
    shopping_list_items: [{ data: [], error: null, count: 0 }],
    recipes: [{ data: [pageRecipeData()], error: null }],
    ...recipeRows(),
  });

  const result = await loadCookingContext(
    'user-1',
    'household-1',
    'Bearer user-token',
    false,
    [],
    { kind: 'recipe', recipeId: 'recipe-page' },
    client as never,
    undefined,
    { mode: 'all' },
  );

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected context to load');
  assertEquals(result.context.householdRecipes?.map((recipe) => recipe.recipeId), ['recipe-page']);
});

Deno.test('loads inventory by expiry relevance before applying the lot cap', async () => {
  const { loadCookingContext } = await loadContextModule();
  const undatedRows = Array.from(
    { length: CONTEXT_LIMITS.inventoryLots + 1 },
    (_, index) => ({
      id: `undated-${String(index).padStart(3, '0')}`,
      product_id: null,
      name: `Undatiert ${String(index).padStart(3, '0')}`,
      quantity: 1,
      unit: 'piece',
      expiry_date: null,
      location_id: null,
    }),
  );
  const { client, calls } = fakeClient({
    fridge_items: [{
      data: [
        ...undatedRows,
        {
          id: 'expires-first',
          product_id: null,
          name: 'Bald verbrauchen',
          quantity: 1,
          unit: 'piece',
          expiry_date: '2026-11-12',
          location_id: null,
        },
      ],
      error: null,
      count: CONTEXT_LIMITS.inventoryLots + 2,
    }],
    shopping_list_items: [{ data: [], error: null, count: 0 }],
  });

  const result = await loadCookingContext(
    'user-1',
    'household-1',
    'Bearer user-token',
    false,
    [],
    undefined,
    client as never,
  );

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected context to load');
  assertEquals(result.context.inventory.lots[0]?.lotId, 'expires-first');
  assertEquals(result.context.inventory.lots.length, CONTEXT_LIMITS.inventoryLots);
  assertEquals(result.context.inventory.omittedCount, 2);
  assertEquals(
    calls.find((call) => call.table === 'fridge_items')?.orders,
    [
      { column: 'expiry_date', ascending: true, nullsFirst: false },
      { column: 'name', ascending: true, nullsFirst: false },
      { column: 'id', ascending: true, nullsFirst: false },
    ],
  );
});

Deno.test('omits meal-plan recipe references that are missing, soft-deleted, or incomplete', async () => {
  const { loadCookingContext } = await loadContextModule();
  const completeRows = recipeRows();
  const { client } = fakeClient({
    fridge_items: [{ data: [], error: null, count: 0 }],
    shopping_list_items: [{ data: [], error: null, count: 0 }],
    meal_plans: [{
      data: { id: 'plan-1', name: 'Woche', week_start_date: '2026-11-09' },
      error: null,
    }],
    meal_plan_entries: [{
      data: [
        {
          id: 'entry-complete',
          entry_date: '2026-11-09',
          meal_slot: 'dinner',
          recipe_id: 'recipe-page',
          custom_title: null,
          custom_ingredients: [],
          portions: 2,
        },
        {
          id: 'entry-missing',
          entry_date: '2026-11-10',
          meal_slot: 'dinner',
          recipe_id: 'recipe-missing',
          custom_title: null,
          custom_ingredients: [],
          portions: 2,
        },
        {
          id: 'entry-soft-deleted',
          entry_date: '2026-11-11',
          meal_slot: 'dinner',
          recipe_id: 'recipe-soft-deleted',
          custom_title: null,
          custom_ingredients: [],
          portions: 2,
        },
        {
          id: 'entry-incomplete',
          entry_date: '2026-11-12',
          meal_slot: 'dinner',
          recipe_id: 'recipe-incomplete',
          custom_title: null,
          custom_ingredients: [],
          portions: 2,
        },
        {
          id: 'entry-custom',
          entry_date: '2026-11-13',
          meal_slot: 'dinner',
          recipe_id: null,
          custom_title: 'Resteabend',
          custom_ingredients: [],
          portions: 2,
        },
      ],
      error: null,
      count: 5,
    }],
    recipes: [{
      data: [
        pageRecipeData(),
        {
          ...pageRecipeData(),
          id: 'recipe-incomplete',
          title: 'Unvollständig',
        },
      ],
      error: null,
    }],
    recipe_components: [
      ...completeRows.recipe_components,
      { data: [], error: null },
    ],
    recipe_component_items: [
      ...completeRows.recipe_component_items,
      { data: [], error: null },
    ],
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
  assertEquals(
    result.context.mealPlan?.entries.map((entry) => ({
      entryId: entry.entryId,
      recipeId: entry.recipeId,
      title: entry.title,
    })),
    [
      { entryId: 'entry-complete', recipeId: 'recipe-page', title: 'Seitengericht' },
      { entryId: 'entry-custom', recipeId: null, title: 'Resteabend' },
    ],
  );
});
