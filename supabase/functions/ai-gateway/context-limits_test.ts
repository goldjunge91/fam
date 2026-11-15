import { assertEquals } from 'jsr:@std/assert@1';

import {
  boundGatewayCookingContext,
  CONTEXT_LIMITS,
  limitContextString,
} from './context-limits.ts';
import type { GatewayCookingContext } from './handler.ts';

function recipe(recipeId: string, ingredientCount = 1) {
  return {
    recipeId,
    title: 'x'.repeat(250),
    estimatedMinutes: 10,
    servings: 2,
    dietaryTags: [],
    allergens: null,
    ingredients: Array.from({ length: ingredientCount }, (_, index) => ({
      itemId: `item-${index}`,
      productId: null,
      normalizedName: `Zutat ${index}`,
      quantity: 1,
      unit: 'piece',
    })),
  };
}

Deno.test('bounds inventory and nested snapshots with deterministic truncation metadata', () => {
  const context: GatewayCookingContext = {
    inventory: {
      source: 'inventory',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      lots: Array.from({ length: CONTEXT_LIMITS.inventoryLots + 1 }, (_, index) => ({
        lotId: `lot-${index}`,
        productId: null,
        normalizedName: 'x'.repeat(250),
        quantity: 1,
        unit: 'piece',
        bestBefore: null,
        useBy: null,
        storage: 'pantry' as const,
      })),
    },
    recipes: [recipe('overflow', CONTEXT_LIMITS.catalogIngredientsPerRecipe + 1)],
    shoppingList: Array.from({ length: CONTEXT_LIMITS.shoppingListItems + 1 }, (_, index) => ({
      itemId: `item-${index}`,
      productId: null,
      name: 'Einkauf',
      quantity: 1,
      unit: 'piece',
      categoryId: null,
      storeId: null,
      checkedAt: null,
      recipeNames: Array.from(
        { length: CONTEXT_LIMITS.recipeNamesPerShoppingItem + 2 },
        (_, nameIndex) => `Rezept ${nameIndex}`,
      ),
    })),
    mealPlan: {
      weekStartDate: '2026-01-05',
      planName: 'Woche',
      entries: [{
        entryId: 'entry-1',
        date: '2026-01-05',
        mealSlot: 'dinner',
        recipeId: null,
        title: 'Freitext',
        portions: 2,
        customIngredients: Array.from(
          { length: CONTEXT_LIMITS.customIngredientsPerEntry + 1 },
          (_, index) => ({ name: `Zutat ${index}`, quantity: 1, unit: 'piece' }),
        ),
      }],
    },
  };

  const bounded = boundGatewayCookingContext(context);

  assertEquals(bounded.inventory.lots.length, CONTEXT_LIMITS.inventoryLots);
  assertEquals(bounded.inventory.truncated, true);
  assertEquals(bounded.inventory.omittedCount, 1);
  assertEquals(bounded.inventory.lots[0]?.normalizedName.length, 200);
  assertEquals(bounded.recipes, []);
  assertEquals(bounded.unavailableRecipeIds, ['overflow']);
  assertEquals(bounded.shoppingList?.length, CONTEXT_LIMITS.shoppingListItems);
  assertEquals(bounded.shoppingListTruncated, true);
  assertEquals(bounded.shoppingListOmittedCount! > 0, true);
  assertEquals(
    bounded.shoppingList?.[0]?.recipeNames.length,
    CONTEXT_LIMITS.recipeNamesPerShoppingItem,
  );
  assertEquals(bounded.shoppingList?.[0]?.recipeNamesTruncated, true);
  assertEquals(
    bounded.mealPlan?.entries[0]?.customIngredients.length,
    CONTEXT_LIMITS.customIngredientsPerEntry,
  );
  assertEquals(bounded.mealPlan?.entries[0]?.customIngredientsTruncated, true);
  assertEquals(limitContextString('x'.repeat(201)).length, 200);
});

Deno.test('keeps complete recipes and preserves explicit unavailable markers', () => {
  const context: GatewayCookingContext = {
    inventory: { source: 'inventory', fetchedAt: 'now', lots: [] },
    recipes: [recipe('complete')],
    householdRecipes: [recipe('household')],
    unavailableRecipeIds: ['missing'],
  };

  const bounded = boundGatewayCookingContext(context);

  assertEquals(bounded.recipes.map((item) => item.recipeId), ['complete']);
  assertEquals(bounded.householdRecipes?.map((item) => item.recipeId), ['household']);
  assertEquals(bounded.unavailableRecipeIds, ['missing']);
});
