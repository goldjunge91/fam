import {
  type FunctionsInvoker,
  RecipeSuggestionGatewayError,
  requestRecipeSuggestions,
} from './recipe-suggestion-gateway';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const response = {
  requestId: 'request-1',
  skill: 'fam-cook-from-inventory' as const,
  provider: 'catalog',
  model: 'z-ai/glm-5.3-flash',
  generatedAt: '2026-11-06T08:00:00.000Z',
  result: {
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
  },
};

const request = {
  householdId: HOUSEHOLD_ID,
  userText: 'Was kann ich heute kochen?',
  servings: 2,
  maxMinutes: 30,
  dietaryPattern: null,
  allergies: [],
  shoppingDecision: 'no' as const,
  selectedInventoryItemIds: ['lot-tomato'],
};

function invoker(result: Awaited<ReturnType<FunctionsInvoker['invoke']>>) {
  return { invoke: jest.fn().mockResolvedValue(result) } satisfies FunctionsInvoker;
}

describe('requestRecipeSuggestions', () => {
  it('invokes the current Gateway contract and validates the result', async () => {
    const functions = invoker({ data: response, error: null });

    await expect(requestRecipeSuggestions(request, functions)).resolves.toEqual(response);
    expect(functions.invoke).toHaveBeenCalledWith('ai-gateway', {
      body: {
        skill: 'fam-cook-from-inventory',
        householdId: HOUSEHOLD_ID,
        userText: 'Was kann ich heute kochen?',
        servings: 2,
        maxMinutes: 30,
        dietaryPattern: null,
        allergies: [],
        shoppingDecision: 'no',
        selectedInventoryItemIds: ['lot-tomato'],
      },
    });
  });

  it('rejects malformed success envelopes before they reach the screen', async () => {
    const functions = invoker({
      data: { ...response, result: { ...response.result, unexpected: true } },
      error: null,
    });

    await expect(requestRecipeSuggestions(request, functions)).rejects.toMatchObject({
      code: 'gateway_invalid_response',
    });
  });

  it('keeps remote error codes and issue paths without exposing remote messages', async () => {
    const functions = invoker({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            error: 'provider_contract_violation',
            requestId: 'gateway-request-42',
            message: 'private provider details',
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
    expect((error as Error).message).not.toContain('private provider details');
  });

  it('classifies a plain-object 400 error without remote details', async () => {
    const functions = invoker({
      data: null,
      error: { context: { status: 400 } },
    });

    const error = await requestRecipeSuggestions(request, functions).catch(
      (value: unknown) => value,
    );
    expect(error).toBeInstanceOf(RecipeSuggestionGatewayError);
    expect(error).toMatchObject({
      code: 'gateway_request_failed',
      status: 400,
      remoteCode: null,
      issues: null,
      requestId: null,
    });
  });

  it('normalizes transport failures', async () => {
    const functions: FunctionsInvoker = {
      invoke: jest.fn().mockRejectedValue(new Error('offline')),
    };

    await expect(requestRecipeSuggestions(request, functions)).rejects.toMatchObject({
      code: 'gateway_request_failed',
      status: null,
    });
  });
});
