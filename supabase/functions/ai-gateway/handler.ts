/**
 * Read-only AI gateway for the two scoped fam skills.
 *
 * The handler is dependency-injected so auth, database access and the model
 * provider can be tested without a Supabase instance or an OpenRouter key.
 */

export const ALLOWED_MODELS = [
  'ibm-granite/granite-4.2-8b',
  'google/gemma-4-26b-a4b-it',
  'qwen/qwen3.8-flash',
  'z-ai/glm-5.3-flash',
  'google/gemma-4-31b-it',
  'minimax/minimax-m3:free',
] as const;

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
  estimatedMinutes: number | null;
  servings: number | null;
  dietaryTags: string[];
  /** null means the catalog has no authoritative allergen metadata. */
  allergens: string[] | null;
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
  return typeof value === 'string' && value.trim().length > 0;
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
    Array.isArray(value.allergies) &&
    value.allergies.every(nonEmptyString)
    ? {
        skill: value.skill,
        householdId: value.householdId.trim(),
        userText: value.userText.trim(),
        servings: value.servings,
        maxMinutes: value.maxMinutes,
        dietaryPattern:
          value.dietaryPattern === null ? null : value.dietaryPattern.trim(),
        allergies: value.allergies.map((allergy) => allergy.trim()),
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

function buildSystemPrompt(request: GatewayRequest, context: GatewayCookingContext): string {
  const common = `
Du bist der read-only Haushaltsassistent von fam. Antworte ausschließlich als
gültiges JSON ohne Markdown, Kommentare oder zusätzliche Felder. Erfinde keine
Lebensmittel, Mengen, Daten, Rezept-IDs oder Inventar-Lot-IDs. Führe keine
Datenbankmutation und keine Aktion außerhalb dieses Aufrufs aus.`;

  if (request.skill === 'fam-inventory-capture') {
    return `${common}
Szenario: natürliche Erfassung eines deutschen Inventartexts.
Vertrag: inventory_capture_proposal.v1 mit exakt den Feldern kind, items,
questions und warnings. Jedes Item enthält exakt rawText, normalizedName,
quantity, unit, perishability, storage, date, dateKind, confidence, evidence
und missingFields. "Etwas" bleibt bei quantity null. Evidence muss wörtlich aus
dem Nutzereingabetext stammen. Das Ergebnis ist ausschließlich ein Proposal, niemals
eine bestätigte Inventaränderung.`;
  }

  return `${common}
Szenario: Kochvorschlag aus dem autorisierten Inventar.
Vertrag: cooking_suggestion.v1 mit exakt kind, recipeId, title, usedLots,
missingIngredients, estimatedMinutes, servings, rationale und constraintChecks.
constraintChecks.allergies muss pass sein, dietaryPattern und time sind pass oder
unknown. Verwende ausschließlich Rezept-IDs und Lot-IDs aus dem folgenden
Kontext. Fehlende Zutaten gehören in missingIngredients. Liefere höchstens drei
Vorschläge; wenn der Vertrag nur ein Objekt erlaubt, liefere den besten.

Kanonischer Inventarkontext:
${JSON.stringify(context.inventory)}

Freigegebene Rezeptbasis:
${JSON.stringify(context.recipes)}`;
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
    allergies: request.allergies,
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
      if (request.allergies.length > 0) {
        if (recipe.allergens === null) return false;
        const allergens = new Set(recipe.allergens.map((allergen) => allergen.toLocaleLowerCase('de-DE')));
        if (request.allergies.some((allergy) => allergens.has(allergy.toLocaleLowerCase('de-DE')))) {
          return false;
        }
      }
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
  const defaultModel = dependencies.defaultModel ?? 'z-ai/glm-5.3-flash';
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

    if (dependencies.isRateLimited?.()) return json({ error: 'rate_limited' }, 429);
    dependencies.recordRateLimitAttempt?.();

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

    const preparedContext =
      parsedRequest.skill === 'fam-cook-from-inventory'
        ? prepareCookingContext(contextResult.context, parsedRequest)
        : contextResult.context;
    if (preparedContext === null) return json({ error: 'no_safe_recipe' }, 422);

    const provider = await dependencies.complete({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(parsedRequest, preparedContext) },
        { role: 'user', content: buildUserPrompt(parsedRequest) },
      ],
    });
    if (!provider.ok) {
      return json({ error: provider.error, ...(provider.message ? { message: provider.message } : {}) }, provider.status);
    }
    if (provider.model !== model || !allowedModels.includes(provider.model)) {
      return json({ error: 'provider_model_mismatch' }, 502);
    }

    const parsedResult = parseProviderJson(provider.content);
    if (!parsedResult) return json({ error: 'provider_invalid_json' }, 502);

    const validationError =
      parsedRequest.skill === 'fam-inventory-capture'
        ? validateCaptureResult(parsedResult, parsedRequest)
        : validateCookingResult(parsedResult, preparedContext, parsedRequest);
    if (validationError) return json({ error: validationError }, 502);

    return json({
      requestId: requestId(),
      skill: parsedRequest.skill,
      model: provider.model,
      result: parsedResult,
      ...(provider.usage === undefined ? {} : { usage: provider.usage }),
      generatedAt: now(),
    });
  };
}
