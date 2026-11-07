import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  type RecipeSuggestionContext,
  type RecipeSuggestionMeal,
  validateRecipeSuggestionContext,
  validateRecipeSuggestionResponse,
} from './recipe-suggestion-contract.ts';

const catalogRecipe = {
  id: 'catalog-pasta',
  source: 'catalog' as const,
  title: 'Tomatenpasta',
  ingredient_names: ['Tomaten', 'Pasta'],
};

function createContext(
  overrides: Partial<RecipeSuggestionContext> = {},
): RecipeSuggestionContext {
  return {
    schema_version: 1,
    request: { type: 'recipe_suggestion', servings: 2 },
    constraints: {
      allergies: [],
      preferences: [],
      allowed_staples: ['Öl'],
      forbidden_ingredients: ['Erdnüsse'],
    },
    priority_foods: [
      {
        inventory_item_id: 'inventory-tomatoes',
        name: 'Tomaten',
        available_quantity: 1,
        unit: 'kg',
        priority_score: 1,
      },
    ],
    planned_shopping_items: [],
    candidate_recipes: [catalogRecipe],
    shopping_question: null,
    fallback_allowed: false,
    ...overrides,
  };
}

function createMeal(overrides: Partial<RecipeSuggestionMeal> = {}): RecipeSuggestionMeal {
  return {
    title: 'Tomatenpasta',
    source: 'catalog',
    recipe_id: catalogRecipe.id,
    servings: 2,
    used_items: [],
    additional_ingredients: [],
    steps: ['Alles kochen.'],
    notes: [],
    ...overrides,
  };
}

function expectIssue(
  result:
    | ReturnType<typeof validateRecipeSuggestionContext>
    | ReturnType<typeof validateRecipeSuggestionResponse>,
  code: string,
  path: string,
): void {
  assert(!result.ok, `expected ${code} at ${path}, got a valid result`);
  assert(
    result.issues.some((issue) => issue.code === code && issue.path === path),
    `expected ${code} at ${path}, got ${JSON.stringify(result.issues)}`,
  );
}

Deno.test('accepts a valid response without mutating context or output', () => {
  const context = createContext();
  const response = {
    schema_version: 1,
    meals: [
      createMeal({
        used_items: [
          {
            inventory_item_id: 'inventory-tomatoes',
            quantity: 1_000,
            unit: 'g',
          },
        ],
        additional_ingredients: [' Öl '],
      }),
    ],
  };
  const contextBefore = JSON.stringify(context);
  const responseBefore = JSON.stringify(response);

  const result = validateRecipeSuggestionResponse(context, response);

  assert(result.ok, JSON.stringify(result));
  assertEquals(result.value, response);
  assertEquals(JSON.stringify(context), contextBefore);
  assertEquals(JSON.stringify(response), responseBefore);
});

Deno.test('validates shopping needs before response persistence', () => {
  const context = createContext();
  assert(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({ shopping_needs: [{ name: 'Pasta', quantity: 200, unit: 'g' }] }),
      ],
    }).ok,
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({ shopping_needs: [{ name: 'Pasta', quantity: 0, unit: 'g' }] }),
      ],
    }),
    'invalid_shape',
    '$.meals[0].shopping_needs[0].quantity',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({ shopping_needs: [{ name: 'Erdnüsse', quantity: 1, unit: 'g' }] }),
      ],
    }),
    'forbidden_ingredient',
    '$.meals[0].shopping_needs[0].name',
  );
});

Deno.test('accepts three alternatives and rejects empty or oversized responses', () => {
  const context = createContext();
  assert(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal(), createMeal(), createMeal()],
    }).ok,
  );

  expectIssue(
    validateRecipeSuggestionResponse(context, { schema_version: 1, meals: [] }),
    'invalid_shape',
    '$.meals',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal(), createMeal(), createMeal(), createMeal()],
    }),
    'invalid_shape',
    '$.meals',
  );
});

Deno.test('rejects unknown fields and a wrong schema version', () => {
  const context = createContext();
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal()],
      unexpected: true,
    }),
    'invalid_shape',
    '$',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 2,
      meals: [createMeal()],
    }),
    'invalid_shape',
    '$.schema_version',
  );
});

Deno.test('rejects invented recipe and inventory references', () => {
  const context = createContext();
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({ recipe_id: 'invented-recipe' })],
    }),
    'invalid_reference',
    '$.meals[0].recipe_id',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({
          used_items: [
            { inventory_item_id: 'invented-inventory', quantity: 1, unit: 'g' },
          ],
        }),
      ],
    }),
    'invalid_reference',
    '$.meals[0].used_items[0].inventory_item_id',
  );
});

Deno.test('rejects inventory that is not part of the selected recipe', () => {
  const context = createContext({
    priority_foods: [
      ...createContext().priority_foods,
      {
        inventory_item_id: 'inventory-rice',
        name: 'Reis',
        available_quantity: 500,
        unit: 'g',
        priority_score: 1,
      },
    ],
  });

  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({
          used_items: [
            { inventory_item_id: 'inventory-rice', quantity: 100, unit: 'g' },
          ],
        }),
      ],
    }),
    'invalid_reference',
    '$.meals[0].used_items[0].inventory_item_id',
  );
});

Deno.test('validates quantities independently per alternative', () => {
  const context = createContext();
  const result = validateRecipeSuggestionResponse(context, {
    schema_version: 1,
    meals: [
      createMeal({
        used_items: [
          { inventory_item_id: 'inventory-tomatoes', quantity: 600, unit: 'g' },
        ],
      }),
      createMeal({
        used_items: [
          { inventory_item_id: 'inventory-tomatoes', quantity: 600, unit: 'g' },
        ],
      }),
    ],
  });

  assert(result.ok, JSON.stringify(result));
});

Deno.test('rejects duplicate, incompatible, and excessive inventory quantities', () => {
  const context = createContext();
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({
          used_items: [
            { inventory_item_id: 'inventory-tomatoes', quantity: 500, unit: 'g' },
            { inventory_item_id: 'inventory-tomatoes', quantity: 500, unit: 'g' },
          ],
        }),
      ],
    }),
    'invalid_reference',
    '$.meals[0].used_items[1].inventory_item_id',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({
          used_items: [
            { inventory_item_id: 'inventory-tomatoes', quantity: 1, unit: 'piece' },
          ],
        }),
      ],
    }),
    'invalid_quantity',
    '$.meals[0].used_items[0].unit',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [
        createMeal({
          used_items: [
            { inventory_item_id: 'inventory-tomatoes', quantity: 1_001, unit: 'g' },
          ],
        }),
      ],
    }),
    'invalid_quantity',
    '$.meals[0].used_items[0].quantity',
  );
});

Deno.test('enforces source and fallback invariants', () => {
  const catalogContext = createContext();
  expectIssue(
    validateRecipeSuggestionResponse(catalogContext, {
      schema_version: 1,
      meals: [createMeal({ source: 'template' })],
    }),
    'source_mismatch',
    '$.meals[0].source',
  );
  expectIssue(
    validateRecipeSuggestionResponse(catalogContext, {
      schema_version: 1,
      meals: [createMeal({ source: 'model_generated', recipe_id: null })],
    }),
    'fallback_not_allowed',
    '$.meals[0].source',
  );

  const fallbackContext = createContext({ candidate_recipes: [], fallback_allowed: true });
  expectIssue(
    validateRecipeSuggestionResponse(fallbackContext, {
      schema_version: 1,
      meals: [createMeal({ source: 'model_generated' })],
    }),
    'source_mismatch',
    '$.meals[0].recipe_id',
  );
  assert(
    validateRecipeSuggestionResponse(fallbackContext, {
      schema_version: 1,
      meals: [createMeal({ source: 'model_generated', recipe_id: null })],
    }).ok,
  );
});

Deno.test('allows only approved and non-forbidden additional ingredients', () => {
  const context = createContext();
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({ additional_ingredients: ['Erdnüsse', 'Zucker'] })],
    }),
    'forbidden_ingredient',
    '$.meals[0].additional_ingredients[0]',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({ additional_ingredients: ['Erdnüsse', 'Zucker'] })],
    }),
    'unapproved_ingredient',
    '$.meals[0].additional_ingredients[1]',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({ additional_ingredients: ['Öl', 'Salz', 'Pfeffer'] })],
    }),
    'invalid_shape',
    '$.meals[0].additional_ingredients',
  );
});

Deno.test('rejects malformed response fields without coercion or repair', () => {
  const context = createContext();
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({ steps: [] })],
    }),
    'invalid_shape',
    '$.meals[0].steps',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({ notes: ['ok', 3 as never] })],
    }),
    'invalid_shape',
    '$.meals[0].notes[1]',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, '{"schema_version":1'),
    'invalid_shape',
    '$',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      toJSON: () => ({ schema_version: 1, meals: [createMeal()] }),
    }),
    'invalid_shape',
    '$',
  );
});

Deno.test('validates context invariants before it reaches the provider', () => {
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({ candidate_recipes: [], fallback_allowed: false }),
    ),
    'fallback_not_allowed',
    '$.fallback_allowed',
  );
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({
        planned_shopping_items: [
          { shopping_item_id: 'shopping-1', name: 'Salz', quantity: 1, unit: 'package' },
        ],
        shopping_question: 'Willst du heute einkaufen?',
      }),
    ),
    'invalid_shape',
    '$.shopping_question',
  );
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({ candidate_recipes: [catalogRecipe, catalogRecipe] }),
    ),
    'invalid_reference',
    '$.candidate_recipes[1].id',
  );
});

Deno.test('rejects ambiguous context ids and forbidden recipe ingredients', () => {
  const baseContext = createContext();
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({
        priority_foods: [
          ...baseContext.priority_foods,
          { ...baseContext.priority_foods[0] },
        ],
      }),
    ),
    'invalid_reference',
    '$.priority_foods[1].inventory_item_id',
  );
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({
        planned_shopping_items: [
          { shopping_item_id: 'shopping-1', name: 'Salz', quantity: 1, unit: 'package' },
          { shopping_item_id: 'shopping-1', name: 'Pfeffer', quantity: 1, unit: 'package' },
        ],
      }),
    ),
    'invalid_reference',
    '$.planned_shopping_items[1].shopping_item_id',
  );
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({
        candidate_recipes: [
          { ...catalogRecipe, ingredient_names: ['Tomaten', 'ERDNÜSSE'] },
        ],
      }),
    ),
    'forbidden_ingredient',
    '$.candidate_recipes[0].ingredient_names[1]',
  );
});
