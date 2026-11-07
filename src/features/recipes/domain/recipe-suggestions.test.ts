import { recipeSuggestionResponseSchema } from './recipe-suggestions';

const meal = {
  title: 'Tomatenpfanne',
  source: 'catalog' as const,
  recipe_id: 'recipe-1',
  servings: 2,
  used_items: [{ inventory_item_id: 'lot-tomato', quantity: 1, unit: 'piece' }],
  additional_ingredients: [],
  steps: ['Tomate garen.'],
  notes: [],
};

it('accepts one to three strictly shaped recipe alternatives', () => {
  expect(
    recipeSuggestionResponseSchema.safeParse({ schema_version: 1, meals: [meal] }).success,
  ).toBe(true);
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [meal, meal, meal],
    }).success,
  ).toBe(true);
  expect(recipeSuggestionResponseSchema.safeParse({ schema_version: 1, meals: [] }).success).toBe(
    false,
  );
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [meal, meal, meal, meal],
    }).success,
  ).toBe(false);
});

it('rejects unknown fields at every response level', () => {
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [meal],
      unexpected: true,
    }).success,
  ).toBe(false);
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [{ ...meal, unexpected: true }],
    }).success,
  ).toBe(false);
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [
        {
          ...meal,
          used_items: [{ ...meal.used_items[0], unexpected: true }],
        },
      ],
    }).success,
  ).toBe(false);
});

it('rejects malformed identifiers, quantities, and instructions', () => {
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [{ ...meal, recipe_id: null }],
    }).success,
  ).toBe(false);
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [{ ...meal, source: 'model_generated', recipe_id: null }],
    }).success,
  ).toBe(true);
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [{ ...meal, used_items: [{ ...meal.used_items[0], quantity: 0 }] }],
    }).success,
  ).toBe(false);
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 1,
      meals: [{ ...meal, steps: [] }],
    }).success,
  ).toBe(false);
  expect(
    recipeSuggestionResponseSchema.safeParse({
      schema_version: 2,
      meals: [meal],
    }).success,
  ).toBe(false);
});
