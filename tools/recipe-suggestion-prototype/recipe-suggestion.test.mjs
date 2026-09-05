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

test('Verbote gelten normalisiert auch fuer Grundzutaten und zugesagte Einkaeufe', () => {
  const input = structuredClone(baseInput);
  input.forbiddenIngredients = ['  SPINAT  ', ' SALT '];
  input.shoppingList = [
    { id: 'shopping-spinach', name: 'spinat', quantity: 2, unit: 'package' },
    { id: 'shopping-peanuts', name: 'Erdnüsse', quantity: 1, unit: 'package' },
  ];
  const context = buildRecipeContext(input, 'yes');
  assert.deepEqual(context.priority_foods.map((food) => food.name), ['Tomaten']);
  assert.deepEqual(context.constraints.allowed_staples, ['oil']);
  assert.deepEqual(context.planned_shopping_items, []);
  assert.deepEqual(context.candidate_recipes, []);
});

test('ein unbrauchbares Los sperrt kein anderes brauchbares Los desselben Lebensmittels', () => {
  const input = structuredClone(baseInput);
  input.inventory.push({ ...input.inventory[0], id: 'spinach-bad-lot', expired: true });
  const context = buildRecipeContext(input);
  assert.deepEqual(context.priority_foods.map((food) => food.inventory_item_id),
    ['inventory-spinach', 'inventory-tomatoes']);
  assert.equal(context.constraints.forbidden_ingredients.includes('Spinat'), false);
  assert.equal(context.candidate_recipes[0].id, 'catalog-spinach-tomato');
});

function validResponse() {
  return { schema_version: 1, meals: [{
    title: 'Spinat mit Tomaten', source: 'catalog', recipe_id: 'catalog-spinach-tomato',
    servings: 3,
    used_items: [{ inventory_item_id: 'inventory-spinach', quantity: 1, unit: 'package' }],
    additional_ingredients: [], steps: ['Garen.'], notes: [],
  }] };
}

test('ein widerspruechlicher Kontext erlaubt keinen verbotenen used_item', () => {
  const context = buildRecipeContext(baseInput);
  context.constraints.forbidden_ingredients.push('  SPINAT ');
  assert.equal(validateRecipeResponse(context, validResponse()).ok, false);
});

test('kumulativer Verbrauch akzeptiert die exakte Grenze auch bei Dezimalzahlen', () => {
  const context = buildRecipeContext(baseInput);
  context.priority_foods[0].available_quantity = 0.3;
  const response = validResponse();
  response.meals[0].used_items[0].quantity = 0.1;
  const second = structuredClone(response.meals[0]);
  second.used_items[0].quantity = 0.2;
  response.meals.push(second);
  assert.equal(validateRecipeResponse(context, response).ok, true);
  second.used_items[0].quantity = 0.200001;
  assert.equal(validateRecipeResponse(context, response).ok, false);
});

test('validator akzeptiert physisch gleiche Mengen in kompatiblen Einheiten', () => {
  const input = structuredClone(baseInput);
  input.inventory[0].quantity = 1;
  input.inventory[0].unit = 'kg';
  const context = buildRecipeContext(input);
  const response = validResponse();
  response.meals[0].used_items[0] = {
    inventory_item_id: 'inventory-spinach', quantity: 1000, unit: 'g',
  };
  assert.equal(validateRecipeResponse(context, response).ok, true);
});

test('Mengen werden pro Los getrennt und pro Validierungsaufruf neu gezaehlt', () => {
  const input = structuredClone(baseInput);
  input.inventory.push({ ...input.inventory[0], id: 'spinach-second-lot', priorityScore: 1 });
  const context = buildRecipeContext(input);
  const response = validResponse();
  response.meals[0].used_items.push({ inventory_item_id: 'spinach-second-lot', quantity: 1, unit: 'package' });
  const before = structuredClone({ context, response });
  assert.equal(validateRecipeResponse(context, response).ok, true);
  assert.equal(validateRecipeResponse(context, response).ok, true);
  assert.deepEqual({ context, response }, before);
});

test('ungueltige JSON-Schema-Werte werden ohne Reparatur abgewiesen', () => {
  const context = buildRecipeContext(baseInput);
  for (const mutate of [
    (r) => { r.meals[0].used_items[0].quantity = NaN; },
    (r) => { r.meals[0].used_items[0].quantity = Infinity; },
    (r) => { r.meals[0].used_items[0].quantity = '1'; },
    (r) => { r.meals[0].steps = [null]; },
    (r) => { r.meals[0].notes = ['']; },
    (r) => { r.meals[0].notes = ['  ']; },
    (r) => { r.meals[0].servings = '3'; },
    (r) => { r.meals[0].used_items = [null]; },
    (r) => { r.meals[0].recipe_id = 123; },
    (r) => { r.meals[0] = null; },
  ]) {
    const response = validResponse();
    mutate(response);
    assert.equal(validateRecipeResponse(context, response).ok, false, JSON.stringify(response));
  }
});

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
