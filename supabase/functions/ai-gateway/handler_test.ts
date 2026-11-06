import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayCreditAction,
  type GatewayInventoryContext,
} from './handler.ts';

const CONTEXT: GatewayCookingContext = {
  inventory: {
    source: 'inventory',
    fetchedAt: '2026-09-01T10:00:00.000Z',
    lots: [
      {
        lotId: 'lot-tomato',
        productId: 'product-tomato',
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
      estimatedMinutes: 20,
      servings: 2,
      dietaryTags: ['vegetarian'],
      allergens: [],
      ingredients: [
        {
          productId: 'product-tomato',
          normalizedName: 'Tomate',
          quantity: 1,
          unit: 'piece',
        },
      ],
    },
  ],
};

const COOKING_RESULT = {
  kind: 'cooking_suggestion.v1',
  recipeId: 'recipe-1',
  title: 'Tomatenpfanne',
  usedLots: ['lot-tomato'],
  missingIngredients: [],
  estimatedMinutes: 20,
  servings: 2,
  rationale: 'Die Tomate wird zuerst verwendet.',
  constraintChecks: { allergies: 'pass', dietaryPattern: 'pass', time: 'pass' },
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

function setup(
  options: {
    providerContent?: string;
    model?: string;
    providerModel?: string;
    rateLimited?: boolean;
    memberAllowed?: boolean;
    entitlementAllowed?: boolean;
    entitlementUnavailable?: boolean;
    bookingAllowed?: boolean;
    providerFailed?: boolean;
    providerThrows?: boolean;
    refundThrows?: boolean;
  } = {},
) {
  const calls: Array<{ model: string; system: string; user: string }> = [];
  const bookings: Array<{
    action: GatewayCreditAction;
    householdId: string;
    requestId: string;
    subscriberUserId: string;
  }> = [];
  const refunds: Array<{ requestId: string; subscriberUserId: string }> = [];
  let contextReads = 0;
  const handler = createAiGatewayHandler({
    authenticate: (request) =>
      Promise.resolve(
        request.headers.get('Authorization')
          ? {
            ok: true as const,
            userId: 'user-1',
            authorization: request.headers.get('Authorization')!,
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
    authorizeAiEntitlement: () =>
      Promise.resolve(
        options.entitlementUnavailable
          ? { ok: false as const, status: 503, error: 'ai_status_unavailable' }
          : options.entitlementAllowed === false
          ? { ok: false as const, status: 402, error: 'ai_subscription_required' }
          : { ok: true as const, subscriberUserId: 'subscriber-1' },
      ),
    bookAiCredit: (input) => {
      bookings.push(input);
      return Promise.resolve(
        options.bookingAllowed === false
          ? { ok: false as const, status: 429, error: 'ai_credit_limit_exceeded' }
          : { ok: true as const },
      );
    },
    refundAiCredit: (subscriberUserId, requestId) => {
      refunds.push({ requestId, subscriberUserId });
      return options.refundThrows ? Promise.reject(new Error('refund failed')) : Promise.resolve();
    },
    loadCookingContext: () => {
      contextReads += 1;
      return Promise.resolve({ ok: true as const, context: CONTEXT });
    },
    complete: ({ model, messages }) => {
      calls.push({
        model,
        system: messages[0]?.content ?? '',
        user: messages[1]?.content ?? '',
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
    defaultModel: options.model ?? 'z-ai/glm-5.3-flash',
    now: () => '2026-09-01T10:00:00.000Z',
    requestId: () => 'request-1',
  });
  return { handler, calls, bookings, refunds, getContextReads: () => contextReads };
}

Deno.test('rejects unauthenticated requests before parsing the body', async () => {
  const { handler } = setup();
  const response = await handler(
    new Request('http://localhost/ai-gateway', {
      method: 'POST',
      body: '{}',
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'missing_authorization' });
});

Deno.test('rejects invalid requests and disallowed models', async () => {
  const { handler, calls } = setup();
  const invalid = await handler(
    request({ skill: 'fam-cook-from-inventory', householdId: 'h' }),
  );
  assertEquals(invalid.status, 400);

  const disallowed = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
      model: 'unknown/provider',
    }),
  );
  assertEquals(disallowed.status, 400);
  assertEquals(calls, []);
});

Deno.test('builds a cooking prompt from gateway context and returns validated JSON', async () => {
  const { handler, calls, bookings, getContextReads } = setup();
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: 2,
      maxMinutes: 30,
      dietaryPattern: 'vegetarian',
      allergies: [],
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.requestId, 'request-1');
  assertEquals(calls.length, 1);
  assertEquals(bookings, [{
    action: 'recipe',
    householdId: 'household-1',
    requestId: body.requestId,
    subscriberUserId: 'subscriber-1',
  }]);
  assertEquals(body.result, COOKING_RESULT);
  assertEquals(getContextReads(), 1);
  assertStringIncludes(calls[0]?.system ?? '', 'lot-tomato');
  assertStringIncludes(calls[0]?.user ?? '', 'vegetarian');
});

Deno.test('rejects provider output that invents an inventory lot', async () => {
  const { handler, refunds } = setup({
    providerContent: JSON.stringify({
      ...COOKING_RESULT,
      usedLots: ['lot-invented'],
    }),
  });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 502);
  assertEquals(await response.json(), { error: 'lot_not_allowed' });
  assertEquals(refunds, [{ requestId: 'request-1', subscriberUserId: 'subscriber-1' }]);
});

Deno.test('rejects a provider model that differs from the allowlisted request', async () => {
  const { handler, refunds } = setup({ providerModel: 'google/gemma-4-31b-it' });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 502);
  assertEquals(await response.json(), { error: 'provider_model_mismatch' });
  assertEquals(refunds.length, 1);
});

Deno.test('does not call the provider or book credits without an active AI entitlement', async () => {
  const { handler, calls, bookings } = setup({ entitlementAllowed: false });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 402);
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('rejects non-members before entitlement, context, booking, or provider calls', async () => {
  const { handler, calls, bookings, getContextReads } = setup({ memberAllowed: false });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 403);
  assertEquals(calls, []);
  assertEquals(bookings, []);
  assertEquals(getContextReads(), 0);
});

Deno.test('denies access when RevenueCat cannot confirm the current AI status', async () => {
  const { handler, calls, bookings } = setup({ entitlementUnavailable: true });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 503);
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('does not call the provider when the credit booking is rejected', async () => {
  const { handler, calls, bookings } = setup({ bookingAllowed: false });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(bookings[0]?.action, 'recipe');
  assertEquals(calls, []);
});

Deno.test('refunds the booking when the provider returns no result', async () => {
  const { handler, bookings, refunds } = setup({ providerFailed: true });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 502);
  assertEquals(bookings[0]?.requestId, refunds[0]?.requestId);
  assertEquals(refunds, [{ requestId: 'request-1', subscriberUserId: 'subscriber-1' }]);
});

Deno.test('refunds credits when the provider throws or a refund itself fails', async () => {
  const providerFailure = setup({ providerThrows: true });
  const requestBody = {
    skill: 'fam-cook-from-inventory',
    householdId: 'household-1',
    userText: 'Was kann ich heute kochen?',
    servings: null,
    maxMinutes: null,
    dietaryPattern: null,
    allergies: [],
  };
  const providerResponse = await providerFailure.handler(request(requestBody));
  assertEquals(providerResponse.status, 502);
  assertEquals(providerFailure.refunds.length, 1);

  const refundFailure = setup({ providerFailed: true, refundThrows: true });
  const refundResponse = await refundFailure.handler(request(requestBody));
  assertEquals(refundResponse.status, 500);
  assertEquals(await refundResponse.json(), {
    error: 'credit_refund_failed',
    requestId: 'request-1',
    message: 'refund failed',
  });
});

Deno.test('applies the gateway rate limit before loading context or calling the provider', async () => {
  const { handler, calls, getContextReads } = setup({ rateLimited: true });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(await response.json(), { error: 'rate_limited' });
  assertEquals(calls, []);
  assertEquals(getContextReads(), 0);
});

Deno.test('capture remains read-only and does not load inventory context', async () => {
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
  const { handler, bookings, getContextReads } = setup({
    providerContent: JSON.stringify(capture),
  });
  const response = await handler(
    request({
      skill: 'fam-inventory-capture',
      householdId: 'household-1',
      text: 'Ich habe etwas Spinat',
      locale: 'de-DE',
    }),
  );

  assertEquals(response.status, 200);
  assert((await response.json()).result.items.length === 1);
  assertEquals(bookings[0]?.action, 'suggestion');
  assertEquals(getContextReads(), 0);
});

Deno.test('rejects capture evidence that is not present in the user text', async () => {
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
      householdId: 'household-1',
      text: 'Ich habe etwas Spinat',
      locale: 'de-DE',
    }),
  );

  assertEquals(response.status, 502);
  assertEquals(await response.json(), {
    error: 'capture_evidence_not_grounded',
  });
});

Deno.test('rejects non-JSON provider output without fallback text', async () => {
  const { handler } = setup({ providerContent: 'Ich würde Pasta kochen.' });
  const response = await handler(
    request({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    }),
  );

  assertEquals(response.status, 502);
  assertEquals(await response.json(), { error: 'provider_invalid_json' });
});
