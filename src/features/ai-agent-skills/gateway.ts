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

/**
 * Calls the authenticated Supabase gateway. The mobile client never receives
 * an OpenRouter key and cannot supply inventory lots or write operations.
 */
export async function invokeAiGateway(request: AiGatewayRequest): Promise<AiGatewayResponse> {
  const parsedRequest = aiGatewayRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    throw new AiGatewayError('Die Gateway-Anfrage entspricht nicht dem Skill-Vertrag.', 400);
  }

  let response: { data: unknown; error: unknown };
  try {
    response = await getSupabase().functions.invoke('ai-gateway', {
      method: 'POST',
      body: parsedRequest.data,
    });
  } catch (error) {
    throw new AiGatewayError(
      error instanceof Error ? error.message : 'Der AI-Gateway-Aufruf ist fehlgeschlagen.',
    );
  }

  if (response.error) {
    const status = statusFromFunctionError(response.error);
    const message =
      response.error instanceof Error
        ? response.error.message
        : typeof response.error === 'object' &&
            response.error !== null &&
            'message' in response.error
          ? String((response.error as { message: unknown }).message)
          : 'Der AI-Gateway-Aufruf ist fehlgeschlagen.';
    throw new AiGatewayError(message, status);
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
