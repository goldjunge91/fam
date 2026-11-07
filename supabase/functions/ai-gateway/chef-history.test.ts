import { assertEquals, assertMatch, assertThrows } from 'jsr:@std/assert@1';

import {
  buildChefRecipeSnapshot,
  buildChefRequestPayload,
  chefRequestFingerprint,
  historyContextMessage,
  isUuid,
  normalizedInventoryIds,
  parseChefExchangeLookup,
} from './chef-history.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';

const request = {
  householdId: '11111111-1111-4111-8111-111111111111',
  userText: '  Was soll ich kochen?  ',
  servings: 2,
  maxMinutes: null,
  dietaryPattern: null,
  shoppingDecision: null,
  selectedInventoryItemIds: [
    '33333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
  ],
  clientRequestId: '44444444-4444-4444-8444-444444444444',
};

const context: RecipeSuggestionContext = {
  schema_version: 1,
  request: { type: 'recipe_suggestion', servings: 2 },
  constraints: {
    allergies: [],
    preferences: [],
    allowed_staples: [],
    forbidden_ingredients: [],
  },
  priority_foods: [
    {
      inventory_item_id: '22222222-2222-4222-8222-222222222222',
      name: 'Tomate',
      available_quantity: 2,
      unit: 'piece',
      priority_score: 1,
    },
  ],
  planned_shopping_items: [],
  candidate_recipes: [{
    id: 'recipe-1',
    source: 'catalog',
    title: 'Pfanne',
    ingredient_names: ['Tomate'],
  }],
  shopping_question: null,
  fallback_allowed: false,
};

const result = {
  schema_version: 1 as const,
  meals: [
    {
      title: 'Tomatenpfanne',
      source: 'catalog' as const,
      recipe_id: 'recipe-1',
      servings: 2,
      used_items: [
        {
          inventory_item_id: '22222222-2222-4222-8222-222222222222',
          quantity: 1,
          unit: 'piece',
        },
      ],
      additional_ingredients: [],
      steps: ['Garen.'],
      notes: [],
    },
  ],
};

Deno.test('normalizes the visible request snapshot and selected inventory ids', () => {
  assertEquals(normalizedInventoryIds(request.selectedInventoryItemIds), [
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
  ]);
  assertEquals(buildChefRequestPayload(request), {
    schema_version: 1,
    user_text: 'Was soll ich kochen?',
    servings: 2,
    max_minutes: null,
    dietary_pattern: null,
    shopping_decision: null,
    selected_inventory_item_ids: [
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ],
  });
});

Deno.test('builds a deterministic fingerprint independent of inventory id order', async () => {
  const first = await chefRequestFingerprint({ request, model: 'test-model' });
  const second = await chefRequestFingerprint({
    request: {
      ...request,
      selectedInventoryItemIds: [...request.selectedInventoryItemIds].reverse(),
    },
    model: 'test-model',
  });

  assertEquals(first, second);
  assertMatch(first, /^[0-9a-f]{64}$/);
});

Deno.test('creates one response-level snapshot and resolves visible inventory names', () => {
  assertEquals(buildChefRecipeSnapshot(result, context), {
    title: 'Tomatenpfanne',
    recipe_payload: {
      schema_version: 1,
      response: result,
      used_item_snapshots: [
        {
          inventory_item_id: '22222222-2222-4222-8222-222222222222',
          name: 'Tomate',
          quantity: 1,
          unit: 'piece',
        },
      ],
    },
  });

  assertThrows(
    () =>
      buildChefRecipeSnapshot(
        {
          ...result,
          meals: [
            {
              ...result.meals[0],
              used_items: [
                {
                  inventory_item_id: '99999999-9999-4999-8999-999999999999',
                  quantity: 1,
                  unit: 'piece',
                },
              ],
            },
          ],
        },
        context,
      ),
    Error,
    'chef_recipe_inventory_snapshot_missing',
  );
});

Deno.test('validates UUIDs and rejects malformed lookup payloads', () => {
  assertEquals(isUuid('11111111-1111-4111-8111-111111111111'), true);
  assertEquals(isUuid('household-1'), false);
  assertEquals(parseChefExchangeLookup({ schema_version: 1, status: 'missing' }), {
    schema_version: 1,
    status: 'missing',
  });
  assertEquals(
    parseChefExchangeLookup({ schema_version: 1, status: 'match', hydration: {} }),
    null,
  );
});

Deno.test('marks server-loaded history as untrusted provider context', () => {
  const message = historyContextMessage({ schema_version: 1, truncated: true, turns: [] });
  const parsed = JSON.parse(message);
  assertEquals(parsed.kind, 'untrusted_chef_history');
  assertEquals(parsed.truncated, true);
});
