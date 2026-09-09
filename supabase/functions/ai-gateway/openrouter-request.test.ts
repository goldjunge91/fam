import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  COOKING_SUGGESTION_RESPONSE_FORMAT,
  INVENTORY_CAPTURE_RESPONSE_FORMAT,
  createOpenRouterChatBody,
} from './openrouter-request.ts';

// Diese Tests prüfen die Provider-Schemata und die Modellparameter.
Deno.test('uses strict JSON Schema output with a closed response object for cooking suggestions', () => {
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

Deno.test('uses strict JSON Schema output for inventory capture proposals', () => {
  assertEquals(INVENTORY_CAPTURE_RESPONSE_FORMAT.type, 'json_schema');
  assertEquals(INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.strict, true);
  assertEquals(INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.name, 'inventory_capture_proposal_v1');
  assertEquals(INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.schema.additionalProperties, false);
  assertEquals(
    INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.schema.properties.kind.const,
    'inventory_capture_proposal.v1',
  );
  assertEquals(
    INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.schema.properties.items.items.additionalProperties,
    false,
  );
  const itemProps = INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.schema.properties.items.items.properties;
  assert(itemProps.rawText);
  assert(itemProps.normalizedName);
  assert(itemProps.quantity);
  assert(itemProps.unit);
  assert(itemProps.perishability);
  assert(itemProps.storage);
  assert(itemProps.date);
  assert(itemProps.dateKind);
  assert(itemProps.confidence);
  assert(itemProps.evidence);
  assert(itemProps.missingFields);
  assert(INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.schema.required.includes('items'));
  assert(INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.schema.required.includes('questions'));
  assert(INVENTORY_CAPTURE_RESPONSE_FORMAT.json_schema.schema.required.includes('warnings'));
});

Deno.test('dynamically assigns response_format based on skill', () => {
  const cookingBody = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
    skill: 'fam-cook-from-inventory',
  });
  assertEquals(cookingBody.response_format, COOKING_SUGGESTION_RESPONSE_FORMAT);

  const captureBody = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
    skill: 'fam-inventory-capture',
  });
  assertEquals(captureBody.response_format, INVENTORY_CAPTURE_RESPONSE_FORMAT);

  const defaultBody = createOpenRouterChatBody({
    model: 'z-ai/glm-5.3-flash',
    messages: [],
  });
  assertEquals(defaultBody.response_format, COOKING_SUGGESTION_RESPONSE_FORMAT);
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
  assertEquals(body.max_tokens, 4_096);
  assertEquals(body.temperature, 0);
  assertEquals(body.messages, [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'user' },
  ]);
  assert(!Object.hasOwn(body, 'apiKey'), 'provider credentials must stay outside the body');
  assert(!Object.hasOwn(body, 'householdId'), 'tenant identifiers must stay outside the body');
  assert(!Object.hasOwn(body, 'userId'), 'user identifiers must stay outside the body');
});

Deno.test('configures reasoning profiles for Granite and GLM', () => {
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
  assert(!Object.hasOwn(gemma, 'reasoning'), 'Gemma keeps the provider default reasoning profile');
});
