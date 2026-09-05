import { z } from 'zod';

import { trackAnalyticsEvent } from '@/lib/analytics';
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

function parseGatewayResponse(data: unknown): RecipeSuggestionGatewayResponse {
  const parsed = gatewayResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new RecipeSuggestionGatewayError('gateway_invalid_response');
  }

  const shoppingQuestion = parsed.data.shoppingQuestion ?? null;
  if ((parsed.data.result === null) === (shoppingQuestion === null)) {
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
  functions: FunctionsInvoker = getSupabase().functions,
): Promise<RecipeSuggestionGatewayResponse> {
  const { data, error } = await functions.invoke('ai-gateway', {
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
  });

  if (error) {
    const status = errorStatus(error);
    throw new RecipeSuggestionGatewayError(
      status !== null && status >= 500 ? 'gateway_unavailable' : 'gateway_request_failed',
      status,
    );
  }

  const response = parseGatewayResponse(data);
  trackSuggestionRequest(response);
  return response;
}
