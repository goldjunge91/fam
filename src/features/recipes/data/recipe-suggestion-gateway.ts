import { z } from 'zod';

import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  type RecipeSuggestionResponse,
  recipeSuggestionResponseSchema,
} from '../domain/recipe-suggestions';

const nonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0);

const gatewayResponseSchema = z.strictObject({
  requestId: nonEmptyStringSchema,
  skill: z.literal('fam-cook-from-inventory'),
  provider: nonEmptyStringSchema,
  model: nonEmptyStringSchema,
  result: recipeSuggestionResponseSchema,
  generatedAt: nonEmptyStringSchema,
});

export type RecipeSuggestionGatewayRequest = {
  householdId: string;
  userText: string;
  servings: number | null;
  maxMinutes: number | null;
  dietaryPattern: string | null;
  allergies: readonly string[];
  shoppingDecision: 'yes' | 'no' | null;
  selectedInventoryItemIds?: readonly string[];
};

export type RecipeSuggestionGatewayResponse = {
  requestId: string;
  provider: string;
  model: string;
  generatedAt: string;
  result: RecipeSuggestionResponse;
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

export type FunctionsInvoker = {
  invoke: (
    functionName: string,
    options: { body: Record<string, unknown> },
  ) => Promise<{ data: unknown; error: unknown }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorStatus(error: unknown): number | null {
  if (!isRecord(error) || !('context' in error)) return null;
  const context = error.context;
  if (context instanceof Response) return context.status;
  return isRecord(context) && typeof context.status === 'number' ? context.status : null;
}

async function errorResponseDetails(error: unknown): Promise<{
  remoteCode: string | null;
  issues: RecipeSuggestionGatewayIssue[] | null;
  requestId: string | null;
}> {
  if (!isRecord(error) || !('context' in error) || !(error.context instanceof Response)) {
    return { remoteCode: null, issues: null, requestId: null };
  }

  const response = error.context;
  const requestId = response.headers.get('X-Request-Id');
  try {
    const body: unknown = await response.clone().json();
    if (!isRecord(body)) return { remoteCode: null, issues: null, requestId };
    const issues = Array.isArray(body.issues)
      ? body.issues.filter(
          (issue): issue is RecipeSuggestionGatewayIssue =>
            isRecord(issue) && typeof issue.code === 'string' && typeof issue.path === 'string',
        )
      : null;
    return {
      remoteCode: typeof body.error === 'string' ? body.error : null,
      issues,
      requestId: typeof body.requestId === 'string' ? body.requestId : requestId,
    };
  } catch {
    return { remoteCode: null, issues: null, requestId };
  }
}

function parseGatewayResponse(data: unknown): RecipeSuggestionGatewayResponse {
  const parsed = gatewayResponseSchema.safeParse(data);
  if (!parsed.success) {
    const requestId = isRecord(data) && typeof data.requestId === 'string' ? data.requestId : null;
    throw new RecipeSuggestionGatewayError('gateway_invalid_response', null, null, null, requestId);
  }
  return parsed.data;
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
  const body: Record<string, unknown> = {
    skill: 'fam-cook-from-inventory',
    householdId: input.householdId,
    userText: input.userText,
    servings: input.servings,
    maxMinutes: input.maxMinutes,
    dietaryPattern: input.dietaryPattern,
    allergies: [...input.allergies],
    shoppingDecision: input.shoppingDecision,
    ...(input.selectedInventoryItemIds === undefined
      ? {}
      : { selectedInventoryItemIds: [...input.selectedInventoryItemIds] }),
  };

  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await invokeGateway(body, functions));
  } catch {
    throw new RecipeSuggestionGatewayError('gateway_request_failed');
  }

  if (error) {
    const status = errorStatus(error);
    const details = await errorResponseDetails(error);
    throw new RecipeSuggestionGatewayError(
      status !== null && status >= 500 ? 'gateway_unavailable' : 'gateway_request_failed',
      status,
      details.remoteCode,
      details.issues,
      details.requestId,
    );
  }

  return parseGatewayResponse(data);
}
