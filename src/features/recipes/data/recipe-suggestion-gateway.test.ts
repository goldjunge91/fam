import type { FunctionInvokeOptions, FunctionsResponse } from '@supabase/functions-js';
import { trackAnalyticsEvent } from '@/lib/analytics';

import {
  developmentBypassHeaders,
  type FunctionsInvoker,
  RecipeSuggestionGatewayError,
  requestRecipeSuggestions,
} from './recipe-suggestion-gateway';

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const suggestion = {
  schema_version: 1 as const,
  meals: [
    {
      title: 'Spinatpfanne',
      source: 'model_generated' as const,
      recipe_id: null,
      servings: 2,
      used_items: [{ inventory_item_id: 'inventory-spinach', quantity: 200, unit: 'g' }],
      additional_ingredients: [],
      steps: ['Spinat in der Pfanne garen.'],
      notes: [],
    },
  ],
};

function invoker(response: unknown, error: unknown = null) {
  const calls: Array<{ name: string; options: { body: unknown; headers?: HeadersInit } }> = [];
  const invoke = async <T>(
    name: string,
    options?: FunctionInvokeOptions,
  ): Promise<FunctionsResponse<T>> => {
    if (options?.body !== undefined) {
      calls.push({
        name,
        options: {
          body: options.body,
          ...(options.headers === undefined ? {} : { headers: options.headers }),
        },
      });
    }
    return error === null ? { data: response as T, error: null } : { data: null, error };
  };
  return {
    functions: { invoke } satisfies FunctionsInvoker,
    calls,
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'request-1',
    skill: 'fam-cook-from-inventory',
    model: 'z-ai/glm-5.3-flash',
    result: suggestion,
    priorityFoodCount: 3,
    generatedAt: '2026-09-04T12:00:00.000Z',
    ...overrides,
  };
}

describe('recipe suggestion gateway', () => {
  const originalForceAi = process.env.EXPO_PUBLIC_FORCE_AI;

  afterEach(() => {
    if (originalForceAi === undefined) {
      delete process.env.EXPO_PUBLIC_FORCE_AI;
    } else {
      process.env.EXPO_PUBLIC_FORCE_AI = originalForceAi;
    }
  });

  it('sends the development bypass header only when development and force-ai are enabled', () => {
    expect(developmentBypassHeaders(true, true)).toEqual({ 'x-fam-ai-dev-bypass': 'true' });
    expect(developmentBypassHeaders(true, false)).toBeUndefined();
    expect(developmentBypassHeaders(false, true)).toBeUndefined();
    expect(developmentBypassHeaders(false, false)).toBeUndefined();
  });

  it('sends only the scoped request and parses a canonical response', async () => {
    process.env.EXPO_PUBLIC_FORCE_AI = 'true';
    const client = invoker(response());

    const result = await requestRecipeSuggestions(
      {
        householdId: 'household-1',
        userText: 'Was kann ich heute kochen?',
        servings: 2,
        maxMinutes: 30,
        dietaryPattern: null,
        shoppingDecision: 'no',
      },
      client.functions,
    );

    expect(result.result).toEqual(suggestion);
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('meal_suggestion.request.completed', {
      result: 'suggestions',
      suggestion_count: 1,
      priority_food_count: 3,
      fallback_used: true,
    });
    expect(client.calls).toEqual([
      {
        name: 'ai-gateway',
        options: {
          body: {
            skill: 'fam-cook-from-inventory',
            householdId: 'household-1',
            userText: 'Was kann ich heute kochen?',
            servings: 2,
            maxMinutes: 30,
            dietaryPattern: null,
            shoppingDecision: 'no',
          },
          headers: { 'x-fam-ai-dev-bypass': 'true' },
        },
      },
    ]);
    expect(JSON.stringify(client.calls)).not.toContain('apiKey');
  });

  it('omits the bypass header when force-ai is false or missing', async () => {
    const request = {
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: 2,
      maxMinutes: 30,
      dietaryPattern: null,
      shoppingDecision: 'no' as const,
    };

    process.env.EXPO_PUBLIC_FORCE_AI = 'false';
    const falseClient = invoker(response());
    await requestRecipeSuggestions(request, falseClient.functions);
    expect(falseClient.calls[0]?.options.headers).toBeUndefined();

    delete process.env.EXPO_PUBLIC_FORCE_AI;
    const missingClient = invoker(response());
    await requestRecipeSuggestions(request, missingClient.functions);
    expect(missingClient.calls[0]?.options.headers).toBeUndefined();
  });

  it('returns a deterministic shopping question without treating it as a meal', async () => {
    const client = invoker(
      response({ result: null, shoppingQuestion: 'Willst du heute noch einkaufen?' }),
    );

    const result = await requestRecipeSuggestions(
      {
        householdId: 'household-1',
        userText: 'Was sollte ich heute essen?',
        servings: 2,
        maxMinutes: null,
        dietaryPattern: null,
        shoppingDecision: null,
      },
      client.functions,
    );

    expect(result.result).toBeNull();
    expect(result.shoppingQuestion).toBe('Willst du heute noch einkaufen?');
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('meal_suggestion.request.completed', {
      result: 'shopping_question',
      suggestion_count: 0,
      priority_food_count: 3,
      fallback_used: false,
    });
  });

  it('rejects malformed success envelopes at the app boundary', async () => {
    const client = invoker(response({ result: null }));

    await expect(
      requestRecipeSuggestions(
        {
          householdId: 'household-1',
          userText: 'Was kann ich kochen?',
          servings: null,
          maxMinutes: null,
          dietaryPattern: null,
          shoppingDecision: 'no',
        },
        client.functions,
      ),
    ).rejects.toBeInstanceOf(RecipeSuggestionGatewayError);
  });

  it('maps function failures to stable typed errors', async () => {
    const client = invoker(null, { context: { status: 429 } });

    await expect(
      requestRecipeSuggestions(
        {
          householdId: 'household-1',
          userText: 'Was kann ich kochen?',
          servings: null,
          maxMinutes: null,
          dietaryPattern: null,
          shoppingDecision: 'no',
        },
        client.functions,
      ),
    ).rejects.toMatchObject({
      name: 'RecipeSuggestionGatewayError',
      code: 'gateway_request_failed',
      status: 429,
    });
  });

  it('captures remote issues from provider contract violations', async () => {
    const mockResponse = {
      clone: () => ({
        json: async () => ({
          error: 'provider_contract_violation',
          issues: [{ code: 'unapproved_ingredient', path: '$.meals[0].additional_ingredients[0]' }],
        }),
      }),
      status: 502,
    };
    const client = invoker(null, { context: mockResponse });

    await expect(
      requestRecipeSuggestions(
        {
          householdId: 'household-1',
          userText: 'Was kann ich kochen?',
          servings: null,
          maxMinutes: null,
          dietaryPattern: null,
          shoppingDecision: 'no',
        },
        client.functions,
      ),
    ).rejects.toMatchObject({
      name: 'RecipeSuggestionGatewayError',
      code: 'gateway_unavailable',
      status: 502,
      remoteCode: 'provider_contract_violation',
      issues: [{ code: 'unapproved_ingredient', path: '$.meals[0].additional_ingredients[0]' }],
    });
  });
});
