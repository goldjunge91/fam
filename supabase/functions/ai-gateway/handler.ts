import { buildCatalogSuggestions } from './catalog-suggestions.ts';
import {
  buildChefRecipeSnapshot,
  buildChefRequestPayload,
  buildChefResponsePayload,
  type ChefConversationContext,
  type ChefConversationPreflight,
  type ChefCookingHistoryRequest,
  type ChefExchangeLookup,
  type ChefHistoryHydration,
  chefRequestFingerprint,
  historyContextMessage,
  isUuid,
  normalizedInventoryIds,
} from './chef-history.ts';
import { ALLOWED_MODELS, DEFAULT_MODEL } from './config.ts';
import { buildRecipeSuggestionContext } from './recipe-suggestion-context.ts';
import {
  type CandidateRecipeSource,
  type RecipeSuggestionContext,
  validateRecipeSuggestionResponse,
} from './recipe-suggestion-contract.ts';

export { ALLOWED_MODELS, DEFAULT_MODEL } from './config.ts';

type CaptureRequest = {
  skill: 'fam-inventory-capture';
  householdId: string;
  text: string;
  locale: 'de-DE';
  model?: string;
};

type CookingRequest = ChefCookingHistoryRequest & {
  skill: 'fam-cook-from-inventory';
  model?: string;
};

export type GatewayRequest = CaptureRequest | CookingRequest;

export type GatewayLot = {
  lotId: string;
  productId: string | null;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  bestBefore: string | null;
  useBy: string | null;
  storage: 'fridge' | 'freezer' | 'pantry' | 'unknown';
};

export type GatewayInventoryContext = {
  source: 'inventory';
  fetchedAt: string;
  lots: GatewayLot[];
};

export type GatewayRecipe = {
  recipeId: string;
  title: string;
  source: CandidateRecipeSource;
  estimatedMinutes: number | null;
  servings: number | null;
  dietaryTags: string[];
  /** Null means the recipe has no complete, reviewed allergen projection. */
  allergens: string[] | null;
  steps: string[];
  ingredients: Array<{
    productId: string | null;
    normalizedName: string;
    quantity: number | null;
    unit: string | null;
  }>;
};

export type GatewayCookingContext = {
  inventory: GatewayInventoryContext;
  recipes: GatewayRecipe[];
  shoppingItems: Array<{
    shoppingItemId: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  allergies: string[];
  preferences: string[];
  forbiddenIngredients: string[];
};

type JsonRecord = Record<string, unknown>;

type AuthResult =
  | { ok: true; userId: string; authorization: string }
  | { ok: false; status: number; error: string };

export type GatewayCreditAction = 'suggestion' | 'recipe';

type EntitlementResult =
  | { ok: true; subscriberUserId: string }
  | { ok: false; status: number; error: string };

type CreditResult =
  | { ok: true; created: boolean }
  | { ok: false; status: number; error: string };

type HistoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

type ContextResult =
  | { ok: true; context: GatewayCookingContext }
  | { ok: false; status: number; error: string };

type ProviderResult =
  | { ok: true; content: string; model: string; usage?: unknown }
  | { ok: false; status: number; error: string };

type Dependencies = {
  authenticate: (request: Request, requestId: string) => Promise<AuthResult>;
  assertHouseholdMember: (
    userId: string,
    householdId: string,
    authorization: string,
    requestId: string,
  ) => Promise<AuthResult>;
  lookupChefExchange: (input: {
    householdId: string;
    actorUserId: string;
    clientRequestId: string;
    requestFingerprint: string;
  }) => Promise<HistoryResult<ChefExchangeLookup>>;
  preflightChefExchange: (input: {
    householdId: string;
    actorUserId: string;
    conversationId: string | null;
    continuedFromConversationId: string | null;
  }) => Promise<HistoryResult<ChefConversationPreflight>>;
  loadChefConversationContext: (input: {
    householdId: string;
    actorUserId: string;
    conversationId: string;
  }) => Promise<HistoryResult<ChefConversationContext>>;
  persistChefExchange: (input: {
    householdId: string;
    actorUserId: string;
    conversationId: string | null;
    continuedFromConversationId: string | null;
    clientRequestId: string;
    requestFingerprint: string;
    requestPayload: ReturnType<typeof buildChefRequestPayload>;
    userText: string;
    responsePayload: ReturnType<typeof buildChefResponsePayload>;
    recipeSnapshots: ReturnType<typeof buildChefRecipeSnapshot>[];
  }) => Promise<HistoryResult<ChefHistoryHydration>>;
  authorizeAiEntitlement: (
    userId: string,
    householdId: string,
    authorization: string,
    requestId: string,
  ) => Promise<EntitlementResult>;
  bookAiCredit: (input: {
    householdId: string;
    subscriberUserId: string;
    action: GatewayCreditAction;
    requestId: string;
  }) => Promise<CreditResult>;
  refundAiCredit: (subscriberUserId: string, requestId: string) => Promise<void>;
  loadCookingContext: (
    userId: string,
    householdId: string,
    authorization: string,
    requestId: string,
  ) => Promise<ContextResult>;
  complete: (input: {
    requestId: string;
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    skill: GatewayRequest['skill'];
    cookingContext: RecipeSuggestionContext | null;
  }) => Promise<ProviderResult>;
  isRateLimited?: () => boolean;
  recordRateLimitAttempt?: () => void;
  allowedModels?: readonly string[];
  defaultModel?: string;
  now?: () => string;
  requestId?: () => string;
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'X-Request-Id',
};

export function createAiGatewayResponse(
  body: JsonRecord,
  status: number,
  requestId: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS, 'X-Request-Id': requestId },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 8_000;
}

function validOptionalModel(value: unknown): value is string | undefined {
  return value === undefined || nonEmptyString(value);
}

function validNullableInteger(value: unknown, maximum: number): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= maximum)
  );
}

function validOptionalUuid(value: unknown): value is string | undefined {
  return value === undefined || isUuid(value);
}

function validOptionalInventoryItemIds(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 100 &&
      value.every(isUuid) &&
      new Set(value).size === value.length)
  );
}

function parseRequest(value: unknown): GatewayRequest | null {
  if (!isRecord(value) || !nonEmptyString(value.householdId)) return null;

  if (value.skill === 'fam-inventory-capture') {
    const allowedKeys = new Set(['skill', 'householdId', 'text', 'locale', 'model']);
    if (
      Object.keys(value).some((key) => !allowedKeys.has(key)) ||
      value.locale !== 'de-DE' ||
      !nonEmptyString(value.text) ||
      !validOptionalModel(value.model)
    ) {
      return null;
    }
    return {
      skill: value.skill,
      householdId: value.householdId.trim(),
      text: value.text.trim(),
      locale: value.locale,
      ...(value.model === undefined ? {} : { model: value.model.trim() }),
    };
  }

  if (value.skill !== 'fam-cook-from-inventory') return null;
  const allowedKeys = new Set([
    'skill',
    'householdId',
    'userText',
    'servings',
    'maxMinutes',
    'dietaryPattern',
    'shoppingDecision',
    'selectedInventoryItemIds',
    'clientRequestId',
    'conversationId',
    'continuedFromConversationId',
    'model',
  ]);
  const selectedInventoryItemIds = value.selectedInventoryItemIds;
  if (
    Object.keys(value).some((key) => !allowedKeys.has(key)) ||
    !isUuid(value.householdId) ||
    !isUuid(value.clientRequestId) ||
    !nonEmptyString(value.userText) ||
    !validNullableInteger(value.servings, 100) ||
    !validNullableInteger(value.maxMinutes, 1440) ||
    (value.dietaryPattern !== null && !nonEmptyString(value.dietaryPattern)) ||
    (value.shoppingDecision !== null &&
      value.shoppingDecision !== 'yes' &&
      value.shoppingDecision !== 'no') ||
    !validOptionalInventoryItemIds(selectedInventoryItemIds) ||
    !validOptionalUuid(value.conversationId) ||
    !validOptionalUuid(value.continuedFromConversationId) ||
    (value.conversationId !== undefined && value.continuedFromConversationId !== undefined) ||
    !validOptionalModel(value.model)
  ) {
    return null;
  }

  return {
    skill: value.skill,
    householdId: value.householdId.trim(),
    userText: value.userText.trim(),
    servings: value.servings,
    maxMinutes: value.maxMinutes,
    dietaryPattern: value.dietaryPattern === null ? null : value.dietaryPattern.trim(),
    shoppingDecision: value.shoppingDecision,
    clientRequestId: value.clientRequestId,
    ...(selectedInventoryItemIds === undefined
      ? {}
      : { selectedInventoryItemIds: normalizedInventoryIds(selectedInventoryItemIds) }),
    ...(value.conversationId === undefined ? {} : { conversationId: value.conversationId }),
    ...(value.continuedFromConversationId === undefined
      ? {}
      : { continuedFromConversationId: value.continuedFromConversationId }),
    ...(value.model === undefined ? {} : { model: value.model.trim() }),
  };
}

function modelFor(
  requestedModel: string | undefined,
  allowedModels: readonly string[],
  defaultModel: string,
): string | null {
  const model = requestedModel ?? defaultModel;
  return allowedModels.includes(model) ? model : null;
}

function creditActionFor(request: GatewayRequest): GatewayCreditAction {
  return request.skill === 'fam-inventory-capture' ? 'suggestion' : 'recipe';
}

function buildSystemPrompt(
  request: GatewayRequest,
  cookingContext: RecipeSuggestionContext | null,
): string {
  const common = `
Du bist der read-only Haushaltsassistent von fam. Antworte ausschließlich als
gültiges JSON ohne Markdown, Kommentare oder zusätzliche Felder. Erfinde keine
Lebensmittel, Mengen, Daten, Rezept-IDs oder Inventar-Lot-IDs. Führe keine
Datenbankmutation und keine Aktion außerhalb dieses Aufrufs aus.`;

  if (request.skill === 'fam-inventory-capture') {
    return `${common}
Szenario: natürliche Erfassung eines deutschen Inventartexts.
Vertrag: inventory_capture_proposal.v1 mit exakt den Feldern kind, items,
questions und warnings. Das Ergebnis ist nur ein Vorschlag und niemals eine
bestätigte Inventaränderung.`;
  }

  return `${common}
Szenario: Rezeptvorschlag aus dem autorisierten Haushaltsbestand.
Vertrag: exakt {schema_version, meals}. Liefere eine bis drei Mahlzeiten.
Verwende ausschließlich Rezept- und Inventar-IDs aus dem bereitgestellten
Kontext. Mengen dürfen den Bestand nicht überschreiten. Zusätzliche Zutaten
müssen ausdrücklich in allowed_staples oder planned_shopping_items stehen.
Ein Modellrezept ist nur erlaubt, wenn fallback_allowed true ist. Die Antwort
schreibt niemals Daten.

Geprüfter Kontext:
${JSON.stringify(cookingContext)}`;
}

function buildUserPrompt(request: GatewayRequest): string {
  if (request.skill === 'fam-inventory-capture') {
    return JSON.stringify({
      scenario: request.skill,
      locale: request.locale,
      text: request.text,
    });
  }

  return JSON.stringify({
    scenario: request.skill,
    userText: request.userText,
    servings: request.servings,
    maxMinutes: request.maxMinutes,
    dietaryPattern: request.dietaryPattern,
    shoppingDecision: request.shoppingDecision,
  });
}

function parseProviderJson(content: string): JsonRecord | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

function validMissingFields(value: unknown): value is string[] {
  const allowed = new Set(['quantity', 'unit', 'storage', 'date']);
  return validStringArray(value) && value.every((field) => allowed.has(field));
}

function validateCaptureResult(result: JsonRecord, request: CaptureRequest): string | null {
  if (result.kind !== 'inventory_capture_proposal.v1') return 'invalid_capture_kind';
  if (
    !Array.isArray(result.items) ||
    !validStringArray(result.questions) ||
    !validStringArray(result.warnings)
  ) {
    return 'invalid_capture_shape';
  }

  for (const item of result.items) {
    if (!isRecord(item)) return 'invalid_capture_item';
    const required = [
      'rawText',
      'normalizedName',
      'quantity',
      'unit',
      'perishability',
      'storage',
      'date',
      'dateKind',
      'confidence',
      'evidence',
      'missingFields',
    ];
    if (
      Object.keys(item).some((key) => !required.includes(key)) ||
      required.some((key) => !Object.hasOwn(item, key))
    ) {
      return 'invalid_capture_item_fields';
    }
    if (
      !nonEmptyString(item.rawText) ||
      !nonEmptyString(item.evidence) ||
      !validMissingFields(item.missingFields)
    ) {
      return 'invalid_capture_item_values';
    }
    if (!request.text.includes(item.rawText) || !request.text.includes(item.evidence)) {
      return 'capture_evidence_not_grounded';
    }
    if (
      typeof item.confidence !== 'number' ||
      item.confidence < 0 ||
      item.confidence > 1
    ) {
      return 'invalid_capture_confidence';
    }
  }
  return null;
}

function chefResponseFromHistory(history: ChefHistoryHydration): JsonRecord {
  const response = history.turn.response_payload;
  return {
    skill: response.skill,
    model: response.model,
    result: response.result,
    priorityFoodCount: response.priority_food_count,
    shoppingQuestion: response.shopping_question,
    generatedAt: response.generated_at,
    clientRequestId: history.turn.client_request_id,
    conversationId: history.conversation.id,
    turnId: history.turn.id,
    history,
  };
}

function preflightErrorStatus(errorCode: string | null): number {
  if (errorCode === 'invalid_request') return 400;
  if (errorCode === 'household_forbidden') return 403;
  if (errorCode === 'chef_conversation_not_found') return 404;
  return 409;
}

/** Creates the HTTP handler while keeping auth, storage, billing, and provider I/O injectable. */
export function createAiGatewayHandler(dependencies: Dependencies) {
  const allowedModels = dependencies.allowedModels ?? ALLOWED_MODELS;
  const defaultModel = dependencies.defaultModel ?? DEFAULT_MODEL;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const makeRequestId = dependencies.requestId ?? (() => crypto.randomUUID());

  return async (request: Request, edgeRequestId?: string): Promise<Response> => {
    const requestId = edgeRequestId ?? makeRequestId();
    const respond = (body: JsonRecord, status = 200) =>
      createAiGatewayResponse({ ...body, requestId }, status, requestId);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, 'X-Request-Id': requestId },
      });
    }
    if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);

    const auth = await dependencies.authenticate(request, requestId);
    if (!auth.ok) return respond({ error: auth.error }, auth.status);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respond({ error: 'invalid_json' }, 400);
    }

    const parsedRequest = parseRequest(body);
    if (parsedRequest === null) return respond({ error: 'invalid_request' }, 400);

    const member = await dependencies.assertHouseholdMember(
      auth.userId,
      parsedRequest.householdId,
      auth.authorization,
      requestId,
    );
    if (!member.ok) return respond({ error: member.error }, member.status);

    const model = modelFor(parsedRequest.model, allowedModels, defaultModel);
    if (model === null) return respond({ error: 'model_not_allowed' }, 400);

    let requestFingerprint: string | null = null;
    let requestPayload: ReturnType<typeof buildChefRequestPayload> | null = null;
    let conversationContext: ChefConversationContext | null = null;

    if (parsedRequest.skill === 'fam-cook-from-inventory') {
      requestPayload = buildChefRequestPayload(parsedRequest);
      requestFingerprint = await chefRequestFingerprint({ request: parsedRequest, model });

      const lookup = await dependencies.lookupChefExchange({
        householdId: parsedRequest.householdId,
        actorUserId: auth.userId,
        clientRequestId: parsedRequest.clientRequestId,
        requestFingerprint,
      });
      if (!lookup.ok) return respond({ error: lookup.error }, lookup.status);
      if (lookup.value.status === 'conflict') {
        return respond({ error: 'chef_request_replay_mismatch' }, 409);
      }
      if (lookup.value.status === 'refunded') {
        return respond({ error: 'chef_request_already_refunded' }, 409);
      }
      if (lookup.value.status === 'incomplete') {
        return respond({ error: 'chef_request_incomplete' }, 409);
      }
      if (lookup.value.status === 'match') {
        return respond(chefResponseFromHistory(lookup.value.hydration));
      }

      const preflight = await dependencies.preflightChefExchange({
        householdId: parsedRequest.householdId,
        actorUserId: auth.userId,
        conversationId: parsedRequest.conversationId ?? null,
        continuedFromConversationId: parsedRequest.continuedFromConversationId ?? null,
      });
      if (!preflight.ok) return respond({ error: preflight.error }, preflight.status);
      if (!preflight.value.allowed) {
        const error = preflight.value.error_code ?? 'chef_conversation_preflight_failed';
        return respond({ error }, preflightErrorStatus(error));
      }
    }

    if (dependencies.isRateLimited?.()) return respond({ error: 'rate_limited' }, 429);
    dependencies.recordRateLimitAttempt?.();

    const entitlement = await dependencies.authorizeAiEntitlement(
      auth.userId,
      parsedRequest.householdId,
      auth.authorization,
      requestId,
    );
    if (!entitlement.ok) return respond({ error: entitlement.error }, entitlement.status);

    const generatedAt = now();
    let cookingContext: RecipeSuggestionContext | null = null;
    let catalogMeals: ReturnType<typeof buildCatalogSuggestions> | null = null;

    const persistCookingResponse = async (input: {
      responsePayload: ReturnType<typeof buildChefResponsePayload>;
      recipeSnapshots: ReturnType<typeof buildChefRecipeSnapshot>[];
      bookedSubscriberUserId?: string;
    }): Promise<Response> => {
      if (
        parsedRequest.skill !== 'fam-cook-from-inventory' ||
        requestFingerprint === null ||
        requestPayload === null
      ) {
        return respond({ error: 'chef_history_persist_failed' }, 500);
      }

      const persisted = await dependencies.persistChefExchange({
        householdId: parsedRequest.householdId,
        actorUserId: auth.userId,
        conversationId: parsedRequest.conversationId ?? null,
        continuedFromConversationId: parsedRequest.continuedFromConversationId ?? null,
        clientRequestId: parsedRequest.clientRequestId,
        requestFingerprint,
        requestPayload,
        userText: parsedRequest.userText,
        responsePayload: input.responsePayload,
        recipeSnapshots: input.recipeSnapshots,
      });
      if (persisted.ok) return respond(chefResponseFromHistory(persisted.value));

      const reconciliation = await dependencies.lookupChefExchange({
        householdId: parsedRequest.householdId,
        actorUserId: auth.userId,
        clientRequestId: parsedRequest.clientRequestId,
        requestFingerprint,
      });
      if (!reconciliation.ok) {
        return respond({ error: 'chef_history_persist_unknown' }, 500);
      }
      if (reconciliation.value.status === 'match') {
        return respond(chefResponseFromHistory(reconciliation.value.hydration));
      }
      if (reconciliation.value.status === 'conflict') {
        return respond({ error: 'chef_request_replay_mismatch' }, 409);
      }

      if (input.bookedSubscriberUserId !== undefined) {
        try {
          await dependencies.refundAiCredit(
            input.bookedSubscriberUserId,
            parsedRequest.clientRequestId,
          );
        } catch {
          return respond({ error: 'credit_refund_failed' }, 500);
        }
      }
      return respond({ error: persisted.error }, persisted.status);
    };

    if (parsedRequest.skill === 'fam-cook-from-inventory') {
      const contextResult = await dependencies.loadCookingContext(
        auth.userId,
        parsedRequest.householdId,
        auth.authorization,
        requestId,
      );
      if (!contextResult.ok) return respond({ error: contextResult.error }, contextResult.status);

      const context = buildRecipeSuggestionContext({
        inventory: contextResult.context.inventory,
        recipes: contextResult.context.recipes,
        shoppingItems: contextResult.context.shoppingItems,
        servings: parsedRequest.servings ?? 1,
        maxMinutes: parsedRequest.maxMinutes,
        dietaryPattern: parsedRequest.dietaryPattern,
        allergies: contextResult.context.allergies,
        preferences: contextResult.context.preferences,
        forbiddenIngredients: contextResult.context.forbiddenIngredients,
        selectedInventoryItemIds: parsedRequest.selectedInventoryItemIds ?? [],
        shoppingDecision: parsedRequest.shoppingDecision,
        today: new Date(generatedAt),
      });
      if (context === null) return respond({ error: 'no_safe_recipe' }, 422);
      cookingContext = context.context;

      const historySourceId = parsedRequest.conversationId ??
        parsedRequest.continuedFromConversationId;
      if (historySourceId !== undefined) {
        const loadedHistory = await dependencies.loadChefConversationContext({
          householdId: parsedRequest.householdId,
          actorUserId: auth.userId,
          conversationId: historySourceId,
        });
        if (!loadedHistory.ok) {
          return respond({ error: loadedHistory.error }, loadedHistory.status);
        }
        conversationContext = loadedHistory.value;
      }

      if (context.shoppingQuestion !== null) {
        return persistCookingResponse({
          responsePayload: buildChefResponsePayload({
            model,
            generatedAt,
            priorityFoodCount: cookingContext.priority_foods.length,
            shoppingQuestion: context.shoppingQuestion,
            result: null,
          }),
          recipeSnapshots: [],
        });
      }

      catalogMeals = buildCatalogSuggestions(
        cookingContext,
        contextResult.context.recipes,
        parsedRequest.shoppingDecision === 'yes',
      );
    }

    const creditRequestId = parsedRequest.skill === 'fam-cook-from-inventory'
      ? parsedRequest.clientRequestId
      : requestId;
    const booking = await dependencies.bookAiCredit({
      householdId: parsedRequest.householdId,
      subscriberUserId: entitlement.subscriberUserId,
      action: creditActionFor(parsedRequest),
      requestId: creditRequestId,
    });
    if (!booking.ok) return respond({ error: booking.error }, booking.status);
    if (!booking.created) {
      return respond(
        {
          error: parsedRequest.skill === 'fam-cook-from-inventory'
            ? 'chef_request_incomplete'
            : 'ai_credit_request_incomplete',
        },
        409,
      );
    }

    const refundAndRespond = async (responseBody: JsonRecord, status: number) => {
      try {
        await dependencies.refundAiCredit(entitlement.subscriberUserId, creditRequestId);
      } catch {
        return respond({ error: 'credit_refund_failed' }, 500);
      }
      return respond(responseBody, status);
    };

    if (catalogMeals !== null && catalogMeals.length > 0) {
      if (cookingContext === null) {
        return await refundAndRespond({ error: 'gateway_context_invalid' }, 500);
      }
      const result = { schema_version: 1 as const, meals: catalogMeals };
      return persistCookingResponse({
        responsePayload: buildChefResponsePayload({
          model,
          generatedAt,
          priorityFoodCount: cookingContext.priority_foods.length,
          shoppingQuestion: null,
          result,
        }),
        recipeSnapshots: [buildChefRecipeSnapshot(result, cookingContext)],
        bookedSubscriberUserId: entitlement.subscriberUserId,
      });
    }

    let provider: ProviderResult;
    try {
      provider = await dependencies.complete({
        requestId,
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(parsedRequest, cookingContext) },
          ...(conversationContext === null || conversationContext.turns.length === 0
            ? []
            : [{ role: 'user' as const, content: historyContextMessage(conversationContext) }]),
          { role: 'user', content: buildUserPrompt(parsedRequest) },
        ],
        skill: parsedRequest.skill,
        cookingContext,
      });
    } catch {
      return await refundAndRespond({ error: 'provider_unavailable' }, 502);
    }
    if (!provider.ok) return await refundAndRespond({ error: provider.error }, provider.status);
    if (provider.model !== model || !allowedModels.includes(provider.model)) {
      return await refundAndRespond({ error: 'provider_model_mismatch' }, 502);
    }

    const parsedResult = parseProviderJson(provider.content);
    if (parsedResult === null) {
      return await refundAndRespond({ error: 'provider_invalid_json' }, 502);
    }

    if (parsedRequest.skill === 'fam-inventory-capture') {
      const validationError = validateCaptureResult(parsedResult, parsedRequest);
      if (validationError !== null) {
        return await refundAndRespond({ error: validationError }, 502);
      }
      return respond({
        skill: parsedRequest.skill,
        model: provider.model,
        result: parsedResult,
        ...(provider.usage === undefined ? {} : { usage: provider.usage }),
        generatedAt,
      });
    }

    if (cookingContext === null) {
      return await refundAndRespond({ error: 'gateway_context_invalid' }, 500);
    }
    const validation = validateRecipeSuggestionResponse(cookingContext, parsedResult);
    if (!validation.ok) {
      console.error(
        JSON.stringify({
          event: 'ai_gateway_provider_contract_violation',
          requestId,
          issues: validation.issues.map(({ code, path }) => ({ code, path })),
        }),
      );
      return await refundAndRespond(
        {
          error: 'provider_contract_violation',
          issues: validation.issues.map(({ code, path }) => ({ code, path })),
        },
        502,
      );
    }

    let recipeSnapshot: ReturnType<typeof buildChefRecipeSnapshot>;
    try {
      recipeSnapshot = buildChefRecipeSnapshot(validation.value, cookingContext);
    } catch {
      return await refundAndRespond({ error: 'provider_contract_violation' }, 502);
    }

    return persistCookingResponse({
      responsePayload: buildChefResponsePayload({
        model: provider.model,
        generatedAt,
        priorityFoodCount: cookingContext.priority_foods.length,
        shoppingQuestion: null,
        result: validation.value,
      }),
      recipeSnapshots: [recipeSnapshot],
      bookedSubscriberUserId: entitlement.subscriberUserId,
    });
  };
}
