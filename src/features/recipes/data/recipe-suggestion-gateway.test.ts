import {
  type FunctionsInvoker,
  hasIndeterminateRecipeSuggestionOutcome,
  RecipeSuggestionGatewayError,
  requestRecipeSuggestions,
} from './recipe-suggestion-gateway';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const TURN_ID = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-11-06T08:00:00.000Z';

const request = {
  householdId: HOUSEHOLD_ID,
  userText: 'Was kann ich heute kochen?',
  servings: 2,
  maxMinutes: 30,
  dietaryPattern: 'vegetarian',
  shoppingDecision: null,
  clientRequestId: CLIENT_REQUEST_ID,
};

const result = {
  schema_version: 1 as const,
  meals: [
    {
      title: 'Tomatenpfanne',
      source: 'catalog' as const,
      recipe_id: 'recipe-1',
      servings: 2,
      used_items: [{ inventory_item_id: 'lot-tomato', quantity: 1, unit: 'piece' }],
      additional_ingredients: [],
      steps: ['Tomate garen.'],
      notes: [],
    },
  ],
};

function responsePayload(input: {
  result: typeof result | null;
  shoppingQuestion: string | null;
  model?: string;
}) {
  const model = input.model ?? 'google/gemma-4-31b-it:free';
  const persistedResponse = {
    schema_version: 1 as const,
    skill: 'fam-cook-from-inventory' as const,
    model,
    generated_at: CREATED_AT,
    priority_food_count: 1,
    shopping_question: input.shoppingQuestion,
    result: input.result,
  };
  return {
    requestId: 'request-1',
    skill: 'fam-cook-from-inventory' as const,
    model,
    result: input.result,
    priorityFoodCount: 1,
    shoppingQuestion: input.shoppingQuestion,
    generatedAt: CREATED_AT,
    clientRequestId: CLIENT_REQUEST_ID,
    conversationId: CONVERSATION_ID,
    turnId: TURN_ID,
    history: {
      schema_version: 1 as const,
      replayed: false,
      conversation: {
        id: CONVERSATION_ID,
        household_id: HOUSEHOLD_ID,
        created_by: 'user-1',
        created_at: CREATED_AT,
        last_activity_at: CREATED_AT,
        continued_from_id: null,
        updated_at: CREATED_AT,
      },
      turn: {
        id: TURN_ID,
        conversation_id: CONVERSATION_ID,
        household_id: HOUSEHOLD_ID,
        created_by: 'user-1',
        client_request_id: CLIENT_REQUEST_ID,
        request_fingerprint: 'a'.repeat(64),
        user_text: request.userText,
        request_payload: {
          schema_version: 1 as const,
          user_text: request.userText,
          servings: 2,
          max_minutes: 30,
          dietary_pattern: 'vegetarian',
          shopping_decision: null,
          selected_inventory_item_ids: [],
        },
        response_payload: persistedResponse,
        created_at: CREATED_AT,
      },
      recipe_history:
        input.result === null
          ? []
          : [
              {
                id: '55555555-5555-4555-8555-555555555555',
                conversation_id: CONVERSATION_ID,
                turn_id: TURN_ID,
                household_id: HOUSEHOLD_ID,
                title: 'Tomatenpfanne',
                recipe_payload: {
                  schema_version: 1 as const,
                  response: input.result,
                  used_item_snapshots: [
                    {
                      inventory_item_id: 'lot-tomato',
                      name: 'Tomate',
                      quantity: 1,
                      unit: 'piece',
                    },
                  ],
                },
                created_at: CREATED_AT,
              },
            ],
    },
  };
}

function invoker(response: Awaited<ReturnType<FunctionsInvoker['invoke']>>) {
  return { invoke: jest.fn().mockResolvedValue(response) } satisfies FunctionsInvoker;
}

describe('requestRecipeSuggestions', () => {
  it('sends the client request identity and returns strict history hydration', async () => {
    const data = responsePayload({ result, shoppingQuestion: null });
    const functions = invoker({ data, error: null });

    await expect(requestRecipeSuggestions(request, functions)).resolves.toEqual({
      requestId: 'request-1',
      model: 'google/gemma-4-31b-it:free',
      result,
      priorityFoodCount: 1,
      shoppingQuestion: null,
      generatedAt: CREATED_AT,
      clientRequestId: CLIENT_REQUEST_ID,
      conversationId: CONVERSATION_ID,
      turnId: TURN_ID,
      history: data.history,
    });
    expect(functions.invoke).toHaveBeenCalledWith('ai-gateway', {
      body: {
        skill: 'fam-cook-from-inventory',
        householdId: HOUSEHOLD_ID,
        userText: 'Was kann ich heute kochen?',
        servings: 2,
        maxMinutes: 30,
        dietaryPattern: 'vegetarian',
        shoppingDecision: null,
        clientRequestId: CLIENT_REQUEST_ID,
      },
    });
  });

  it('sends model and conversation fields only when provided', async () => {
    const model = 'google/gemma-4-26b-a4b-it:free';
    const functions = invoker({
      data: responsePayload({ result, shoppingQuestion: null, model }),
      error: null,
    });

    await requestRecipeSuggestions(
      {
        ...request,
        model,
        continuedFromConversationId: CONVERSATION_ID,
      },
      functions,
    );

    expect(functions.invoke).toHaveBeenCalledWith('ai-gateway', {
      body: expect.objectContaining({
        model,
        clientRequestId: CLIENT_REQUEST_ID,
        continuedFromConversationId: CONVERSATION_ID,
      }),
    });
  });

  it('accepts a stored shopping question without a recipe snapshot', async () => {
    const functions = invoker({
      data: responsePayload({ result: null, shoppingQuestion: 'Willst du heute noch einkaufen?' }),
      error: null,
    });

    await expect(requestRecipeSuggestions(request, functions)).resolves.toMatchObject({
      result: null,
      shoppingQuestion: 'Willst du heute noch einkaufen?',
      history: { recipe_history: [] },
    });
  });

  it('rejects malformed, ambiguous, or mismatched history responses', async () => {
    const malformedData = responsePayload({ result, shoppingQuestion: null });
    const malformed = invoker({
      data: { ...malformedData, result: { ...result, unexpected: true } },
      error: null,
    });
    const ambiguousData = responsePayload({
      result,
      shoppingQuestion: 'Willst du heute noch einkaufen?',
    });
    const ambiguous = invoker({ data: ambiguousData, error: null });
    const mismatchedData = responsePayload({ result, shoppingQuestion: null });
    const mismatched = invoker({
      data: { ...mismatchedData, conversationId: 'other-conversation' },
      error: null,
    });

    await expect(requestRecipeSuggestions(request, malformed)).rejects.toMatchObject({
      code: 'gateway_invalid_response',
    });
    await expect(requestRecipeSuggestions(request, ambiguous)).rejects.toMatchObject({
      code: 'gateway_invalid_response',
    });
    await expect(requestRecipeSuggestions(request, mismatched)).rejects.toMatchObject({
      code: 'gateway_invalid_response',
    });
  });

  it('preserves safe remote error metadata from a function response', async () => {
    const functions = invoker({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            error: 'provider_contract_violation',
            requestId: 'gateway-request-42',
            message: 'internal provider detail',
            issues: [{ code: 'invalid_reference', path: '$.meals[0].recipe_id' }],
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        ),
      },
    });

    const error = await requestRecipeSuggestions(request, functions).catch(
      (value: unknown) => value,
    );
    expect(error).toBeInstanceOf(RecipeSuggestionGatewayError);
    expect(error).toMatchObject({
      code: 'gateway_unavailable',
      status: 502,
      remoteCode: 'provider_contract_violation',
      requestId: 'gateway-request-42',
      issues: [{ code: 'invalid_reference', path: '$.meals[0].recipe_id' }],
    });
    expect((error as Error).message).not.toContain('internal provider detail');
  });

  it('classifies an unknown Chef history persistence result as indeterminate', async () => {
    const functions = invoker({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            error: 'chef_history_persist_unknown',
            requestId: 'gateway-request-unknown',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      },
    });

    const error = await requestRecipeSuggestions(request, functions).catch(
      (value: unknown) => value,
    );

    expect(hasIndeterminateRecipeSuggestionOutcome(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'gateway_unavailable',
      status: 500,
      remoteCode: 'chef_history_persist_unknown',
      requestId: 'gateway-request-unknown',
    });
  });

  it('keeps lookup failures and malformed successes indeterminate', () => {
    expect(
      hasIndeterminateRecipeSuggestionOutcome(
        new RecipeSuggestionGatewayError('gateway_unavailable', 500, 'chef_history_lookup_failed'),
      ),
    ).toBe(true);
    expect(
      hasIndeterminateRecipeSuggestionOutcome(
        new RecipeSuggestionGatewayError('gateway_invalid_response'),
      ),
    ).toBe(true);
    expect(
      hasIndeterminateRecipeSuggestionOutcome(
        new RecipeSuggestionGatewayError('gateway_unavailable', 502, 'provider_unavailable'),
      ),
    ).toBe(false);
  });

  it('normalizes thrown transport failures', async () => {
    const functions: FunctionsInvoker = {
      invoke: jest.fn().mockRejectedValue(new Error('offline')),
    };

    await expect(requestRecipeSuggestions(request, functions)).rejects.toBeInstanceOf(
      RecipeSuggestionGatewayError,
    );
    await expect(requestRecipeSuggestions(request, functions)).rejects.toMatchObject({
      code: 'gateway_request_failed',
      status: null,
    });
  });
});
