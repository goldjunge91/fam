import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

import {
  COOKING_SUGGESTION_RESPONSE_FORMAT,
  createCookingSuggestionResponseFormat,
  createOpenRouterChatBody,
} from './openrouter-request.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';

const context: RecipeSuggestionContext = {
  schema_version: 1,
  request: { type: 'recipe_suggestion', servings: 2 },
  constraints: {
    allergies: [],
    preferences: [],
    allowed_staples: ['Olivenöl'],
    forbidden_ingredients: [],
  },
  priority_foods: [{
    inventory_item_id: 'inventory-1',
    name: 'Tomaten',
    available_quantity: 2,
    unit: 'piece',
    priority_score: 1,
  }],
  planned_shopping_items: [{
    shopping_item_id: 'shopping-1',
    name: 'Parmesan',
    quantity: 1,
    unit: 'package',
  }],
  candidate_recipes: [{
    id: 'catalog-1',
    source: 'catalog',
    title: 'Tomatenpfanne',
    ingredient_names: ['Tomaten'],
  }],
  shopping_question: null,
  fallback_allowed: false,
};

Deno.test('uses a strict closed schema with bounded needs and ingredients', () => {
  const format = COOKING_SUGGESTION_RESPONSE_FORMAT;
  assertEquals(format.type, 'json_schema');
  assertEquals(format.json_schema.strict, true);
  assertEquals(format.json_schema.schema.additionalProperties, false);
  assertEquals(format.json_schema.schema.properties.meals.minItems, 1);
  assertEquals(format.json_schema.schema.properties.meals.maxItems, 3);
  assertEquals(format.json_schema.schema.properties.meals.items.additionalProperties, false);
  assertEquals(
    format.json_schema.schema.properties.meals.items.properties.shopping_needs.maxItems,
    2,
  );
  assertEquals(
    format.json_schema.schema.properties.meals.items.properties.additional_ingredients.maxItems,
    2,
  );
});

Deno.test('constrains ids and additional ingredients to the validated context', () => {
  const format = createCookingSuggestionResponseFormat(context);
  const meal = format.json_schema.schema.properties.meals.items;
  assertEquals(meal.properties.recipe_id, { type: 'string', enum: ['catalog-1'] });
  assertEquals(meal.properties.source, { type: 'string', enum: ['catalog'] });
  assertEquals(meal.properties.used_items.items.properties.inventory_item_id, {
    type: 'string',
    enum: ['inventory-1'],
  });
  assertEquals(meal.properties.additional_ingredients.items, {
    type: 'string',
    enum: ['Olivenöl', 'Parmesan'],
  });
});

Deno.test('allows model fallback only when no catalog candidate exists', () => {
  const fallbackContext: RecipeSuggestionContext = {
    ...context,
    planned_shopping_items: [],
    candidate_recipes: [],
    fallback_allowed: true,
  };
  const meal =
    createCookingSuggestionResponseFormat(fallbackContext).json_schema.schema.properties.meals
      .items;
  assertEquals(meal.properties.source, { type: 'string', const: 'model_generated' });
  assertEquals(meal.properties.recipe_id, { type: 'null' });
  assertEquals(meal.properties.used_items.items.properties.inventory_item_id, {
    type: 'string',
    enum: ['inventory-1'],
  });
  assertEquals(meal.properties.additional_ingredients.maxItems, 2);
});

Deno.test('builds a provider-safe body without credentials or household identifiers', () => {
  const messages = [
    { role: 'system' as const, content: 'system' },
    { role: 'user' as const, content: 'user' },
  ];
  const body = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages,
    recipeSuggestionContext: context,
  });
  assertEquals(body.response_format, createCookingSuggestionResponseFormat(context));
  assertEquals(body.provider, { require_parameters: true });
  assertEquals(body.max_tokens, 4_096);
  assertEquals(body.temperature, 0);
  assertEquals(body.messages, messages);
  assert(!Object.hasOwn(body, 'apiKey'));
  assert(!Object.hasOwn(body, 'householdId'));
  assert(!Object.hasOwn(body, 'userId'));
});

Deno.test('rejects generation settings outside the gateway budget', () => {
  const base = { model: 'z-ai/glm-5.3-flash', messages: [] };
  assertThrows(() => createOpenRouterChatBody({ ...base, maxTokens: 0 }), RangeError);
  assertThrows(() => createOpenRouterChatBody({ ...base, maxTokens: 8_193 }), RangeError);
  assertThrows(() => createOpenRouterChatBody({ ...base, temperature: -0.1 }), RangeError);
  assertThrows(() => createOpenRouterChatBody({ ...base, temperature: 2.1 }), RangeError);
});
