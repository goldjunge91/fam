import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

import {
  COOKING_SUGGESTION_RESPONSE_FORMAT,
  createCookingSuggestionResponseFormat,
  createOpenRouterChatBody,
  INVENTORY_CAPTURE_RESPONSE_FORMAT,
  parseOpenRouterChatCompletion,
} from './openrouter-request.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';

const COOKING_CONTEXT: RecipeSuggestionContext = {
  schema_version: 1,
  request: { type: 'recipe_suggestion', servings: 2 },
  constraints: {
    allergies: [],
    preferences: [],
    allowed_staples: ['Olivenöl'],
    forbidden_ingredients: [],
  },
  priority_foods: [
    {
      inventory_item_id: 'inventory-1',
      name: 'Tomaten',
      available_quantity: 2,
      unit: 'Stück',
      priority_score: 1,
    },
  ],
  planned_shopping_items: [
    {
      shopping_item_id: 'shopping-1',
      name: 'Parmesan',
      quantity: 1,
      unit: 'Packung',
    },
  ],
  candidate_recipes: [
    {
      id: 'catalog-1',
      source: 'catalog',
      title: 'Tomatenpfanne',
      ingredient_names: ['Tomaten'],
    },
    {
      id: 'template-1',
      source: 'template',
      title: 'Tomaten mit Parmesan',
      ingredient_names: ['Tomaten', 'Parmesan'],
    },
  ],
  shopping_question: null,
  fallback_allowed: false,
};

Deno.test('uses a strict closed JSON Schema for cooking suggestions', () => {
  const format = COOKING_SUGGESTION_RESPONSE_FORMAT;

  assertEquals(format.type, 'json_schema');
  assertEquals(format.json_schema.strict, true);
  assertEquals(format.json_schema.schema.additionalProperties, false);
  assertEquals(format.json_schema.schema.properties.meals.minItems, 1);
  assertEquals(format.json_schema.schema.properties.meals.maxItems, 3);
  assertEquals(format.json_schema.schema.properties.meals.items.additionalProperties, false);
  assertEquals(
    format.json_schema.schema.properties.meals.items.properties.additional_ingredients.maxItems,
    2,
  );
});

Deno.test('constrains cooking output to recipe, inventory, and shopping context', () => {
  const format = createCookingSuggestionResponseFormat(COOKING_CONTEXT);
  const meal = format.json_schema.schema.properties.meals.items;
  const body = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
    skill: 'fam-cook-from-inventory',
    recipeSuggestionContext: COOKING_CONTEXT,
  });

  assertEquals(body.response_format, format);
  assertEquals(meal.properties.recipe_id, {
    type: 'string',
    enum: ['catalog-1', 'template-1'],
  });
  assertEquals(meal.properties.source, {
    type: 'string',
    enum: ['catalog', 'template'],
  });
  assertEquals(
    meal.properties.used_items.items.properties.inventory_item_id,
    { type: 'string', enum: ['inventory-1'] },
  );
  assertEquals(meal.properties.additional_ingredients.items, {
    type: 'string',
    enum: ['Olivenöl', 'Parmesan'],
  });
});

Deno.test('allows model-generated meals only when no candidate recipe exists', () => {
  const context: RecipeSuggestionContext = {
    ...COOKING_CONTEXT,
    constraints: { ...COOKING_CONTEXT.constraints, allowed_staples: [] },
    planned_shopping_items: [],
    candidate_recipes: [],
    fallback_allowed: true,
  };
  const meal = createCookingSuggestionResponseFormat(context).json_schema.schema.properties.meals
    .items;

  assertEquals(meal.properties.source, {
    type: 'string',
    const: 'model_generated',
  });
  assertEquals(meal.properties.recipe_id, { type: 'null' });
  assertEquals(meal.properties.additional_ingredients.maxItems, 0);
});

Deno.test('keeps inventory capture on its existing strict proposal contract', () => {
  const format = INVENTORY_CAPTURE_RESPONSE_FORMAT;

  assertEquals(format.type, 'json_schema');
  assertEquals(format.json_schema.strict, true);
  assertEquals(format.json_schema.name, 'inventory_capture_proposal_v1');
  assertEquals(format.json_schema.schema.additionalProperties, false);
  assertEquals(
    format.json_schema.schema.properties.kind.const,
    'inventory_capture_proposal.v1',
  );
  assertEquals(format.json_schema.schema.properties.items.items.additionalProperties, false);
  assert(format.json_schema.schema.required.includes('items'));
  assert(format.json_schema.schema.required.includes('questions'));
  assert(format.json_schema.schema.required.includes('warnings'));
});

Deno.test('selects the response contract from the requested skill', () => {
  assertEquals(
    createOpenRouterChatBody({
      model: 'z-ai/glm-5.3-flash',
      messages: [],
      skill: 'fam-cook-from-inventory',
    }).response_format,
    COOKING_SUGGESTION_RESPONSE_FORMAT,
  );
  assertEquals(
    createOpenRouterChatBody({
      model: 'z-ai/glm-5.3-flash',
      messages: [],
      skill: 'fam-inventory-capture',
    }).response_format,
    INVENTORY_CAPTURE_RESPONSE_FORMAT,
  );
});

Deno.test('uses JSON mode for Gemma free models while keeping routing constrained', () => {
  for (
    const model of [
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
    ]
  ) {
    const cookingBody = createOpenRouterChatBody({ model, messages: [] });
    const captureBody = createOpenRouterChatBody({
      model,
      messages: [],
      skill: 'fam-inventory-capture',
    });

    assertEquals(
      JSON.stringify(cookingBody.response_format),
      JSON.stringify({ type: 'json_object' }),
    );
    assertEquals(
      JSON.stringify(captureBody.response_format),
      JSON.stringify({ type: 'json_object' }),
    );
    assertEquals(cookingBody.provider, { require_parameters: true });
  }
});

Deno.test('uses strict response schemas for the Xing free model', () => {
  const cookingBody = createOpenRouterChatBody({
    model: 'xingchen-agi/xing4.0-29b-a4b:free',
    messages: [],
  });
  const captureBody = createOpenRouterChatBody({
    model: 'xingchen-agi/xing4.0-29b-a4b:free',
    messages: [],
    skill: 'fam-inventory-capture',
  });

  assertEquals(cookingBody.response_format, COOKING_SUGGESTION_RESPONSE_FORMAT);
  assertEquals(cookingBody.provider, { require_parameters: true });
  assertEquals(captureBody.response_format, INVENTORY_CAPTURE_RESPONSE_FORMAT);
});

Deno.test('keeps strict schema output for models with schema-capable providers', () => {
  const body = createOpenRouterChatBody({
    model: 'google/gemma-4-31b-it',
    messages: [],
  });

  assertEquals(body.response_format, COOKING_SUGGESTION_RESPONSE_FORMAT);
});

Deno.test('requires provider support for every requested parameter', () => {
  const body = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
  });

  assertEquals(body.provider, { require_parameters: true });
});

Deno.test('builds a deterministic body without credentials or caller identifiers', () => {
  const messages = [
    { role: 'system' as const, content: 'system' },
    { role: 'user' as const, content: 'user' },
  ];
  const body = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages,
  });

  assertEquals(body.model, 'z-ai/glm-5.3-flash');
  assertEquals(body.max_tokens, 4_096);
  assertEquals(body.temperature, 0);
  assertEquals(body.messages, messages);
  assert(!Object.hasOwn(body, 'apiKey'));
  assert(!Object.hasOwn(body, 'householdId'));
  assert(!Object.hasOwn(body, 'userId'));
});

Deno.test('applies model-specific reasoning settings', () => {
  const granite = createOpenRouterChatBody({
    model: 'ibm-granite/granite-4.2-8b',
    messages: [],
  });
  const glm = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
  });
  const gemma = createOpenRouterChatBody({
    model: 'google/gemma-4-26b-a4b-it',
    messages: [],
  });

  assertEquals(granite.reasoning, { enabled: false });
  assertEquals(glm.reasoning, { effort: 'low' });
  assert(!Object.hasOwn(gemma, 'reasoning'));
});

Deno.test('allows bounded call-specific generation overrides', () => {
  const body = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
    maxTokens: 2_048,
    temperature: 0.2,
  });

  assertEquals(body.max_tokens, 2_048);
  assertEquals(body.temperature, 0.2);
});

Deno.test('reads the actual model from a chat completion response', () => {
  assertEquals(
    parseOpenRouterChatCompletion({
      model: 'provider/actual-model',
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { total_tokens: 12 },
    }),
    {
      ok: true,
      content: '{"ok":true}',
      model: 'provider/actual-model',
      usage: { total_tokens: 12 },
    },
  );
});

Deno.test('rejects chat completion responses without an actual model', () => {
  assertEquals(
    parseOpenRouterChatCompletion({
      choices: [{ message: { content: '{"ok":true}' } }],
    }),
    { ok: false, error: 'provider_model_missing' },
  );
  assertEquals(
    parseOpenRouterChatCompletion({
      model: '   ',
      choices: [{ message: { content: '{"ok":true}' } }],
    }),
    { ok: false, error: 'provider_model_missing' },
  );
});

Deno.test('rejects chat completion responses without content', () => {
  assertEquals(
    parseOpenRouterChatCompletion({ model: 'provider/model', choices: [] }),
    { ok: false, error: 'provider_empty_response' },
  );
});

Deno.test('rejects generation overrides outside the gateway budget', () => {
  const base = { model: 'z-ai/glm-5.3-flash', messages: [] };

  assertThrows(() => createOpenRouterChatBody({ ...base, maxTokens: 0 }), RangeError);
  assertThrows(() => createOpenRouterChatBody({ ...base, maxTokens: 8_193 }), RangeError);
  assertThrows(() => createOpenRouterChatBody({ ...base, temperature: -0.1 }), RangeError);
  assertThrows(() => createOpenRouterChatBody({ ...base, temperature: 2.1 }), RangeError);
});
