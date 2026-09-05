import type { FunctionInvokeOptions, FunctionsResponse } from '@supabase/functions-js';
import { trackAnalyticsEvent } from '@/lib/analytics';

import {
  type FunctionsInvoker,
  RecipeSuggestionGatewayError,
  requestRecipeSuggestions,
} from './recipe-suggestion-gateway';

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

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
  const calls: Array<{ name: string; options: { body: unknown } }> = [];
  const invoke = async <T>(
    name: string,
    options?: FunctionInvokeOptions,
  ): Promise<FunctionsResponse<T>> => {
    if (options?.body !== undefined) calls.push({ name, options: { body: options.body } });
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
  it('sends only the scoped request and parses a canonical response', async () => {
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
        },
      },
    ]);
    expect(JSON.stringify(client.calls)).not.toContain('apiKey');
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
});
