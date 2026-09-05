import {
  RECIPE_SUGGESTION_SCHEMA_VERSION,
  type RecipeSuggestionContext,
  type RecipeSuggestionMeal,
  validateRecipeSuggestionContext,
  validateRecipeSuggestionResponse,
} from './recipe-suggestions';

const catalogRecipe = {
  id: 'catalog-pasta',
  source: 'catalog' as const,
  title: 'Tomatenpasta',
  ingredient_names: ['Tomaten', 'Pasta'],
};

function createContext(overrides: Partial<RecipeSuggestionContext> = {}): RecipeSuggestionContext {
  return {
    schema_version: RECIPE_SUGGESTION_SCHEMA_VERSION,
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

function createCatalogMeal(overrides: Partial<RecipeSuggestionMeal> = {}) {
  return {
    title: 'Tomatenpasta',
    source: 'catalog' as const,
    recipe_id: catalogRecipe.id,
    servings: 2,
    used_items: [],
    additional_ingredients: [],
    steps: ['Alles kochen.'],
    notes: [],
    ...overrides,
  };
}

function createModelMeal(overrides: Partial<RecipeSuggestionMeal> = {}) {
  return createCatalogMeal({
    source: 'model_generated',
    recipe_id: null,
    ...overrides,
  });
}

function createResponse(...meals: RecipeSuggestionMeal[]) {
  return {
    schema_version: RECIPE_SUGGESTION_SCHEMA_VERSION,
    meals,
  };
}

describe('recipe suggestion contracts', () => {
  it('rejects unknown response fields strictly', () => {
    const result = validateRecipeSuggestionResponse(createContext(), {
      ...createResponse(createCatalogMeal()),
      unexpected_field: true,
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'invalid_shape', path: '$' })],
    });
  });

  it('accepts a valid catalog response referencing its candidate recipe', () => {
    const response = createResponse(createCatalogMeal());

    const result = validateRecipeSuggestionResponse(createContext(), response);

    expect(result).toEqual({ ok: true, value: response });
  });

  it('accepts up to three meals and rejects a fourth meal', () => {
    const threeMeals = validateRecipeSuggestionResponse(
      createContext(),
      createResponse(createCatalogMeal(), createCatalogMeal(), createCatalogMeal()),
    );
    expect(threeMeals).toMatchObject({ ok: true });

    const fourMeals = validateRecipeSuggestionResponse(
      createContext(),
      createResponse(
        createCatalogMeal(),
        createCatalogMeal(),
        createCatalogMeal(),
        createCatalogMeal(),
      ),
    );
    expect(fourMeals).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'invalid_shape', path: '$.meals' })],
    });
  });

  it.each([
    {
      label: 'an unknown recipe reference',
      meal: createCatalogMeal({ recipe_id: 'missing-recipe' }),
      issue: { code: 'invalid_reference', path: '$.meals[0].recipe_id' },
    },
    {
      label: 'a source mismatch',
      meal: createCatalogMeal({ source: 'template' }),
      issue: { code: 'source_mismatch', path: '$.meals[0].source' },
    },
  ])('rejects $label', ({ meal, issue }) => {
    const result = validateRecipeSuggestionResponse(createContext(), createResponse(meal));

    expect(result).toMatchObject({ ok: false, issues: [expect.objectContaining(issue)] });
  });

  it('rejects an inventory item that is not an ingredient of the selected recipe', () => {
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
    const result = validateRecipeSuggestionResponse(
      context,
      createResponse(
        createCatalogMeal({
          used_items: [{ inventory_item_id: 'inventory-rice', quantity: 100, unit: 'g' }],
        }),
      ),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'invalid_reference',
          path: '$.meals[0].used_items[0].inventory_item_id',
        }),
      ],
    });
  });

  it('rejects more than two additional ingredients', () => {
    const result = validateRecipeSuggestionResponse(
      createContext(),
      createResponse(createCatalogMeal({ additional_ingredients: ['Öl', 'Salz', 'Pfeffer'] })),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'invalid_shape',
          path: '$.meals[0].additional_ingredients',
        }),
      ],
    });
  });

  it('allows model_generated only when fallback is allowed', () => {
    const rejected = validateRecipeSuggestionResponse(
      createContext(),
      createResponse(createModelMeal()),
    );
    expect(rejected).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'fallback_not_allowed',
          path: '$.meals[0].source',
        }),
      ],
    });

    const fallbackContext = createContext({ candidate_recipes: [], fallback_allowed: true });
    const accepted = validateRecipeSuggestionResponse(
      fallbackContext,
      createResponse(createModelMeal()),
    );
    expect(accepted).toMatchObject({ ok: true });
  });

  it('rejects inventory quantities that exceed availability across meals', () => {
    const result = validateRecipeSuggestionResponse(
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

    expect(result).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'invalid_quantity',
          path: '$.meals[1].used_items[0].quantity',
        }),
      ],
    });
  });

  it('accepts compatible mass units without changing the inventory representation', () => {
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

    const accepted = validateRecipeSuggestionResponse(
      context,
      createResponse(
        createCatalogMeal({
          used_items: [{ inventory_item_id: 'inventory-tomatoes', quantity: 1_000, unit: 'g' }],
        }),
      ),
    );
    expect(accepted).toMatchObject({ ok: true });
    expect(context.priority_foods[0]).toMatchObject({ available_quantity: 1, unit: 'kg' });

    const overdrawn = validateRecipeSuggestionResponse(
      context,
      createResponse(
        createCatalogMeal({
          used_items: [{ inventory_item_id: 'inventory-tomatoes', quantity: 1_001, unit: 'g' }],
        }),
      ),
    );
    expect(overdrawn).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'invalid_quantity' })],
    });
  });

  it('rejects forbidden and unapproved additional ingredients', () => {
    const result = validateRecipeSuggestionResponse(
      createContext(),
      createResponse(createCatalogMeal({ additional_ingredients: ['Erdnüsse', 'Zucker'] })),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'forbidden_ingredient',
          path: '$.meals[0].additional_ingredients[0]',
        }),
        expect.objectContaining({
          code: 'unapproved_ingredient',
          path: '$.meals[0].additional_ingredients[1]',
        }),
      ],
    });
  });

  it.each([
    {
      label: 'with candidates',
      context: createContext({ fallback_allowed: true }),
    },
    {
      label: 'without candidates',
      context: createContext({ candidate_recipes: [], fallback_allowed: false }),
    },
  ])('rejects an inconsistent fallback_allowed context $label', ({ context }) => {
    const result = validateRecipeSuggestionContext(context);

    expect(result).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({ code: 'fallback_not_allowed', path: '$.fallback_allowed' }),
      ],
    });
  });
});
