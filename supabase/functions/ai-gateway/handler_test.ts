import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  createAiGatewayHandler,
  ALLOWED_MODELS,
  GROQ_ALLOWED_MODELS,
  type GatewayProvider,
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

const RECIPE_IMPORT_RESULT = {
  kind: 'recipe_import_draft.v1',
  title: 'Linsensuppe',
  servings: 4,
  ingredients: [{ text: '200 g Linsen', confidence: 'high' }],
  steps: ['Linsen weich kochen.'],
  notes: null,
  warnings: [],
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
    providerToolCalls?: Array<{ id: string; name: string; arguments: string }>;
    context?: GatewayCookingContext;
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
    recipePage?:
      | { ok: true; text: string; draft: unknown }
      | { ok: false; status: number; error: string };
    publicUrlAllowed?: boolean;
    modelTestingEnabled?: boolean;
    modelOverridesEnabled?: boolean;
  } = {},
) {
  const calls: Array<{
    model: string;
    provider: GatewayProvider | undefined;
    responseFormat: 'json_object' | null | undefined;
    system: string;
    user: string;
    transcript: string;
  }> = [];
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
      return Promise.resolve({ ok: true as const, context: options.context ?? CONTEXT });
    },
    ...(options.recipePage === undefined
      ? {}
      : { loadRecipePage: () => Promise.resolve(options.recipePage!) }),
    ...(options.publicUrlAllowed === undefined
      ? {}
      : { validatePublicUrl: () => Promise.resolve(options.publicUrlAllowed!) }),
    complete: ({ provider, model, messages, responseFormat }) => {
      const contentAsText = (content: unknown) =>
        typeof content === 'string' ? content : JSON.stringify(content ?? '');
      const callIndex = calls.length;
      calls.push({
        model,
        provider,
        responseFormat,
        system: contentAsText(messages[0]?.content),
        user: contentAsText(messages[1]?.content),
        transcript: messages.map((message) => contentAsText(message.content)).join('\n'),
      });
      if (options.providerThrows) throw new Error('provider failed');
      if (options.providerFailed) {
        return Promise.resolve({
          ok: false as const,
          status: 502,
          error: 'provider_unavailable',
        });
      }
      if (callIndex === 0 && options.providerToolCalls) {
        return Promise.resolve({
          ok: true as const,
          content: null,
          toolCalls: options.providerToolCalls,
          model: options.providerModel ?? model,
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
    defaultProvider: 'openrouter',
    providerModels: { openrouter: ALLOWED_MODELS, groq: GROQ_ALLOWED_MODELS },
    providerDefaultModels: {
      openrouter: 'z-ai/glm-5.3-flash',
      groq: 'qwen/qwen3.8-27b',
    },
    modelOverridesEnabled: options.modelOverridesEnabled ?? false,
    modelTestingEnabled: options.modelTestingEnabled ?? false,
    modelTestModels: { openrouter: ALLOWED_MODELS, groq: GROQ_ALLOWED_MODELS },
    mediaFallback: { provider: 'openrouter', model: 'qwen/qwen3.8-flash' },
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

Deno.test('model test endpoint is local-only, allowlisted, and does not bill household credits', async () => {
  const payload = {
    skill: 'fam-ai-model-test',
    householdId: 'household-1',
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    prompt: 'Gib mir eine kurze Linsengericht-Idee.',
  };
  const disabled = setup();
  const disabledResponse = await disabled.handler(request(payload));
  assertEquals(disabledResponse.status, 403);
  assertEquals(await disabledResponse.json(), { error: 'model_testing_unavailable' });
  assertEquals(disabled.calls, []);
  assertEquals(disabled.bookings, []);

  const enabled = setup({ modelTestingEnabled: true });
  const response = await enabled.handler(request(payload));
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.skill, 'fam-ai-model-test');
  assertEquals(body.provider, 'groq');
  assertEquals(body.model, 'qwen/qwen3.8-27b');
  assertEquals(body.text, JSON.stringify(COOKING_RESULT));
  assertEquals(enabled.calls[0]?.provider, 'groq');
  assertEquals(enabled.calls[0]?.responseFormat, null);
  assertEquals(enabled.bookings, []);
  assertEquals(enabled.getContextReads(), 0);
});

Deno.test('Groq free chat models are available to the local model tester', async () => {
  for (const model of GROQ_ALLOWED_MODELS) {
    const { handler } = setup({ modelTestingEnabled: true });
    const response = await handler(request({
      skill: 'fam-ai-model-test',
      householdId: 'household-1',
      provider: 'groq',
      model,
      prompt: 'Antworte kurz auf Deutsch.',
    }));

    assertEquals(response.status, 200, `Expected ${model} to be allowlisted`);
  }
});

Deno.test('applies the local provider and model selection to the regular assistant flow', async () => {
  const assistantOutput = {
    kind: 'assistant_reply.v1',
    text: 'Eine schnelle Linsenpfanne.',
    suggestions: [],
  };
  const { handler, calls, bookings } = setup({
    modelOverridesEnabled: true,
    providerContent: JSON.stringify(assistantOutput),
  });
  const response = await handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    message: 'Was kann ich kochen?',
    history: [],
    includeHouseholdContext: false,
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
  }));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.provider, 'groq');
  assertEquals(body.model, 'openai/gpt-oss-120b');
  assertEquals(calls[0]?.provider, 'groq');
  assertEquals(calls[0]?.model, 'openai/gpt-oss-120b');
  assertEquals(bookings.length, 1);
});

Deno.test('uses OpenRouter media fallback for Groq sources the selected model cannot accept', async () => {
  const { handler, calls } = setup({
    modelOverridesEnabled: true,
    providerContent: JSON.stringify(RECIPE_IMPORT_RESULT),
  });
  const response = await handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'pdf',
    attachments: [{ filename: 'recipe.pdf', mimeType: 'application/pdf', data: 'aGVsbG8=' }],
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
  }));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.provider, 'openrouter');
  assertEquals(body.model, 'qwen/qwen3.8-flash');
  assertEquals(calls[0]?.provider, 'openrouter');
  assertEquals(calls[0]?.model, 'qwen/qwen3.8-flash');
});

Deno.test('rejects provider and model overrides outside the local developer gateway', async () => {
  const { handler, calls, bookings } = setup();
  const response = await handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    message: 'Was kann ich kochen?',
    history: [],
    includeHouseholdContext: false,
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
  }));

  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: 'model_override_unavailable' });
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('recipe import validates text, links, and attachment metadata before billing', async () => {
  const { handler, calls, bookings } = setup();
  const base = {
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
  };
  const validAttachment = {
    filename: 'recipe.jpg',
    mimeType: 'image/jpeg',
    data: 'aGVsbG8=',
  };
  const invalidRequests = [
    { ...base, sourceType: 'text' },
    { ...base, sourceType: 'text', sourceText: ' ' },
    { ...base, sourceType: 'text', sourceText: 'Rezept', sourceUrl: 'https://example.test' },
    { ...base, consentVersion: 'old', sourceType: 'text', sourceText: 'Rezept' },
    { ...base, sourceType: 'url' },
    { ...base, sourceType: 'url', sourceUrl: 'http://example.test' },
    { ...base, sourceType: 'url', sourceUrl: 'https://user:secret@example.test' },
    { ...base, sourceType: 'url', sourceUrl: 'https://example.test', sourceText: 'extra' },
    { ...base, sourceType: 'url', sourceUrl: 'not a URL' },
    { ...base, sourceType: 'image', attachments: [] },
    { ...base, sourceType: 'image', attachments: [null] },
    {
      ...base,
      sourceType: 'image',
      attachments: [{ ...validAttachment, filename: 'x'.repeat(101) }],
    },
    { ...base, sourceType: 'image', attachments: [{ ...validAttachment, data: 'not base64!' }] },
    { ...base, sourceType: 'image', attachments: [{ ...validAttachment, mimeType: 'image/gif' }] },
    { ...base, sourceType: 'image', attachments: [validAttachment], sourceText: 'not allowed' },
    {
      ...base,
      sourceType: 'image',
      attachments: Array.from({ length: 6 }, () => validAttachment),
    },
    {
      ...base,
      sourceType: 'image',
      attachments: [{ ...validAttachment, data: 'a'.repeat(8_000_001) }],
    },
    { ...base, sourceType: 'pdf', attachments: [validAttachment, validAttachment] },
    {
      ...base,
      sourceType: 'pdf',
      attachments: [{ ...validAttachment, mimeType: 'image/jpeg' }],
    },
    { ...base, sourceType: 'unknown', sourceText: 'Rezept' },
    { ...base, sourceType: 'text', sourceText: 'a'.repeat(50_001) },
  ];

  for (const payload of invalidRequests) {
    const response = await handler(request(payload));
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error, 'invalid_request');
  }
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('imports recipe text and sends a source-grounded recipe prompt', async () => {
  const { handler, calls, bookings } = setup({
    providerContent: JSON.stringify(RECIPE_IMPORT_RESULT),
  });
  const response = await handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'text',
    sourceText: '  Linsen weich kochen.  ',
    model: ' z-ai/glm-5.3-flash ',
  }));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.source, 'ai');
  assertEquals(body.result, RECIPE_IMPORT_RESULT);
  assertEquals(bookings[0]?.action, 'recipe');
  assertStringIncludes(calls[0]?.system ?? '', 'Erfinde keine Mengen');
  assertStringIncludes(calls[0]?.user ?? '', 'Linsen weich kochen.');
});

Deno.test('imports PDF and image attachments as media content parts', async () => {
  const { handler, calls } = setup({
    providerContent: JSON.stringify(RECIPE_IMPORT_RESULT),
  });
  for (
    const [sourceType, mimeType, contentType] of [
      ['pdf', 'application/pdf', 'file'],
      ['image', 'image/png', 'image_url'],
    ] as const
  ) {
    const response = await handler(request({
      skill: 'fam-recipe-import',
      householdId: 'household-1',
      consentVersion: 'fam-ai-v2',
      sourceType,
      attachments: [{ filename: 'seite.png', mimeType, data: 'cGFnZQ==' }],
    }));
    assertEquals(response.status, 200);
    assertStringIncludes(calls.at(-1)?.transcript ?? '', contentType);
  }
});

Deno.test('reads structured URL imports first and falls back to safe page text', async () => {
  const structured = setup({
    recipePage: { ok: true, text: 'Rezept', draft: RECIPE_IMPORT_RESULT },
  });
  const structuredResponse = await structured.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'url',
    sourceUrl: 'https://example.test/recipe',
  }));
  assertEquals(structuredResponse.status, 200);
  assertEquals((await structuredResponse.json()).source, 'structured');
  assertEquals(structured.bookings, []);
  assertEquals(structured.calls, []);

  const extracted = setup({
    providerContent: JSON.stringify(RECIPE_IMPORT_RESULT),
    recipePage: { ok: true, text: 'Mehl und Wasser vermischen.', draft: null },
  });
  const extractedResponse = await extracted.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'url',
    sourceUrl: 'https://example.test/recipe',
  }));
  assertEquals(extractedResponse.status, 200);
  assertStringIncludes(extracted.calls[0]?.user ?? '', 'Mehl und Wasser vermischen.');
});

Deno.test('handles failed and empty recipe pages and validates video source URLs', async () => {
  const unavailablePage = setup({
    recipePage: { ok: false, status: 502, error: 'source_unavailable' },
  });
  const pageFailure = await unavailablePage.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'url',
    sourceUrl: 'https://example.test/recipe',
  }));
  assertEquals(pageFailure.status, 502);

  const emptyPage = setup({ recipePage: { ok: true, text: '  ', draft: null } });
  const noText = await emptyPage.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'url',
    sourceUrl: 'https://example.test/recipe',
  }));
  assertEquals(noText.status, 422);

  const unsafeVideo = setup();
  const rejectedVideo = await unsafeVideo.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'video',
    sourceUrl: 'https://video.example/reel',
  }));
  assertEquals(rejectedVideo.status, 400);

  const video = setup({
    publicUrlAllowed: true,
    providerContent: JSON.stringify(RECIPE_IMPORT_RESULT),
  });
  const importedVideo = await video.handler(request({
    skill: 'fam-recipe-import',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    sourceType: 'video',
    sourceUrl: 'https://video.example/reel',
  }));
  assertEquals(importedVideo.status, 200);
  assertStringIncludes(video.calls[0]?.transcript ?? '', 'video_url');
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

Deno.test('cooking rejects allergen rules when recipes have no current reviewed projection', async () => {
  const { handler, calls, bookings } = setup();
  const response = await handler(request({
    skill: 'fam-cook-from-inventory',
    householdId: 'household-1',
    userText: 'Was kann ich kochen?',
    servings: null,
    maxMinutes: null,
    dietaryPattern: null,
    allergies: ['peanuts'],
  }));

  assertEquals(response.status, 422);
  assertEquals(await response.json(), { error: 'no_safe_recipe' });
  assertEquals(calls, []);
  assertEquals(bookings, []);
});

Deno.test('cooking accepts a recipe only when the projection covers the exact active allergy set', async () => {
  const { handler, calls } = setup({
    context: {
      ...CONTEXT,
      recipes: [{
        ...CONTEXT.recipes[0]!,
        allergenProjection: {
          status: 'clear',
          allergenIds: ['EU_05_PEANUTS'],
          conflictingAllergenIds: [],
          unknownAllergenIds: [],
          rulesUpdatedAt: null,
          knowledgeVersion: 'v1',
        },
      }],
    },
  });
  const response = await handler(request({
    skill: 'fam-cook-from-inventory',
    householdId: 'household-1',
    userText: 'Was kann ich kochen?',
    servings: null,
    maxMinutes: null,
    dietaryPattern: null,
    allergies: ['peanuts'],
  }));

  assertEquals(response.status, 200);
  assertEquals(calls.length, 1);
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

Deno.test('keeps plain-text assistant output readable when the model misses its JSON envelope', async () => {
  const { handler } = setup({ providerContent: 'Eine schnelle Gemüsepfanne mit Reis.' });
  const response = await handler(
    request({
      skill: 'fam-assistant',
      householdId: 'household-1',
      consentVersion: 'fam-ai-v2',
      message: 'Nenne eine einfache Idee fürs Abendessen.',
      history: [],
      includeHouseholdContext: false,
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.result, {
    kind: 'assistant_reply.v1',
    text: 'Eine schnelle Gemüsepfanne mit Reis.',
    suggestions: [],
    proposals: [],
    toolTrace: [],
  });
});

Deno.test('assistant includes pantry stock and searches the catalog when household recipes are empty', async () => {
  const context: GatewayCookingContext = {
    ...CONTEXT,
    householdRecipes: [],
    inventory: {
      ...CONTEXT.inventory,
      lots: [
        ...CONTEXT.inventory.lots,
        {
          lotId: 'lot-rice',
          productId: null,
          normalizedName: 'Reis',
          quantity: 500,
          unit: 'g',
          bestBefore: null,
          useBy: null,
          storage: 'pantry',
        },
      ],
    },
  };
  const { handler, calls } = setup({
    context,
    providerToolCalls: [
      { id: 'inventory-call', name: 'get_inventory', arguments: '{}' },
      { id: 'recipe-call', name: 'search_recipes', arguments: '{"query":"Tomate"}' },
    ],
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Mit Tomate und Reis kannst du eine einfache Tomaten-Reis-Pfanne machen.',
      suggestions: [],
    }),
  });
  const response = await handler(
    request({
      skill: 'fam-assistant',
      householdId: 'household-1',
      consentVersion: 'fam-ai-v2',
      message: 'Was kann ich heute essen?',
      history: [],
      includeHouseholdContext: true,
    }),
  );

  assertEquals(response.status, 200);
  assertStringIncludes(calls[0].system, 'Beginne mit einer konkreten Idee');
  assertStringIncludes(calls[0].system, '"foodRuleStatus":"clear"');
  assertStringIncludes(calls[0].system, 'Reis');
  assertStringIncludes(calls[0].system, 'Tomatenpfanne');
  assertStringIncludes(calls[1].transcript, 'Reis');
  assertStringIncludes(calls[1].transcript, 'Tomatenpfanne');
  const body = await response.json();
  assertEquals(body.result.toolTrace, ['get_inventory', 'search_recipes']);
});

Deno.test('assistant blocks meal proposals when current allergy coverage is unknown', async () => {
  const context: GatewayCookingContext = {
    ...CONTEXT,
    foodRules: {
      allergies: ['Erdnüsse'],
      allergyCodes: ['peanuts'],
      intolerances: [],
      avoidFoods: [],
      updatedAt: '2026-11-08T10:00:00.000Z',
    },
  };
  const { handler, calls } = setup({
    context,
    providerToolCalls: [{
      id: 'meal-plan-call',
      name: 'propose_meal_plan',
      arguments: JSON.stringify({
        meals: [{
          date: '2026-11-09',
          mealSlot: 'dinner',
          recipeId: 'recipe-1',
          portions: 2,
          rationale: 'Passt zum Abend.',
        }],
      }),
    }],
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Ich kann dieses Rezept mit deinen Regeln noch nicht sicher abgleichen.',
      suggestions: [],
    }),
  });
  const response = await handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    message: 'Plane Abendessen.',
    history: [],
    includeHouseholdContext: true,
  }));

  assertEquals(response.status, 200);
  assertStringIncludes(calls[0]?.system ?? '', '"foodRuleStatus":"unknown"');
  assertStringIncludes(calls[1]?.transcript ?? '', 'recipe_food_rules_blocked');
  const body = await response.json();
  assertEquals(body.result.proposals, []);
});

Deno.test('assistant does not send custom private labels to the model and reports unsupported search coverage', async () => {
  const privateLabel = 'Meine sehr private Allergie';
  const context: GatewayCookingContext = {
    ...CONTEXT,
    foodRules: {
      allergies: [privateLabel],
      allergyCodes: [],
      customAllergies: [privateLabel],
      intolerances: [],
      intoleranceCodes: [],
      customIntolerances: [],
      avoidFoods: [],
      dislikedFoods: [],
      updatedAt: '2026-11-08T10:00:00.000Z',
    },
  };
  const { handler, calls } = setup({
    context,
    providerToolCalls: [{
      id: 'recipe-search',
      name: 'search_recipes',
      arguments: '{"query":"Tomate"}',
    }],
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Ich kann gespeicherte Rezepte mit den Regeln nicht vollständig abgleichen.',
      suggestions: [],
    }),
  });
  const response = await handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    message: 'Was kann ich kochen?',
    history: [],
    includeHouseholdContext: true,
  }));

  assertEquals(response.status, 200);
  assertEquals(calls[0]?.system.includes(privateLabel), false);
  assertEquals(calls[1]?.transcript.includes(privateLabel), false);
  assertStringIncludes(calls[0]?.system ?? '', '"foodRuleStatus":"unsupported"');
  assertStringIncludes(calls[1]?.transcript ?? '', '"blockedByFoodRules":true');
  assertStringIncludes(calls[1]?.transcript ?? '', '"foodRuleStatus":"unsupported"');
});

Deno.test('assistant keeps lactose intolerance unsupported even when milk allergy evidence is clear', async () => {
  const context: GatewayCookingContext = {
    ...CONTEXT,
    foodRules: {
      allergies: [],
      allergyCodes: [],
      customAllergies: [],
      intolerances: ['Laktose'],
      intoleranceCodes: ['lactose'],
      customIntolerances: [],
      avoidFoods: [],
      dislikedFoods: [],
      updatedAt: '2026-11-08T10:00:00.000Z',
    },
    householdRecipes: [{
      ...CONTEXT.recipes[0]!,
      updatedAt: '2026-11-08T10:00:00.000Z',
      allergenProjection: {
        status: 'clear',
        allergenIds: ['EU_07_MILK'],
        conflictingAllergenIds: [],
        unknownAllergenIds: [],
        rulesUpdatedAt: '2026-11-08T10:00:00.000Z',
        knowledgeVersion: 'allergen-knowledge-v3',
      },
    }],
  };
  const { handler, calls } = setup({
    context,
    providerToolCalls: [{
      id: 'meal-plan-call',
      name: 'propose_meal_plan',
      arguments: JSON.stringify({
        meals: [{
          date: '2026-11-09',
          mealSlot: 'dinner',
          recipeId: 'recipe-1',
          portions: 2,
          rationale: 'Passt zum Abend.',
        }],
      }),
    }],
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Ich kann den Plan mit den hinterlegten Regeln nicht vollständig prüfen.',
      suggestions: [],
    }),
  });
  const response = await handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    message: 'Plane Abendessen.',
    history: [],
    includeHouseholdContext: true,
  }));

  assertEquals(response.status, 200);
  assertEquals(calls[0]?.system.includes('Laktose'), false);
  assertStringIncludes(calls[1]?.transcript ?? '', '"foodRuleStatus":"unsupported"');
  assertEquals((await response.json()).result.proposals, []);
});

Deno.test('assistant asks for usable context instead of suggesting a meal when rules are active and data is empty', async () => {
  const privateLabel = 'Private individuelle Allergie';
  const context: GatewayCookingContext = {
    ...CONTEXT,
    inventory: { ...CONTEXT.inventory, lots: [] },
    recipes: [],
    householdRecipes: [],
    foodRules: {
      allergies: [privateLabel],
      allergyCodes: [],
      customAllergies: [privateLabel],
      intolerances: [],
      intoleranceCodes: [],
      customIntolerances: [],
      avoidFoods: [],
      dislikedFoods: [],
      updatedAt: '2026-11-08T10:00:00.000Z',
    },
  };
  const { handler, calls } = setup({
    context,
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text:
        'Ich habe gerade keinen Bestand oder ein Rezept zum Abgleich. Nenne mir konkrete Zutaten oder füge ein Rezept hinzu.',
      suggestions: [],
    }),
  });
  const response = await handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    message: 'Was kann ich heute essen?',
    history: [],
    includeHouseholdContext: true,
  }));

  assertEquals(response.status, 200);
  assertStringIncludes(
    calls[0]?.system ?? '',
    '"foodRules":{"active":true,"coverageStatus":"unknown"}',
  );
  assertStringIncludes(
    calls[0]?.system ?? '',
    'Bei aktiven Regeln ohne clear-Abgleich nenne keine konkrete Zutaten- oder Rezeptempfehlung.',
  );
  assertEquals(calls[0]?.system.includes(privateLabel), false);
  assertEquals(
    (await response.json()).result.text,
    'Ich habe gerade keinen Bestand oder ein Rezept zum Abgleich. Nenne mir konkrete Zutaten oder füge ein Rezept hinzu.',
  );
});

Deno.test('meal proposals carry the rule and evidence versions used by coverage', async () => {
  const rulesUpdatedAt = '2026-11-08T10:00:00.000Z';
  const recipeUpdatedAt = '2026-11-08T09:30:00.000Z';
  const context: GatewayCookingContext = {
    ...CONTEXT,
    foodRules: {
      allergies: ['Erdnüsse'],
      allergyCodes: ['peanuts'],
      intolerances: [],
      avoidFoods: [],
      updatedAt: rulesUpdatedAt,
    },
    householdRecipes: [{
      ...CONTEXT.recipes[0]!,
      updatedAt: recipeUpdatedAt,
      allergenProjection: {
        status: 'clear',
        allergenIds: ['EU_05_PEANUTS'],
        conflictingAllergenIds: [],
        unknownAllergenIds: [],
        rulesUpdatedAt,
        knowledgeVersion: 'allergen-knowledge-v3',
      },
    }],
  };
  const { handler } = setup({
    context,
    providerToolCalls: [{
      id: 'meal-plan-call',
      name: 'propose_meal_plan',
      arguments: JSON.stringify({
        meals: [{
          date: '2026-11-09',
          mealSlot: 'dinner',
          recipeId: 'recipe-1',
          portions: 2,
          rationale: 'Passt zum Abend.',
        }],
      }),
    }],
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Der Vorschlag ist bereit zur Prüfung.',
      suggestions: [],
    }),
  });
  const response = await handler(request({
    skill: 'fam-assistant',
    householdId: 'household-1',
    consentVersion: 'fam-ai-v2',
    message: 'Plane Abendessen.',
    history: [],
    includeHouseholdContext: true,
  }));

  assertEquals(response.status, 200);
  const proposal = (await response.json()).result.proposals[0];
  assertEquals(proposal.foodRuleCoverage.status, 'clear');
  assertEquals(proposal.foodRuleCoverage.rulesUpdatedAt, rulesUpdatedAt);
  assertEquals(proposal.foodRuleCoverage.recipeVersions[0].recipeUpdatedAt, recipeUpdatedAt);
  assertStringIncludes(proposal.foodRuleCoverage.recipeVersions[0].coverageVersion, rulesUpdatedAt);
});

Deno.test('validates proposal evidence without an AI entitlement, provider call, or credit', async () => {
  const recipeUpdatedAt = '2026-11-08T09:30:00.000Z';
  const context: GatewayCookingContext = {
    ...CONTEXT,
    recipes: [{ ...CONTEXT.recipes[0]!, updatedAt: recipeUpdatedAt }],
  };
  const { handler, bookings, calls, getContextReads } = setup({
    context,
    entitlementAllowed: false,
  });
  const response = await handler(request({
    skill: 'fam-assistant-proposal-validation',
    householdId: 'household-1',
    foodRulesUpdatedAt: null,
    coverageRulesUpdatedAt: null,
    recipeIds: ['recipe-1'],
    recipeVersions: [{
      recipeId: 'recipe-1',
      recipeUpdatedAt,
      coverageVersion: JSON.stringify({
        rulesUpdatedAt: null,
        knowledgeVersion: null,
        ingredientMappingVersion: null,
        aliasSourceVersions: [],
      }),
    }],
  }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    skill: 'fam-assistant-proposal-validation',
    valid: true,
  });
  assertEquals(getContextReads(), 1);
  assertEquals(bookings, []);
  assertEquals(calls, []);
});

Deno.test('rejects a proposal when private food-rule version changed', async () => {
  const { handler, bookings, calls } = setup({
    context: {
      ...CONTEXT,
      foodRules: {
        allergies: [],
        intolerances: [],
        avoidFoods: [],
        updatedAt: '2026-11-08T10:00:00.000Z',
      },
    },
  });
  const response = await handler(request({
    skill: 'fam-assistant-proposal-validation',
    householdId: 'household-1',
    foodRulesUpdatedAt: null,
    coverageRulesUpdatedAt: null,
    recipeIds: ['recipe-1'],
    recipeVersions: [{
      recipeId: 'recipe-1',
      recipeUpdatedAt: '2026-11-08T09:30:00.000Z',
      coverageVersion: 'old-evidence',
    }],
  }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    skill: 'fam-assistant-proposal-validation',
    valid: false,
    reason: 'food_rules_changed',
  });
  assertEquals(bookings, []);
  assertEquals(calls, []);
});

Deno.test('rejects a proposal when current ingredient-mapping evidence changed', async () => {
  const recipeUpdatedAt = '2026-11-08T09:30:00.000Z';
  const context: GatewayCookingContext = {
    ...CONTEXT,
    recipes: [{
      ...CONTEXT.recipes[0]!,
      updatedAt: recipeUpdatedAt,
      ingredientMappingVersion: 'current-mapping-v2',
    }],
  };
  const { handler } = setup({ context });
  const response = await handler(request({
    skill: 'fam-assistant-proposal-validation',
    householdId: 'household-1',
    foodRulesUpdatedAt: null,
    coverageRulesUpdatedAt: null,
    recipeIds: ['recipe-1'],
    recipeVersions: [{
      recipeId: 'recipe-1',
      recipeUpdatedAt,
      coverageVersion: JSON.stringify({
        rulesUpdatedAt: null,
        knowledgeVersion: null,
        ingredientMappingVersion: null,
        aliasSourceVersions: [],
      }),
    }],
  }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    skill: 'fam-assistant-proposal-validation',
    valid: false,
    reason: 'recipe_evidence_changed',
  });
});

Deno.test('assistant prompt uses available stock directly when no saved or catalog recipes exist', async () => {
  const context: GatewayCookingContext = {
    ...CONTEXT,
    recipes: [],
    householdRecipes: [],
  };
  const { handler, calls } = setup({
    context,
    providerToolCalls: [
      { id: 'inventory-call', name: 'get_inventory', arguments: '{}' },
      { id: 'recipe-call', name: 'search_recipes', arguments: '{"query":"Abendessen"}' },
    ],
    providerContent: JSON.stringify({
      kind: 'assistant_reply.v1',
      text: 'Mit deiner Tomate kannst du eine schnelle Tomatenpfanne zubereiten.',
      suggestions: [],
    }),
  });
  const response = await handler(
    request({
      skill: 'fam-assistant',
      householdId: 'household-1',
      consentVersion: 'fam-ai-v2',
      message: 'Was kann ich heute essen?',
      history: [],
      includeHouseholdContext: true,
    }),
  );

  assertEquals(response.status, 200);
  assertStringIncludes(calls[0].system, 'Wenn die Rezeptsuche leer ist');
  assertStringIncludes(calls[0].system, '"foodRules":{"active":false,"coverageStatus":"clear"}');
  assertStringIncludes(calls[1].transcript, 'Tomate');
  const body = await response.json();
  assertEquals(
    body.result.text,
    'Mit deiner Tomate kannst du eine schnelle Tomatenpfanne zubereiten.',
  );
  assertEquals(body.result.toolTrace, ['get_inventory', 'search_recipes']);
});
