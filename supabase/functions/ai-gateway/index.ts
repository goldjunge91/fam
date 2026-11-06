import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  ALLOWED_MODELS,
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayCreditAction,
  type GatewayInventoryContext,
  type GatewayLot,
  type GatewayRecipe,
} from './handler.ts';
import { SlidingWindowRateLimiter } from '../enrich-off-product/rate-limiter.ts';
import { createRevenueCatSubscriberStatusReader } from '../revenuecat-webhook/subscriber-status.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseSecretKey = Deno.env.get('SUPABASE_SECRET_KEY')!;
const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
const openRouterBaseUrl = (Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1')
  .replace(/\/$/, '');
const defaultModel = Deno.env.get('AI_GATEWAY_MODEL') ?? 'z-ai/glm-5.3-flash';
const allowedModels = (Deno.env.get('AI_GATEWAY_ALLOWED_MODELS') ?? '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const rateLimiter = new SlidingWindowRateLimiter(
  Number(Deno.env.get('AI_GATEWAY_RATE_LIMIT') ?? 30),
  60_000,
);
const readRevenueCatStatus = createRevenueCatSubscriberStatusReader(
  Deno.env.get('REVENUECAT_SECRET_API_KEY'),
);

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

async function assertHouseholdMember(
  userId: string,
  householdId: string,
  authorization: string,
) {
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
    return {
      ok: false as const,
      status: 500,
      error: 'household_lookup_failed',
      message: error.message,
    };
  }
  if (!data) {
    return { ok: false as const, status: 403, error: 'household_forbidden' };
  }
  return { ok: true as const, userId, authorization };
}

async function authorizeAiEntitlement(householdId: string, authorization: string) {
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client
    .from('households')
    .select('ai_active, ai_expires_at, ai_subscriber_id')
    .eq('id', householdId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500, error: 'ai_household_lookup_failed' };
  }
  const subscriberUserId = data?.ai_subscriber_id;
  if (!subscriberUserId) {
    return { ok: false as const, status: 403, error: 'ai_entitlement_missing' };
  }

  try {
    const status = await readRevenueCatStatus(subscriberUserId);
    const entitlement = status.entitlements.AI ?? {
      active: false,
      expiresAt: null,
    };
    const requestDateMs = status.requestDateMs ?? Date.now();
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);

    if (entitlement.active) {
      const currentExpiryMs = data.ai_expires_at === null ? null : Date.parse(data.ai_expires_at);
      const confirmedExpiryMs = entitlement.expiresAt === null
        ? null
        : Date.parse(entitlement.expiresAt);
      const projectionMatches = data.ai_active &&
        data.ai_subscriber_id === subscriberUserId &&
        currentExpiryMs === confirmedExpiryMs;

      if (!projectionMatches) {
        const { data: applied, error: updateError } = await adminClient.rpc(
          'assign_ai_household',
          {
            p_subscriber_user_id: subscriberUserId,
            p_target_household_id: householdId,
            p_entitlement_expires_at: entitlement.expiresAt,
            p_event_timestamp_ms: requestDateMs,
          },
        );
        if (updateError || !applied) {
          return { ok: false as const, status: 503, error: 'ai_status_refresh_failed' };
        }
      }
      return { ok: true as const, subscriberUserId };
    }

    if (data.ai_active && data.ai_subscriber_id === subscriberUserId) {
      const { data: applied, error: updateError } = await adminClient.rpc(
        'deactivate_ai_household',
        {
          p_subscriber_user_id: subscriberUserId,
          p_event_timestamp_ms: requestDateMs,
        },
      );
      if (updateError || !applied) {
        return { ok: false as const, status: 503, error: 'ai_status_refresh_failed' };
      }
    }
    return { ok: false as const, status: 402, error: 'ai_subscription_required' };
  } catch {
    return { ok: false as const, status: 503, error: 'ai_status_unavailable' };
  }
}

async function bookAiCredit(input: {
  householdId: string;
  subscriberUserId: string;
  action: GatewayCreditAction;
  requestId: string;
}) {
  const client = createClient(supabaseUrl, supabaseSecretKey);
  const { error } = await client.rpc('book_ai_credit', {
    p_household_id: input.householdId,
    p_action: input.action,
    p_request_id: input.requestId,
    p_expected_subscriber_user_id: input.subscriberUserId,
  });

  if (!error) return { ok: true as const };
  if (error.message.includes('ai_credit_limit_exceeded')) {
    return { ok: false as const, status: 429, error: 'ai_credit_limit_exceeded' };
  }
  if (error.message.includes('ai_subscriber_changed')) {
    return { ok: false as const, status: 409, error: 'ai_subscriber_changed' };
  }
  if (error.message.includes('ai_household_not_assigned')) {
    return { ok: false as const, status: 403, error: 'ai_entitlement_missing' };
  }
  return { ok: false as const, status: 500, error: 'ai_credit_booking_failed' };
}

async function refundAiCredit(subscriberUserId: string, requestId: string) {
  const client = createClient(supabaseUrl, supabaseSecretKey);
  const { error } = await client.rpc('refund_ai_credit', {
    p_subscriber_user_id: subscriberUserId,
    p_request_id: requestId,
  });
  if (error) throw error;
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
    return perishableSuffixes.has(
      separator === -1 ? normalized : normalized.slice(separator + 1),
    );
  });
  return hasPerishable ? 'perishable' : 'unknown';
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

async function loadCookingContext(
  _userId: string,
  householdId: string,
  authorization: string,
) {
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
    return {
      ok: false as const,
      status: 500,
      error: 'inventory_lookup_failed',
      message: inventoryError.message,
    };
  }

  const rows = inventoryRows ?? [];
  const locationIds = [
    ...new Set(rows.map((row) => row.location_id).filter(Boolean)),
  ];
  const productIds = [
    ...new Set(rows.map((row) => row.product_id).filter(Boolean)),
  ];
  const [locationsResult, productsResult] = await Promise.all([
    locationIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client.from('storage_locations').select('id, kind').in(
        'id',
        locationIds,
      ),
    productIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : client.from('products').select('id, name, off_category_tags').in(
        'id',
        productIds,
      ),
  ]);
  if (locationsResult.error || productsResult.error) {
    return {
      ok: false as const,
      status: 500,
      error: 'inventory_enrichment_failed',
      message: locationsResult.error?.message ?? productsResult.error?.message,
    };
  }

  const locations = new Map(
    (locationsResult.data ?? []).map((row) => [row.id, row.kind]),
  );
  const products = new Map(
    (productsResult.data ?? []).map((row) => [row.id, row]),
  );
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
        storage: storageKind(
          row.location_id ? locations.get(row.location_id) : null,
        ),
        perishability: classifyPerishability(product?.off_category_tags),
      };
    })
    .filter((lot) => lot.normalizedName.length > 0 && lot.perishability === 'perishable')
    .map(({ perishability: _perishability, ...lot }) => lot)
    .sort((a, b) => {
      const aDate = a.useBy ?? a.bestBefore;
      const bDate = b.useBy ?? b.bestBefore;
      if (aDate !== bDate) {
        if (aDate === null) return 1;
        if (bDate === null) return -1;
        return aDate.localeCompare(bDate);
      }
      return a.normalizedName.localeCompare(b.normalizedName, 'de') ||
        a.lotId.localeCompare(b.lotId);
    });

  const { data: recipeRows, error: recipeError } = await client
    .from('catalog_recipes')
    .select('id, title, cook_time_minutes, default_servings, dietary_tags')
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (recipeError) {
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_lookup_failed',
      message: recipeError.message,
    };
  }

  const recipeIds = (recipeRows ?? []).map((row) => row.id);
  const { data: itemRows, error: itemError } = recipeIds.length === 0
    ? { data: [], error: null }
    : await client
      .from('catalog_recipe_component_items')
      .select(
        'recipe_id, product_id, ingredient_name, quantity, unit, position',
      )
      .in('recipe_id', recipeIds)
      .order('position', { ascending: true });
  if (itemError) {
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_ingredients_lookup_failed',
      message: itemError.message,
    };
  }

  const recipeProductIds = [
    ...new Set((itemRows ?? []).map((row) => row.product_id).filter(Boolean)),
  ];
  const { data: recipeProducts, error: recipeProductsError } = recipeProductIds.length === 0
    ? { data: [], error: null }
    : await client.from('products').select('id, name').in(
      'id',
      recipeProductIds,
    );
  if (recipeProductsError) {
    return {
      ok: false as const,
      status: 500,
      error: 'recipe_products_lookup_failed',
      message: recipeProductsError.message,
    };
  }

  const recipeProductNames = new Map(
    (recipeProducts ?? []).map((row) => [row.id, row.name]),
  );
  const ingredientsByRecipe = new Map<string, GatewayRecipe['ingredients']>();
  for (const row of itemRows ?? []) {
    const name = typeof row.ingredient_name === 'string' &&
        row.ingredient_name.trim().length > 0
      ? row.ingredient_name.trim()
      : row.product_id
      ? String(recipeProductNames.get(row.product_id) ?? '').trim()
      : '';
    if (!name) continue;
    const current = ingredientsByRecipe.get(row.recipe_id) ?? [];
    current.push({
      productId: row.product_id ?? null,
      normalizedName: name,
      quantity: typeof row.quantity === 'number' ? row.quantity : null,
      unit: typeof row.unit === 'string' ? row.unit : null,
    });
    ingredientsByRecipe.set(row.recipe_id, current);
  }

  const recipes: GatewayRecipe[] = (recipeRows ?? []).map((row) => ({
    recipeId: row.id,
    title: String(row.title).trim(),
    estimatedMinutes: typeof row.cook_time_minutes === 'number' ? row.cook_time_minutes : null,
    servings: typeof row.default_servings === 'number' ? row.default_servings : null,
    dietaryTags: Array.isArray(row.dietary_tags) ? row.dietary_tags : [],
    allergens: null,
    ingredients: ingredientsByRecipe.get(row.id) ?? [],
  }));

  const context: GatewayCookingContext = {
    inventory: {
      source: 'inventory',
      fetchedAt: new Date().toISOString(),
      lots,
    } satisfies GatewayInventoryContext,
    recipes,
  };
  return { ok: true as const, context };
}

async function complete(
  { model, messages }: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
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
        ...(Deno.env.get('OPENROUTER_SITE_URL')
          ? { 'HTTP-Referer': Deno.env.get('OPENROUTER_SITE_URL')! }
          : {}),
        ...(Deno.env.get('OPENROUTER_SITE_NAME')
          ? { 'X-Title': Deno.env.get('OPENROUTER_SITE_NAME')! }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1536,
        response_format: { type: 'json_object' },
        ...(model === 'ibm-granite/granite-4.2-8b' ? { reasoning: { enabled: false } } : {}),
      }),
      signal: AbortSignal.timeout(
        Number(Deno.env.get('AI_GATEWAY_TIMEOUT_MS') ?? 45_000),
      ),
    });
  } catch {
    return { ok: false as const, status: 502, error: 'provider_unavailable' };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      status: 502,
      error: 'provider_request_failed',
    };
  }
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      ok: false as const,
      status: 502,
      error: 'provider_empty_response',
    };
  }
  return { ok: true as const, content, model, usage: body?.usage };
}

const handler = createAiGatewayHandler({
  authenticate,
  assertHouseholdMember,
  authorizeAiEntitlement,
  bookAiCredit,
  refundAiCredit,
  loadCookingContext,
  complete,
  isRateLimited: () => rateLimiter.isLimited(),
  recordRateLimitAttempt: () => rateLimiter.record(),
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
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
  console.info(
    JSON.stringify({
      event: 'ai_gateway_request',
      method: request.method,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    }),
  );
  return response;
});
