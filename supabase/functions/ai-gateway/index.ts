// Diese Datei ist der Einstiegspunkt der Edge Function.
// Sie verbindet Authentifizierung, Datenbank, Limits und den KI-Anbieter.
// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { ALLOWED_MODELS, DEFAULT_MODEL } from './config.ts';
import {
  CORS_HEADERS,
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayAccessResult,
} from './handler.ts';
import { createOpenRouterChatBody } from './openrouter-request.ts';

// Die Zugangsdaten kommen aus den geheimen Umgebungsvariablen der Edge Function.
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
if (!anonKey) {
  throw new Error('SUPABASE_ANON_KEY oder SUPABASE_PUBLISHABLE_KEY erforderlich.');
}
// Der Service-Role-Client wird nur für serverseitige Limit- und Credit-RPCs verwendet.
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
const openRouterBaseUrl = (Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const defaultModel = Deno.env.get('AI_GATEWAY_MODEL') ?? DEFAULT_MODEL;
const llmEnabled = (Deno.env.get('AI_GATEWAY_LLM_ENABLED') ?? 'false').trim().toLowerCase() === 'true';
const allowedModels = (Deno.env.get('AI_GATEWAY_ALLOWED_MODELS') ?? '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
// Diese Werte begrenzen Anfragen pro Minute und KI-Verbrauch pro Monat.
const userRateLimit = Number(Deno.env.get('AI_GATEWAY_RATE_LIMIT') ?? 30);
const monthlyCreditLimit = Number(Deno.env.get('AI_MONTHLY_CREDIT_LIMIT') ?? 100);
const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// Der Entwicklungs-Bypass ist zusätzlich auf bestimmte Nutzer beschränkt.
const devBypassEnabled =
  (Deno.env.get('AI_GATEWAY_DEV_BYPASS_ENABLED') ?? '').trim().toLowerCase() === 'true';
const devBypassUserIds = new Set(
  (Deno.env.get('AI_GATEWAY_DEV_USER_IDS') ?? '')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean),
);

// Gibt einen einheitlichen Fehler zurück, wenn die benötigte Server-Infrastruktur fehlt.
function unavailableAccess(): GatewayAccessResult {
  return { ok: false, status: 503, error: 'gateway_unavailable' };
}

// Wandelt die Wartezeit aus der Datenbank in eine gültige Sekundenangabe um.
function numericRetryAfter(value: unknown): number | undefined {
  const retryAfter = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(retryAfter) ? Math.max(1, Math.ceil(retryAfter)) : undefined;
}

// Prüft, ob der Nutzer das Anfrage-Limit noch nicht erreicht hat.
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

  // Die RPC liefert eine Tabelle. Für diesen Aufruf brauchen wir nur ihre erste Zeile.
  const row = data?.[0] ?? null;
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

// Übersetzt interne Credit-Fehler in sichere Fehler für den Client.
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

// Reserviert vor einem echten KI-Aufruf Credits für den Haushalt.
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
  // Auch diese RPC liefert eine Tabelle mit genau einer relevanten Zeile.
  const row = data?.[0] ?? null;
  if (!row || typeof row.blocked !== 'boolean') return unavailableAccess();
  return { ok: true };
}

// Gibt reservierte Credits wieder frei, wenn der KI-Aufruf nicht erfolgreich war.
async function releaseCredit(requestId: string): Promise<void> {
  if (!adminClient) return;
  const { error } = await adminClient.rpc('release_ai_credit', { p_request_id: requestId });
  if (error) {
    console.error(JSON.stringify({ event: 'ai_gateway_credit_release_failed', requestId }));
  }
}

// Liest einen Fehlercode aus verschiedenen möglichen JSON-Formaten.
export function readErrorCode(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null;
  const error = (value as { error: unknown }).error;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof (error as { code: unknown }).code === 'string'
    ? ((error as { code: string }).code)
    : null;
}

// Liest nur für das Logging den Fehlercode aus einer HTTP-Antwort.
async function readResponseErrorCode(response: Response): Promise<string | null> {
  try {
    return readErrorCode(await response.clone().json());
  } catch {
    return null;
  }
}

// Baut einen Supabase-Client, der mit dem JWT des aktuellen Nutzers arbeitet.
function userClient(request: Request) {
  const authorization = request.headers.get('Authorization');
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

// Prüft, ob die Anfrage von einem gültig angemeldeten Nutzer kommt.
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

// Prüft, ob der angemeldete Nutzer zum angefragten Haushalt gehört.
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

// Lädt alle Daten, die für einen Kochvorschlag benötigt werden, über einen RPC-Aufruf.
async function loadCookingContext(_userId: string, householdId: string, authorization: string) {
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data, error } = await client.rpc('get_cooking_context', {
    p_household_id: householdId,
  });

  if (error) {
    console.error(JSON.stringify({
      event: 'ai_gateway_cooking_context_rpc_failed',
      householdId,
      error: error.message,
    }));
    const isForbidden = error.message.includes('household_forbidden');
    return {
      ok: false as const,
      status: isForbidden ? 403 : 500,
      error: isForbidden ? 'household_forbidden' : 'cooking_context_lookup_failed',
      message: error.message,
    };
  }

  return { ok: true as const, context: data as GatewayCookingContext };
}

// Ruft OpenRouter auf und prüft die technische Form der Provider-Antwort.
async function complete({
  model,
  messages,
  skill,
}: {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  skill?: 'fam-cook-from-inventory' | 'fam-inventory-capture';
}) {
  // Der KI-Aufruf kann serverseitig vollständig abgeschaltet werden.
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
    // Der geheime OpenRouter-Key bleibt auf dem Server und wird nie an die App gegeben.
    response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        ...(Deno.env.get('OPENROUTER_SITE_URL') ? { 'HTTP-Referer': Deno.env.get('OPENROUTER_SITE_URL')! } : {}),
        ...(Deno.env.get('OPENROUTER_SITE_NAME') ? { 'X-Title': Deno.env.get('OPENROUTER_SITE_NAME')! } : {}),
      },
      body: JSON.stringify(createOpenRouterChatBody({ model, messages, skill })),
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

  // Provider-Fehler werden vereinheitlicht und nicht an den Client durchgereicht.
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
  // Danach wird nur der eigentliche Text aus der Provider-Antwort übernommen.
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

// Hier werden die echten Server-Funktionen in den testbaren Handler eingesetzt.
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

// Deno ruft diese Funktion für jede eingehende HTTP-Anfrage auf.
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
        ...CORS_HEADERS,
      },
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
