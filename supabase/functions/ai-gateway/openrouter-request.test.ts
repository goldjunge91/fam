import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  COOKING_SUGGESTION_RESPONSE_FORMAT,
  createOpenRouterChatBody,
} from './openrouter-request.ts';

Deno.test('uses strict JSON Schema output with a closed response object', () => {
  assertEquals(COOKING_SUGGESTION_RESPONSE_FORMAT.type, 'json_schema');
  assertEquals(COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.strict, true);
  assertEquals(COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.schema.additionalProperties, false);
  assertEquals(
    COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.schema.properties.meals.items.additionalProperties,
    false,
  );
  assert(
    COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.schema.required.includes('meals'),
    'meals must be required',
  );
  assertEquals(COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.schema.properties.meals.maxItems, 3);
  assertEquals(
    COOKING_SUGGESTION_RESPONSE_FORMAT.json_schema.schema.properties.meals.items
      .properties.additional_ingredients.maxItems,
    2,
  );
});

Deno.test('builds a provider body without credentials or caller identifiers', () => {
  const body = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'user' },
    ],
  });

  assertEquals(body.model, 'z-ai/glm-5.3-flash');
  assertEquals(body.max_tokens, 1_536);
  assertEquals(body.messages, [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'user' },
  ]);
  assert(!Object.hasOwn(body, 'apiKey'), 'provider credentials must stay outside the body');
  assert(!Object.hasOwn(body, 'householdId'), 'tenant identifiers must stay outside the body');
  assert(!Object.hasOwn(body, 'userId'), 'user identifiers must stay outside the body');
});

Deno.test('disables reasoning only for the known Granite profile', () => {
  const granite = createOpenRouterChatBody({
    model: 'ibm-granite/granite-4.2-8b',
    messages: [],
  });
  const glm = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
  });

  assertEquals(granite.reasoning, { enabled: false });
  assert(!Object.hasOwn(glm, 'reasoning'), 'GLM keeps the provider default reasoning profile');
});
