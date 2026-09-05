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

Deno.test('keeps non-perishable inventory and orders urgent food first', () => {
  const result = buildRecipeSuggestionContext(createInput());

  assert(result !== null, 'an inventory context should be created');
  assertEquals(result.context.priority_foods.map((food) => food.name), ['Spinat', 'Reis']);
  assertEquals(result.context.priority_foods[1]?.unit, 'kg');
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), ['recipe-spinach-rice']);
});

Deno.test('scales recipe quantities to requested servings before selecting a candidate', () => {
  const input = createInput({
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
      ingredients: [{ normalizedName: 'Kartoffeln', quantity: 600, unit: 'g' }],
    }],
    servings: 4,
  });

  const result = buildRecipeSuggestionContext(input);

  assert(result !== null, 'usable inventory remains');
  assertEquals(result.context.candidate_recipes, []);
  assertEquals(result.context.fallback_allowed, true);
});

Deno.test('combines compatible units across inventory lots without changing their representation', () => {
  const input = createInput({
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
    recipes: [{
      recipeId: 'recipe-potato-pan',
      title: 'Kartoffelpfanne',
      source: 'catalog',
      estimatedMinutes: 30,
      servings: 2,
      dietaryTags: [],
      allergens: [],
      ingredients: [{ normalizedName: 'Kartoffeln', quantity: 1200, unit: 'g' }],
    }],
  });

  const result = buildRecipeSuggestionContext(input);

  assert(result !== null, 'usable inventory remains');
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), ['recipe-potato-pan']);
  assertEquals(result.context.priority_foods.map((food) => food.unit), ['g', 'kg']);
});

Deno.test('excludes expired lots without repairing or rewriting the source context', () => {
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

  const result = buildRecipeSuggestionContext(input);

  assert(result !== null, 'usable inventory remains');
  assertEquals(result.context.priority_foods.some((food) => food.name === 'Joghurt'), false);
  assertEquals(input.inventory.lots[2]?.normalizedName, 'Joghurt');
});

Deno.test('asks before using a non-empty shopping list and does not call a model implicitly', () => {
  const result = buildRecipeSuggestionContext(createInput({
    shoppingItems: [{ shoppingItemId: 'shopping-oil', name: 'Öl', quantity: 100, unit: 'ml' }],
  }));

  assert(result !== null, 'an inventory context should be created');
  assertEquals(result.shoppingQuestion, 'Willst du heute noch einkaufen?');
  assertEquals(result.context.planned_shopping_items, []);
  assertEquals(result.context.fallback_allowed, false);
});

Deno.test('includes shopping items only after explicit approval', () => {
  const result = buildRecipeSuggestionContext(createInput({
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
        ingredients: [
          { normalizedName: 'Reis', quantity: 150, unit: 'g' },
          { normalizedName: 'Öl', quantity: 10, unit: 'ml' },
        ],
      },
    ],
    shoppingItems: [{ shoppingItemId: 'shopping-oil', name: 'Öl', quantity: 100, unit: 'ml' }],
    shoppingDecision: 'yes',
  }));

  assert(result !== null, 'an inventory context should be created');
  assertEquals(result.shoppingQuestion, null);
  assertEquals(result.context.planned_shopping_items[0]?.name, 'Öl');
  assertEquals(result.context.candidate_recipes.map((recipe) => recipe.id), [
    'recipe-spinach-rice',
    'recipe-with-oil',
  ]);
});

Deno.test('fails closed when every usable lot is explicitly allergic', () => {
  const result = buildRecipeSuggestionContext(createInput({
    allergies: ['Spinat', 'Reis'],
  }));

  assertEquals(result, null);
});

Deno.test('does not infer milk allergy safety from the name Mozzarella', () => {
  const result = buildRecipeSuggestionContext(createInput({
    inventory: { lots: [{
      lotId: 'mozzarella', normalizedName: 'Mozzarella', quantity: 200,
      unit: 'g', bestBefore: null, useBy: null,
    }] },
    recipes: [],
    allergies: ['milk'],
  }));
  assertEquals(result, null);
});

Deno.test('requires verification for every allergy, intolerance and custom exclusion', () => {
  for (const rule of ['milk', 'lactose', 'my-custom-allergy']) {
    assertEquals(buildRecipeSuggestionContext(createInput({ allergies: [rule] })), null);
  }
});

Deno.test('does not offer disliked inventory or shopping ingredients to a fallback', () => {
  const result = buildRecipeSuggestionContext(createInput({
    recipes: [],
    forbiddenIngredients: [' Spinat '],
    shoppingItems: [{ shoppingItemId: 'spinach', name: 'SPINAT', quantity: 200, unit: 'g' }],
    shoppingDecision: 'yes',
  }));
  assert(result !== null);
  assertEquals(result.context.priority_foods.map((item) => item.name), ['Reis']);
  assertEquals(result.context.planned_shopping_items, []);
});
