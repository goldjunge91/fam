import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  createAiGatewayHandler,
  type GatewayCookingContext,
  type GatewayFoodRules,
  type ProviderMessage,
} from './handler.ts';

const VERSION_ONE = `hmac-sha256:${'1'.repeat(64)}`;
const VERSION_TWO = `hmac-sha256:${'2'.repeat(64)}`;
const EMPTY_RULES: GatewayFoodRules = {
  allergies: [],
  allergyCodes: [],
  customAllergies: [],
  intolerances: [],
  intoleranceCodes: [],
  customIntolerances: [],
  avoidFoods: [],
  dislikedFoods: [],
  updatedAt: VERSION_ONE,
};
const PRIVATE_RULES: GatewayFoodRules = {
  ...EMPTY_RULES,
  customAllergies: ['private child allergy'],
  dislikedFoods: ['private adult dislike'],
};

function request(body: unknown) {
  return new Request('http://localhost/ai-gateway', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function textContent(messages: ProviderMessage[]): string {
  return messages.map((message) =>
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  ).join('\n');
}

function setup(options: {
  snapshots?: Array<
    | { ok: true; foodRules: GatewayFoodRules }
    | { ok: false; status: number; error: string }
  >;
  providerContent?: string;
  context?: GatewayCookingContext;
  recipePage?: {
    ok: true;
    text: string;
    draft: unknown;
  };
} = {}) {
  const providerMessages: ProviderMessage[][] = [];
  const contextRules: GatewayFoodRules[] = [];
  const refunds: string[] = [];
  let ruleReads = 0;
  let bookings = 0;
  const snapshots = [...(options.snapshots ?? [{ ok: true, foodRules: EMPTY_RULES }])];
  const lastSnapshot = snapshots.at(-1) ?? { ok: true as const, foodRules: EMPTY_RULES };
  const handler = createAiGatewayHandler({
    authenticate: () =>
      Promise.resolve({
        ok: true as const,
        userId: '11111111-1111-4111-8111-111111111111',
        authorization: 'Bearer user-token',
      }),
    assertHouseholdMember: () =>
      Promise.resolve({
        ok: true as const,
        userId: '11111111-1111-4111-8111-111111111111',
        authorization: 'Bearer user-token',
      }),
    authorizeAiEntitlement: () =>
      Promise.resolve({ ok: true as const, subscriberUserId: 'subscriber-1' }),
    bookAiCredit: () => {
      bookings += 1;
      return Promise.resolve({ ok: true as const });
    },
    refundAiCredit: (_subscriberUserId, requestId) => {
      refunds.push(requestId);
      return Promise.resolve();
    },
    loadHouseholdFoodRules: () => {
      ruleReads += 1;
      return Promise.resolve(snapshots.shift() ?? lastSnapshot);
    },
    ...(options.recipePage ? { loadRecipePage: () => Promise.resolve(options.recipePage!) } : {}),
    loadCookingContext: (
      _householdId,
      _authorization,
      foodRules,
    ) => {
      contextRules.push(foodRules);
      const context: GatewayCookingContext = {
        ...(options.context ?? {
          inventory: { source: 'inventory', fetchedAt: UPDATED_AT, lots: [] },
          recipes: [],
          householdRecipes: [],
        }),
        foodRules,
      };
      return Promise.resolve({ ok: true as const, context });
    },
    complete: ({ model, messages }) => {
      providerMessages.push(messages);
      return Promise.resolve({
        ok: true as const,
        model,
        content: options.providerContent ?? JSON.stringify({
          kind: 'assistant_reply.v1',
          text: 'Ich brauche ein vollständig geprüftes Rezept.',
          suggestions: [],
        }),
      });
    },
    defaultModel: 'z-ai/glm-5.3-flash',
    defaultProvider: 'openrouter',
    allowedModels: ['z-ai/glm-5.3-flash'],
    now: () => UPDATED_AT,
    requestId: () => 'request-snapshot',
  });

  return {
    handler,
    providerMessages,
    contextRules,
    refunds,
    getRuleReads: () => ruleReads,
    getBookings: () => bookings,
  };
}

const UPDATED_AT = '2026-11-17T10:00:00.000Z';

Deno.test('blocks every food-generating surface when household rule coverage is incomplete', async () => {
  const requests = [
    {
      skill: 'fam-assistant',
      householdId: 'household-1',
      message: 'Was sollen wir essen?',
      history: [],
      includeHouseholdContext: false,
    },
    {
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    },
    {
      skill: 'fam-recipe-import',
      householdId: 'household-1',
      sourceType: 'text',
      sourceText: 'Suppe: Linsen kochen.',
    },
  ];

  for (const body of requests) {
    const test = setup({
      snapshots: [{ ok: false, status: 409, error: 'food_rule_snapshot_incomplete' }],
    });
    const response = await test.handler(request(body));
    assertEquals(response.status, 409);
    assertEquals(await response.json(), { error: 'food_rule_snapshot_incomplete' });
    assertEquals(test.providerMessages.length, 0);
    assertEquals(test.getBookings(), 0);
  }
});

Deno.test('loads safety rules without optional household context and sends no private labels or IDs', async () => {
  const test = setup({
    snapshots: [
      { ok: true, foodRules: PRIVATE_RULES },
      { ok: true, foodRules: PRIVATE_RULES },
    ],
  });
  const response = await test.handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    message: 'Nenne eine Essensidee.',
    history: [],
    includeHouseholdContext: false,
  }));

  assertEquals(response.status, 200);
  assertEquals(test.getRuleReads(), 2);
  assertEquals(test.contextRules, []);
  const transcript = textContent(test.providerMessages[0] ?? []);
  assertStringIncludes(transcript, '"foodRules":{"active":true,"coverageStatus":"unknown"}');
  assertEquals(transcript.includes('private child allergy'), false);
  assertEquals(transcript.includes('private adult dislike'), false);
  assertEquals(transcript.includes('11111111-1111-4111-8111-111111111111'), false);
  assertEquals(transcript.includes(VERSION_ONE), false);
});

Deno.test('passes the aggregate snapshot into cooking context', async () => {
  const test = setup({ snapshots: [{ ok: true, foodRules: PRIVATE_RULES }] });
  const response = await test.handler(request({
    skill: 'fam-cook-from-inventory',
    householdId: 'household-1',
    userText: 'Was kann ich kochen?',
    servings: null,
    maxMinutes: null,
    dietaryPattern: null,
    allergies: [],
  }));

  assertEquals(response.status, 422);
  assertEquals(await response.json(), { error: 'no_safe_recipe' });
  assertEquals(test.contextRules, [PRIVATE_RULES]);
  assertEquals(test.providerMessages.length, 0);
});

Deno.test('invalidates a generated answer when membership or rules change during the request', async () => {
  const test = setup({
    snapshots: [
      { ok: true, foodRules: EMPTY_RULES },
      { ok: true, foodRules: { ...EMPTY_RULES, updatedAt: VERSION_TWO } },
    ],
  });
  const response = await test.handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    message: 'Was sollen wir essen?',
    history: [],
    includeHouseholdContext: false,
  }));

  assertEquals(response.status, 409);
  assertEquals(await response.json(), { error: 'food_rule_snapshot_changed' });
  assertEquals(test.providerMessages.length, 1);
  assertEquals(test.refunds, ['request-snapshot']);
});

Deno.test('recipe import checks and revalidates coverage without sending private rules', async () => {
  const test = setup({
    snapshots: [
      { ok: true, foodRules: PRIVATE_RULES },
      { ok: true, foodRules: PRIVATE_RULES },
    ],
    providerContent: JSON.stringify({
      kind: 'recipe_import_draft.v1',
      title: 'Linsensuppe',
      servings: 4,
      ingredients: [{ name: 'Linsen', quantity: 200, unit: 'g', confidence: 'high' }],
      steps: ['Linsen kochen.'],
      notes: null,
      warnings: [],
    }),
  });
  const response = await test.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    sourceType: 'text',
    sourceText: 'Linsensuppe mit 200 g Linsen. Linsen kochen.',
  }));

  assertEquals(response.status, 200);
  assertEquals(test.getRuleReads(), 2);
  const transcript = textContent(test.providerMessages[0] ?? []);
  assertEquals(transcript.includes('private child allergy'), false);
  assertEquals(transcript.includes('private adult dislike'), false);
  assertEquals(transcript.includes(VERSION_ONE), false);
});

Deno.test('invalidates a structured recipe import when rules change during source loading', async () => {
  const test = setup({
    snapshots: [
      { ok: true, foodRules: EMPTY_RULES },
      { ok: true, foodRules: { ...EMPTY_RULES, updatedAt: VERSION_TWO } },
    ],
    recipePage: {
      ok: true,
      text: 'Linsensuppe mit 200 g Linsen. Linsen kochen.',
      draft: {
        kind: 'recipe_import_draft.v1',
        title: 'Linsensuppe',
        servings: 4,
        ingredients: [{ name: 'Linsen', quantity: 200, unit: 'g', confidence: 'high' }],
        steps: ['Linsen kochen.'],
        notes: null,
        warnings: [],
      },
    },
  });
  const response = await test.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    sourceType: 'url',
    sourceUrl: 'https://example.com/rezept',
  }));

  assertEquals(response.status, 409);
  assertEquals(await response.json(), { error: 'food_rule_snapshot_changed' });
  assertEquals(test.getRuleReads(), 2);
  assertEquals(test.providerMessages.length, 0);
  assertEquals(test.getBookings(), 0);
});

Deno.test('replaces an unverified provider food suggestion when household rules are active', async () => {
  const test = setup({
    snapshots: [
      { ok: true, foodRules: PRIVATE_RULES },
      { ok: true, foodRules: PRIVATE_RULES },
    ],
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Koche Erdnussnudeln.',
      suggestions: ['Soll ich noch ein Erdnussdessert vorschlagen?'],
    }),
  });
  const response = await test.handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    message: 'Was sollen wir essen?',
    history: [],
    includeHouseholdContext: false,
  }));
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(
    body.result.text,
    'Ich habe gerade keinen Bestand oder ein Rezept zum Abgleich. Nenne mir konkrete Zutaten oder füge ein Rezept hinzu.',
  );
  assertEquals(body.result.suggestions, []);
  assertEquals(JSON.stringify(body).includes('Erdnuss'), false);
});

Deno.test('does not endorse a named household recipe whose group coverage is blocked', async () => {
  const blockedRules: GatewayFoodRules = {
    ...EMPTY_RULES,
    allergyCodes: ['peanuts'],
  };
  const test = setup({
    snapshots: [
      { ok: true, foodRules: blockedRules },
      { ok: true, foodRules: blockedRules },
    ],
    context: {
      inventory: { source: 'inventory', fetchedAt: UPDATED_AT, lots: [] },
      recipes: [],
      householdRecipes: [{
        recipeId: 'blocked-recipe',
        title: 'Riskantes Rezept',
        source: 'household',
        updatedAt: UPDATED_AT,
        estimatedMinutes: 20,
        servings: 2,
        dietaryTags: [],
        allergens: null,
        ingredients: [{
          productId: null,
          normalizedName: 'Erdnüsse',
          quantity: 100,
          unit: 'g',
        }],
        ingredientDataComplete: true,
        allergenProjection: {
          status: 'conflict',
          allergenIds: ['EU_05_PEANUTS'],
          conflictingAllergenIds: ['EU_05_PEANUTS'],
          unknownAllergenIds: [],
          rulesUpdatedAt: VERSION_ONE,
          knowledgeVersion: 'knowledge-v1',
        },
      }],
    },
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Heute passt das Riskante Rezept.',
      suggestions: [],
    }),
  });
  const response = await test.handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    message: 'Was sollen wir essen?',
    history: [],
    includeHouseholdContext: true,
  }));
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.result.recipeReferences, []);
  assertEquals(body.result.text.includes('Riskantes Rezept'), false);
});
