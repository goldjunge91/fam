import { assertEquals } from 'jsr:@std/assert@1';
import { projectRecipeAllergens } from './recipe-allergen-projection.ts';

const recipe = { recipeId: 'recipe-1' };
const item = { itemId: 'item-1', recipeId: recipe.recipeId };
const link = {
  catalogItemId: item.itemId,
  ingredientId: 'ingredient-1',
  confidence: 'verified',
  reviewedAt: '2026-11-06T12:00:00.000Z',
};
const ingredient = {
  ingredientId: link.ingredientId,
  allergenReviewedAt: '2026-11-06T12:00:00.000Z',
};
const mapping = {
  ingredientId: ingredient.ingredientId,
  allergenId: 'EU_05_PEANUTS',
  relation: 'contains',
};

Deno.test('projects allergen codes only from fully reviewed recipe ingredients', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item],
      links: [link],
      ingredients: [ingredient],
      mappings: [mapping],
    }).get(recipe.recipeId),
    ['EU_05_PEANUTS'],
  );
});

Deno.test('a reviewed ingredient without mapping is a reviewed clear result', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item],
      links: [link],
      ingredients: [ingredient],
      mappings: [],
    }).get(recipe.recipeId),
    [],
  );
});

Deno.test('missing ingredient links stay unknown', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item],
      links: [],
      ingredients: [],
      mappings: [],
    }).get(recipe.recipeId),
    null,
  );
});

Deno.test('an external or inferred ingredient link stays unknown', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item],
      links: [{ ...link, confidence: 'external', reviewedAt: null }],
      ingredients: [ingredient],
      mappings: [mapping],
    }).get(recipe.recipeId),
    null,
  );
});

Deno.test('unreviewed ingredient allergen knowledge stays unknown', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item],
      links: [link],
      ingredients: [{ ...ingredient, allergenReviewedAt: null }],
      mappings: [mapping],
    }).get(recipe.recipeId),
    null,
  );
});

Deno.test('conflicting ingredient identities for an item stay unknown', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item],
      links: [link, { ...link, ingredientId: 'ingredient-2' }],
      ingredients: [ingredient],
      mappings: [mapping],
    }).get(recipe.recipeId),
    null,
  );
});

Deno.test('unknown allergen codes stay unknown instead of being dropped', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item],
      links: [link],
      ingredients: [ingredient],
      mappings: [{ ...mapping, allergenId: 'EU_99_UNKNOWN' }],
    }).get(recipe.recipeId),
    null,
  );
});

Deno.test('recipes without item rows stay unknown', () => {
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [],
      links: [],
      ingredients: [],
      mappings: [],
    }).get(recipe.recipeId),
    null,
  );
});

Deno.test('every ingredient in a recipe must be reviewed', () => {
  const secondItem = { itemId: 'item-2', recipeId: recipe.recipeId };
  assertEquals(
    projectRecipeAllergens({
      recipes: [recipe],
      items: [item, secondItem],
      links: [link],
      ingredients: [ingredient],
      mappings: [mapping],
    }).get(recipe.recipeId),
    null,
  );
});
