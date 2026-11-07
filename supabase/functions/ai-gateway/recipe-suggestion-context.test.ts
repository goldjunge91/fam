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
    shoppingDecision: null,
    today,
    ...overrides,
  };
}

Deno.test('orders urgent food first while retaining inventory without a date', () => {
  const result = buildRecipeSuggestionContext(createInput());

  assert(result !== null);
  assertEquals(result.context.priority_foods.map((food) => food.name), ['Spinat', 'Reis']);
  assertEquals(result.context.priority_foods[1]?.unit, 'kg');
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), [
    'recipe-spinach-rice',
  ]);
});

Deno.test('does not expose a catalog candidate without usable steps', () => {
  const result = buildRecipeSuggestionContext(
    createInput({ recipes: [{ ...createInput().recipes[0], steps: [] }] }),
  );

  assert(result !== null);
  assertEquals(result.context.candidate_recipes, []);
  assertEquals(result.context.fallback_allowed, true);
});

Deno.test('scales recipe quantities to requested servings', () => {
  const result = buildRecipeSuggestionContext(
    createInput({
      inventory: {
        lots: [
          {
            lotId: 'lot-potatoes',
            normalizedName: 'Kartoffeln',
            quantity: 1,
            unit: 'kg',
            bestBefore: null,
            useBy: null,
          },
        ],
      },
      recipes: [
        {
          recipeId: 'recipe-potato-pan',
          title: 'Kartoffelpfanne',
          source: 'catalog',
          estimatedMinutes: 30,
          servings: 2,
          dietaryTags: [],
          allergens: [],
          steps: ['Kartoffeln garen.'],
          ingredients: [{ normalizedName: 'Kartoffeln', quantity: 600, unit: 'g' }],
        },
      ],
      servings: 4,
    }),
  );

  assert(result !== null);
  assertEquals(result.context.candidate_recipes, []);
  assertEquals(result.context.fallback_allowed, true);
});

Deno.test('combines compatible quantities without rewriting inventory units', () => {
  const result = buildRecipeSuggestionContext(
    createInput({
      inventory: {
        lots: [
          {
            lotId: 'lot-potatoes-a',
            normalizedName: 'Kartoffeln',
            quantity: 500,
            unit: 'g',
            bestBefore: null,
            useBy: null,
          },
          {
            lotId: 'lot-potatoes-b',
            normalizedName: 'Kartoffeln',
            quantity: 0.7,
            unit: 'kg',
            bestBefore: null,
            useBy: null,
          },
        ],
      },
      recipes: [
        {
          recipeId: 'recipe-potato-pan',
          title: 'Kartoffelpfanne',
          source: 'catalog',
          estimatedMinutes: 30,
          servings: 2,
          dietaryTags: [],
          allergens: [],
          steps: ['Kartoffeln garen.'],
          ingredients: [{ normalizedName: 'Kartoffeln', quantity: 1_200, unit: 'g' }],
        },
      ],
    }),
  );

  assert(result !== null);
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), [
    'recipe-potato-pan',
  ]);
  assertEquals(result.context.priority_foods.map((food) => food.unit), ['g', 'kg']);
});

Deno.test('excludes expired lots without mutating the source context', () => {
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
      ],
    },
  });
  const before = JSON.stringify(input);

  const result = buildRecipeSuggestionContext(input);

  assert(result !== null);
  assertEquals(result.context.priority_foods.some((food) => food.name === 'Joghurt'), false);
  assertEquals(JSON.stringify(input), before);
});

Deno.test('asks before using a non-empty shopping list', () => {
  const result = buildRecipeSuggestionContext(
    createInput({
      shoppingItems: [
        { shoppingItemId: 'shopping-oil', name: 'Öl', quantity: 100, unit: 'ml' },
      ],
    }),
  );

  assert(result !== null);
  assertEquals(result.shoppingQuestion, 'Willst du heute noch einkaufen?');
  assertEquals(result.context.planned_shopping_items, []);
});

Deno.test('includes shopping items only after explicit approval', () => {
  const result = buildRecipeSuggestionContext(
    createInput({
      recipes: [
        ...createInput().recipes,
        {
          recipeId: 'recipe-with-oil',
          title: 'Reis mit Öl',
          source: 'catalog',
          estimatedMinutes: 10,
          servings: 2,
          dietaryTags: [],
          allergens: [],
          steps: ['Reis mit Öl vermengen.'],
          ingredients: [
            { normalizedName: 'Reis', quantity: 150, unit: 'g' },
            { normalizedName: 'Öl', quantity: 10, unit: 'ml' },
          ],
        },
      ],
      shoppingItems: [
        { shoppingItemId: 'shopping-oil', name: 'Öl', quantity: 100, unit: 'ml' },
      ],
      shoppingDecision: 'yes',
    }),
  );

  assert(result !== null);
  assertEquals(result.shoppingQuestion, null);
  assertEquals(result.context.planned_shopping_items[0]?.name, 'Öl');
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), [
    'recipe-spinach-rice',
    'recipe-with-oil',
  ]);
});

Deno.test('fails closed for unknown allergy rules', () => {
  assertEquals(
    buildRecipeSuggestionContext(createInput({ allergies: ['my-custom-allergy'] })),
    null,
  );
});

Deno.test('does not infer allergen safety from an ingredient name', () => {
  const result = buildRecipeSuggestionContext(
    createInput({
      inventory: {
        lots: [
          {
            lotId: 'mozzarella',
            normalizedName: 'Mozzarella',
            quantity: 200,
            unit: 'g',
            bestBefore: null,
            useBy: null,
          },
        ],
      },
      recipes: [],
      allergies: ['milk'],
    }),
  );

  assertEquals(result, null);
});

Deno.test('accepts reviewed safe recipes for known allergy aliases', () => {
  for (const rule of ['milk', 'lactose']) {
    const result = buildRecipeSuggestionContext(createInput({ allergies: [rule] }));
    assert(result !== null);
    assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), [
      'recipe-spinach-rice',
    ]);
  }
});

Deno.test('excludes forbidden inventory and shopping ingredients', () => {
  const result = buildRecipeSuggestionContext(
    createInput({
      recipes: [],
      forbiddenIngredients: [' Spinat '],
      shoppingItems: [
        { shoppingItemId: 'spinach', name: 'SPINAT', quantity: 200, unit: 'g' },
      ],
      shoppingDecision: 'yes',
    }),
  );

  assert(result !== null);
  assertEquals(result.context.priority_foods.map((item) => item.name), ['Reis']);
  assertEquals(result.context.planned_shopping_items, []);
});

Deno.test('returns the same context for the same verified input', () => {
  const input = createInput();
  const first = buildRecipeSuggestionContext(input);
  const second = buildRecipeSuggestionContext(input);

  assertEquals(first, second);
});
