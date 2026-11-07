import { z } from 'zod';

import {
  type ChefHistoryHydration,
  chefHistoryHydrationSchema,
} from '@/features/chef-koch/domain/chef-history';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { ChefKochModel } from '../domain/ai-gateway-model';
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
  shoppingQuestion: z.union([nonEmptyStringSchema, z.null()]),
  generatedAt: nonEmptyStringSchema,
  clientRequestId: nonEmptyStringSchema,
  conversationId: nonEmptyStringSchema,
  turnId: nonEmptyStringSchema,
  history: chefHistoryHydrationSchema,
});

export type RecipeSuggestionGatewayRequest = {
  householdId: string;
  userText: string;
  servings: number | null;
  maxMinutes: number | null;
  dietaryPattern: string | null;
  shoppingDecision: 'yes' | 'no' | null;
  selectedInventoryItemIds?: readonly string[];
  clientRequestId: string;
  conversationId?: string;
  continuedFromConversationId?: string;
  model?: ChefKochModel;
};

export type RecipeSuggestionGatewayResponse = {
  requestId: string;
  model: string;
  generatedAt: string;
  result: RecipeSuggestionResponse | null;
  priorityFoodCount: number;
  shoppingQuestion: string | null;
  clientRequestId: string;
  conversationId: string;
  turnId: string;
  history: ChefHistoryHydration;
};

export type RecipeSuggestionGatewayIssue = {
  code: string;
  path: string;
};

export class RecipeSuggestionGatewayError extends Error {
  constructor(
    readonly code: 'gateway_request_failed' | 'gateway_invalid_response' | 'gateway_unavailable',
    readonly status: number | null = null,
    readonly remoteCode: string | null = null,
    readonly issues: readonly RecipeSuggestionGatewayIssue[] | null = null,
    readonly requestId: string | null = null,
  ) {
    super(code);
    this.name = 'RecipeSuggestionGatewayError';
  }
}

export function hasIndeterminateRecipeSuggestionOutcome(error: unknown): boolean {
  return (
    error instanceof RecipeSuggestionGatewayError &&
    ((error.code === 'gateway_request_failed' && error.status === null) ||
      error.code === 'gateway_invalid_response' ||
      error.remoteCode === 'chef_history_persist_unknown' ||
      (error.remoteCode === 'chef_history_lookup_failed' &&
        (error.status === null || error.status >= 500)))
  );
}

export type FunctionsInvoker = {
  invoke: (
    functionName: string,
    options: { body: Record<string, unknown> },
  ) => Promise<{ data: unknown; error: unknown }>;
};

function errorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('context' in error)) return null;
  const context = error.context;
  if (typeof context !== 'object' || context === null || !('status' in context)) return null;
  return typeof context.status === 'number' ? context.status : null;
}

async function errorResponseDetails(error: unknown): Promise<{
  remoteCode: string | null;
  issues: RecipeSuggestionGatewayIssue[] | null;
  requestId: string | null;
}> {
  if (typeof error !== 'object' || error === null || !('context' in error)) {
    return { remoteCode: null, issues: null, requestId: null };
  }
  const context = error.context;
  const responseHeaders =
    typeof context === 'object' && context !== null && 'headers' in context
      ? context.headers
      : null;
  const requestId =
    typeof responseHeaders === 'object' &&
    responseHeaders !== null &&
    'get' in responseHeaders &&
    typeof responseHeaders.get === 'function'
      ? responseHeaders.get('X-Request-Id')
      : null;
  if (
    typeof context !== 'object' ||
    context === null ||
    !('clone' in context) ||
    typeof context.clone !== 'function'
  ) {
    return { remoteCode: null, issues: null, requestId };
  }

  try {
    const body: unknown = await context.clone().json();
    if (typeof body !== 'object' || body === null) {
      return { remoteCode: null, issues: null, requestId };
    }
    const remoteCode = 'error' in body && typeof body.error === 'string' ? body.error : null;
    const responseRequestId =
      'requestId' in body && typeof body.requestId === 'string' ? body.requestId : requestId;
    const issues =
      'issues' in body && Array.isArray(body.issues)
        ? body.issues.filter(
            (item): item is RecipeSuggestionGatewayIssue =>
              typeof item === 'object' &&
              item !== null &&
              'code' in item &&
              typeof item.code === 'string' &&
              'path' in item &&
              typeof item.path === 'string',
          )
        : null;
    return { remoteCode, issues, requestId: responseRequestId };
  } catch {
    return { remoteCode: null, issues: null, requestId };
  }
}

function parseGatewayResponse(data: unknown): RecipeSuggestionGatewayResponse {
  const parsed = gatewayResponseSchema.safeParse(data);
  if (!parsed.success) {
    const requestId =
      typeof data === 'object' &&
      data !== null &&
      'requestId' in data &&
      typeof data.requestId === 'string'
        ? data.requestId
        : null;
    debugLogEvent('recipe-suggestion.gateway.invalid-response', {
      request_id: requestId,
    });
    throw new RecipeSuggestionGatewayError('gateway_invalid_response', null, null, null, requestId);
  }

  const { result, shoppingQuestion, history } = parsed.data;
  const persistedResponse = history.turn.response_payload;
  const mismatchedHistory =
    parsed.data.clientRequestId !== history.turn.client_request_id ||
    parsed.data.conversationId !== history.conversation.id ||
    parsed.data.turnId !== history.turn.id ||
    parsed.data.model !== persistedResponse.model ||
    parsed.data.generatedAt !== persistedResponse.generated_at ||
    parsed.data.priorityFoodCount !== persistedResponse.priority_food_count ||
    parsed.data.shoppingQuestion !== persistedResponse.shopping_question ||
    JSON.stringify(result) !== JSON.stringify(persistedResponse.result);
  if ((result === null) === (shoppingQuestion === null) || mismatchedHistory) {
    debugLogEvent('recipe-suggestion.gateway.invalid-response', {
      reason: mismatchedHistory
        ? 'history-envelope-invariant'
        : 'result-shopping-question-invariant',
      request_id: parsed.data.requestId,
    });
    throw new RecipeSuggestionGatewayError(
      'gateway_invalid_response',
      null,
      null,
      null,
      parsed.data.requestId,
    );
  }

  return {
    requestId: parsed.data.requestId,
    model: parsed.data.model,
    generatedAt: parsed.data.generatedAt,
    result,
    priorityFoodCount: parsed.data.priorityFoodCount,
    shoppingQuestion,
    clientRequestId: parsed.data.clientRequestId,
    conversationId: parsed.data.conversationId,
    turnId: parsed.data.turnId,
    history,
  };
}

async function invokeGateway(
  body: Record<string, unknown>,
  functions?: FunctionsInvoker,
): Promise<{ data: unknown; error: unknown }> {
  if (functions !== undefined) return functions.invoke('ai-gateway', { body });
  return getSupabase().functions.invoke('ai-gateway', { body });
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

  const body: Record<string, unknown> = {
    skill: 'fam-cook-from-inventory',
    householdId: input.householdId,
    userText: input.userText,
    servings: input.servings,
    maxMinutes: input.maxMinutes,
    dietaryPattern: input.dietaryPattern,
    shoppingDecision: input.shoppingDecision,
    clientRequestId: input.clientRequestId,
    ...(input.selectedInventoryItemIds === undefined
      ? {}
      : { selectedInventoryItemIds: [...input.selectedInventoryItemIds] }),
    ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
    ...(input.continuedFromConversationId === undefined
      ? {}
      : { continuedFromConversationId: input.continuedFromConversationId }),
    ...(input.model === undefined ? {} : { model: input.model }),
  };

  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await invokeGateway(body, functions));
  } catch (invokeError) {
    debugLogEvent('recipe-suggestion.gateway.request.failed', {
      phase: 'invoke',
      error_type: invokeError instanceof Error ? invokeError.name : typeof invokeError,
    });
    throw new RecipeSuggestionGatewayError('gateway_request_failed');
  }

  if (error) {
    const status = errorStatus(error);
    const { remoteCode, issues, requestId } = await errorResponseDetails(error);
    const gatewayError = new RecipeSuggestionGatewayError(
      status !== null && status >= 500 ? 'gateway_unavailable' : 'gateway_request_failed',
      status,
      remoteCode,
      issues,
      requestId,
    );
    debugLogEvent('recipe-suggestion.gateway.request.failed', {
      phase: 'response',
      code: gatewayError.code,
      status,
      remote_code: remoteCode,
      issues_count: issues?.length ?? 0,
      request_id: requestId,
    });
    throw gatewayError;
  }

  const response = parseGatewayResponse(data);
  debugLogEvent('recipe-suggestion.gateway.request.completed', {
    request_id: response.requestId,
    model: response.model,
    result: response.shoppingQuestion === null ? 'suggestions' : 'shopping_question',
    suggestion_count: response.result?.meals.length ?? 0,
  });
  return response;
}
