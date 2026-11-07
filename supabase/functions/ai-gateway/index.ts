import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  type ChefRecipeSnapshotInput,
  type ChefRequestPayload,
  type ChefResponsePayload,
  parseChefConversationContext,
  parseChefConversationPreflight,
  parseChefExchangeLookup,
  parseChefHistoryHydration,
} from './chef-history.ts';
import {
  ALLOWED_MODELS,
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayCreditAction,
  type GatewayInventoryContext,
  type GatewayLot,
  type GatewayRecipe,
} from './handler.ts';
import { resolveDefaultModel } from './config.ts';
import {
  createAiEntitlementAuthorizer,
  readAiEntitlementServerConfig,
} from './entitlement-authorization.ts';
import { createOpenRouterChatBody, parseOpenRouterChatCompletion } from './openrouter-request.ts';
import { projectRecipeAllergens } from './recipe-allergen-projection.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';
import { SlidingWindowRateLimiter } from '../enrich-off-product/rate-limiter.ts';
import { createRevenueCatSubscriberStatusReader } from '../revenuecat-webhook/subscriber-status.ts';
import { withRequestId } from '../_shared/http.ts';
import { requireDefaultSupabaseKey } from '../_shared/supabase-keys.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = requireDefaultSupabaseKey('SUPABASE_PUBLISHABLE_KEYS');
const aiEntitlementServerConfig = readAiEntitlementServerConfig((name) => Deno.env.get(name));
const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
const openRouterBaseUrl = (Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1')
  .replace(/\/$/, '');
const defaultModel = resolveDefaultModel(Deno.env.get('AI_GATEWAY_MODEL'));
const MAX_CATALOG_RECIPES_PER_REQUEST = 100;
const rateLimiter = new SlidingWindowRateLimiter(
  Number(Deno.env.get('AI_GATEWAY_RATE_LIMIT') ?? 30),
  60_000,
);
const readRevenueCatStatus = createRevenueCatSubscriberStatusReader(
  Deno.env.get('REVENUECAT_SECRET_API_KEY'),
  fetch,
  {
    allowSandboxAiEntitlement: aiEntitlementServerConfig.allowSandboxEntitlements,
  },
);

function createAdminClient() {
  return createClient(supabaseUrl, aiEntitlementServerConfig.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function userClient(request: Request, requestId: string) {
  const authorization = request.headers.get('Authorization');
  return createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        'X-Request-Id': requestId,
      },
    },
  });
}

async function authenticate(request: Request, requestId: string) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return { ok: false as const, status: 401, error: 'missing_authorization' };
  }

  const { data, error } = await userClient(request, requestId).auth.getUser();
  if (error || !data.user) {
    return { ok: false as const, status: 401, error: 'unauthorized' };
  }
  return { ok: true as const, userId: data.user.id, authorization };
}

async function assertHouseholdMember(
  userId: string,
  householdId: string,
  authorization: string,
  requestId: string,
) {
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization, 'X-Request-Id': requestId } },
  });
  const { data, error } = await client
    .from('household_members')
    .select('household_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: 'household_lookup_failed',
    };
  }
  if (!data) {
    return { ok: false as const, status: 403, error: 'household_forbidden' };
  }
  return { ok: true as const, userId, authorization };
}

function historyRpcFailure(
  message: string,
  fallback: string,
): { ok: false; status: number; error: string } {
  for (
    const [needle, status, error] of [
      ['household_forbidden', 403, 'household_forbidden'],
      ['invalid_request', 400, 'invalid_request'],
      ['chef_history_payload_invalid', 400, 'invalid_request'],
      ['chef_recipe_snapshot_invalid', 400, 'invalid_request'],
      ['chef_conversation_not_found', 404, 'chef_conversation_not_found'],
      ['chef_request_replay_mismatch', 409, 'chef_request_replay_mismatch'],
      ['chef_request_already_refunded', 409, 'chef_request_already_refunded'],
      ['chef_conversation_source_immutable', 409, 'chef_conversation_source_immutable'],
      ['chef_conversation_continuation_expired', 409, 'chef_conversation_continuation_expired'],
    ] as const
  ) {
    if (message.includes(needle)) return { ok: false, status, error };
  }
  return { ok: false, status: 500, error: fallback };
}

async function lookupChefExchange(input: {
  householdId: string;
  actorUserId: string;
  clientRequestId: string;
  requestFingerprint: string;
}) {
  const { data, error } = await createAdminClient().rpc('lookup_chef_exchange', {
    p_household_id: input.householdId,
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_request_fingerprint: input.requestFingerprint,
  });
  if (error) return historyRpcFailure(error.message, 'chef_history_lookup_failed');
  const value = parseChefExchangeLookup(data);
  return value === null
    ? { ok: false as const, status: 500, error: 'chef_history_lookup_failed' }
    : { ok: true as const, value };
}

async function preflightChefExchange(input: {
  householdId: string;
  actorUserId: string;
  conversationId: string | null;
  continuedFromConversationId: string | null;
}) {
  const { data, error } = await createAdminClient().rpc('preflight_chef_exchange', {
    p_household_id: input.householdId,
    p_actor_user_id: input.actorUserId,
    p_conversation_id: input.conversationId,
    p_continued_from_conversation_id: input.continuedFromConversationId,
  });
  if (error) return historyRpcFailure(error.message, 'chef_conversation_preflight_failed');
  const value = parseChefConversationPreflight(data);
  return value === null
    ? { ok: false as const, status: 500, error: 'chef_conversation_preflight_failed' }
    : { ok: true as const, value };
}

async function loadChefConversationContext(input: {
  householdId: string;
  actorUserId: string;
  conversationId: string;
}) {
  const { data, error } = await createAdminClient().rpc('get_chef_conversation_context', {
    p_household_id: input.householdId,
    p_actor_user_id: input.actorUserId,
    p_conversation_id: input.conversationId,
    p_max_depth: 20,
    p_max_chars: 32_000,
  });
  if (error) return historyRpcFailure(error.message, 'chef_history_context_lookup_failed');
  const value = parseChefConversationContext(data);
  return value === null
    ? { ok: false as const, status: 500, error: 'chef_history_context_lookup_failed' }
    : { ok: true as const, value };
}

async function persistChefExchange(input: {
  householdId: string;
  actorUserId: string;
  conversationId: string | null;
  continuedFromConversationId: string | null;
  clientRequestId: string;
  requestFingerprint: string;
  requestPayload: ChefRequestPayload;
  userText: string;
  responsePayload: ChefResponsePayload;
  recipeSnapshots: ChefRecipeSnapshotInput[];
}) {
  const { data, error } = await createAdminClient().rpc('persist_chef_exchange', {
    p_household_id: input.householdId,
    p_actor_user_id: input.actorUserId,
    p_conversation_id: input.conversationId,
    p_continued_from_conversation_id: input.continuedFromConversationId,
    p_client_request_id: input.clientRequestId,
    p_request_fingerprint: input.requestFingerprint,
    p_request_payload: input.requestPayload,
    p_user_text: input.userText,
    p_response_payload: input.responsePayload,
    p_recipe_snapshots: input.recipeSnapshots,
  });
  if (error) return historyRpcFailure(error.message, 'chef_history_persist_failed');
  const value = parseChefHistoryHydration(data);
  return value === null
    ? { ok: false as const, status: 500, error: 'chef_history_persist_failed' }
    : { ok: true as const, value };
}

const authorizeAiEntitlement = createAiEntitlementAuthorizer({
  allowAuthenticatedUserRecovery: aiEntitlementServerConfig.allowSandboxEntitlements,
  readHouseholdProjection: async ({ householdId, authorization, requestId }) => {
    const client = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization, 'X-Request-Id': requestId } },
    });
    const { data, error } = await client
      .from('households')
      .select('ai_active, ai_expires_at, ai_subscriber_id')
      .eq('id', householdId)
      .maybeSingle();

    return error ? { ok: false as const } : { ok: true as const, projection: data };
  },
  readSubscriberStatus: readRevenueCatStatus,
  assignAiHousehold: async ({
    subscriberUserId,
    householdId,
    entitlementExpiresAt,
    eventTimestampMs,
  }) => {
    const { data: applied, error } = await createAdminClient().rpc(
      'assign_ai_household',
      {
        p_subscriber_user_id: subscriberUserId,
        p_target_household_id: householdId,
        p_entitlement_expires_at: entitlementExpiresAt,
        p_event_timestamp_ms: eventTimestampMs,
      },
    );
    return !error && applied === true;
  },
  deactivateAiHousehold: async ({ subscriberUserId, eventTimestampMs }) => {
    const { data: applied, error } = await createAdminClient().rpc(
      'deactivate_ai_household',
      {
        p_subscriber_user_id: subscriberUserId,
        p_event_timestamp_ms: eventTimestampMs,
      },
    );
    return !error && applied === true;
  },
});

async function bookAiCredit(input: {
  householdId: string;
  subscriberUserId: string;
  action: GatewayCreditAction;
  requestId: string;
}) {
  const client = createAdminClient();
  const { data, error } = await client.rpc('book_ai_credit', {
    p_household_id: input.householdId,
    p_action: input.action,
    p_request_id: input.requestId,
    p_expected_subscriber_user_id: input.subscriberUserId,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    if (
      typeof row === 'object' &&
      row !== null &&
      'booking_created' in row &&
      typeof row.booking_created === 'boolean'
    ) {
      return { ok: true as const, created: row.booking_created };
    }
    return { ok: false as const, status: 500, error: 'ai_credit_booking_failed' };
  }
  if (error.message.includes('ai_credit_limit_exceeded')) {
    return { ok: false as const, status: 429, error: 'ai_credit_limit_exceeded' };
  }
  if (error.message.includes('ai_subscriber_changed')) {
    return { ok: false as const, status: 409, error: 'ai_subscriber_changed' };
  }
  if (error.message.includes('ai_household_not_assigned')) {
    return { ok: false as const, status: 403, error: 'ai_entitlement_missing' };
  }
  if (error.message.includes('ai_credit_request_refunded')) {
    return { ok: false as const, status: 409, error: 'chef_request_already_refunded' };
  }
  if (error.message.includes('ai_credit_request_mismatch')) {
    return { ok: false as const, status: 409, error: 'chef_request_replay_mismatch' };
  }
  return { ok: false as const, status: 500, error: 'ai_credit_booking_failed' };
}

async function refundAiCredit(subscriberUserId: string, requestId: string) {
  const client = createAdminClient();
  const { error } = await client.rpc('refund_ai_credit', {
    p_subscriber_user_id: subscriberUserId,
    p_request_id: requestId,
  });
  if (error) throw error;
}

function storageKind(value: unknown): GatewayLot['storage'] {
  return value === 'fridge' || value === 'freezer' || value === 'pantry' ? value : 'unknown';
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLocaleLowerCase('de-DE');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function logLookupFailure(
  requestId: string,
  operation: string,
  error: { code?: string; message: string },
): void {
  console.error(JSON.stringify({
    event: 'ai_gateway_database_lookup_failed',
    requestId,
    operation,
    upstreamCode: error.code ?? null,
    upstreamMessage: error.message,
  }));
}

async function loadCookingContext(
  userId: string,
  householdId: string,
  authorization: string,
  requestId: string,
) {
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization, 'X-Request-Id': requestId } },
  });

  const [inventoryResult, shoppingResult, rulesResult, recipesResult] = await Promise.all([
    client
      .from('fridge_items')
      .select('id, product_id, name, quantity, unit, expiry_date, location_id')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .gt('quantity', 0),
    client
      .from('shopping_list_items')
      .select('id, name, quantity, unit, created_at')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .is('checked_at', null)
      .gt('quantity', 0)
      .order('created_at', { ascending: true }),
    client
      .from('profile_food_rules')
      .select(
        'allergy_codes, custom_allergies, intolerance_codes, custom_intolerances, disliked_foods',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('catalog_recipes')
      .select('id, title, cook_time_minutes, default_servings, dietary_tags')
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .limit(MAX_CATALOG_RECIPES_PER_REQUEST),
  ]);

  const initialError = inventoryResult.error ?? shoppingResult.error ??
    rulesResult.error ?? recipesResult.error;
  if (initialError) {
    logLookupFailure(requestId, 'cooking_context', initialError);
    return {
      ok: false as const,
      status: 500,
      error: 'cooking_context_lookup_failed',
    };
  }

  const inventoryRows = inventoryResult.data ?? [];
  const locationIds = [
    ...new Set(inventoryRows.map((row) => row.location_id).filter(Boolean)),
  ];
  const locationsResult = locationIds.length === 0
    ? { data: [], error: null }
    : await client.from('storage_locations').select('id, kind').in('id', locationIds);
  if (locationsResult.error) {
    logLookupFailure(requestId, 'inventory_locations', locationsResult.error);
    return {
      ok: false as const,
      status: 500,
      error: 'inventory_locations_lookup_failed',
    };
  }

  const locations = new Map(
    (locationsResult.data ?? []).map((row) => [row.id, row.kind]),
  );
  const lots: GatewayLot[] = inventoryRows
    .map((row) => ({
      lotId: row.id,
      productId: row.product_id ?? null,
      normalizedName: String(row.name).trim(),
      quantity: finiteNumber(row.quantity),
      unit: typeof row.unit === 'string' ? row.unit : null,
      bestBefore: normalizeDate(row.expiry_date),
      useBy: null,
      storage: storageKind(row.location_id ? locations.get(row.location_id) : null),
    }))
    .filter((lot) => lot.normalizedName.length > 0)
    .sort((left, right) => {
      const leftDate = left.useBy ?? left.bestBefore;
      const rightDate = right.useBy ?? right.bestBefore;
      if (leftDate !== rightDate) {
        if (leftDate === null) return 1;
        if (rightDate === null) return -1;
        return leftDate.localeCompare(rightDate);
      }
      return left.normalizedName.localeCompare(right.normalizedName, 'de') ||
        left.lotId.localeCompare(right.lotId);
    });

  const shoppingItems: GatewayCookingContext['shoppingItems'] = [];
  for (const row of shoppingResult.data ?? []) {
    const quantity = finiteNumber(row.quantity);
    if (
      typeof row.name === 'string' &&
      row.name.trim().length > 0 &&
      quantity !== null &&
      quantity > 0 &&
      typeof row.unit === 'string' &&
      row.unit.trim().length > 0
    ) {
      shoppingItems.push({
        shoppingItemId: row.id,
        name: row.name.trim(),
        quantity,
        unit: row.unit,
      });
    }
  }

  const recipeRows = recipesResult.data ?? [];
  const recipeIds = recipeRows.map((row) => row.id);
  const [itemsResult, stepsResult] = recipeIds.length === 0
    ? [{ data: [], error: null }, { data: [], error: null }]
    : await Promise.all([
      client
        .from('catalog_recipe_component_items')
        .select('id, recipe_id, product_id, ingredient_name, quantity, grams, unit, position')
        .in('recipe_id', recipeIds)
        .order('position', { ascending: true }),
      client
        .from('catalog_recipe_steps')
        .select('recipe_id, text, position')
        .in('recipe_id', recipeIds)
        .order('position', { ascending: true }),
    ]);
  const recipeDetailError = itemsResult.error ?? stepsResult.error;
  if (recipeDetailError) {
    logLookupFailure(requestId, 'recipe_details', recipeDetailError);
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_details_lookup_failed',
    };
  }

  const itemRows = itemsResult.data ?? [];
  const recipeProductIds = [
    ...new Set(itemRows.map((row) => row.product_id).filter(Boolean)),
  ];
  const rules = rulesResult.data;
  const allergies = uniqueStrings([
    ...stringArray(rules?.allergy_codes),
    ...stringArray(rules?.custom_allergies),
    ...stringArray(rules?.intolerance_codes),
    ...stringArray(rules?.custom_intolerances),
  ]);
  const catalogItemIds = itemRows.map((row) => row.id);
  const [recipeProductsResult, recipeIngredientLinksResult] = await Promise.all([
    recipeProductIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client.from('products').select('id, name').in('id', recipeProductIds),
    allergies.length === 0 || catalogItemIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client
        .from('catalog_recipe_item_ingredient_links')
        .select('catalog_item_id, ingredient_id, confidence, reviewed_at')
        .in('catalog_item_id', catalogItemIds),
  ]);
  if (recipeProductsResult.error) {
    logLookupFailure(requestId, 'recipe_products', recipeProductsResult.error);
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_products_lookup_failed',
    };
  }
  if (recipeIngredientLinksResult.error) {
    logLookupFailure(requestId, 'recipe_ingredient_links', recipeIngredientLinksResult.error);
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_allergen_lookup_failed',
    };
  }

  const recipeIngredientLinks = recipeIngredientLinksResult.data ?? [];
  const linkedIngredientIds = [
    ...new Set(recipeIngredientLinks.map((link) => link.ingredient_id)),
  ];
  const [ingredientKnowledgeResult, ingredientMappingsResult] = linkedIngredientIds.length === 0
    ? [{ data: [], error: null }, { data: [], error: null }]
    : await Promise.all([
      client
        .from('food_ingredients')
        .select('id, allergen_reviewed_at')
        .in('id', linkedIngredientIds),
      client
        .from('ingredient_allergen_mappings')
        .select('ingredient_id, allergen_id, relation')
        .in('ingredient_id', linkedIngredientIds),
    ]);
  const ingredientKnowledgeError = ingredientKnowledgeResult.error ??
    ingredientMappingsResult.error;
  if (ingredientKnowledgeError) {
    logLookupFailure(requestId, 'ingredient_allergen_knowledge', ingredientKnowledgeError);
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_allergen_lookup_failed',
    };
  }

  const allergensByRecipeId = projectRecipeAllergens({
    recipes: recipeRows.map((row) => ({ recipeId: row.id })),
    items: itemRows.map((row) => ({ itemId: row.id, recipeId: row.recipe_id })),
    links: recipeIngredientLinks.map((link) => ({
      catalogItemId: link.catalog_item_id,
      ingredientId: link.ingredient_id,
      confidence: link.confidence,
      reviewedAt: link.reviewed_at,
    })),
    ingredients: (ingredientKnowledgeResult.data ?? []).map((ingredient) => ({
      ingredientId: ingredient.id,
      allergenReviewedAt: ingredient.allergen_reviewed_at,
    })),
    mappings: (ingredientMappingsResult.data ?? []).map((mapping) => ({
      ingredientId: mapping.ingredient_id,
      allergenId: mapping.allergen_id,
      relation: mapping.relation,
    })),
  });

  const productNames = new Map(
    (recipeProductsResult.data ?? []).map((row) => [row.id, row.name]),
  );
  const ingredientsByRecipe = new Map<string, GatewayRecipe['ingredients']>();
  for (const row of itemRows) {
    const name = typeof row.ingredient_name === 'string' && row.ingredient_name.trim().length > 0
      ? row.ingredient_name.trim()
      : row.product_id
      ? String(productNames.get(row.product_id) ?? '').trim()
      : '';
    if (name.length === 0) continue;

    const explicitQuantity = finiteNumber(row.quantity);
    const quantity = explicitQuantity ?? finiteNumber(row.grams);
    const current = ingredientsByRecipe.get(row.recipe_id) ?? [];
    current.push({
      productId: row.product_id ?? null,
      normalizedName: name,
      quantity,
      unit: explicitQuantity === null
        ? quantity === null ? null : 'g'
        : typeof row.unit === 'string'
        ? row.unit
        : null,
    });
    ingredientsByRecipe.set(row.recipe_id, current);
  }

  const stepsByRecipe = new Map<string, string[]>();
  for (const row of stepsResult.data ?? []) {
    if (typeof row.text !== 'string' || row.text.trim().length === 0) continue;
    const current = stepsByRecipe.get(row.recipe_id) ?? [];
    current.push(row.text.trim());
    stepsByRecipe.set(row.recipe_id, current);
  }

  const recipes: GatewayRecipe[] = recipeRows.map((row) => ({
    recipeId: row.id,
    title: String(row.title).trim(),
    source: 'catalog',
    estimatedMinutes: finiteNumber(row.cook_time_minutes),
    servings: finiteNumber(row.default_servings),
    dietaryTags: stringArray(row.dietary_tags),
    allergens: allergensByRecipeId.get(row.id) ?? null,
    steps: stepsByRecipe.get(row.id) ?? [],
    ingredients: ingredientsByRecipe.get(row.id) ?? [],
  }));

  const context: GatewayCookingContext = {
    inventory: {
      source: 'inventory',
      fetchedAt: new Date().toISOString(),
      lots,
    } satisfies GatewayInventoryContext,
    recipes,
    shoppingItems,
    allergies,
    preferences: [],
    forbiddenIngredients: uniqueStrings(stringArray(rules?.disliked_foods)),
  };
  return { ok: true as const, context };
}

async function complete(
  { requestId, model, messages, skill, cookingContext }: {
    requestId: string;
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    skill: 'fam-cook-from-inventory' | 'fam-inventory-capture';
    cookingContext: RecipeSuggestionContext | null;
  },
) {
  if (!openRouterKey) {
    return {
      ok: false as const,
      status: 503,
      error: 'provider_not_configured',
    };
  }

  let response: Response;
  try {
    response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...(Deno.env.get('OPENROUTER_SITE_URL')
          ? { 'HTTP-Referer': Deno.env.get('OPENROUTER_SITE_URL')! }
          : {}),
        ...(Deno.env.get('OPENROUTER_SITE_NAME')
          ? { 'X-Title': Deno.env.get('OPENROUTER_SITE_NAME')! }
          : {}),
      },
      body: JSON.stringify(createOpenRouterChatBody({
        model,
        messages,
        skill,
        ...(cookingContext === null ? {} : { recipeSuggestionContext: cookingContext }),
      })),
      signal: AbortSignal.timeout(
        Number(Deno.env.get('AI_GATEWAY_TIMEOUT_MS') ?? 45_000),
      ),
    });
  } catch {
    console.error(JSON.stringify({
      event: 'ai_gateway_provider_request_failed',
      requestId,
      error: 'provider_unavailable',
    }));
    return { ok: false as const, status: 502, error: 'provider_unavailable' };
  }

  if (!response.ok) {
    console.error(JSON.stringify({
      event: 'ai_gateway_provider_request_failed',
      requestId,
      error: 'provider_request_failed',
      upstreamStatus: response.status,
    }));
    return {
      ok: false as const,
      status: 502,
      error: 'provider_request_failed',
    };
  }
  const body: unknown = await response.json();
  const completion = parseOpenRouterChatCompletion(body);
  if (!completion.ok) {
    return {
      ok: false as const,
      status: 502,
      error: completion.error,
    };
  }
  return completion;
}

const handler = createAiGatewayHandler({
  authenticate,
  assertHouseholdMember,
  lookupChefExchange,
  preflightChefExchange,
  loadChefConversationContext,
  persistChefExchange,
  authorizeAiEntitlement,
  bookAiCredit,
  refundAiCredit,
  loadCookingContext,
  complete,
  isRateLimited: () => rateLimiter.isLimited(),
  recordRateLimitAttempt: () => rateLimiter.record(),
  allowedModels: ALLOWED_MODELS,
  defaultModel,
});

Deno.serve(withRequestId('ai-gateway', (request, requestId) => handler(request, requestId)));
