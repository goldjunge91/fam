import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  createAiGatewayHandler,
  type GatewayCookingContext,
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
        { productId: 'product-tomato', normalizedName: 'Tomate', quantity: 1, unit: 'piece' },
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
    headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

function setup(options: { providerContent?: string; model?: string; providerModel?: string; rateLimited?: boolean } = {}) {
  const calls: Array<{ model: string; system: string; user: string }> = [];
  let contextReads = 0;
  const handler = createAiGatewayHandler({
    authenticate: async (request) =>
      request.headers.get('Authorization')
        ? {
            ok: true as const,
            userId: 'user-1',
            authorization: request.headers.get('Authorization')!,
          }
        : { ok: false as const, status: 401, error: 'missing_authorization' },
    assertHouseholdMember: async () => ({
      ok: true as const,
      userId: 'user-1',
      authorization: 'Bearer user-token',
    }),
    loadCookingContext: async () => {
      contextReads += 1;
      return { ok: true as const, context: CONTEXT };
    },
    complete: async ({ model, messages }) => {
      calls.push({ model, system: messages[0]?.content ?? '', user: messages[1]?.content ?? '' });
      return {
        ok: true as const,
        content: options.providerContent ?? JSON.stringify(COOKING_RESULT),
        model: options.providerModel ?? model,
      };
    },
    isRateLimited: () => options.rateLimited ?? false,
    defaultModel: options.model ?? 'z-ai/glm-5.3-flash',
    now: () => '2026-09-01T10:00:00.000Z',
    requestId: () => 'request-1',
  });
  return { handler, calls, getContextReads: () => contextReads };
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
  const invalid = await handler(request({ skill: 'fam-cook-from-inventory', householdId: 'h' }));
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
  const { handler, calls, getContextReads } = setup();
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
  assertEquals(body.result, COOKING_RESULT);
  assertEquals(getContextReads(), 1);
  assertStringIncludes(calls[0]?.system ?? '', 'lot-tomato');
  assertStringIncludes(calls[0]?.user ?? '', 'vegetarian');
});

Deno.test('rejects provider output that invents an inventory lot', async () => {
  const { handler } = setup({
    providerContent: JSON.stringify({ ...COOKING_RESULT, usedLots: ['lot-invented'] }),
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
});

Deno.test('rejects a provider model that differs from the allowlisted request', async () => {
  const { handler } = setup({ providerModel: 'google/gemma-4-31b-it' });
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
  const { handler, getContextReads } = setup({ providerContent: JSON.stringify(capture) });
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
  assertEquals(await response.json(), { error: 'capture_evidence_not_grounded' });
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
