import {
  validateRecipeSuggestionContract,
  type RecipeSuggestionContext,
  type RecipeSuggestionMeal,
  type RecipeSuggestionResponse,
} from './recipe-suggestion-contract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`);
  }
}

const catalogRecipe = {
  id: 'catalog-pasta',
  source: 'catalog' as const,
  title: 'Tomatenpasta',
  ingredient_names: ['Tomaten', 'Pasta'],
};

function createContext(overrides: Partial<RecipeSuggestionContext> = {}): RecipeSuggestionContext {
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
        available_quantity: 100,
        unit: 'g',
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

function createCatalogMeal(overrides: Partial<RecipeSuggestionMeal> = {}): RecipeSuggestionMeal {
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

function createModelMeal(overrides: Partial<RecipeSuggestionMeal> = {}): RecipeSuggestionMeal {
  return createCatalogMeal({ source: 'model_generated', recipe_id: null, ...overrides });
}

function createResponse(...meals: RecipeSuggestionMeal[]): RecipeSuggestionResponse {
  return { schema_version: 1, meals };
}

function expectIssue(
  result: ReturnType<typeof validateRecipeSuggestionContract>,
  code: string,
  path: string,
): void {
  assert(!result.ok, 'expected validation to fail');
  assert(
    result.issues.some((candidate) => candidate.code === code && candidate.path === path),
    `expected issue ${code} at ${path}, got ${JSON.stringify(result.issues)}`,
  );
}

Deno.test('accepts a valid catalog response and preserves the value', () => {
  const response = createResponse(createCatalogMeal({ additional_ingredients: [' Öl '] }));
  const before = JSON.stringify(response);
  const result = validateRecipeSuggestionContract(createContext(), response);

  assert(result.ok, `expected valid response, got ${JSON.stringify(result)}`);
  assertDeepEquals(result.value, response, 'validated response changed');
  assert(JSON.stringify(response) === before, 'validator mutated the input');
});

Deno.test('accepts three meals and rejects a fourth meal', () => {
  const accepted = validateRecipeSuggestionContract(
    createContext(),
    createResponse(createCatalogMeal(), createCatalogMeal(), createCatalogMeal()),
  );
  assert(accepted.ok, 'three meals should be valid');

  const rejected = validateRecipeSuggestionContract(
    createContext(),
    createResponse(
      createCatalogMeal(),
      createCatalogMeal(),
      createCatalogMeal(),
      createCatalogMeal(),
    ),
  );
  expectIssue(rejected, 'invalid_shape', '$.meals');
});

Deno.test('rejects unknown response fields strictly', () => {
  const response = {
    ...createResponse(createCatalogMeal()),
    unexpected_field: true,
  };
  const result = validateRecipeSuggestionContract(createContext(), response);
  expectIssue(result, 'invalid_shape', '$');
});

Deno.test('rejects a wrong schema version', () => {
  const result = validateRecipeSuggestionContract(createContext(), {
    ...createResponse(createCatalogMeal()),
    schema_version: 2,
  });
  expectIssue(result, 'invalid_shape', '$.schema_version');
});

Deno.test('rejects invented recipe and inventory references', () => {
  const recipeResult = validateRecipeSuggestionContract(
    createContext(),
    createResponse(createCatalogMeal({ recipe_id: 'invented-recipe' })),
  );
  expectIssue(recipeResult, 'invalid_reference', '$.meals[0].recipe_id');

  const inventoryResult = validateRecipeSuggestionContract(
    createContext(),
    createResponse(
      createCatalogMeal({
        used_items: [{ inventory_item_id: 'invented-inventory', quantity: 1, unit: 'g' }],
      }),
    ),
  );
  expectIssue(inventoryResult, 'invalid_reference', '$.meals[0].used_items[0].inventory_item_id');
});

Deno.test('rejects an inventory item that is not an ingredient of the selected recipe', () => {
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
  const result = validateRecipeSuggestionContract(
    context,
    createResponse(
      createCatalogMeal({
        used_items: [{ inventory_item_id: 'inventory-rice', quantity: 100, unit: 'g' }],
      }),
    ),
  );

  expectIssue(result, 'invalid_reference', '$.meals[0].used_items[0].inventory_item_id');
});

Deno.test('rejects more than two additional ingredients', () => {
  const result = validateRecipeSuggestionContract(
    createContext(),
    createResponse(
      createCatalogMeal({ additional_ingredients: ['Öl', 'Salz', 'Pfeffer'] }),
    ),
  );

  expectIssue(result, 'invalid_shape', '$.meals[0].additional_ingredients');
});

Deno.test('rejects quantities that exceed availability across all meals', () => {
  const result = validateRecipeSuggestionContract(
    createContext(),
    createResponse(
      createCatalogMeal({
        used_items: [{ inventory_item_id: 'inventory-tomatoes', quantity: 60, unit: 'g' }],
      }),
      createCatalogMeal({
        used_items: [{ inventory_item_id: 'inventory-tomatoes', quantity: 60, unit: 'g' }],
      }),
    ),
  );
  expectIssue(result, 'invalid_quantity', '$.meals[1].used_items[0].quantity');
});

Deno.test('accepts compatible mass units without mutating the context', () => {
  const context = createContext({
    priority_foods: [
      {
        inventory_item_id: 'inventory-tomatoes',
        name: 'Tomaten',
        available_quantity: 1,
        unit: 'kg',
        priority_score: 1,
      },
    ],
  });
  const response = createResponse(
    createCatalogMeal({
      used_items: [{ inventory_item_id: 'inventory-tomatoes', quantity: 1_000, unit: 'g' }],
    }),
  );

  const accepted = validateRecipeSuggestionContract(context, response);
  assert(accepted.ok, `compatible mass units should pass: ${JSON.stringify(accepted)}`);
  assert(context.priority_foods[0]?.available_quantity === 1, 'context quantity changed');
  assert(context.priority_foods[0]?.unit === 'kg', 'context unit changed');

  const rejected = validateRecipeSuggestionContract(
    context,
    createResponse(
      createCatalogMeal({
        used_items: [{ inventory_item_id: 'inventory-tomatoes', quantity: 1_001, unit: 'g' }],
      }),
    ),
  );
  expectIssue(rejected, 'invalid_quantity', '$.meals[0].used_items[0].quantity');
});

Deno.test('rejects source mismatches and disallowed fallback responses', () => {
  const sourceMismatch = validateRecipeSuggestionContract(
    createContext(),
    createResponse(createCatalogMeal({ source: 'template' })),
  );
  expectIssue(sourceMismatch, 'source_mismatch', '$.meals[0].source');

  const fallbackRejected = validateRecipeSuggestionContract(
    createContext(),
    createResponse(createModelMeal()),
  );
  expectIssue(fallbackRejected, 'fallback_not_allowed', '$.meals[0].source');

  const fallbackWithRecipeId = validateRecipeSuggestionContract(
    createContext({ candidate_recipes: [], fallback_allowed: true }),
    createResponse(createModelMeal({ recipe_id: 'must-be-null' })),
  );
  expectIssue(fallbackWithRecipeId, 'source_mismatch', '$.meals[0].recipe_id');
});

Deno.test('rejects forbidden allergens and non-allowlisted additional ingredients', () => {
  const result = validateRecipeSuggestionContract(
    createContext(),
    createResponse(createCatalogMeal({ additional_ingredients: ['Erdnüsse', 'Zucker'] })),
  );
  expectIssue(result, 'forbidden_ingredient', '$.meals[0].additional_ingredients[0]');
  expectIssue(result, 'unapproved_ingredient', '$.meals[0].additional_ingredients[1]');
});

Deno.test('requires non-empty steps and string notes', () => {
  const emptySteps = validateRecipeSuggestionContract(
    createContext(),
    createResponse(createCatalogMeal({ steps: [] })),
  );
  expectIssue(emptySteps, 'invalid_shape', '$.meals[0].steps');

  const invalidNotes = validateRecipeSuggestionContract(
    createContext(),
    createResponse(createCatalogMeal({ notes: ['ok', 3 as never] })),
  );
  expectIssue(invalidNotes, 'invalid_shape', '$.meals[0].notes[1]');
});

Deno.test('rejects truncated and non-JSON-like input without repairing it', () => {
  const truncated = validateRecipeSuggestionContract(createContext(), '{"schema_version":1');
  expectIssue(truncated, 'invalid_shape', '$');

  const repairable = {
    toJSON: () => createResponse(createCatalogMeal()),
  };
  const nonJsonLike = validateRecipeSuggestionContract(createContext(), repairable);
  expectIssue(nonJsonLike, 'invalid_shape', '$');
});
