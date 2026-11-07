import { assert, assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert@1';

import type {
  ChefConversationContext,
  ChefConversationPreflight,
  ChefExchangeLookup,
  ChefHistoryHydration,
} from './chef-history.ts';
import { resolveDefaultModel } from './config.ts';
import {
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayCreditAction,
  type GatewayInventoryContext,
} from './handler.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const LOT_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const CONVERSATION_ID = '55555555-5555-4555-8555-555555555555';
const TURN_ID = '66666666-6666-4666-8666-666666666666';
const CONTINUATION_ID = '88888888-8888-4888-8888-888888888888';

const CONTEXT: GatewayCookingContext = {
  inventory: {
    source: 'inventory',
    fetchedAt: '2026-09-01T10:00:00.000Z',
    lots: [
      {
        lotId: LOT_ID,
        productId: PRODUCT_ID,
        normalizedName: 'Tomate',
        quantity: 2,
        unit: 'piece',
        bestBefore: '2026-09-03',
        useBy: null,
        storage: 'fridge',
      },
    ],
  } satisfies GatewayInventoryContext,
  recipes: [
    {
      recipeId: 'recipe-1',
      title: 'Tomatenpfanne',
      source: 'catalog',
      estimatedMinutes: 20,
      servings: 4,
      dietaryTags: ['vegetarian'],
      allergens: [],
      steps: ['Tomate in der Pfanne garen.'],
      ingredients: [
        {
          productId: PRODUCT_ID,
          normalizedName: 'Tomate',
          quantity: 1,
          unit: 'piece',
        },
      ],
    },
  ],
  shoppingItems: [],
  allergies: [],
  preferences: [],
  forbiddenIngredients: [],
};

const COOKING_RESULT = {
  schema_version: 1,
  meals: [
    {
      title: 'Tomatenpfanne',
      source: 'catalog',
      recipe_id: 'recipe-1',
      servings: 2,
      used_items: [
        {
          inventory_item_id: LOT_ID,
          quantity: 1,
          unit: 'piece',
        },
      ],
      additional_ingredients: [],
      steps: ['Tomate in der Pfanne garen.'],
      notes: [],
    },
  ],
};

const COOKING_REQUEST = {
  skill: 'fam-cook-from-inventory',
  householdId: HOUSEHOLD_ID,
  userText: 'Was kann ich heute kochen?',
  servings: 2,
  maxMinutes: 30,
  dietaryPattern: 'vegetarian',
  shoppingDecision: null,
  clientRequestId: CLIENT_REQUEST_ID,
};

function request(body: unknown, method = 'POST') {
  return new Request('http://localhost/ai-gateway', {
    method,
    headers: {
      Authorization: 'Bearer user-token',
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

Deno.test('rejects a configured model outside the fixed allowlist', () => {
  assertEquals(resolveDefaultModel(undefined), 'google/gemma-4-31b-it:free');
  assertEquals(
    resolveDefaultModel('google/gemma-4-26b-a4b-it:free'),
    'google/gemma-4-26b-a4b-it:free',
  );
  assertEquals(
    resolveDefaultModel('xingchen-agi/xing4.0-29b-a4b:free'),
    'xingchen-agi/xing4.0-29b-a4b:free',
  );
  assertEquals(
    resolveDefaultModel('z-ai/glm-5.3-flash'),
    'z-ai/glm-5.3-flash',
  );
  assertThrows(() => resolveDefaultModel('openai/gpt-4o'));
});

function setup(
  options: {
    context?: GatewayCookingContext;
    providerContent?: string;
    model?: string;
    providerModel?: string;
    rateLimited?: boolean;
    memberAllowed?: boolean;
    entitlementAllowed?: boolean;
    entitlementUnavailable?: boolean;
    bookingAllowed?: boolean;
    bookingCreated?: boolean;
    providerFailed?: boolean;
    providerThrows?: boolean;
    refundThrows?: boolean;
    lookupResults?: ChefExchangeLookup[];
    lookupError?: { status: number; error: string };
    preflight?: ChefConversationPreflight;
    historyContext?: ChefConversationContext;
    persistError?: { status: number; error: string };
  } = {},
) {
  const calls: Array<{
    model: string;
    skill: 'fam-cook-from-inventory' | 'fam-inventory-capture';
    cookingContext: RecipeSuggestionContext | null;
    system: string;
    history: string | null;
    user: string;
  }> = [];
  const bookings: Array<{
    action: GatewayCreditAction;
    householdId: string;
    requestId: string;
    subscriberUserId: string;
  }> = [];
  const refunds: Array<{ requestId: string; subscriberUserId: string }> = [];
  const entitlementChecks: Array<{
    userId: string;
    householdId: string;
    authorization: string;
  }> = [];
  const lookupCalls: Array<{ clientRequestId: string; requestFingerprint: string }> = [];
  const preflightCalls: Array<{
    conversationId: string | null;
    continuedFromConversationId: string | null;
  }> = [];
  const persistedInputs: Array<{
    conversationId: string | null;
    continuedFromConversationId: string | null;
    clientRequestId: string;
  }> = [];
  const lookupResults = [...(options.lookupResults ?? [])];
  let contextReads = 0;
  let historyContextReads = 0;

  const handler = createAiGatewayHandler({
    authenticate: (incomingRequest) =>
      Promise.resolve(
        incomingRequest.headers.get('Authorization')
          ? {
            ok: true as const,
            userId: 'user-1',
            authorization: incomingRequest.headers.get('Authorization')!,
          }
          : { ok: false as const, status: 401, error: 'missing_authorization' },
      ),
    assertHouseholdMember: () =>
      Promise.resolve(
        options.memberAllowed === false
          ? { ok: false as const, status: 403, error: 'household_forbidden' }
          : {
            ok: true as const,
            userId: 'user-1',
            authorization: 'Bearer user-token',
          },
      ),
    lookupChefExchange: (input) => {
      lookupCalls.push({
        clientRequestId: input.clientRequestId,
        requestFingerprint: input.requestFingerprint,
      });
      if (options.lookupError !== undefined) {
        return Promise.resolve({ ok: false as const, ...options.lookupError });
      }
      return Promise.resolve({
        ok: true as const,
        value: lookupResults.shift() ?? ({ schema_version: 1, status: 'missing' } as const),
      });
    },
    preflightChefExchange: (input) => {
      preflightCalls.push({
        conversationId: input.conversationId,
        continuedFromConversationId: input.continuedFromConversationId,
      });
      return Promise.resolve({
        ok: true as const,
        value: options.preflight ??
          ({
            allowed: true,
            error_code: null,
            conversation_id: input.conversationId ?? input.continuedFromConversationId,
            last_activity_at: null,
          } satisfies ChefConversationPreflight),
      });
    },
    loadChefConversationContext: () => {
      historyContextReads += 1;
      return Promise.resolve({
        ok: true as const,
        value: options.historyContext ??
          ({ schema_version: 1, truncated: false, turns: [] } satisfies ChefConversationContext),
      });
    },
    persistChefExchange: (input) => {
      persistedInputs.push({
        conversationId: input.conversationId,
        continuedFromConversationId: input.continuedFromConversationId,
        clientRequestId: input.clientRequestId,
      });
      if (options.persistError) {
        return Promise.resolve({ ok: false as const, ...options.persistError });
      }
      const conversationId = input.conversationId ??
        (input.continuedFromConversationId === null ? CONVERSATION_ID : CONTINUATION_ID);
      const recipe = input.recipeSnapshots[0];
      const hydration: ChefHistoryHydration = {
        schema_version: 1,
        replayed: false,
        conversation: {
          id: conversationId,
          household_id: input.householdId,
          created_by: input.actorUserId,
          created_at: '2026-09-01T10:00:00.000Z',
          last_activity_at: '2026-09-01T10:00:00.000Z',
          continued_from_id: input.continuedFromConversationId,
          updated_at: '2026-09-01T10:00:00.000Z',
        },
        turn: {
          id: TURN_ID,
          conversation_id: conversationId,
          household_id: input.householdId,
          created_by: input.actorUserId,
          client_request_id: input.clientRequestId,
          request_fingerprint: input.requestFingerprint,
          user_text: input.userText,
          request_payload: input.requestPayload,
          response_payload: input.responsePayload,
          created_at: '2026-09-01T10:00:00.000Z',
        },
        recipe_history: recipe === undefined ? [] : [
          {
            id: '77777777-7777-4777-8777-777777777777',
            conversation_id: conversationId,
            turn_id: TURN_ID,
            household_id: input.householdId,
            title: recipe.title,
            recipe_payload: recipe.recipe_payload,
            created_at: '2026-09-01T10:00:00.000Z',
          },
        ],
      };
      return Promise.resolve({ ok: true as const, value: hydration });
    },
    authorizeAiEntitlement: (userId, householdId, authorization) => {
      entitlementChecks.push({ userId, householdId, authorization });
      return Promise.resolve(
        options.entitlementUnavailable
          ? { ok: false as const, status: 503, error: 'ai_status_unavailable' }
          : options.entitlementAllowed === false
          ? { ok: false as const, status: 402, error: 'ai_subscription_required' }
          : { ok: true as const, subscriberUserId: 'subscriber-1' },
      );
    },
    bookAiCredit: (input) => {
      bookings.push(input);
      return Promise.resolve(
        options.bookingAllowed === false
          ? { ok: false as const, status: 429, error: 'ai_credit_limit_exceeded' }
          : { ok: true as const, created: options.bookingCreated ?? true },
      );
    },
    refundAiCredit: (subscriberUserId, requestId) => {
      refunds.push({ requestId, subscriberUserId });
      return options.refundThrows ? Promise.reject(new Error('refund failed')) : Promise.resolve();
    },
    loadCookingContext: () => {
      contextReads += 1;
      return Promise.resolve({ ok: true as const, context: options.context ?? CONTEXT });
    },
    complete: ({ model, messages, skill, cookingContext }) => {
      calls.push({
        model,
        skill,
        cookingContext,
        system: messages[0]?.content ?? '',
        history: messages.length === 3 ? (messages[1]?.content ?? null) : null,
        user: messages.at(-1)?.content ?? '',
      });
      if (options.providerThrows) throw new Error('provider failed');
      if (options.providerFailed) {
        return Promise.resolve({
          ok: false as const,
          status: 502,
          error: 'provider_unavailable',
        });
      }
      return Promise.resolve({
        ok: true as const,
        content: options.providerContent ?? JSON.stringify(COOKING_RESULT),
        model: options.providerModel ?? model,
      });
    },
    isRateLimited: () => options.rateLimited ?? false,
    defaultModel: options.model ?? 'google/gemma-4-31b-it:free',
    now: () => '2026-09-01T10:00:00.000Z',
    requestId: () => 'request-1',
  });
  return {
    handler,
    calls,
    bookings,
    refunds,
    entitlementChecks,
    lookupCalls,
    preflightCalls,
    persistedInputs,
    getContextReads: () => contextReads,
    getHistoryContextReads: () => historyContextReads,
  };
}

Deno.test('rejects unauthenticated requests before parsing the body', async () => {
  const { handler } = setup();
  const response = await handler(
    new Request('http://localhost/ai-gateway', { method: 'POST', body: '{}' }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: 'missing_authorization',
    requestId: 'request-1',
  });
  assertEquals(response.headers.get('X-Request-Id'), 'request-1');
});

Deno.test('includes one request ID on every handler response', async () => {
  const cases = [
    {
      response: await setup().handler(request({ skill: 'invalid' })),
      status: 400,
      error: 'invalid_request',
    },
    {
      response: await setup({ memberAllowed: false }).handler(request(COOKING_REQUEST)),
      status: 403,
      error: 'household_forbidden',
    },
    {
      response: await setup({ entitlementAllowed: false }).handler(request(COOKING_REQUEST)),
      status: 402,
      error: 'ai_subscription_required',
    },
    {
      response: await setup({
        context: { ...CONTEXT, allergies: ['unknown-allergy'] },
      }).handler(request(COOKING_REQUEST)),
      status: 422,
      error: 'no_safe_recipe',
    },
    {
      response: await setup({ rateLimited: true }).handler(request(COOKING_REQUEST)),
      status: 429,
      error: 'rate_limited',
    },
    {
      response: await setup({ providerFailed: true }).handler(request(COOKING_REQUEST)),
      status: 502,
      error: 'provider_unavailable',
    },
    {
      response: await setup({ providerFailed: true, refundThrows: true }).handler(
        request(COOKING_REQUEST),
      ),
      status: 500,
      error: 'credit_refund_failed',
    },
    {
      response: await setup().handler(request(COOKING_REQUEST)),
      status: 200,
      error: undefined,
    },
  ];

  for (const { response, status, error } of cases) {
    assertEquals(response.status, status);
    assertEquals(response.headers.get('X-Request-Id'), 'request-1');
    const body = await response.json();
    assertEquals(body.requestId, 'request-1');
    if (error !== undefined) assertEquals(body.error, error);
  }

  const options = await setup().handler(request({}, 'OPTIONS'));
  assertEquals(options.status, 204);
  assertEquals(options.headers.get('X-Request-Id'), 'request-1');
});

Deno.test('uses the request ID provided at the edge boundary', async () => {
  const { handler } = setup();
  const response = await handler(request(COOKING_REQUEST), 'edge-request-42');

  assertEquals(response.headers.get('X-Request-Id'), 'edge-request-42');
  assertEquals((await response.json()).requestId, 'edge-request-42');
});

Deno.test('uses the configured default model and accepts both exact model overrides', async () => {
  const defaultRequest = await setup().handler(request(COOKING_REQUEST));
  assertEquals((await defaultRequest.json()).model, 'google/gemma-4-31b-it:free');

  for (const model of ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free']) {
    const { handler, calls } = setup();
    const response = await handler(request({ ...COOKING_REQUEST, model }));

    assertEquals(response.status, 200);
    assertEquals(calls[0]?.model, model);
  }
});

Deno.test('rejects invalid requests, client authorization claims, and disallowed models', async () => {
  const { handler, calls } = setup();
  const invalid = await handler(
    request({ skill: 'fam-cook-from-inventory', householdId: 'h' }),
  );
  assertEquals(invalid.status, 400);

  const clientAllergies = await handler(
    request({ ...COOKING_REQUEST, allergies: [] }),
  );
  assertEquals(clientAllergies.status, 400);

  const clientEntitlement = await handler(
    request({ ...COOKING_REQUEST, entitlementActive: true }),
  );
  assertEquals(clientEntitlement.status, 400);

  const clientEnvironment = await handler(
    request({ ...COOKING_REQUEST, environment: 'sandbox' }),
  );
  assertEquals(clientEnvironment.status, 400);

  const disallowed = await handler(
    request({ ...COOKING_REQUEST, model: 'unknown/provider' }),
  );
  assertEquals(disallowed.status, 400);
  for (const oldModel of ['google/gemma-4-31b-it', 'google/gemma-4-26b-a4b-it']) {
    const oldModelResponse = await handler(request({ ...COOKING_REQUEST, model: oldModel }));
    assertEquals(oldModelResponse.status, 400);
  }
  assertEquals(calls, []);
});

Deno.test('builds a minimal cooking prompt and returns validated alternatives', async () => {
  const { handler, calls, bookings, entitlementChecks, getContextReads } = setup();
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.requestId, 'request-1');
  assertEquals(body.result, COOKING_RESULT);
  assertEquals(body.priorityFoodCount, 1);
  assertEquals(body.shoppingQuestion, null);
  assertEquals(body.clientRequestId, CLIENT_REQUEST_ID);
  assertEquals(body.conversationId, CONVERSATION_ID);
  assertEquals(body.turnId, TURN_ID);
  assertEquals(body.history.recipe_history.length, 1);
  assertEquals('usage' in body, false);
  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.skill, 'fam-cook-from-inventory');
  assertEquals(
    calls[0]?.cookingContext?.candidate_recipes.map(({ id }) => id),
    ['recipe-1'],
  );
  assertEquals(
    calls[0]?.cookingContext?.priority_foods.map(({ inventory_item_id }) => inventory_item_id),
    [LOT_ID],
  );
  assertStringIncludes(calls[0]?.system ?? '', LOT_ID);
  assertStringIncludes(calls[0]?.user ?? '', 'vegetarian');
  assertEquals(bookings, [
    {
      action: 'recipe',
      householdId: HOUSEHOLD_ID,
      requestId: CLIENT_REQUEST_ID,
      subscriberUserId: 'subscriber-1',
    },
  ]);
  assertEquals(entitlementChecks, [{
    userId: 'user-1',
    householdId: HOUSEHOLD_ID,
    authorization: 'Bearer user-token',
  }]);
  assertEquals(getContextReads(), 1);
});

Deno.test('asks about shopping before booking credit or calling the provider', async () => {
  const { handler, calls, bookings } = setup({
    context: {
      ...CONTEXT,
      shoppingItems: [
        { shoppingItemId: 'shopping-oil', name: 'Öl', quantity: 100, unit: 'ml' },
      ],
    },
  });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.requestId, 'request-1');
  assertEquals(body.result, null);
  assertEquals(body.shoppingQuestion, 'Willst du heute noch einkaufen?');
  assertEquals(body.clientRequestId, CLIENT_REQUEST_ID);
  assertEquals(body.history.recipe_history, []);
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('returns no safe recipe before booking when authoritative allergies are unknown', async () => {
  const { handler, calls, bookings } = setup({
    context: { ...CONTEXT, allergies: ['custom-allergy'] },
  });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 422);
  assertEquals(await response.json(), { error: 'no_safe_recipe', requestId: 'request-1' });
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('rejects invented inventory references without returning model content', async () => {
  const invalidResult = {
    ...COOKING_RESULT,
    meals: [
      {
        ...COOKING_RESULT.meals[0],
        used_items: [
          { inventory_item_id: 'lot-invented', quantity: 1, unit: 'piece' },
        ],
      },
    ],
  };
  const { handler, refunds } = setup({ providerContent: JSON.stringify(invalidResult) });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 502);
  assertEquals(await response.json(), {
    error: 'provider_contract_violation',
    requestId: 'request-1',
    issues: [
      {
        code: 'invalid_reference',
        path: '$.meals[0].used_items[0].inventory_item_id',
      },
    ],
  });
  assertEquals(refunds, [{ requestId: CLIENT_REQUEST_ID, subscriberUserId: 'subscriber-1' }]);
});

Deno.test('rejects a provider model that differs from the allowlisted request', async () => {
  const { handler, refunds } = setup({ providerModel: 'google/gemma-4-26b-a4b-it:free' });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 502);
  assertEquals(await response.json(), {
    error: 'provider_model_mismatch',
    requestId: 'request-1',
  });
  assertEquals(refunds.length, 1);
});

Deno.test('does not call the provider or book credits without an active AI entitlement', async () => {
  const { handler, calls, bookings } = setup({ entitlementAllowed: false });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 402);
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('rejects non-members before entitlement, context, booking, or provider calls', async () => {
  const { handler, calls, bookings, entitlementChecks, getContextReads } = setup({
    memberAllowed: false,
  });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 403);
  assertEquals(calls, []);
  assertEquals(bookings, []);
  assertEquals(entitlementChecks, []);
  assertEquals(getContextReads(), 0);
});

Deno.test('replays a stored exchange before entitlement, context, credit, or provider work', async () => {
  const first = setup();
  const firstResponse = await first.handler(request(COOKING_REQUEST));
  const stored = (await firstResponse.json()).history as ChefHistoryHydration;
  const replayed: ChefHistoryHydration = { ...stored, replayed: true };

  const replay = setup({
    lookupResults: [{ schema_version: 1, status: 'match', hydration: replayed }],
    entitlementAllowed: false,
  });
  const response = await replay.handler(request(COOKING_REQUEST));
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.history.replayed, true);
  assertEquals(body.conversationId, CONVERSATION_ID);
  assertEquals(replay.entitlementChecks, []);
  assertEquals(replay.getContextReads(), 0);
  assertEquals(replay.bookings, []);
  assertEquals(replay.calls, []);
  assertEquals(replay.persistedInputs, []);
});

Deno.test('does not book credit or call the provider when a retry lookup is unavailable', async () => {
  const retry = setup({
    lookupError: { status: 500, error: 'chef_history_lookup_failed' },
  });
  const response = await retry.handler(request(COOKING_REQUEST));

  assertEquals(response.status, 500);
  assertEquals((await response.json()).error, 'chef_history_lookup_failed');
  assertEquals(retry.lookupCalls.length, 1);
  assertEquals(retry.lookupCalls[0]?.clientRequestId, CLIENT_REQUEST_ID);
  assertEquals(retry.preflightCalls, []);
  assertEquals(retry.bookings, []);
  assertEquals(retry.calls, []);
});

Deno.test('rejects an expired continuation before entitlement, context, credit, or provider work', async () => {
  const expired = setup({
    preflight: {
      allowed: false,
      error_code: 'chef_conversation_continuation_expired',
      conversation_id: CONVERSATION_ID,
      last_activity_at: '2026-08-01T00:00:00.000Z',
    },
  });
  const response = await expired.handler(
    request({ ...COOKING_REQUEST, conversationId: CONVERSATION_ID }),
  );

  assertEquals(response.status, 409);
  assertEquals((await response.json()).error, 'chef_conversation_continuation_expired');
  assertEquals(expired.entitlementChecks, []);
  assertEquals(expired.getContextReads(), 0);
  assertEquals(expired.bookings, []);
  assertEquals(expired.calls, []);
});

Deno.test('continues from a source into a new conversation with bounded server history', async () => {
  const first = setup();
  const firstResponse = await first.handler(request(COOKING_REQUEST));
  const source = (await firstResponse.json()).history as ChefHistoryHydration;
  const historyContext: ChefConversationContext = {
    schema_version: 1,
    truncated: false,
    turns: [
      {
        conversation_id: source.turn.conversation_id,
        turn_id: source.turn.id,
        created_at: source.turn.created_at,
        request_payload: source.turn.request_payload,
        response_payload: source.turn.response_payload,
      },
    ],
  };
  const nextClientRequestId = '99999999-9999-4999-8999-999999999999';
  const continuation = setup({ historyContext });
  const response = await continuation.handler(
    request({
      ...COOKING_REQUEST,
      clientRequestId: nextClientRequestId,
      continuedFromConversationId: CONVERSATION_ID,
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.conversationId, CONTINUATION_ID);
  assertEquals(body.history.conversation.continued_from_id, CONVERSATION_ID);
  assertEquals(continuation.preflightCalls, [
    { conversationId: null, continuedFromConversationId: CONVERSATION_ID },
  ]);
  assertEquals(continuation.persistedInputs, [
    {
      conversationId: null,
      continuedFromConversationId: CONVERSATION_ID,
      clientRequestId: nextClientRequestId,
    },
  ]);
  assertEquals(continuation.getHistoryContextReads(), 1);
  assertStringIncludes(continuation.calls[0]?.history ?? '', 'untrusted_chef_history');
});

Deno.test('does not load context or repeat the provider for a booked credit without a stored turn', async () => {
  const existing = setup({
    lookupResults: [{ schema_version: 1, status: 'incomplete' }],
  });
  const response = await existing.handler(request(COOKING_REQUEST));

  assertEquals(response.status, 409);
  assertEquals((await response.json()).error, 'chef_request_incomplete');
  assertEquals(existing.preflightCalls, []);
  assertEquals(existing.getContextReads(), 0);
  assertEquals(existing.bookings, []);
  assertEquals(existing.calls, []);
});

Deno.test('refunds only after persistence reconciliation proves no turn exists', async () => {
  const failed = setup({
    persistError: { status: 500, error: 'chef_history_persist_failed' },
    lookupResults: [
      { schema_version: 1, status: 'missing' },
      { schema_version: 1, status: 'incomplete' },
    ],
  });
  const response = await failed.handler(request(COOKING_REQUEST));

  assertEquals(response.status, 500);
  assertEquals((await response.json()).error, 'chef_history_persist_failed');
  assertEquals(failed.calls.length, 1);
  assertEquals(failed.refunds, [
    { requestId: CLIENT_REQUEST_ID, subscriberUserId: 'subscriber-1' },
  ]);
});

Deno.test('rejects incompatible conversation identifiers during request validation', async () => {
  const invalid = setup();
  const response = await invalid.handler(
    request({
      ...COOKING_REQUEST,
      conversationId: CONVERSATION_ID,
      continuedFromConversationId: CONTINUATION_ID,
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(invalid.lookupCalls, []);
});

Deno.test('denies access when RevenueCat cannot confirm the current AI status', async () => {
  const { handler, calls, bookings } = setup({ entitlementUnavailable: true });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 503);
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('does not call the provider when the credit booking is rejected', async () => {
  const { handler, calls, bookings } = setup({ bookingAllowed: false });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 429);
  assertEquals(bookings[0]?.action, 'recipe');
  assertEquals(calls, []);
});

Deno.test('refunds the booking when the provider returns no result', async () => {
  const { handler, bookings, refunds } = setup({ providerFailed: true });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 502);
  assertEquals(bookings[0]?.requestId, refunds[0]?.requestId);
  assertEquals(refunds, [{ requestId: CLIENT_REQUEST_ID, subscriberUserId: 'subscriber-1' }]);
});

Deno.test('refunds credits when the provider throws or reports an unusable result', async () => {
  const providerFailure = setup({ providerThrows: true });
  const providerResponse = await providerFailure.handler(request(COOKING_REQUEST));
  assertEquals(providerResponse.status, 502);
  assertEquals(providerFailure.refunds.length, 1);

  const refundFailure = setup({ providerFailed: true, refundThrows: true });
  const refundResponse = await refundFailure.handler(request(COOKING_REQUEST));
  assertEquals(refundResponse.status, 500);
  assertEquals(await refundResponse.json(), {
    error: 'credit_refund_failed',
    requestId: 'request-1',
  });
});

Deno.test('applies the gateway rate limit before loading context or calling the provider', async () => {
  const { handler, calls, getContextReads } = setup({ rateLimited: true });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 429);
  assertEquals(await response.json(), { error: 'rate_limited', requestId: 'request-1' });
  assertEquals(calls, []);
  assertEquals(getContextReads(), 0);
});

Deno.test('capture remains read-only and does not load cooking context', async () => {
  const capture = {
    kind: 'inventory_capture_proposal.v1',
    items: [
      {
        rawText: 'etwas Spinat',
        normalizedName: 'Spinat',
        quantity: null,
        unit: null,
        perishability: 'perishable',
        storage: 'unknown',
        date: null,
        dateKind: null,
        confidence: 0.8,
        evidence: 'etwas Spinat',
        missingFields: ['quantity', 'unit', 'storage', 'date'],
      },
    ],
    questions: [],
    warnings: [],
  };
  const { handler, bookings, calls, getContextReads } = setup({
    providerContent: JSON.stringify(capture),
  });
  const response = await handler(
    request({
      skill: 'fam-inventory-capture',
      householdId: HOUSEHOLD_ID,
      text: 'Ich habe etwas Spinat',
      locale: 'de-DE',
    }),
  );

  assertEquals(response.status, 200);
  assert((await response.json()).result.items.length === 1);
  assertEquals(bookings[0]?.action, 'suggestion');
  assertEquals(calls[0]?.skill, 'fam-inventory-capture');
  assertEquals(getContextReads(), 0);
});

Deno.test('rejects capture evidence that is absent from the user text', async () => {
  const capture = {
    kind: 'inventory_capture_proposal.v1',
    items: [
      {
        rawText: 'etwas Spinat',
        normalizedName: 'Spinat',
        quantity: null,
        unit: null,
        perishability: 'perishable',
        storage: 'unknown',
        date: null,
        dateKind: null,
        confidence: 0.8,
        evidence: 'drei Tomaten',
        missingFields: ['quantity', 'unit', 'storage', 'date'],
      },
    ],
    questions: [],
    warnings: [],
  };
  const { handler } = setup({ providerContent: JSON.stringify(capture) });
  const response = await handler(
    request({
      skill: 'fam-inventory-capture',
      householdId: HOUSEHOLD_ID,
      text: 'Ich habe etwas Spinat',
      locale: 'de-DE',
    }),
  );

  assertEquals(response.status, 502);
  assertEquals(await response.json(), {
    error: 'capture_evidence_not_grounded',
    requestId: 'request-1',
  });
});

Deno.test('rejects non-JSON provider output without fallback text', async () => {
  const { handler, refunds } = setup({ providerContent: 'Ich würde Pasta kochen.' });
  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 502);
  assertEquals(await response.json(), { error: 'provider_invalid_json', requestId: 'request-1' });
  assertEquals(refunds.length, 1);
});

Deno.test('books one recipe credit request before returning an exact catalog match', async () => {
  const exactRecipe = { ...CONTEXT.recipes[0], servings: 2 };
  const { handler, calls, bookings, refunds, persistedInputs } = setup({
    context: { ...CONTEXT, recipes: [exactRecipe] },
  });

  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 200);
  assertEquals((await response.json()).result, {
    schema_version: 1,
    meals: [
      {
        title: 'Tomatenpfanne',
        source: 'catalog',
        recipe_id: 'recipe-1',
        servings: 2,
        used_items: [
          { inventory_item_id: LOT_ID, quantity: 1, unit: 'piece' },
        ],
        additional_ingredients: [],
        steps: ['Tomate in der Pfanne garen.'],
        notes: [],
      },
    ],
  });
  assertEquals(calls, []);
  assertEquals(bookings, [{
    action: 'recipe',
    householdId: HOUSEHOLD_ID,
    requestId: CLIENT_REQUEST_ID,
    subscriberUserId: 'subscriber-1',
  }]);
  assertEquals(persistedInputs.length, 1);
  assertEquals(refunds, []);
});

Deno.test('rejects an exact catalog match when the server reports exhausted credits', async () => {
  const exactRecipe = { ...CONTEXT.recipes[0], servings: 2 };
  const { handler, calls, bookings, refunds, persistedInputs } = setup({
    context: { ...CONTEXT, recipes: [exactRecipe] },
    bookingAllowed: false,
  });

  const response = await handler(request(COOKING_REQUEST));

  assertEquals(response.status, 429);
  assertEquals(await response.json(), {
    error: 'ai_credit_limit_exceeded',
    requestId: 'request-1',
  });
  assertEquals(calls, []);
  assertEquals(bookings, [{
    action: 'recipe',
    householdId: HOUSEHOLD_ID,
    requestId: CLIENT_REQUEST_ID,
    subscriberUserId: 'subscriber-1',
  }]);
  assertEquals(persistedInputs, []);
  assertEquals(refunds, []);
});
