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

Deno.test('rejects unknown fields, wrong versions, and bounded arrays', () => {
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
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({
        shopping_needs: [
          { name: 'Pasta', quantity: 1, unit: 'package' },
          { name: 'Salz', quantity: 1, unit: 'package' },
          { name: 'Öl', quantity: 1, unit: 'ml' },
        ],
      })],
    }),
    'invalid_shape',
    '$.meals[0].shopping_needs',
  );
});

Deno.test('rejects invented references and incompatible or excessive quantities', () => {
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
      meals: [createMeal({
        used_items: [
          { inventory_item_id: 'invented-inventory', quantity: 1, unit: 'g' },
        ],
      })],
    }),
    'invalid_reference',
    '$.meals[0].used_items[0].inventory_item_id',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({
        used_items: [
          { inventory_item_id: 'inventory-tomatoes', quantity: 1, unit: 'piece' },
        ],
      })],
    }),
    'invalid_quantity',
    '$.meals[0].used_items[0].unit',
  );
  expectIssue(
    validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [createMeal({
        used_items: [
          { inventory_item_id: 'inventory-tomatoes', quantity: 1_001, unit: 'g' },
        ],
      })],
    }),
    'invalid_quantity',
    '$.meals[0].used_items[0].quantity',
  );
});

Deno.test('enforces source, fallback, and ingredient invariants', () => {
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
  assert(
    validateRecipeSuggestionResponse(fallbackContext, {
      schema_version: 1,
      meals: [createMeal({ source: 'model_generated', recipe_id: null })],
    }).ok,
  );
  expectIssue(
    validateRecipeSuggestionResponse(fallbackContext, {
      schema_version: 1,
      meals: [
        createMeal({
          source: 'model_generated',
          recipe_id: null,
          additional_ingredients: ['Zucker'],
        }),
      ],
    }),
    'unapproved_ingredient',
    '$.meals[0].additional_ingredients[0]',
  );
  expectIssue(
    validateRecipeSuggestionResponse(fallbackContext, {
      schema_version: 1,
      meals: [
        createMeal({
          source: 'model_generated',
          recipe_id: null,
          additional_ingredients: ['Erdnüsse'],
        }),
      ],
    }),
    'forbidden_ingredient',
    '$.meals[0].additional_ingredients[0]',
  );
});

Deno.test('validates context ids and fallback invariants before provider use', () => {
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({ candidate_recipes: [], fallback_allowed: false }),
    ),
    'fallback_not_allowed',
    '$.fallback_allowed',
  );
  expectIssue(
    validateRecipeSuggestionContext(
      createContext({ candidate_recipes: [catalogRecipe, catalogRecipe] }),
    ),
    'invalid_reference',
    '$.candidate_recipes[1].id',
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
});
