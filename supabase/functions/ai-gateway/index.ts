// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  ALLOWED_MODELS,
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayInventoryContext,
  type GatewayLot,
  type GatewayRecipe,
  type GatewayAccessResult,
} from './handler.ts';
import { createOpenRouterChatBody } from './openrouter-request.ts';
import { buildCatalogRecipeAllergenProjections } from './ingredient-knowledge.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
const openRouterBaseUrl = (Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const defaultModel = Deno.env.get('AI_GATEWAY_MODEL') ?? 'z-ai/glm-5.3-flash';
const llmEnabled = (Deno.env.get('AI_GATEWAY_LLM_ENABLED') ?? 'false').trim().toLowerCase() === 'true';
const allowedModels = (Deno.env.get('AI_GATEWAY_ALLOWED_MODELS') ?? '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const userRateLimit = Number(Deno.env.get('AI_GATEWAY_RATE_LIMIT') ?? 30);
const monthlyCreditLimit = Number(Deno.env.get('AI_MONTHLY_CREDIT_LIMIT') ?? 100);
const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
const devBypassEnabled =
  (Deno.env.get('AI_GATEWAY_DEV_BYPASS_ENABLED') ?? '').trim().toLowerCase() === 'true';
const devBypassUserIds = new Set(
  (Deno.env.get('AI_GATEWAY_DEV_USER_IDS') ?? '')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean),
);

function firstRow<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function unavailableAccess(): GatewayAccessResult {
  return { ok: false, status: 503, error: 'gateway_unavailable' };
}

function numericRetryAfter(value: unknown): number | undefined {
  const retryAfter = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(retryAfter) ? Math.max(1, Math.ceil(retryAfter)) : undefined;
}

async function consumeRateLimit(userId: string): Promise<GatewayAccessResult> {
  if (!adminClient || !Number.isSafeInteger(userRateLimit) || userRateLimit < 1) {
    return unavailableAccess();
  }
  const { data, error } = await adminClient.rpc('consume_request_limit', {
    p_user_id: userId,
    p_scope: 'ai-gateway',
    p_limit: userRateLimit,
    p_window_seconds: 60,
  });
  if (error) return unavailableAccess();
  const row = firstRow(data as unknown as Array<{ allowed: boolean; retry_after: unknown }>);
  if (!row || typeof row.allowed !== 'boolean') return unavailableAccess();
  if (row.allowed) return { ok: true };
  return {
    ok: false,
    status: 429,
    error: 'rate_limited',
    ...(numericRetryAfter(row.retry_after) === undefined
      ? {}
      : { retryAfter: numericRetryAfter(row.retry_after) }),
  };
}

function creditError(error: { message?: string } | null): GatewayAccessResult {
  const message = error?.message ?? '';
  if (message.includes('ai_credit_limit_exceeded')) {
    return { ok: false, status: 429, error: 'ai_credit_limit_exceeded' };
  }
  if (message.includes('ai_household_not_assigned') || message.includes('ai_entitlement_required')) {
    return { ok: false, status: 403, error: 'ai_entitlement_required' };
  }
  return unavailableAccess();
}

async function reserveCredit(input: {
  householdId: string;
  action: 'suggestion' | 'voice';
  requestId: string;
}): Promise<GatewayAccessResult> {
  if (!adminClient || !Number.isSafeInteger(monthlyCreditLimit) || monthlyCreditLimit < 1) {
    return unavailableAccess();
  }
  const { data, error } = await adminClient.rpc('book_ai_credit', {
    p_household_id: input.householdId,
    p_action: input.action,
    p_request_id: input.requestId,
    p_monthly_limit: monthlyCreditLimit,
  });
  if (error) return creditError(error);
  const row = firstRow(data as unknown as Array<{ blocked: unknown }>);
  if (!row || typeof row.blocked !== 'boolean') return unavailableAccess();
  return { ok: true };
}

async function releaseCredit(requestId: string): Promise<void> {
  if (!adminClient) return;
  const { error } = await adminClient.rpc('release_ai_credit', { p_request_id: requestId });
  if (error) {
    console.error(JSON.stringify({ event: 'ai_gateway_credit_release_failed', requestId }));
  }
}

function readErrorCode(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null;
  const error = value.error;
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

async function readResponseErrorCode(response: Response): Promise<string | null> {
  try {
    return readErrorCode(await response.clone().json());
  } catch {
    return null;
  }
}

function userClient(request: Request) {
  const authorization = request.headers.get('Authorization');
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

async function authenticate(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return { ok: false as const, status: 401, error: 'missing_authorization' };
  }

  const { data, error } = await userClient(request).auth.getUser();
  if (error || !data.user) {
    return { ok: false as const, status: 401, error: 'unauthorized' };
  }
  return { ok: true as const, userId: data.user.id, authorization };
}

async function assertHouseholdMember(userId: string, householdId: string, authorization: string) {
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client
    .from('household_members')
    .select('household_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500, error: 'household_lookup_failed', message: error.message };
  }
  if (!data) return { ok: false as const, status: 403, error: 'household_forbidden' };
  return { ok: true as const, userId };
}

function storageKind(value: unknown): GatewayLot['storage'] {
  return value === 'fridge' || value === 'freezer' || value === 'pantry' ? value : 'unknown';
}

function classifyPerishability(tags: unknown): 'perishable' | 'unknown' {
  const perishableSuffixes = new Set([
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
  if (!Array.isArray(tags)) return 'unknown';
  const hasPerishable = tags.some((tag) => {
    if (typeof tag !== 'string') return false;
    const normalized = tag.trim().toLocaleLowerCase('en-US');
    const separator = normalized.indexOf(':');
    return perishableSuffixes.has(separator === -1 ? normalized : normalized.slice(separator + 1));
  });
  return hasPerishable ? 'perishable' : 'unknown';
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

async function loadCookingContext(userId: string, householdId: string, authorization: string) {
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: inventoryRows, error: inventoryError } = await client
    .from('fridge_items')
    .select('id, product_id, name, quantity, unit, expiry_date, location_id')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .gt('quantity', 0);
  if (inventoryError) {
    return { ok: false as const, status: 500, error: 'inventory_lookup_failed', message: inventoryError.message };
  }

  const rows = inventoryRows ?? [];
  const locationIds = [...new Set(rows.map((row) => row.location_id).filter(Boolean))];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))];
  const [locationsResult, productsResult] = await Promise.all([
    locationIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client.from('storage_locations').select('id, kind').in('id', locationIds),
    productIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client.from('products').select('id, name, off_category_tags').in('id', productIds),
  ]);
  if (locationsResult.error || productsResult.error) {
    return {
      ok: false as const,
      status: 500,
      error: 'inventory_enrichment_failed',
      message: locationsResult.error?.message ?? productsResult.error?.message,
    };
  }

  const locations = new Map((locationsResult.data ?? []).map((row) => [row.id, row.kind]));
  const products = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
  const lots: GatewayLot[] = rows
    .map((row) => {
      const product = row.product_id ? products.get(row.product_id) : undefined;
      return {
        lotId: row.id,
        productId: row.product_id ?? null,
        normalizedName: String(row.name).trim(),
        quantity: typeof row.quantity === 'number' ? row.quantity : null,
        unit: typeof row.unit === 'string' ? row.unit : null,
        bestBefore: normalizeDate(row.expiry_date),
        useBy: null,
        storage: storageKind(row.location_id ? locations.get(row.location_id) : null),
        perishability: classifyPerishability(product?.off_category_tags),
      };
    })
    .filter((lot) => lot.normalizedName.length > 0)
    .map(({ perishability: _perishability, ...lot }) => lot)
    .sort((a, b) => {
      const aDate = a.useBy ?? a.bestBefore;
      const bDate = b.useBy ?? b.bestBefore;
      if (aDate !== bDate) {
        if (aDate === null) return 1;
        if (bDate === null) return -1;
        return aDate.localeCompare(bDate);
      }
      return a.normalizedName.localeCompare(b.normalizedName, 'de') || a.lotId.localeCompare(b.lotId);
    });

  const { data: shoppingRows, error: shoppingError } = await client
    .from('shopping_list_items')
    .select('id, name, quantity, unit')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .is('checked_at', null)
    .gt('quantity', 0)
    .order('created_at', { ascending: true });
  if (shoppingError) {
    return { ok: false as const, status: 500, error: 'shopping_list_lookup_failed', message: shoppingError.message };
  }

  const { data: foodRules, error: foodRulesError } = await client
    .from('profile_food_rules')
    .select('allergy_codes, custom_allergies, intolerance_codes, custom_intolerances, disliked_foods')
    .eq('user_id', userId)
    .maybeSingle();
  if (foodRulesError) {
    return { ok: false as const, status: 500, error: 'food_rules_lookup_failed', message: foodRulesError.message };
  }

  const allergies = [
    ...(foodRules?.allergy_codes ?? []),
    ...(foodRules?.custom_allergies ?? []),
    ...(foodRules?.intolerance_codes ?? []),
    ...(foodRules?.custom_intolerances ?? []),
  ];
  const dislikedFoods = foodRules?.disliked_foods ?? [];

  const { data: recipeRows, error: recipeError } = await client
    .from('catalog_recipes')
    .select('id, title, cook_time_minutes, default_servings, dietary_tags')
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (recipeError) {
    return { ok: false as const, status: 500, error: 'recipe_lookup_failed', message: recipeError.message };
  }

  const recipeIds = (recipeRows ?? []).map((row) => row.id);
  const { data: itemRows, error: itemError } = recipeIds.length === 0
    ? { data: [], error: null }
    : await client
        .from('catalog_recipe_component_items')
        .select('id, recipe_id, product_id, ingredient_name, quantity, grams, unit, position')
        .in('recipe_id', recipeIds)
        .order('position', { ascending: true });
  if (itemError) {
    return { ok: false as const, status: 500, error: 'recipe_ingredients_lookup_failed', message: itemError.message };
  }

  const { data: stepRows, error: stepError } = recipeIds.length === 0
    ? { data: [], error: null }
    : await client
        .from('catalog_recipe_steps')
        .select('recipe_id, text, position')
        .in('recipe_id', recipeIds)
        .order('position', { ascending: true });
  if (stepError) {
    return { ok: false as const, status: 500, error: 'recipe_steps_lookup_failed', message: stepError.message };
  }

  const recipeProductIds = [...new Set((itemRows ?? []).map((row) => row.product_id).filter(Boolean))];
  const { data: productIngredientLinkRows, error: productIngredientLinkError } = recipeProductIds.length === 0
    ? { data: [], error: null }
    : await client
        .from('product_ingredient_links')
        .select('product_id, ingredient_id')
        .in('product_id', recipeProductIds);
  if (productIngredientLinkError) {
    return {
      ok: false as const,
      status: 500,
      error: 'product_ingredient_links_lookup_failed',
      message: productIngredientLinkError.message,
    };
  }

  const catalogItemIds = [...new Set((itemRows ?? []).map((row) => row.id).filter(Boolean))];
  const { data: ingredientLinkRows, error: ingredientLinkError } = catalogItemIds.length === 0
    ? { data: [], error: null }
    : await client
        .from('catalog_recipe_item_ingredient_links')
        .select('catalog_item_id, ingredient_id')
        .in('catalog_item_id', catalogItemIds);
  if (ingredientLinkError) {
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_ingredient_links_lookup_failed',
      message: ingredientLinkError.message,
    };
  }

  const ingredientIds = [...new Set([
    ...(ingredientLinkRows ?? []).map((row) => row.ingredient_id),
    ...(productIngredientLinkRows ?? []).map((row) => row.ingredient_id),
  ].filter(Boolean))];
  const { data: ingredientRows, error: ingredientError } = ingredientIds.length === 0
    ? { data: [], error: null }
    : await client
        .from('external_food_ingredients')
        .select('id, allergen_resolution, allergen_reviewed_at')
        .in('id', ingredientIds);
  if (ingredientError) {
    return {
      ok: false as const,
      status: 500,
      error: 'ingredient_knowledge_lookup_failed',
      message: ingredientError.message,
    };
  }

  const { data: ingredientMappingRows, error: ingredientMappingError } = ingredientIds.length === 0
    ? { data: [], error: null }
    : await client
        .from('ingredient_allergen_mappings')
        .select('ingredient_id, allergen_id, relation, confidence, reviewed_at')
        .in('ingredient_id', ingredientIds);
  if (ingredientMappingError) {
    return {
      ok: false as const,
      status: 500,
      error: 'ingredient_allergen_mappings_lookup_failed',
      message: ingredientMappingError.message,
    };
  }

  const recipeIdByItemId = new Map((itemRows ?? []).map((row) => [row.id, row.recipe_id]));
  const itemIdsByProductId = new Map<string, string[]>();
  for (const row of itemRows ?? []) {
    if (!row.product_id) continue;
    const itemIds = itemIdsByProductId.get(row.product_id) ?? [];
    itemIds.push(row.id);
    itemIdsByProductId.set(row.product_id, itemIds);
  }
  const productLinksAsCatalogLinks = (productIngredientLinkRows ?? []).flatMap((row) =>
    (itemIdsByProductId.get(row.product_id) ?? []).map((catalogItemId) => ({
      catalogItemId,
      recipeId: recipeIdByItemId.get(catalogItemId),
      ingredientId: row.ingredient_id,
    }))
  );
  const recipeAllergenProjections = buildCatalogRecipeAllergenProjections(
    recipeIds,
    [...(ingredientLinkRows ?? [])
      .map((row) => ({
        catalogItemId: row.catalog_item_id,
        recipeId: recipeIdByItemId.get(row.catalog_item_id),
        ingredientId: row.ingredient_id,
      }))
      .filter((row) => typeof row.recipeId === 'string')
      .map((row) => ({
        catalogItemId: row.catalogItemId,
        recipeId: row.recipeId,
        ingredientId: row.ingredientId,
      })), ...productLinksAsCatalogLinks]
      .filter((row) => typeof row.recipeId === 'string')
      .map((row) => ({
        catalogItemId: row.catalogItemId,
        recipeId: row.recipeId,
        ingredientId: row.ingredientId,
      })),
    (ingredientRows ?? []).map((row) => ({
      id: row.id,
      allergenResolution: row.allergen_resolution,
      allergenReviewedAt: row.allergen_reviewed_at,
    })),
    (ingredientMappingRows ?? []).map((row) => ({
      ingredientId: row.ingredient_id,
      allergenId: row.allergen_id,
      relation: row.relation,
      confidence: row.confidence,
      reviewedAt: row.reviewed_at,
    })),
  );

  const { data: recipeProducts, error: recipeProductsError } = recipeProductIds.length === 0
    ? { data: [], error: null }
    : await client.from('products').select('id, name').in('id', recipeProductIds);
  if (recipeProductsError) {
    return { ok: false as const, status: 500, error: 'recipe_products_lookup_failed', message: recipeProductsError.message };
  }

  const recipeProductNames = new Map((recipeProducts ?? []).map((row) => [row.id, row.name]));
  const ingredientsByRecipe = new Map<string, GatewayRecipe['ingredients']>();
  const incompleteRecipeIds = new Set<string>();
  for (const row of itemRows ?? []) {
    const name = typeof row.ingredient_name === 'string' && row.ingredient_name.trim().length > 0
      ? row.ingredient_name.trim()
      : row.product_id
        ? String(recipeProductNames.get(row.product_id) ?? '').trim()
        : '';
    if (!name) {
      incompleteRecipeIds.add(row.recipe_id);
      continue;
    }
    const current = ingredientsByRecipe.get(row.recipe_id) ?? [];
    const quantity = typeof row.quantity === 'number'
      ? row.quantity
      : typeof row.grams === 'number'
        ? row.grams
        : null;
    current.push({
      productId: row.product_id ?? null,
      normalizedName: name,
      quantity,
      unit: typeof row.quantity === 'number' && typeof row.unit === 'string'
        ? row.unit
        : quantity !== null
          ? 'g'
          : null,
    });
    ingredientsByRecipe.set(row.recipe_id, current);
  }

  const stepsByRecipe = new Map<string, string[]>();
  for (const row of stepRows ?? []) {
    if (typeof row.text !== 'string' || row.text.trim().length === 0) {
      incompleteRecipeIds.add(row.recipe_id);
      continue;
    }
    const steps = stepsByRecipe.get(row.recipe_id) ?? [];
    steps.push(row.text.trim());
    stepsByRecipe.set(row.recipe_id, steps);
  }

  const recipes: GatewayRecipe[] = (recipeRows ?? []).map((row) => ({
    recipeId: row.id,
    title: String(row.title).trim(),
    source: 'catalog',
    estimatedMinutes: typeof row.cook_time_minutes === 'number' ? row.cook_time_minutes : null,
    servings: typeof row.default_servings === 'number' ? row.default_servings : null,
    dietaryTags: Array.isArray(row.dietary_tags) ? row.dietary_tags : [],
    allergens: recipeAllergenProjections.get(row.id) ?? null,
    ingredients: incompleteRecipeIds.has(row.id) ? [] : ingredientsByRecipe.get(row.id) ?? [],
    steps: stepsByRecipe.get(row.id) ?? [],
  }));

  const context: GatewayCookingContext = {
    inventory: {
      source: 'inventory',
      fetchedAt: new Date().toISOString(),
      lots,
    } satisfies GatewayInventoryContext,
    recipes,
    allergies,
    preferences: [],
    forbiddenIngredients: dislikedFoods,
    shoppingItems: (shoppingRows ?? [])
      .filter((row) => typeof row.name === 'string' && row.name.trim().length > 0)
      .map((row) => ({
        shoppingItemId: row.id,
        name: row.name.trim(),
        quantity: typeof row.quantity === 'number' ? row.quantity : 1,
        unit: typeof row.unit === 'string' ? row.unit : 'piece',
      })),
  };
  return { ok: true as const, context };
}

async function complete({ model, messages }: { model: string; messages: Array<{ role: 'system' | 'user'; content: string }> }) {
  if (!llmEnabled) {
    console.info(JSON.stringify({
      event: 'ai_gateway_llm_blocked',
      model,
      error: 'llm_temporarily_disabled',
    }));
    return { ok: false as const, status: 503, error: 'llm_temporarily_disabled' };
  }

  if (!openRouterKey) {
    console.warn(JSON.stringify({ event: 'ai_gateway_provider_failure', stage: 'configuration', model, error: 'provider_not_configured' }));
    return { ok: false as const, status: 503, error: 'provider_not_configured' };
  }

  let response: Response;
  try {
    response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        ...(Deno.env.get('OPENROUTER_SITE_URL') ? { 'HTTP-Referer': Deno.env.get('OPENROUTER_SITE_URL')! } : {}),
        ...(Deno.env.get('OPENROUTER_SITE_NAME') ? { 'X-Title': Deno.env.get('OPENROUTER_SITE_NAME')! } : {}),
      },
      body: JSON.stringify(createOpenRouterChatBody({ model, messages })),
      signal: AbortSignal.timeout(Number(Deno.env.get('AI_GATEWAY_TIMEOUT_MS') ?? 45_000)),
    });
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'ai_gateway_provider_failure',
      stage: 'request',
      model,
      error: 'provider_unavailable',
      errorType: error instanceof Error ? error.name : typeof error,
    }));
    return { ok: false as const, status: 502, error: 'provider_unavailable' };
  }

  if (!response.ok) {
    let providerCode: string | null = null;
    try {
      const providerBody = await response.clone().json();
      providerCode = readErrorCode(providerBody);
    } catch {
      // Die Antwort bleibt absichtlich ohne Provider-Body im Log, damit keine Details leaken.
    }
    console.warn(JSON.stringify({
      event: 'ai_gateway_provider_failure',
      stage: 'response',
      model,
      status: response.status,
      providerCode,
      error: 'provider_request_failed',
    }));
    return { ok: false as const, status: 502, error: 'provider_request_failed' };
  }
  let body: {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: unknown;
  };
  try {
    body = await response.json();
  } catch {
    console.warn(JSON.stringify({ event: 'ai_gateway_provider_failure', stage: 'parse', model, error: 'provider_invalid_response' }));
    return { ok: false as const, status: 502, error: 'provider_invalid_response' };
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    console.warn(JSON.stringify({ event: 'ai_gateway_provider_failure', stage: 'content', model, error: 'provider_empty_response' }));
    return { ok: false as const, status: 502, error: 'provider_empty_response' };
  }
  return { ok: true as const, content, model, usage: body?.usage };
}

const handler = createAiGatewayHandler({
  authenticate,
  assertHouseholdMember,
  loadCookingContext,
  complete,
  consumeRateLimit,
  reserveCredit,
  releaseCredit,
  allowDevelopmentBypass: (userId) => devBypassEnabled && devBypassUserIds.has(userId),
  allowedModels: allowedModels.length > 0 ? allowedModels : ALLOWED_MODELS,
  defaultModel,
});

Deno.serve(async (request) => {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await handler(request);
  } catch (error) {
    console.error('ai_gateway_unhandled_error', error);
    response = new Response(JSON.stringify({ error: 'gateway_unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  console.info(
    JSON.stringify({
      event: 'ai_gateway_request',
      method: request.method,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      error: response.status >= 400 ? await readResponseErrorCode(response) : null,
    }),
  );
  return response;
});
