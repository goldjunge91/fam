import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  ALLOWED_MODELS,
  type AssistantPageContext,
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayCreditAction,
  type GatewayCreditStatus,
  type GatewayFoodRules,
  type GatewayInventoryContext,
  type GatewayLot,
  type GatewayMealPlanContext,
  type GatewayProvider,
  type GatewayRecipe,
  type GatewayShoppingListItem,
  GROQ_ALLOWED_MODELS,
  nonEmptyString,
} from './handler.ts';
import { createProviderCompleter } from './providers.ts';
import { type AiUsageRecordInput, toAiUsageEvent } from './usage.ts';
import {
  allergenIdForProfileRule,
  type EuAllergenId,
  type IngredientAliasRecord,
  type IngredientFactRecord,
  type IngredientRevision,
  projectRecipeAllergenSafety,
  type RecipeIngredientMappingRow,
  toReviewedRecipeIngredientMapping,
} from './ingredient-knowledge.ts';
import { fingerprintRecipeIngredientMappings } from './food-rule-coverage.ts';
import { SlidingWindowRateLimiter } from '../enrich-off-product/rate-limiter.ts';
import { createRevenueCatSubscriberStatusReader } from '../revenuecat-webhook/subscriber-status.ts';
import {
  isLocalSupabaseUrl,
  isRevenueCatSandboxAllowed,
} from '../_shared/revenuecat-environment.ts';
import { requireSupabaseSecretKey } from '../_shared/env.ts';
import { isPublicHttpsUrl, loadRecipePage } from './recipe-source.ts';
import { CONTEXT_LIMITS, limitContextArray, limitContextString } from './context-limits.ts';
import {
  loadRelevantCatalogRecipes,
  type RecipeContextClient,
  selectRelevantProductIds,
} from './recipe-context.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseSecretKey = requireSupabaseSecretKey();
const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
const groqKey = Deno.env.get('GROQ_API_KEY');
const configuredProvider: GatewayProvider = Deno.env.get('AI_GATEWAY_PROVIDER') === 'groq'
  ? 'groq'
  : 'openrouter';
function modelList(value: string | undefined, fallback: readonly string[]): readonly string[] {
  const configured = (value ?? '').split(',').map((model) => model.trim()).filter(Boolean);
  return configured.length > 0 ? configured : fallback;
}
const openRouterModels = modelList(
  Deno.env.get('AI_GATEWAY_OPENROUTER_ALLOWED_MODELS') ??
    (configuredProvider === 'openrouter' ? Deno.env.get('AI_GATEWAY_ALLOWED_MODELS') : undefined),
  ALLOWED_MODELS,
);
const groqModels = modelList(
  Deno.env.get('AI_GATEWAY_GROQ_ALLOWED_MODELS') ??
    (configuredProvider === 'groq' ? Deno.env.get('AI_GATEWAY_ALLOWED_MODELS') : undefined),
  GROQ_ALLOWED_MODELS,
);
const providerModels = { openrouter: openRouterModels, groq: groqModels };
const providerDefaultModels: Record<GatewayProvider, string> = {
  openrouter: 'z-ai/glm-5.3-flash',
  groq: 'qwen/qwen3.8-27b',
};
const defaultModel = Deno.env.get('AI_GATEWAY_MODEL') ?? providerDefaultModels[configuredProvider];
const configuredAllowedModels = configuredProvider === 'groq' ? groqModels : openRouterModels;
const allowedModels = configuredAllowedModels;
const providerComplete = createProviderCompleter({
  defaultProvider: configuredProvider,
  openRouterKey,
  openRouterBaseUrl: Deno.env.get('OPENROUTER_BASE_URL'),
  openRouterSiteUrl: Deno.env.get('OPENROUTER_SITE_URL'),
  openRouterSiteName: Deno.env.get('OPENROUTER_SITE_NAME'),
  groqKey,
  groqBaseUrl: Deno.env.get('GROQ_BASE_URL'),
  timeoutMs: Number(Deno.env.get('AI_GATEWAY_TIMEOUT_MS') ?? 45_000),
});
const rateLimiter = new SlidingWindowRateLimiter(
  Number(Deno.env.get('AI_GATEWAY_RATE_LIMIT') ?? 30),
  60_000,
);
const readRevenueCatStatus = createRevenueCatSubscriberStatusReader(
  Deno.env.get('REVENUECAT_SECRET_API_KEY'),
  fetch,
  { allowSandbox: isRevenueCatSandboxAllowed(supabaseUrl) },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function relationProductName(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value.find(isRecord);
    return first && typeof first.name === 'string' ? first.name.trim() : null;
  }
  return isRecord(value) && typeof value.name === 'string' ? value.name.trim() : null;
}

function hasCurrentIngredientReview(
  mapping: ReturnType<typeof toReviewedRecipeIngredientMapping>,
): boolean {
  return mapping.status === 'verified' && mapping.complete &&
    mapping.ingredientIds.length > 0 &&
    mapping.source.trim().length > 0 &&
    mapping.sourceId.trim().length > 0 &&
    mapping.sourceUrl !== null && mapping.sourceUrl.trim().length > 0 &&
    mapping.sourceVersion.length > 0 &&
    mapping.sourceVersion === mapping.currentSourceVersion &&
    mapping.license !== null && mapping.license.trim().length > 0 &&
    mapping.evidenceSnapshot.trim().length > 0 &&
    mapping.reviewedAt !== null && Number.isFinite(Date.parse(mapping.reviewedAt)) &&
    mapping.reviewedBy !== null && mapping.reviewedBy.trim().length > 0;
}

const ALLERGY_RULE_LABELS: Record<string, string> = {
  'gluten-containing-cereals': 'glutenhaltiges Getreide',
  crustaceans: 'Krebstiere',
  eggs: 'Eier',
  fish: 'Fisch',
  peanuts: 'Erdnüsse',
  soybeans: 'Soja',
  milk: 'Milch / Milcheiweiß',
  'tree-nuts': 'Schalenfrüchte',
  celery: 'Sellerie',
  mustard: 'Senf',
  sesame: 'Sesam',
  'sulphur-dioxide-sulphites': 'Schwefeldioxid und Sulfite',
  lupin: 'Lupinen',
  molluscs: 'Weichtiere',
};

const INTOLERANCE_RULE_LABELS: Record<string, string> = {
  lactose: 'Laktose',
  'fructose-malabsorption': 'Fruktosemalabsorption',
  'sorbitol-malabsorption': 'Sorbitmalabsorption',
  'celiac-gluten': 'Zöliakie / Gluten strikt meiden',
};

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

  if (isLocalSupabaseUrl(supabaseUrl)) {
    const expiresAtMs = data.ai_expires_at === null ? null : Date.parse(data.ai_expires_at);
    const locallyActive = data.ai_active && (
      expiresAtMs === null || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    );
    if (!locallyActive) {
      return { ok: false as const, status: 402, error: 'ai_subscription_required' };
    }
    return { ok: true as const, subscriberUserId };
  }

  // Hosted environments re-check RevenueCat directly before granting AI access.
  // The local Test Store flow has already projected verified SDK CustomerInfo into this
  // disposable household row and must not require a RevenueCat v1 secret key.
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

async function getAiCreditStatus(householdId: string) {
  const client = createClient(supabaseUrl, supabaseSecretKey);
  const { data, error } = await client.rpc('get_ai_credit_status', {
    p_household_id: householdId,
  });
  if (error) {
    console.warn('ai_credit_status_lookup_failed');
    return { ok: false as const, status: 503, error: 'ai_credit_status_unavailable' };
  }

  const row: unknown = Array.isArray(data) ? data[0] : null;
  if (
    !isRecord(row) ||
    !Number.isInteger(row.credits_used) ||
    !Number.isInteger(row.credits_remaining) ||
    !Number.isInteger(row.credit_limit) ||
    typeof row.warning_reached !== 'boolean' ||
    typeof row.blocked !== 'boolean'
  ) {
    return { ok: false as const, status: 503, error: 'ai_credit_status_unavailable' };
  }

  const status: GatewayCreditStatus = {
    creditsUsed: row.credits_used as number,
    creditsRemaining: row.credits_remaining as number,
    creditLimit: row.credit_limit as number,
    warningReached: row.warning_reached,
    blocked: row.blocked,
  };
  return { ok: true as const, status };
}

async function recordAiUsage(input: AiUsageRecordInput) {
  const client = createClient(supabaseUrl, supabaseSecretKey);
  const { error } = await client.from('ai_usage_events').upsert(toAiUsageEvent(input), {
    onConflict: 'request_id,provider_call_index',
    ignoreDuplicates: true,
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

export async function loadCookingContext(
  userId: string,
  householdId: string,
  authorization: string,
  includePersonalFoodRules: boolean,
  requestedAllergies: string[] = [],
  pageContext?: AssistantPageContext,
  clientOverride?: unknown,
  focusedInventoryLotIds?: readonly string[],
) {
  const client = clientOverride === undefined
    ? createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    : clientOverride as ReturnType<typeof createClient>;

  let foodRules: GatewayFoodRules = {
    allergies: [],
    intolerances: [],
    avoidFoods: [],
    updatedAt: null,
  };
  if (includePersonalFoodRules) {
    // RLS on profile_food_rules permits this caller to see only their own row.
    const { data: foodRuleRow, error: foodRulesError } = await client
      .from('profile_food_rules')
      .select(
        'allergy_codes, custom_allergies, intolerance_codes, custom_intolerances, disliked_foods, updated_at',
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (foodRulesError) {
      return {
        ok: false as const,
        status: 500,
        error: 'profile_food_rules_lookup_failed',
        message: foodRulesError.message,
      };
    }
    foodRules = {
      allergies: [
        ...(foodRuleRow?.allergy_codes ?? []).map((code: string) =>
          ALLERGY_RULE_LABELS[code] ?? code
        ),
        ...(foodRuleRow?.custom_allergies ?? []),
      ],
      allergyCodes: foodRuleRow?.allergy_codes ?? [],
      customAllergies: foodRuleRow?.custom_allergies ?? [],
      intolerances: [
        ...(foodRuleRow?.intolerance_codes ?? []).map((code: string) =>
          INTOLERANCE_RULE_LABELS[code] ?? code
        ),
        ...(foodRuleRow?.custom_intolerances ?? []),
      ],
      intoleranceCodes: foodRuleRow?.intolerance_codes ?? [],
      customIntolerances: foodRuleRow?.custom_intolerances ?? [],
      avoidFoods: foodRuleRow?.disliked_foods ?? [],
      dislikedFoods: foodRuleRow?.disliked_foods ?? [],
      updatedAt: foodRuleRow?.updated_at ?? null,
    };
  }

  const activeAllergenIds = [
    ...new Set(
      (includePersonalFoodRules
        ? [
          ...(foodRules.allergyCodes ?? []),
          ...(foodRules.customAllergies ?? []).filter((label) =>
            allergenIdForProfileRule(label) !== null
          ),
        ]
        : requestedAllergies)
        .map(allergenIdForProfileRule)
        .filter((allergenId): allergenId is EuAllergenId => allergenId !== null),
    ),
  ];

  const ingredientAliases: IngredientAliasRecord[] = [];
  const needsCanonicalRuleAliases = includePersonalFoodRules && (
    (foodRules.customAllergies ?? []).some((label) => allergenIdForProfileRule(label) === null) ||
    (foodRules.dislikedFoods ?? []).length > 0
  );
  if (needsCanonicalRuleAliases) {
    const pageSize = 500;
    for (let offset = 0;; offset += pageSize) {
      const { data: aliasRows, error: aliasError } = await client
        .from('food_ingredient_aliases')
        .select(
          'ingredient_id, alias, locale, source, source_id, source_url, source_version, license, confidence, reviewed_at, reviewed_by',
        )
        .eq('locale', 'de')
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (aliasError) {
        return {
          ok: false as const,
          status: 500,
          error: 'food_ingredient_alias_lookup_failed',
          message: aliasError.message,
        };
      }
      const page = aliasRows ?? [];
      ingredientAliases.push(...page.map((row) => ({
        ingredientId: row.ingredient_id,
        alias: row.alias,
        locale: row.locale,
        source: row.source,
        sourceId: row.source_id,
        sourceUrl: row.source_url,
        sourceVersion: row.source_version,
        license: row.license,
        confidence: row.confidence,
        reviewedAt: row.reviewed_at,
        reviewedBy: row.reviewed_by,
      })));
      if (page.length < pageSize) break;
    }
  }

  let inventoryQuery = client
    .from('fridge_items')
    .select('id, product_id, name, quantity, unit, expiry_date, location_id', { count: 'exact' })
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .gt('quantity', 0);
  if (focusedInventoryLotIds !== undefined) {
    inventoryQuery = inventoryQuery.in('id', [...focusedInventoryLotIds]);
  }
  inventoryQuery = inventoryQuery
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .limit(CONTEXT_LIMITS.inventoryLots + 1);
  const {
    data: inventoryRows,
    error: inventoryError,
    count: inventoryCount,
  } = await inventoryQuery;
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
  const locationsResult = locationIds.length === 0
    ? { data: [], error: null }
    : await client.from('storage_locations').select('id, kind').in(
      'id',
      locationIds,
    );
  if (locationsResult.error) {
    return {
      ok: false as const,
      status: 500,
      error: 'inventory_enrichment_failed',
      message: locationsResult.error.message,
    };
  }

  const locations = new Map(
    (locationsResult.data ?? []).map((row) => [row.id, row.kind]),
  );
  const allLots: GatewayLot[] = rows
    .map((row) => ({
      lotId: limitContextString(row.id),
      productId: row.product_id ? limitContextString(row.product_id) : null,
      normalizedName: limitContextString(String(row.name)),
      quantity: typeof row.quantity === 'number' ? row.quantity : null,
      unit: typeof row.unit === 'string' ? limitContextString(row.unit) : null,
      bestBefore: normalizeDate(row.expiry_date),
      useBy: null,
      storage: storageKind(
        row.location_id ? locations.get(row.location_id) : null,
      ),
    }))
    .filter((lot) => lot.normalizedName.length > 0)
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
  const boundedLots = limitContextArray(allLots, CONTEXT_LIMITS.inventoryLots);
  const inventoryOmittedCount = Math.max(
    0,
    (inventoryCount ?? allLots.length) - boundedLots.values.length,
  );

  const shoppingListResult = includePersonalFoodRules
    ? await client
      .from('shopping_list_items')
      .select(
        'id, product_id, name, quantity, unit, category_id, store_id, checked_at, recipe_names',
        { count: 'exact' },
      )
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .order('sort_index', { ascending: true })
      .order('id', { ascending: true })
      .limit(CONTEXT_LIMITS.shoppingListItems + 1)
    : { data: [], error: null, count: 0 };
  if (shoppingListResult.error) {
    return {
      ok: false as const,
      status: 500,
      error: 'shopping_list_lookup_failed',
      message: shoppingListResult.error.message,
    };
  }
  const shoppingRows = (shoppingListResult.data ?? []).map((row) => ({
    itemId: limitContextString(row.id),
    productId: row.product_id ? limitContextString(row.product_id) : null,
    name: limitContextString(String(row.name)),
    quantity: typeof row.quantity === 'number' ? row.quantity : Number(row.quantity),
    unit: typeof row.unit === 'string' ? limitContextString(row.unit) : '',
    categoryId: row.category_id ? limitContextString(row.category_id) : null,
    storeId: row.store_id ? limitContextString(row.store_id) : null,
    checkedAt: typeof row.checked_at === 'string' ? limitContextString(row.checked_at) : null,
    recipeNames: Array.isArray(row.recipe_names)
      ? row.recipe_names.filter((name): name is string => typeof name === 'string')
      : [],
  })).filter((item) => item.name.length > 0 && Number.isFinite(item.quantity));
  const boundedShoppingRows = limitContextArray(
    shoppingRows,
    CONTEXT_LIMITS.shoppingListItems,
  );
  let recipeNameBudget = CONTEXT_LIMITS.recipeNamesTotal;
  const shoppingList: GatewayShoppingListItem[] = boundedShoppingRows.values.map((item) => {
    const perItem = limitContextArray(item.recipeNames, CONTEXT_LIMITS.recipeNamesPerShoppingItem);
    const total = limitContextArray(perItem.values, recipeNameBudget);
    recipeNameBudget -= total.values.length;
    const omittedCount = perItem.omittedCount + total.omittedCount;
    return {
      ...item,
      recipeNames: total.values.map((name) => limitContextString(name)),
      ...(omittedCount > 0
        ? { recipeNamesTruncated: true, recipeNamesOmittedCount: omittedCount }
        : {}),
    };
  });
  const shoppingListOmittedCount = Math.max(
    0,
    (shoppingListResult.count ?? shoppingRows.length) - shoppingList.length,
  );

  const relevantProductIds = selectRelevantProductIds([
    ...boundedLots.values.map((lot) => lot.productId),
    ...shoppingList.map((item) => item.productId),
  ]);
  const catalogLookup = await loadRelevantCatalogRecipes(
    client as unknown as RecipeContextClient,
    relevantProductIds,
  );
  if (!catalogLookup.ok) {
    return {
      ok: false as const,
      status: 500,
      error: catalogLookup.error,
      message: catalogLookup.message,
    };
  }
  const recipes = catalogLookup.recipes;

  type MealPlanEntryRow = {
    id: string;
    entry_date: string;
    meal_slot: string;
    recipe_id: string | null;
    custom_title: string | null;
    custom_ingredients: unknown;
    portions: number | string;
  };
  let mealPlanSelection: {
    weekStartDate: string;
    planName: string | null;
    entries: MealPlanEntryRow[];
    truncated: boolean;
    omittedCount: number;
  } | null = null;
  let mealPlanRecipeIds: string[] = [];
  if (pageContext?.kind === 'meal_plan') {
    const candidateStart = normalizeDate(pageContext.weekStartDate);
    const parsedStart = candidateStart ? new Date(`${candidateStart}T00:00:00.000Z`) : null;
    const weekStartDate = parsedStart && Number.isFinite(parsedStart.getTime()) &&
        parsedStart.toISOString().slice(0, 10) === candidateStart
      ? candidateStart
      : null;
    if (weekStartDate) {
      const parsedEnd = new Date(`${weekStartDate}T00:00:00.000Z`);
      parsedEnd.setUTCDate(parsedEnd.getUTCDate() + 6);
      const weekEndDate = parsedEnd.toISOString().slice(0, 10);
      const planResult = await client
        .from('meal_plans')
        .select('id, name, week_start_date')
        .eq('household_id', householdId)
        .eq('week_start_date', weekStartDate)
        .is('deleted_at', null)
        .maybeSingle();
      if (planResult.error) {
        return {
          ok: false as const,
          status: 500,
          error: 'meal_plan_lookup_failed',
          message: planResult.error.message,
        };
      }
      const entryResult = planResult.data
        ? await client
          .from('meal_plan_entries')
          .select(
            'id, entry_date, meal_slot, recipe_id, custom_title, custom_ingredients, portions',
            { count: 'exact' },
          )
          .eq('household_id', householdId)
          .eq('meal_plan_id', planResult.data.id)
          .is('deleted_at', null)
          .gte('entry_date', weekStartDate)
          .lte('entry_date', weekEndDate)
          .order('entry_date', { ascending: true })
          .order('meal_slot', { ascending: true })
          .order('id', { ascending: true })
          .limit(CONTEXT_LIMITS.mealPlanEntries + 1)
        : { data: [], error: null, count: 0 };
      if (entryResult.error) {
        return {
          ok: false as const,
          status: 500,
          error: 'meal_plan_entries_lookup_failed',
          message: entryResult.error.message,
        };
      }
      const rawEntries = entryResult.data ?? [];
      const entries = rawEntries.slice(0, CONTEXT_LIMITS.mealPlanEntries) as MealPlanEntryRow[];
      const omittedCount = Math.max(
        0,
        (entryResult.count ?? rawEntries.length) - entries.length,
      );
      mealPlanSelection = {
        weekStartDate,
        planName: planResult.data?.name ? limitContextString(planResult.data.name) : null,
        entries,
        truncated: omittedCount > 0,
        omittedCount,
      };
      mealPlanRecipeIds = entries.flatMap((row) => row.recipe_id ? [row.recipe_id] : []);
    }
  }

  const prioritizedHouseholdRecipeIds = [
    ...(pageContext?.kind === 'recipe' ? [pageContext.recipeId] : []),
    ...mealPlanRecipeIds,
  ].filter((id, index, ids) => id.trim().length > 0 && ids.indexOf(id) === index);
  const householdRecipeSelect =
    'id, title, prep_time_minutes, cook_time_minutes, default_servings, dietary_tags, updated_at, cover_image_path';
  const prioritizedHouseholdRecipesResult = prioritizedHouseholdRecipeIds.length === 0
    ? { data: [], error: null }
    : await client
      .from('recipes')
      .select(householdRecipeSelect)
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .in('id', prioritizedHouseholdRecipeIds)
      .limit(CONTEXT_LIMITS.householdRecipes);
  if (prioritizedHouseholdRecipesResult.error) {
    return {
      ok: false as const,
      status: 500,
      error: 'household_recipe_lookup_failed',
      message: prioritizedHouseholdRecipesResult.error.message,
    };
  }
  const prioritizedHouseholdRowsById = new Map(
    (prioritizedHouseholdRecipesResult.data ?? []).map((row) => [row.id, row]),
  );
  const householdRecipeRows = prioritizedHouseholdRecipeIds.flatMap((recipeId) => {
    const row = prioritizedHouseholdRowsById.get(recipeId);
    return row ? [row] : [];
  });
  const householdRecipeIds = householdRecipeRows.map((row) => row.id);
  type HouseholdComponentRow = { id: string; recipe_id: string; name: string };
  type HouseholdItemRow = {
    id: string;
    recipe_id: string;
    product_id: string | null;
    sub_component_id: string | null;
    quantity: number | string | null;
    unit: string | null;
    ingredient_mapping: unknown;
    ingredient_source_type: string | null;
    ingredient_source_id: string | null;
    ingredient_source_url: string | null;
    ingredient_source_version: string | null;
    ingredient_source_license: string | null;
    products: unknown;
  };
  const componentRowsByRecipe = new Map<string, HouseholdComponentRow[]>();
  const householdItemRowsByRecipe = new Map<string, HouseholdItemRow[]>();
  for (const recipeId of householdRecipeIds) {
    const [componentRowsResult, itemRowsResult] = await Promise.all([
      client.from('recipe_components')
        .select('id, recipe_id, name')
        .eq('household_id', householdId)
        .eq('recipe_id', recipeId)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .limit(CONTEXT_LIMITS.householdComponentsPerRecipe + 1),
      client.from('recipe_component_items')
        .select(
          'id, recipe_id, product_id, sub_component_id, quantity, unit, ingredient_mapping, ingredient_source_type, ingredient_source_id, ingredient_source_url, ingredient_source_version, ingredient_source_license, products(name)',
        )
        .eq('household_id', householdId)
        .eq('recipe_id', recipeId)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .limit(CONTEXT_LIMITS.householdIngredientsPerRecipe + 1),
    ]);
    if (componentRowsResult.error || itemRowsResult.error) {
      return {
        ok: false as const,
        status: 500,
        error: 'household_recipe_ingredients_lookup_failed',
        message: componentRowsResult.error?.message ?? itemRowsResult.error?.message,
      };
    }
    componentRowsByRecipe.set(
      recipeId,
      (componentRowsResult.data ?? []) as HouseholdComponentRow[],
    );
    householdItemRowsByRecipe.set(
      recipeId,
      (itemRowsResult.data ?? []) as HouseholdItemRow[],
    );
  }

  const incompleteHouseholdRecipeIds = new Set<string>();
  for (const recipeId of householdRecipeIds) {
    const components = componentRowsByRecipe.get(recipeId) ?? [];
    const items = householdItemRowsByRecipe.get(recipeId) ?? [];
    const componentNames = new Map(
      components.map((row) => [row.id, limitContextString(row.name)]),
    );
    if (
      components.length === 0 ||
      components.length > CONTEXT_LIMITS.householdComponentsPerRecipe ||
      items.length === 0 ||
      items.length > CONTEXT_LIMITS.householdIngredientsPerRecipe ||
      components.some((row) => limitContextString(row.name).length === 0)
    ) {
      incompleteHouseholdRecipeIds.add(recipeId);
      continue;
    }
    const foodItems = items.filter((row) => !row.sub_component_id);
    if (foodItems.length === 0) {
      incompleteHouseholdRecipeIds.add(recipeId);
      continue;
    }
    for (const row of items) {
      if (row.sub_component_id) {
        if (!componentNames.has(row.sub_component_id)) {
          incompleteHouseholdRecipeIds.add(recipeId);
        }
        continue;
      }
      if (!row.product_id || !relationProductName(row.products)) {
        incompleteHouseholdRecipeIds.add(recipeId);
      }
    }
  }
  const completeHouseholdRecipeIds = householdRecipeIds.filter(
    (recipeId) => !incompleteHouseholdRecipeIds.has(recipeId),
  );
  const householdItemRows = completeHouseholdRecipeIds.flatMap(
    (recipeId) => householdItemRowsByRecipe.get(recipeId) ?? [],
  );
  const foodIngredientRows = householdItemRows.filter((row) => !row.sub_component_id);
  const mappingsByItem = new Map(foodIngredientRows.map((row) => [
    row.id,
    toReviewedRecipeIngredientMapping(row as unknown as RecipeIngredientMappingRow),
  ]));
  const mappingFingerprintItemsByRecipe = new Map<
    string,
    Array<Parameters<typeof fingerprintRecipeIngredientMappings>[0][number]>
  >();
  for (const row of foodIngredientRows) {
    const mapping = mappingsByItem.get(row.id);
    if (!mapping) continue;
    const mappingPayload = typeof row.ingredient_mapping === 'object' &&
        row.ingredient_mapping !== null && !Array.isArray(row.ingredient_mapping)
      ? row.ingredient_mapping as Record<string, unknown>
      : {};
    const current = mappingFingerprintItemsByRecipe.get(row.recipe_id) ?? [];
    current.push({
      itemId: row.id,
      mappingStatus: mapping.status,
      submittedMappingStatus: typeof mappingPayload.status === 'string'
        ? mappingPayload.status
        : 'unknown',
      ingredientIds: mapping.ingredientIds,
      complete: mapping.complete,
      mappingSource: mapping.source,
      mappingSourceId: mapping.sourceId,
      mappingSourceUrl: mapping.sourceUrl,
      mappingSourceVersion: mapping.sourceVersion,
      currentSourceVersion: mapping.currentSourceVersion,
      rowSource: row.ingredient_source_type,
      rowSourceId: row.ingredient_source_id,
      rowSourceUrl: row.ingredient_source_url,
      rowSourceVersion: row.ingredient_source_version,
      rowLicense: row.ingredient_source_license,
      mappingLicense: mapping.license,
      reviewedAt: mapping.reviewedAt,
      reviewedBy: mapping.reviewedBy,
      evidenceSnapshot: mapping.evidenceSnapshot,
    });
    mappingFingerprintItemsByRecipe.set(row.recipe_id, current);
  }
  const ingredientMappingVersionByRecipe = new Map(
    await Promise.all(completeHouseholdRecipeIds.map(async (recipeId) =>
      [
        recipeId,
        await fingerprintRecipeIngredientMappings(
          mappingFingerprintItemsByRecipe.get(recipeId) ?? [],
        ),
      ] as const
    )),
  );
  const ingredientIds = [
    ...new Set(
      [...mappingsByItem.values()].flatMap((mapping) =>
        hasCurrentIngredientReview(mapping) ? mapping.ingredientIds : []
      ),
    ),
  ];
  let ingredientRevisions: IngredientRevision[] = [];
  let ingredientFacts: IngredientFactRecord[] = [];
  if (ingredientIds.length > 0) {
    const [ingredientsResult, factsResult] = await Promise.all([
      client.from('food_ingredients')
        .select('id, revision')
        .in('id', ingredientIds),
      activeAllergenIds.length > 0
        ? client.from('ingredient_allergen_assessments')
          .select(
            'ingredient_id, ingredient_revision, allergen_id, assessment, source, source_id, source_url, source_version, license, review_scope, evidence_snapshot, evidence_sha256, confidence, reviewed_at, reviewed_by',
          )
          .in('ingredient_id', ingredientIds)
          .in('allergen_id', activeAllergenIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (ingredientsResult.error || factsResult.error) {
      return {
        ok: false as const,
        status: 500,
        error: 'ingredient_allergen_knowledge_lookup_failed',
        message: ingredientsResult.error?.message ?? factsResult.error?.message,
      };
    }
    ingredientRevisions = (ingredientsResult.data ?? []).map((row) => ({
      ingredientId: row.id,
      revision: row.revision,
    }));
    ingredientFacts = (factsResult.data ?? []).map((row) => ({
      ingredientId: row.ingredient_id,
      ingredientRevision: row.ingredient_revision,
      allergenId: row.allergen_id,
      assessment: row.assessment,
      source: row.source,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      sourceVersion: row.source_version,
      license: row.license,
      reviewScope: row.review_scope,
      evidenceSnapshot: row.evidence_snapshot,
      evidenceSha256: row.evidence_sha256,
      confidence: row.confidence,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
    }));
  }
  const knownIngredientIds = new Set(
    ingredientRevisions.map((ingredient) => ingredient.ingredientId),
  );
  const canonicalIngredientIdsByRecipe = new Map<string, string[]>();
  const incompleteCanonicalIngredientMappings = new Set<string>();
  for (const row of foodIngredientRows) {
    const mapping = mappingsByItem.get(row.id);
    if (
      !mapping || !hasCurrentIngredientReview(mapping) ||
      !mapping.ingredientIds.every((ingredientId) => knownIngredientIds.has(ingredientId))
    ) {
      incompleteCanonicalIngredientMappings.add(row.recipe_id);
      continue;
    }
    const current = canonicalIngredientIdsByRecipe.get(row.recipe_id) ?? [];
    current.push(...mapping.ingredientIds);
    canonicalIngredientIdsByRecipe.set(row.recipe_id, current);
  }
  const householdIngredientsByRecipe = new Map<string, GatewayRecipe['ingredients']>();
  for (const row of householdItemRows) {
    // Subcomponent links are structural. Their child component positions are
    // counted for completeness but are not repeated as food ingredients.
    if (row.sub_component_id) continue;
    const name = relationProductName(row.products);
    if (!name) continue;
    const ingredients = householdIngredientsByRecipe.get(row.recipe_id) ?? [];
    ingredients.push({
      itemId: limitContextString(row.id),
      productId: row.product_id ? limitContextString(row.product_id) : null,
      normalizedName: limitContextString(name),
      quantity: typeof row.quantity === 'number' ? row.quantity : null,
      unit: row.unit ? limitContextString(row.unit) : null,
    });
    householdIngredientsByRecipe.set(row.recipe_id, ingredients);
  }
  const householdRecipes: GatewayRecipe[] = completeHouseholdRecipeIds.flatMap((recipeId) => {
    const row = householdRecipeRows.find((candidate) => candidate.id === recipeId);
    if (!row) return [];
    return [
      {
        recipeId: limitContextString(row.id),
        title: limitContextString(String(row.title)),
        source: 'household',
        coverImagePath: row.cover_image_path
          ? limitContextString(String(row.cover_image_path))
          : null,
        updatedAt: row.updated_at ? limitContextString(row.updated_at) : undefined,
        estimatedMinutes: (typeof row.prep_time_minutes === 'number' ? row.prep_time_minutes : 0) +
            (typeof row.cook_time_minutes === 'number' ? row.cook_time_minutes : 0) || null,
        servings: typeof row.default_servings === 'number' ? row.default_servings : null,
        dietaryTags: Array.isArray(row.dietary_tags)
          ? row.dietary_tags.filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => limitContextString(tag))
          : [],
        allergens: null,
        ingredients: householdIngredientsByRecipe.get(row.id) ?? [],
        ingredientDataComplete: true,
        ingredientMappingVersion: ingredientMappingVersionByRecipe.get(row.id),
        canonicalIngredientIds: [
          ...new Set(canonicalIngredientIdsByRecipe.get(row.id) ?? []),
        ].map(limitContextString).sort(),
        canonicalIngredientMappingComplete: !incompleteCanonicalIngredientMappings.has(row.id) &&
          (canonicalIngredientIdsByRecipe.get(row.id)?.length ?? 0) > 0,
        ...(activeAllergenIds.length > 0
          ? {
            allergenProjection: projectRecipeAllergenSafety({
              expectedItemIds: foodIngredientRows
                .filter((item) => item.recipe_id === row.id)
                .map((item) => item.id),
              mappings: foodIngredientRows.filter((item) => item.recipe_id === row.id)
                .map((item) => mappingsByItem.get(item.id)!),
              ingredients: ingredientRevisions,
              facts: ingredientFacts,
              activeAllergenIds,
              rulesUpdatedAt: includePersonalFoodRules ? foodRules.updatedAt : null,
            }),
          }
          : {}),
      } satisfies GatewayRecipe,
    ];
  });

  const householdRecipeTitleById = new Map(
    householdRecipes.map((recipe) => [recipe.recipeId, recipe.title]),
  );
  const mealPlan: GatewayMealPlanContext | undefined = mealPlanSelection
    ? {
      weekStartDate: mealPlanSelection.weekStartDate,
      planName: mealPlanSelection.planName,
      entries: mealPlanSelection.entries.flatMap((row) => {
        if (!['breakfast', 'lunch', 'dinner'].includes(String(row.meal_slot))) return [];
        const recipeTitle = row.recipe_id ? householdRecipeTitleById.get(row.recipe_id) : null;
        if (row.recipe_id && recipeTitle === undefined) return [];
        const rawCustomIngredients = Array.isArray(row.custom_ingredients)
          ? row.custom_ingredients.flatMap((value: unknown) => {
            if (
              !isRecord(value) || !nonEmptyString(value.name) ||
              typeof value.quantity !== 'number' || !Number.isFinite(value.quantity) ||
              !nonEmptyString(value.unit)
            ) return [];
            return [{
              name: limitContextString(value.name),
              quantity: value.quantity,
              unit: limitContextString(value.unit),
            }];
          })
          : [];
        const customIngredients = limitContextArray(
          rawCustomIngredients,
          CONTEXT_LIMITS.customIngredientsPerEntry,
        );
        return [{
          entryId: limitContextString(row.id),
          date: limitContextString(row.entry_date),
          mealSlot: row.meal_slot as 'breakfast' | 'lunch' | 'dinner',
          recipeId: row.recipe_id ? limitContextString(row.recipe_id) : null,
          title: recipeTitle ?? limitContextString(String(row.custom_title ?? '')),
          portions: typeof row.portions === 'number' ? row.portions : Number(row.portions),
          customIngredients: customIngredients.values,
          ...(customIngredients.truncated
            ? {
              customIngredientsTruncated: true,
              customIngredientsOmittedCount: customIngredients.omittedCount,
            }
            : {}),
        }];
      }),
      ...(mealPlanSelection.truncated
        ? { truncated: true, omittedCount: mealPlanSelection.omittedCount }
        : {}),
    }
    : undefined;

  const context: GatewayCookingContext = {
    inventory: {
      source: 'inventory',
      fetchedAt: new Date().toISOString(),
      lots: boundedLots.values,
      ...(inventoryOmittedCount > 0
        ? { truncated: true, omittedCount: inventoryOmittedCount }
        : {}),
    } satisfies GatewayInventoryContext,
    recipes,
    householdRecipes,
    ...(incompleteHouseholdRecipeIds.size > 0
      ? { unavailableRecipeIds: [...incompleteHouseholdRecipeIds] }
      : {}),
    shoppingList,
    ...(shoppingListOmittedCount > 0
      ? { shoppingListTruncated: true, shoppingListOmittedCount }
      : {}),
    ...(mealPlan ? { mealPlan } : {}),
    foodRules: includePersonalFoodRules ? { ...foodRules, ingredientAliases } : foodRules,
  };
  return { ok: true as const, context };
}

const handler = createAiGatewayHandler({
  authenticate,
  assertHouseholdMember,
  authorizeAiEntitlement,
  bookAiCredit,
  refundAiCredit,
  getAiCreditStatus,
  recordAiUsage,
  loadCookingContext,
  loadRecipePage,
  validatePublicUrl: isPublicHttpsUrl,
  complete: providerComplete,
  isRateLimited: () => rateLimiter.isLimited(),
  recordRateLimitAttempt: () => rateLimiter.record(),
  allowedModels,
  defaultModel,
  defaultProvider: configuredProvider,
  providerModels,
  providerDefaultModels,
  modelOverridesEnabled: isLocalSupabaseUrl(supabaseUrl),
  modelTestingEnabled: isRevenueCatSandboxAllowed(supabaseUrl),
  modelTestModels: providerModels,
  mediaFallback: {
    provider: 'openrouter',
    model: Deno.env.get('AI_GATEWAY_MEDIA_FALLBACK_MODEL') ?? 'qwen/qwen3.8-flash',
  },
});

if (import.meta.main) {
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
    const errorCode = response.status >= 400
      ? await response.clone().json().then((body: unknown) =>
        isRecord(body) && typeof body.error === 'string' ? body.error : undefined
      ).catch(() => undefined)
      : undefined;
    console.info(
      JSON.stringify({
        event: 'ai_gateway_request',
        method: request.method,
        status: response.status,
        ...(errorCode ? { error: errorCode } : {}),
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
    return response;
  });
}
