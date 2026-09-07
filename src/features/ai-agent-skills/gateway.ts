import { env } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import {
  type AiGatewayRequest,
  type AiGatewayResponse,
  aiGatewayRequestSchema,
  aiGatewayResponseSchema,
} from './domain/contracts';

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AiGatewayError';
  }
}

function statusFromFunctionError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== 'object') return undefined;
  const status = (context as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

async function errorCodeFromFunctionError(error: unknown): Promise<string | undefined> {
  if (!error || typeof error !== 'object') return undefined;
  const context = (error as { context?: unknown }).context;
  if (
    !context ||
    typeof context !== 'object' ||
    !('clone' in context) ||
    typeof context.clone !== 'function'
  ) {
    return undefined;
  }
  try {
    const body: unknown = await context.clone().json();
    return typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
      ? body.error
      : undefined;
  } catch {
    return undefined;
  }
}

function userFacingGatewayError(code: string | undefined): string {
  switch (code) {
    case 'rate_limited':
      return 'Zu viele KI-Anfragen. Bitte kurz warten.';
    case 'ai_credit_limit_exceeded':
      return 'Dein KI-Kontingent ist aufgebraucht.';
    case 'ai_entitlement_required':
      return 'Für diese KI-Funktion ist kein aktives KI-Kontingent verfügbar.';
    default:
      return 'Der AI-Gateway-Aufruf ist fehlgeschlagen.';
  }
}

export function developmentBypassHeaders(
  isDevelopment: boolean,
  forceAi: boolean,
): Record<string, string> | undefined {
  return isDevelopment && forceAi ? { 'x-fam-ai-dev-bypass': 'true' } : undefined;
}

/**
 * Calls the authenticated Supabase gateway. The mobile client never receives
 * an OpenRouter key and cannot supply inventory lots or write operations.
 */
export async function invokeAiGateway(request: AiGatewayRequest): Promise<AiGatewayResponse> {
  const parsedRequest = aiGatewayRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    throw new AiGatewayError('Die Gateway-Anfrage entspricht nicht dem Skill-Vertrag.', 400);
  }

  const developmentHeaders = developmentBypassHeaders(__DEV__, env.forceAi);
  let response: { data: unknown; error: unknown };
  try {
    response = await getSupabase().functions.invoke('ai-gateway', {
      method: 'POST',
      body: parsedRequest.data,
      ...(developmentHeaders === undefined ? {} : { headers: developmentHeaders }),
    });
  } catch (error) {
    throw new AiGatewayError(
      error instanceof Error ? error.message : 'Der AI-Gateway-Aufruf ist fehlgeschlagen.',
    );
  }

  if (response.error) {
    const status = statusFromFunctionError(response.error);
    const code = await errorCodeFromFunctionError(response.error);
    throw new AiGatewayError(userFacingGatewayError(code), status, code);
  }

  const parsedResponse = aiGatewayResponseSchema.safeParse(response.data);
  if (!parsedResponse.success) {
    throw new AiGatewayError('Die Gateway-Antwort entspricht nicht dem Skill-Vertrag.', 502);
  }

  if (parsedResponse.data.skill !== parsedRequest.data.skill) {
    throw new AiGatewayError('Gateway und Antwort verwenden unterschiedliche Skill-IDs.', 502);
  }

  return parsedResponse.data;
}
