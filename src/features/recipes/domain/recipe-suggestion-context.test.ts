import {
  buildRecipeSuggestionContext,
  type RecipeSuggestionCandidateInput,
  type RecipeSuggestionContextInput,
  type RecipeSuggestionInventoryInput,
  type RecipeSuggestionShoppingItemInput,
} from './recipe-suggestion-context';

const today = new Date(2026, 8, 2, 12);

function inventoryItem(
  overrides: Partial<RecipeSuggestionInventoryInput> = {},
): RecipeSuggestionInventoryInput {
  return {
    id: 'inventory-tomatoes',
    name: 'Tomaten',
    quantity: 4,
    unit: 'Stück',
    priorityScore: 1,
    allergens: [],
    expiryDate: '2026-09-12',
    openedAt: null,
    ...overrides,
  };
}

function shoppingItem(
  overrides: Partial<RecipeSuggestionShoppingItemInput> = {},
): RecipeSuggestionShoppingItemInput {
  return {
    id: 'shopping-pasta',
    name: 'Pasta',
    quantity: 500,
    unit: 'g',
    ...overrides,
  };
}

function recipeCandidate(
  id: string,
  source: RecipeSuggestionCandidateInput['source'],
  title: string,
  ingredientNames: readonly string[],
): RecipeSuggestionCandidateInput {
  return { id, source, title, ingredientNames };
}

function createInput(
  overrides: Partial<RecipeSuggestionContextInput> = {},
): RecipeSuggestionContextInput {
  return {
    servings: 2,
    allergies: [],
    preferences: [],
    allowedStaples: [],
    forbiddenIngredients: [],
    inventory: [inventoryItem()],
    shoppingList: [],
    candidateRecipes: [],
    today,
    ...overrides,
  };
}

describe('buildRecipeSuggestionContext', () => {
  it('does not ask a question for an empty shopping list', () => {
    const context = buildRecipeSuggestionContext(createInput());

    expect(context.shopping_question).toBeNull();
    expect(context.planned_shopping_items).toEqual([]);
  });

  it('asks the exact shopping question when a decision is pending', () => {
    const context = buildRecipeSuggestionContext(createInput({ shoppingList: [shoppingItem()] }));

    expect(context.shopping_question).toBe('Willst du heute noch einkaufen?');
    expect(context.planned_shopping_items).toEqual([]);
  });

  it('plans shopping items after approval without adding them to priority foods', () => {
    const context = buildRecipeSuggestionContext(
      createInput({ shoppingList: [shoppingItem()] }),
      'yes',
    );

    expect(context.planned_shopping_items).toEqual([
      {
        shopping_item_id: 'shopping-pasta',
        name: 'Pasta',
        quantity: 500,
        unit: 'g',
      },
    ]);
    expect(context.priority_foods.map((food) => food.name)).toEqual(['Tomaten']);
    expect(context.priority_foods).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Pasta' })]),
    );
  });

  it('keeps suggestions grounded in inventory when shopping is declined', () => {
    const context = buildRecipeSuggestionContext(
      createInput({
        shoppingList: [shoppingItem()],
        candidateRecipes: [
          recipeCandidate('inventory-recipe', 'catalog', 'Tomatensalat', ['Tomaten']),
          recipeCandidate('shopping-recipe', 'template', 'Pasta', ['Pasta']),
        ],
      }),
      'no',
    );

    expect(context.shopping_question).toBeNull();
    expect(context.planned_shopping_items).toEqual([]);
    expect(context.priority_foods.map((food) => food.name)).toEqual(['Tomaten']);
    expect(context.candidate_recipes.map((recipe) => recipe.id)).toEqual(['inventory-recipe']);
  });

  it('excludes expired, allergenic, and empty inventory items and forbids their ingredients', () => {
    const context = buildRecipeSuggestionContext(
      createInput({
        allergies: ['Milch'],
        inventory: [
          inventoryItem(),
          inventoryItem({
            id: 'inventory-yogurt',
            name: 'Joghurt',
            expiryDate: '2026-08-31',
          }),
          inventoryItem({
            id: 'inventory-milk',
            name: 'Milch',
            allergens: ['milch'],
          }),
          inventoryItem({
            id: 'inventory-flour',
            name: 'Mehl',
            quantity: 0,
          }),
        ],
      }),
    );

    expect(context.priority_foods.map((food) => food.name)).toEqual(['Tomaten']);
    expect(context.constraints.forbidden_ingredients).toEqual(['Joghurt', 'Milch', 'Mehl']);
  });

  it('keeps opened items usable and orders equal priorities by openedAt', () => {
    const context = buildRecipeSuggestionContext(
      createInput({
        inventory: [
          inventoryItem({
            id: 'inventory-newer',
            name: 'Kefir',
            priorityScore: 5,
            openedAt: '2026-09-01T08:00:00.000Z',
          }),
          inventoryItem({
            id: 'inventory-older',
            name: 'Joghurt',
            priorityScore: 5,
            openedAt: '2026-08-28T08:00:00.000Z',
          }),
        ],
      }),
    );

    expect(context.priority_foods.map((food) => food.name)).toEqual(['Joghurt', 'Kefir']);
    expect(context.priority_foods).toHaveLength(2);
  });

  it('ranks catalog and template candidates by priority coverage stably and keeps at most three', () => {
    const context = buildRecipeSuggestionContext(
      createInput({
        inventory: [
          inventoryItem({
            id: 'inventory-tomatoes',
            name: 'Tomaten',
            priorityScore: 5,
          }),
          inventoryItem({
            id: 'inventory-pasta',
            name: 'Pasta',
            priorityScore: 3,
          }),
        ],
        candidateRecipes: [
          recipeCandidate('catalog-high', 'catalog', 'Tomatenpasta', ['Tomaten', 'Pasta']),
          recipeCandidate('template-tomato', 'template', 'Tomatensuppe', ['Tomaten']),
          recipeCandidate('catalog-pasta-a', 'catalog', 'Pasta A', ['Pasta']),
          recipeCandidate('template-pasta-b', 'template', 'Pasta B', ['Pasta']),
        ],
      }),
    );

    expect(context.candidate_recipes).toEqual([
      {
        id: 'catalog-high',
        source: 'catalog',
        title: 'Tomatenpasta',
        ingredient_names: ['Tomaten', 'Pasta'],
      },
      {
        id: 'template-tomato',
        source: 'template',
        title: 'Tomatensuppe',
        ingredient_names: ['Tomaten'],
      },
      {
        id: 'catalog-pasta-a',
        source: 'catalog',
        title: 'Pasta A',
        ingredient_names: ['Pasta'],
      },
    ]);
  });

  it('blocks candidates containing unsafe or unavailable ingredients', () => {
    const context = buildRecipeSuggestionContext(
      createInput({
        allergies: ['Milch'],
        inventory: [
          inventoryItem({
            id: 'inventory-tomatoes',
            name: 'Tomaten',
            priorityScore: 5,
          }),
          inventoryItem({
            id: 'inventory-yogurt',
            name: 'Joghurt',
            priorityScore: 4,
            expiryDate: '2026-08-31',
          }),
          inventoryItem({
            id: 'inventory-milk',
            name: 'Milch',
            priorityScore: 3,
            allergens: ['Milch'],
          }),
          inventoryItem({
            id: 'inventory-flour',
            name: 'Mehl',
            priorityScore: 2,
            quantity: 0,
          }),
        ],
        candidateRecipes: [
          recipeCandidate('allowed', 'catalog', 'Tomatensalat', ['Tomaten']),
          recipeCandidate('expired', 'catalog', 'Joghurt-Tomaten', ['Tomaten', 'Joghurt']),
          recipeCandidate('allergen', 'template', 'Milch-Tomaten', ['Tomaten', 'Milch']),
          recipeCandidate('empty', 'template', 'Mehl-Tomaten', ['Tomaten', 'Mehl']),
          recipeCandidate('unavailable', 'catalog', 'Zucchini-Tomaten', ['Tomaten', 'Zucchini']),
        ],
      }),
    );

    expect(context.candidate_recipes.map((recipe) => recipe.id)).toEqual(['allowed']);
  });

  it('does not allow fallback while at least one candidate exists', () => {
    const context = buildRecipeSuggestionContext(
      createInput({
        candidateRecipes: [recipeCandidate('catalog-tomatoes', 'catalog', 'Tomaten', ['Tomaten'])],
      }),
    );

    expect(context.candidate_recipes).toHaveLength(1);
    expect(context.fallback_allowed).toBe(false);
  });
});
