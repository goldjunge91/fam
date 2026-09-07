import { z } from 'zod';

import { trackAnalyticsEvent } from '@/lib/analytics';
import { debugLogEvent } from '@/lib/debug-log';
import { getSupabase, type TypedSupabaseClient } from '@/lib/supabase';
import {
  type RecipeSuggestionResponse,
  recipeSuggestionResponseSchema,
} from '../domain/recipe-suggestions';

const nonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0);

const gatewayResponseSchema = z.strictObject({
  requestId: nonEmptyStringSchema,
  skill: z.literal('fam-cook-from-inventory'),
  model: nonEmptyStringSchema,
  result: z.union([recipeSuggestionResponseSchema, z.null()]),
  priorityFoodCount: z.number().int().nonnegative(),
  shoppingQuestion: z.union([z.string(), z.null()]).optional(),
  generatedAt: nonEmptyStringSchema,
});

export type RecipeSuggestionGatewayRequest = {
  householdId: string;
  userText: string;
  servings: number | null;
  maxMinutes: number | null;
  dietaryPattern: string | null;
  shoppingDecision: 'yes' | 'no' | null;
  model?: string;
};

export type RecipeSuggestionGatewayResponse = {
  requestId: string;
  model: string;
  generatedAt: string;
  result: RecipeSuggestionResponse | null;
  priorityFoodCount: number;
  shoppingQuestion: string | null;
};

export class RecipeSuggestionGatewayError extends Error {
  constructor(
    readonly code: 'gateway_request_failed' | 'gateway_invalid_response' | 'gateway_unavailable',
    readonly status: number | null = null,
    readonly remoteCode: string | null = null,
  ) {
    super(code);
    this.name = 'RecipeSuggestionGatewayError';
  }
}

export type FunctionsInvoker = Pick<TypedSupabaseClient['functions'], 'invoke'>;

function errorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('context' in error)) return null;
  const context = error.context;
  if (typeof context !== 'object' || context === null || !('status' in context)) return null;
  return typeof context.status === 'number' ? context.status : null;
}

async function errorResponseCode(error: unknown): Promise<string | null> {
  if (typeof error !== 'object' || error === null || !('context' in error)) return null;
  const context = error.context;
  if (
    typeof context !== 'object' ||
    context === null ||
    !('clone' in context) ||
    typeof context.clone !== 'function'
  ) {
    return null;
  }

  try {
    const response = context.clone();
    const body: unknown = await response.json();
    return typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
      ? body.error
      : null;
  } catch {
    return null;
  }
}

function parseGatewayResponse(data: unknown): RecipeSuggestionGatewayResponse {
  const parsed = gatewayResponseSchema.safeParse(data);
  if (!parsed.success) {
    debugLogEvent('recipe-suggestion.gateway.invalid-response');
    throw new RecipeSuggestionGatewayError('gateway_invalid_response');
  }

  const shoppingQuestion = parsed.data.shoppingQuestion ?? null;
  if ((parsed.data.result === null) === (shoppingQuestion === null)) {
    debugLogEvent('recipe-suggestion.gateway.invalid-response', {
      reason: 'result-shopping-question-invariant',
    });
    throw new RecipeSuggestionGatewayError('gateway_invalid_response');
  }

  return {
    requestId: parsed.data.requestId,
    model: parsed.data.model,
    generatedAt: parsed.data.generatedAt,
    result: parsed.data.result,
    priorityFoodCount: parsed.data.priorityFoodCount,
    shoppingQuestion,
  };
}

function trackSuggestionRequest(response: RecipeSuggestionGatewayResponse): void {
  trackAnalyticsEvent('meal_suggestion.request.completed', {
    result:
      response.shoppingQuestion !== null
        ? 'shopping_question'
        : response.result === null
          ? 'no_safe_suggestion'
          : 'suggestions',
    suggestion_count: response.result?.meals.length ?? 0,
    priority_food_count: response.priorityFoodCount,
    fallback_used:
      response.result?.meals.some((meal) => meal.source === 'model_generated') ?? false,
  });
}

export async function requestRecipeSuggestions(
  input: RecipeSuggestionGatewayRequest,
  functions?: FunctionsInvoker,
): Promise<RecipeSuggestionGatewayResponse> {
  debugLogEvent('recipe-suggestion.gateway.request.started', {
    servings: input.servings,
    max_minutes: input.maxMinutes,
    shopping_decision: input.shoppingDecision,
    has_dietary_pattern: input.dietaryPattern !== null,
    has_model_override: input.model !== undefined,
  });

  let functionsInvoker: FunctionsInvoker;
  let data: unknown;
  let error: unknown;
  if (functions === undefined) {
    try {
      functionsInvoker = getSupabase().functions;
    } catch (clientError) {
      debugLogEvent('recipe-suggestion.gateway.request.failed', {
        phase: 'client',
        error_type: clientError instanceof Error ? clientError.name : typeof clientError,
      });
      if (__DEV__) {
        console.warn('[ChefKoch] Supabase-Client konnte nicht initialisiert werden', {
          phase: 'client',
          errorType: clientError instanceof Error ? clientError.name : typeof clientError,
        });
      }
      throw new RecipeSuggestionGatewayError('gateway_request_failed');
    }
  } else {
    functionsInvoker = functions;
  }

  try {
    ({ data, error } = await functionsInvoker.invoke('ai-gateway', {
      body: {
        skill: 'fam-cook-from-inventory',
        householdId: input.householdId,
        userText: input.userText,
        servings: input.servings,
        maxMinutes: input.maxMinutes,
        dietaryPattern: input.dietaryPattern,
        shoppingDecision: input.shoppingDecision,
        ...(input.model === undefined ? {} : { model: input.model }),
      },
      ...(__DEV__ ? { headers: { 'x-fam-ai-dev-bypass': 'true' } } : {}),
    }));
  } catch (invokeError) {
    debugLogEvent('recipe-suggestion.gateway.request.failed', {
      phase: 'invoke',
      error_type: invokeError instanceof Error ? invokeError.name : typeof invokeError,
    });
    if (__DEV__) {
      console.warn('[ChefKoch] Supabase-Function konnte nicht aufgerufen werden', {
        phase: 'invoke',
        errorType: invokeError instanceof Error ? invokeError.name : typeof invokeError,
      });
    }
    throw new RecipeSuggestionGatewayError('gateway_request_failed');
  }

  if (error) {
    const status = errorStatus(error);
    const remoteCode = await errorResponseCode(error);
    const gatewayError = new RecipeSuggestionGatewayError(
      status !== null && status >= 500 ? 'gateway_unavailable' : 'gateway_request_failed',
      status,
      remoteCode,
    );
    debugLogEvent('recipe-suggestion.gateway.request.failed', {
      phase: 'response',
      code: gatewayError.code,
      status,
      remote_code: remoteCode,
    });
    if (__DEV__) {
      console.warn('[ChefKoch] Vorschlagsanfrage fehlgeschlagen', {
        code: gatewayError.code,
        status,
        remoteCode,
      });
    }
    throw gatewayError;
  }

  const response = parseGatewayResponse(data);
  debugLogEvent('recipe-suggestion.gateway.request.completed', {
    request_id: response.requestId,
    model: response.model,
    result:
      response.shoppingQuestion !== null
        ? 'shopping_question'
        : response.result === null
          ? 'no_safe_suggestion'
          : 'suggestions',
    suggestion_count: response.result?.meals.length ?? 0,
  });
  trackSuggestionRequest(response);
  return response;
}
