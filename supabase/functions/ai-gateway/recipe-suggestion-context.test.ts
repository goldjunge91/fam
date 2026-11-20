import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  buildRecipeSuggestionContext,
  type RecipeSuggestionGatewayInput,
} from './recipe-suggestion-context.ts';

const today = new Date('2026-09-04T12:00:00.000Z');

function createInput(
  overrides: Partial<RecipeSuggestionGatewayInput> = {},
): RecipeSuggestionGatewayInput {
  return {
    inventory: {
      lots: [
        {
          lotId: 'lot-spinach',
          normalizedName: 'Spinat',
          quantity: 200,
          unit: 'g',
          bestBefore: '2026-09-05',
          useBy: null,
        },
        {
          lotId: 'lot-rice',
          normalizedName: 'Reis',
          quantity: 1,
          unit: 'kg',
          bestBefore: null,
          useBy: null,
        },
      ],
    },
    recipes: [
      {
        recipeId: 'recipe-spinach-rice',
        title: 'Spinat-Reis-Pfanne',
        source: 'catalog',
        estimatedMinutes: 25,
        servings: 2,
        dietaryTags: ['vegetarian'],
        allergens: [],
        steps: ['Reis und Spinat garen.'],
        ingredients: [
          { normalizedName: 'Spinat', quantity: 150, unit: 'g' },
          { normalizedName: 'Reis', quantity: 150, unit: 'g' },
        ],
      },
    ],
    shoppingItems: [],
    servings: 2,
    maxMinutes: null,
    dietaryPattern: null,
    allergies: [],
    shoppingDecision: 'no',
    today,
    ...overrides,
  };
}

Deno.test('orders urgent food first while retaining undated inventory', () => {
  const result = buildRecipeSuggestionContext(createInput());

  assert(result !== null);
  assertEquals(result.context.priority_foods.map((food) => food.name), ['Spinat', 'Reis']);
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), [
    'recipe-spinach-rice',
  ]);
});

Deno.test('excludes expired, empty, and invalid lots without mutating input', () => {
  const input = createInput({
    inventory: {
      lots: [
        ...createInput().inventory.lots,
        {
          lotId: 'lot-expired',
          normalizedName: 'Joghurt',
          quantity: 500,
          unit: 'g',
          bestBefore: '2026-09-03',
          useBy: null,
        },
        {
          lotId: 'lot-empty',
          normalizedName: 'Mehl',
          quantity: 0,
          unit: 'g',
          bestBefore: null,
          useBy: null,
        },
      ],
    },
  });
  const before = JSON.stringify(input);

  const result = buildRecipeSuggestionContext(input);

  assert(result !== null);
  assertEquals(result.context.priority_foods.some((food) => food.name === 'Joghurt'), false);
  assertEquals(result.context.priority_foods.some((food) => food.name === 'Mehl'), false);
  assertEquals(JSON.stringify(input), before);
});

Deno.test('scales recipe quantities to requested servings before accepting candidates', () => {
  const result = buildRecipeSuggestionContext(createInput({
    inventory: {
      lots: [{
        lotId: 'lot-potatoes',
        normalizedName: 'Kartoffeln',
        quantity: 1,
        unit: 'kg',
        bestBefore: null,
        useBy: null,
      }],
    },
    recipes: [{
      recipeId: 'recipe-potato-pan',
      title: 'Kartoffelpfanne',
      source: 'catalog',
      estimatedMinutes: 30,
      servings: 2,
      dietaryTags: [],
      allergens: [],
      steps: ['Kartoffeln garen.'],
      ingredients: [{ normalizedName: 'Kartoffeln', quantity: 600, unit: 'g' }],
    }],
    servings: 4,
  }));

  assert(result !== null);
  assertEquals(result.context.candidate_recipes, []);
  assertEquals(result.context.fallback_allowed, true);
});

Deno.test('asks before using a non-empty shopping list and only includes it after approval', () => {
  const shoppingItems = [{ shoppingItemId: 'shopping-oil', name: 'Öl', quantity: 100, unit: 'ml' }];
  const question = buildRecipeSuggestionContext(
    createInput({ shoppingItems, shoppingDecision: null }),
  );
  assert(question !== null);
  assertEquals(question.shoppingQuestion, 'Willst du heute noch einkaufen?');
  assertEquals(question.context.planned_shopping_items, []);

  const approved = buildRecipeSuggestionContext(createInput({
    shoppingItems,
    shoppingDecision: 'yes',
    recipes: [{
      ...createInput().recipes[0]!,
      recipeId: 'recipe-with-oil',
      title: 'Reis mit Öl',
      ingredients: [
        { normalizedName: 'Reis', quantity: 150, unit: 'g' },
        { normalizedName: 'Öl', quantity: 10, unit: 'ml' },
      ],
    }],
  }));
  assert(approved !== null);
  assertEquals(approved.context.planned_shopping_items[0]?.name, 'Öl');
  assertEquals(approved.context.candidate_recipes.map((recipe) => recipe.id), ['recipe-with-oil']);
});

Deno.test('fails closed for unknown or unreviewed allergy coverage', () => {
  assertEquals(
    buildRecipeSuggestionContext(createInput({ allergies: ['custom-allergy'] })),
    null,
  );
  assertEquals(
    buildRecipeSuggestionContext(createInput({ allergies: ['peanuts'] })),
    null,
  );
});

Deno.test('accepts only a current clear projection for a known allergy', () => {
  const result = buildRecipeSuggestionContext(createInput({
    allergies: ['peanuts'],
    recipes: [{
      ...createInput().recipes[0]!,
      allergenProjection: {
        status: 'clear',
        allergenIds: ['EU_05_PEANUTS'],
        conflictingAllergenIds: [],
        unknownAllergenIds: [],
        rulesUpdatedAt: null,
        knowledgeVersion: 'v1',
      },
    }],
  }));

  assert(result !== null);
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), [
    'recipe-spinach-rice',
  ]);
});

Deno.test('prioritizes selected lots and excludes forbidden food-rule names', () => {
  const result = buildRecipeSuggestionContext(createInput({
    forbiddenIngredients: ['Spinat'],
    selectedInventoryItemIds: ['lot-rice'],
  }));

  assert(result !== null);
  assertEquals(result.context.priority_foods.map((food) => food.name), ['Reis']);
  assertEquals(result.context.candidate_recipes, []);
});

Deno.test('returns stable output for the same verified input', () => {
  const input = createInput();
  assertEquals(buildRecipeSuggestionContext(input), buildRecipeSuggestionContext(input));
});
