/**
 * Read-only AI gateway for the two scoped fam skills.
 *
 * The handler is dependency-injected so auth, database access and the model
 * provider can be tested without a Supabase instance or an OpenRouter key.
 */

import { buildRecipeSuggestionContext } from './recipe-suggestion-context.ts';
import { buildCatalogSuggestions } from './catalog-suggestions.ts';
import { recipeHasAllergenConflict } from './ingredient-knowledge.ts';
import {
  validateRecipeSuggestionContext,
  validateRecipeSuggestionResponse,
} from './recipe-suggestion-contract.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';
import { ALLOWED_MODELS, DEFAULT_MODEL, PROMPTS } from './config.ts';

export { ALLOWED_MODELS, DEFAULT_MODEL } from './config.ts';

type CaptureRequest = {
  skill: 'fam-inventory-capture';
  householdId: string;
  text: string;
  locale: 'de-DE';
  model?: string;
};

type CookingRequest = {
  skill: 'fam-cook-from-inventory';
  householdId: string;
  userText: string;
  servings: number | null;
  maxMinutes: number | null;
  dietaryPattern: string | null;
  allergies: string[];
  shoppingDecision: 'yes' | 'no' | null;
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
  source?: 'catalog' | 'template';
  estimatedMinutes: number | null;
  servings: number | null;
  dietaryTags: string[];
  /** null means the catalog has no authoritative allergen metadata. */
  allergens: string[] | null;
  steps?: string[];
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
  allergies?: string[];
  preferences?: string[];
  forbiddenIngredients?: string[];
  shoppingItems?: Array<{
    shoppingItemId: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
};

type JsonRecord = Record<string, unknown>;

type AuthResult =
  | { ok: true; userId: string; authorization: string }
  | { ok: false; status: number; error: string; message?: string };

type ContextResult =
  | { ok: true; context: GatewayCookingContext }
  | { ok: false; status: number; error: string; message?: string };

type ProviderResult =
  | { ok: true; content: string; model: string; usage?: unknown }
  | { ok: false; status: number; error: string; message?: string };

export type GatewayAccessResult =
  | { ok: true }
  | { ok: false; status: number; error: string; retryAfter?: number };

type Dependencies = {
  authenticate: (request: Request) => Promise<AuthResult>;
  assertHouseholdMember: (
    userId: string,
    householdId: string,
    authorization: string,
  ) => Promise<AuthResult>;
  loadCookingContext: (
    userId: string,
    householdId: string,
    authorization: string,
  ) => Promise<ContextResult>;
  complete: (input: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
  }) => Promise<ProviderResult>;
  consumeRateLimit: (userId: string) => Promise<GatewayAccessResult>;
  reserveCredit: (input: {
    householdId: string;
    action: 'suggestion' | 'voice';
    requestId: string;
  }) => Promise<GatewayAccessResult>;
  releaseCredit: (requestId: string) => Promise<void>;
  allowDevelopmentBypass?: (userId: string) => boolean;
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fam-ai-dev-bypass',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 8_000;
}

function parseRequest(value: unknown): GatewayRequest | null {
  if (!isRecord(value) || !nonEmptyString(value.skill) || !nonEmptyString(value.householdId)) {
    return null;
  }

  if (value.skill === 'fam-inventory-capture') {
    const allowedKeys = new Set(['skill', 'householdId', 'text', 'locale', 'model']);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
    return value.locale === 'de-DE' && nonEmptyString(value.text)
      ? {
          skill: value.skill,
          householdId: value.householdId.trim(),
          text: value.text.trim(),
          locale: 'de-DE',
          ...(nonEmptyString(value.model) ? { model: value.model.trim() } : {}),
        }
      : null;
  }

  if (value.skill !== 'fam-cook-from-inventory') return null;
  const allowedKeys = new Set([
    'skill',
    'householdId',
    'userText',
    'servings',
    'maxMinutes',
    'dietaryPattern',
    'allergies',
    'shoppingDecision',
    'model',
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  const validNullableInteger = (candidate: unknown): candidate is number | null =>
    candidate === null ||
    (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0);

  return nonEmptyString(value.userText) &&
    validNullableInteger(value.servings) &&
    validNullableInteger(value.maxMinutes) &&
    (value.dietaryPattern === null || nonEmptyString(value.dietaryPattern)) &&
    (value.allergies === undefined ||
      (Array.isArray(value.allergies) && value.allergies.length <= 50 && value.allergies.every(nonEmptyString))) &&
    (value.shoppingDecision === undefined ||
      value.shoppingDecision === null ||
      value.shoppingDecision === 'yes' ||
      value.shoppingDecision === 'no')
    ? {
        skill: value.skill,
        householdId: value.householdId.trim(),
        userText: value.userText.trim(),
        servings: value.servings,
        maxMinutes: value.maxMinutes,
        dietaryPattern:
          value.dietaryPattern === null ? null : value.dietaryPattern.trim(),
        allergies: Array.isArray(value.allergies)
          ? value.allergies.map((allergy) => allergy.trim())
          : [],
        shoppingDecision: value.shoppingDecision ?? null,
        ...(nonEmptyString(value.model) ? { model: value.model.trim() } : {}),
      }
    : null;
}

function modelFor(
  requestedModel: string | undefined,
  allowedModels: readonly string[],
  defaultModel: string,
): string | null {
  const model = requestedModel ?? defaultModel;
  return allowedModels.includes(model) ? model : null;
}

function buildSystemPrompt(
  request: GatewayRequest,
  context: GatewayCookingContext | RecipeSuggestionContext,
): string {
  if (request.skill === 'fam-inventory-capture') {
    return `${PROMPTS.common}\n${PROMPTS.inventoryCapture}`;
  }

  return `${PROMPTS.common}\n${PROMPTS.cookFromInventory(JSON.stringify(context))}`;
}

function buildUserPrompt(request: GatewayRequest): string {
  if (request.skill === 'fam-inventory-capture') {
    return JSON.stringify({ scenario: request.skill, locale: request.locale, text: request.text });
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

function prepareCookingContext(
  context: GatewayCookingContext,
  request: CookingRequest,
): GatewayCookingContext | null {
  const recipes = context.recipes
    .filter((recipe) => {
      if (recipeHasAllergenConflict(recipe.allergens, request.allergies)) return false;
      if (
        request.dietaryPattern !== null &&
        !recipe.dietaryTags.some((tag) => tag.toLocaleLowerCase('de-DE') === request.dietaryPattern?.toLocaleLowerCase('de-DE'))
      ) {
        return false;
      }
      if (request.maxMinutes !== null &&
        (recipe.estimatedMinutes === null || recipe.estimatedMinutes > request.maxMinutes)) {
        return false;
      }
      return !(request.servings !== null && recipe.servings === null);
    })
    .sort((a, b) => {
      if (a.estimatedMinutes === null && b.estimatedMinutes !== null) return 1;
      if (a.estimatedMinutes !== null && b.estimatedMinutes === null) return -1;
      if (a.estimatedMinutes !== null && b.estimatedMinutes !== null && a.estimatedMinutes !== b.estimatedMinutes) {
        return a.estimatedMinutes - b.estimatedMinutes;
      }
      return a.title.localeCompare(b.title, 'de') || a.recipeId.localeCompare(b.recipeId);
    })
    .slice(0, 3);

  return recipes.length === 0 ? null : { ...context, recipes };
}

function validateCaptureResult(result: JsonRecord, request: CaptureRequest): string | null {
  if (result.kind !== 'inventory_capture_proposal.v1') return 'invalid_capture_kind';
  if (!Array.isArray(result.items) || !validStringArray(result.questions) || !validStringArray(result.warnings)) {
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
    if (Object.keys(item).some((key) => !required.includes(key)) || required.some((key) => !(key in item))) {
      return 'invalid_capture_item_fields';
    }
    if (!nonEmptyString(item.rawText) || !nonEmptyString(item.evidence) || !validMissingFields(item.missingFields)) {
      return 'invalid_capture_item_values';
    }
    if (!request.text.includes(item.rawText) || !request.text.includes(item.evidence)) {
      return 'capture_evidence_not_grounded';
    }
    if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) {
      return 'invalid_capture_confidence';
    }
  }

  return null;
}

function validateCookingResult(result: JsonRecord, context: GatewayCookingContext, request: CookingRequest): string | null {
  if (result.kind !== 'cooking_suggestion.v1') return 'invalid_cooking_kind';
  const required = [
    'kind',
    'recipeId',
    'title',
    'usedLots',
    'missingIngredients',
    'estimatedMinutes',
    'servings',
    'rationale',
    'constraintChecks',
  ];
  if (Object.keys(result).some((key) => !required.includes(key)) || required.some((key) => !(key in result))) {
    return 'invalid_cooking_fields';
  }
  if (!nonEmptyString(result.recipeId) || !nonEmptyString(result.title)) return 'invalid_cooking_shape';
  if (!validStringArray(result.usedLots) || !validStringArray(result.missingIngredients)) {
    return 'invalid_cooking_arrays';
  }
  if (result.usedLots.length === 0 || result.missingIngredients.length > 2) {
    return 'invalid_cooking_arrays';
  }
  if (
    typeof result.estimatedMinutes !== 'number' ||
    !Number.isInteger(result.estimatedMinutes) ||
    result.estimatedMinutes < 1 ||
    typeof result.servings !== 'number' ||
    !Number.isInteger(result.servings) ||
    result.servings < 1
  ) {
    return 'invalid_cooking_shape';
  }
  if (!nonEmptyString(result.rationale)) return 'invalid_cooking_shape';
  if (!isRecord(result.constraintChecks)) return 'invalid_cooking_constraints';
  if (
    result.constraintChecks.allergies !== 'pass' ||
    !['pass', 'unknown'].includes(String(result.constraintChecks.dietaryPattern)) ||
    !['pass', 'unknown'].includes(String(result.constraintChecks.time))
  ) {
    return 'invalid_cooking_constraints';
  }
  if (request.dietaryPattern !== null && result.constraintChecks.dietaryPattern !== 'pass') {
    return 'dietary_gate_failed';
  }
  if (request.maxMinutes !== null && result.constraintChecks.time !== 'pass') {
    return 'time_gate_failed';
  }

  const recipe = context.recipes.find((candidate) => candidate.recipeId === result.recipeId);
  if (!recipe) return 'recipe_not_allowed';
  if (result.title.trim() !== recipe.title) return 'recipe_title_mismatch';

  const seenLots = new Set<string>();
  const allowedLots = new Set(context.inventory.lots.map((lot) => lot.lotId));
  for (const lotId of result.usedLots) {
    if (!allowedLots.has(lotId)) return 'lot_not_allowed';
    if (seenLots.has(lotId)) return 'duplicate_lot';
    seenLots.add(lotId);
  }

  if (request.allergies.length > 0 && result.constraintChecks.allergies !== 'pass') {
    return 'allergy_gate_failed';
  }

  return null;
}

/** Builds the HTTP handler used by the Deno entrypoint and its tests. */
export function createAiGatewayHandler(dependencies: Dependencies) {
  const allowedModels = dependencies.allowedModels ?? ALLOWED_MODELS;
  const defaultModel = dependencies.defaultModel ?? DEFAULT_MODEL;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const requestId = dependencies.requestId ?? (() => crypto.randomUUID());

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const auth = await dependencies.authenticate(request);
    if (!auth.ok) return json({ error: auth.error, ...(auth.message ? { message: auth.message } : {}) }, auth.status);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const parsedRequest = parseRequest(body);
    if (!parsedRequest) return json({ error: 'invalid_request' }, 400);

    const member = await dependencies.assertHouseholdMember(
      auth.userId,
      parsedRequest.householdId,
      auth.authorization,
    );
    if (!member.ok) return json({ error: member.error, ...(member.message ? { message: member.message } : {}) }, member.status);

    const model = modelFor(parsedRequest.model, allowedModels, defaultModel);
    if (!model) return json({ error: 'model_not_allowed' }, 400);

    const rateLimit = await dependencies.consumeRateLimit(auth.userId);
    if (!rateLimit.ok) {
      const response = json({ error: rateLimit.error }, rateLimit.status);
      if (rateLimit.retryAfter !== undefined) {
        response.headers.set('Retry-After', String(rateLimit.retryAfter));
      }
      return response;
    }

    const contextResult =
      parsedRequest.skill === 'fam-cook-from-inventory'
        ? await dependencies.loadCookingContext(
            auth.userId,
            parsedRequest.householdId,
            auth.authorization,
          )
        : {
            ok: true as const,
            context: {
              inventory: { source: 'inventory' as const, fetchedAt: now(), lots: [] },
              recipes: [],
            },
          };
    if (!contextResult.ok) {
      return json(
        { error: contextResult.error, ...(contextResult.message ? { message: contextResult.message } : {}) },
        contextResult.status,
      );
    }

    const canonicalContextResult = parsedRequest.skill === 'fam-cook-from-inventory'
      ? buildRecipeSuggestionContext({
          inventory: contextResult.context.inventory,
          recipes: contextResult.context.recipes,
          shoppingItems: contextResult.context.shoppingItems,
          servings: parsedRequest.servings ?? 1,
          maxMinutes: parsedRequest.maxMinutes,
          dietaryPattern: parsedRequest.dietaryPattern,
          allergies: contextResult.context.allergies ?? parsedRequest.allergies,
          preferences: contextResult.context.preferences,
          forbiddenIngredients: contextResult.context.forbiddenIngredients,
          shoppingDecision: parsedRequest.shoppingDecision,
          today: new Date(now()),
        })
      : null;
    if (parsedRequest.skill === 'fam-cook-from-inventory' && canonicalContextResult === null) {
      return json({ error: 'no_safe_recipe' }, 422);
    }

    if (canonicalContextResult?.shoppingQuestion !== null && canonicalContextResult?.shoppingQuestion !== undefined) {
      return json({
        requestId: requestId(),
        skill: parsedRequest.skill,
        model,
        result: null,
        priorityFoodCount: canonicalContextResult.context.priority_foods.length,
        shoppingQuestion: canonicalContextResult.shoppingQuestion,
        generatedAt: now(),
      });
    }

    const preparedContext = canonicalContextResult?.context ?? contextResult.context;
    if (
      canonicalContextResult !== null &&
      !validateRecipeSuggestionContext(canonicalContextResult.context).ok
    ) {
      return json({ error: 'gateway_context_invalid' }, 500);
    }

    if (canonicalContextResult !== null) {
      const catalogMeals = buildCatalogSuggestions(
        canonicalContextResult.context,
        contextResult.context.recipes,
      );
      if (catalogMeals.length > 0) {
        return json({
          requestId: requestId(),
          skill: parsedRequest.skill,
          model,
          result: { schema_version: 1, meals: catalogMeals },
          priorityFoodCount: canonicalContextResult.context.priority_foods.length,
          generatedAt: now(),
        });
      }
    }

    // The server allowlist is authoritative; a client header alone grants nothing.
    const bypassCredits = request.headers.get('x-fam-ai-dev-bypass') === 'true' &&
      dependencies.allowDevelopmentBypass?.(auth.userId) === true;
    const providerRequestId = requestId();
    if (!bypassCredits) {
      const credit = await dependencies.reserveCredit({
        householdId: parsedRequest.householdId,
        action: parsedRequest.skill === 'fam-cook-from-inventory' ? 'suggestion' : 'voice',
        requestId: providerRequestId,
      });
      if (!credit.ok) return json({ error: credit.error }, credit.status);
    }

    let keepCredit = false;
    try {
      const provider = await dependencies.complete({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(parsedRequest, preparedContext) },
          { role: 'user', content: buildUserPrompt(parsedRequest) },
        ],
      });
      if (!provider.ok) {
        return json(
          { error: provider.error, ...(provider.message ? { message: provider.message } : {}) },
          provider.status,
        );
      }
      if (provider.model !== model || !allowedModels.includes(provider.model)) {
        return json({ error: 'provider_model_mismatch' }, 502);
      }

      const parsedResult = parseProviderJson(provider.content);
      if (!parsedResult) return json({ error: 'provider_invalid_json' }, 502);
      let validatedResult: unknown = parsedResult;

      if (parsedRequest.skill === 'fam-inventory-capture') {
        const validationError = validateCaptureResult(parsedResult, parsedRequest);
        if (validationError) return json({ error: validationError }, 502);
      } else {
        const canonicalContext = canonicalContextResult?.context;
        if (!canonicalContext) return json({ error: 'gateway_context_invalid' }, 500);
        const validation = validateRecipeSuggestionResponse(canonicalContext, parsedResult);
        if (!validation.ok) {
          console.warn(
            JSON.stringify({
              event: 'ai_gateway_contract_violation',
              issues: validation.issues,
              content: provider.content,
            }),
          );
          return json(
            {
              error: 'provider_contract_violation',
              issues: validation.issues.map(({ code, path }) => ({ code, path })),
            },
            502,
          );
        }
        validatedResult = validation.value;
      }

      const response = json({
        requestId: providerRequestId,
        skill: parsedRequest.skill,
        model: provider.model,
        result: validatedResult,
        priorityFoodCount: canonicalContextResult?.context.priority_foods.length ?? 0,
        generatedAt: now(),
      });
      keepCredit = true;
      return response;
    } finally {
      if (!bypassCredits && !keepCredit) {
        await dependencies.releaseCredit(providerRequestId);
      }
    }
  };
}
