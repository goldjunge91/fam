import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRecipeContext,
  validateRecipeResponse,
} from './recipe-suggestion.mjs';

const baseInput = {
  servings: 3,
  allergies: ['peanut'],
  preferences: ['simple'],
  allowedStaples: ['oil', 'salt'],
  inventory: [
    {
      id: 'inventory-spinach',
      name: 'Spinat',
      quantity: 1,
      unit: 'package',
      priorityScore: 100,
      allergens: [],
    },
    {
      id: 'inventory-tomatoes',
      name: 'Tomaten',
      quantity: 3,
      unit: 'piece',
      priorityScore: 80,
      allergens: [],
    },
    {
      id: 'inventory-peanuts',
      name: 'Erdnüsse',
      quantity: 1,
      unit: 'package',
      priorityScore: 90,
      allergens: ['peanut'],
    },
  ],
  shoppingList: [],
  candidateRecipes: [
    {
      id: 'catalog-spinach-tomato',
      source: 'catalog',
      title: 'Spinat-Tomaten-Pasta',
      ingredientNames: ['Spinat', 'Tomaten', 'oil', 'salt'],
    },
  ],
};

test('leere Einkaufsliste erzeugt keine Einkaufsnachfrage', () => {
  const context = buildRecipeContext(baseInput);

  assert.equal(context.shopping_question, null);
  assert.deepEqual(context.planned_shopping_items, []);
  assert.deepEqual(
    context.priority_foods.map((food) => food.name),
    ['Spinat', 'Tomaten'],
  );
});

test('gefüllte Einkaufsliste fragt vor der Berücksichtigung nach dem Einkauf', () => {
  const context = buildRecipeContext({
    ...baseInput,
    shoppingList: [
      { id: 'shopping-mozzarella', name: 'Mozzarella', quantity: 1, unit: 'package' },
    ],
  });

  assert.equal(context.shopping_question, 'Willst du heute noch einkaufen?');
  assert.deepEqual(context.planned_shopping_items, []);
});

test('Einkaufszusage ergänzt geplante Zutaten, aber keinen Bestand', () => {
  const context = buildRecipeContext(
    {
      ...baseInput,
      shoppingList: [
        { id: 'shopping-mozzarella', name: 'Mozzarella', quantity: 1, unit: 'package' },
      ],
    },
    'yes',
  );

  assert.equal(context.shopping_question, null);
  assert.deepEqual(context.planned_shopping_items, [
    {
      shopping_item_id: 'shopping-mozzarella',
      name: 'Mozzarella',
      quantity: 1,
      unit: 'package',
    },
  ]);
  assert.equal(
    context.priority_foods.some((food) => food.name === 'Mozzarella'),
    false,
  );
});

test('Ablehnung des Einkaufs hält den Kontext auf dem Bestand', () => {
  const context = buildRecipeContext(
    {
      ...baseInput,
      shoppingList: [
        { id: 'shopping-mozzarella', name: 'Mozzarella', quantity: 1, unit: 'package' },
      ],
    },
    'no',
  );

  assert.equal(context.shopping_question, null);
  assert.deepEqual(context.planned_shopping_items, []);
});

test('Katalogkandidaten werden nach Prioritätsabdeckung auf maximal drei begrenzt', () => {
  const context = buildRecipeContext({
    ...baseInput,
    candidateRecipes: [
      {
        id: 'catalog-tomato',
        source: 'catalog',
        title: 'Tomatenbrot',
        ingredientNames: ['Tomaten', 'salt'],
      },
      ...baseInput.candidateRecipes,
      {
        id: 'catalog-spinach',
        source: 'catalog',
        title: 'Spinatsuppe',
        ingredientNames: ['Spinat', 'salt'],
      },
      {
        id: 'catalog-unavailable',
        source: 'catalog',
        title: 'Erdnuss-Curry',
        ingredientNames: ['Erdnüsse'],
      },
    ],
  });

  assert.deepEqual(
    context.candidate_recipes.map((recipe) => recipe.id),
    ['catalog-spinach-tomato', 'catalog-spinach', 'catalog-tomato'],
  );
  assert.equal(context.fallback_allowed, false);
});

test('kein passender Katalogkandidat erlaubt einen generativen Fallback', () => {
  const context = buildRecipeContext({
    ...baseInput,
    candidateRecipes: [
      {
        id: 'catalog-peanut',
        source: 'catalog',
        title: 'Erdnuss-Curry',
        ingredientNames: ['Erdnüsse'],
      },
    ],
  });

  assert.deepEqual(context.candidate_recipes, []);
  assert.equal(context.fallback_allowed, true);
});

test('deterministische Templates bleiben als Templatequelle erkennbar', () => {
  const context = buildRecipeContext({
    ...baseInput,
    candidateRecipes: [
      {
        id: 'template-spinach-pan',
        source: 'template',
        title: 'Grüne Pfanne',
        ingredientNames: ['Spinat', 'oil'],
      },
    ],
  });

  assert.deepEqual(context.candidate_recipes, [
    {
      id: 'template-spinach-pan',
      source: 'template',
      title: 'Grüne Pfanne',
      ingredient_names: ['Spinat', 'oil'],
    },
  ]);
});

test('generativer Fallback ist nur ohne Katalogkandidaten gültig', () => {
  const context = buildRecipeContext({
    ...baseInput,
    candidateRecipes: [],
  });
  const result = validateRecipeResponse(context, {
    schema_version: 1,
    meals: [
      {
        title: 'Spinat mit Tomaten',
        source: 'model_generated',
        recipe_id: null,
        servings: 3,
        used_items: [
          { inventory_item_id: 'inventory-spinach', quantity: 1, unit: 'package' },
        ],
        additional_ingredients: ['oil', 'salt'],
        steps: ['Kurz garen.'],
        notes: [],
      },
    ],
  });

  assert.equal(result.ok, true);
});

test('Structured-Output-Validator akzeptiert gültige Katalogantwort', () => {
  const context = buildRecipeContext(baseInput);
  const result = validateRecipeResponse(context, {
    schema_version: 1,
    meals: [
      {
        title: 'Spinat-Tomaten-Pasta',
        source: 'catalog',
        recipe_id: 'catalog-spinach-tomato',
        servings: 3,
        used_items: [
          { inventory_item_id: 'inventory-spinach', quantity: 1, unit: 'package' },
          { inventory_item_id: 'inventory-tomatoes', quantity: 3, unit: 'piece' },
        ],
        additional_ingredients: ['oil', 'salt'],
        steps: ['Kochen.'],
        notes: [],
      },
    ],
  });

  assert.equal(result.ok, true);
});

test('Structured-Output-Validator verwirft fremde IDs, Allergene und mehr als drei Mahlzeiten', () => {
  const context = buildRecipeContext(baseInput);
  const result = validateRecipeResponse(context, {
    schema_version: 1,
    meals: Array.from({ length: 4 }, (_, index) => ({
      title: `Mahlzeit ${index + 1}`,
      source: 'model_generated',
      recipe_id: null,
      servings: 3,
      used_items: [
        { inventory_item_id: 'inventory-unknown', quantity: 1, unit: 'piece' },
      ],
      additional_ingredients: ['Erdnüsse'],
      steps: ['Kochen.'],
      notes: [],
    })),
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.includes('meals must contain between 1 and 3 entries'), true);
  assert.equal(
    result.errors.includes('meals[0].used_items[0].inventory_item_id is not in the context'),
    true,
  );
  assert.equal(
    result.errors.includes(
      'meals[0].additional_ingredients contains a forbidden ingredient: Erdnüsse',
    ),
    true,
  );
});
