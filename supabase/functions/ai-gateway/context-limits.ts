import type {
  GatewayCookingContext,
  GatewayMealPlanContext,
  GatewayRecipe,
  GatewayShoppingListItem,
} from './handler.ts';

export const CONTEXT_LIMITS = {
  inventoryLots: 50,
  householdRecipes: 50,
  householdComponentsPerRecipe: 50,
  householdIngredientsPerRecipe: 100,
  relevantProductIds: 100,
  catalogCandidateItems: 500,
  catalogRecipes: 50,
  catalogIngredientsPerRecipe: 100,
  catalogIngredientItems: 1_000,
  mealPlanEntries: 21,
  customIngredientsPerEntry: 20,
  shoppingListItems: 100,
  recipeNamesPerShoppingItem: 10,
  recipeNamesTotal: 100,
  maxContextValueChars: 200,
} as const;

export type LimitedArray<T> = {
  values: T[];
  truncated: boolean;
  omittedCount: number;
};

export function limitContextString(value: string | null | undefined): string {
  return (value ?? '').trim().slice(0, CONTEXT_LIMITS.maxContextValueChars);
}

export function limitContextArray<T>(
  values: readonly T[],
  limit: number,
): LimitedArray<T> {
  const bounded = values.slice(0, limit);
  return {
    values: bounded,
    truncated: values.length > limit,
    omittedCount: Math.max(0, values.length - bounded.length),
  };
}

function mergeTruncation(
  previousTruncated: boolean | undefined,
  previousOmittedCount: number | undefined,
  next: LimitedArray<unknown>,
): { truncated: boolean; omittedCount: number } {
  const omittedCount = Math.max(0, previousOmittedCount ?? 0) + next.omittedCount;
  return {
    truncated: previousTruncated === true || next.truncated,
    omittedCount,
  };
}

function boundRecipe(recipe: GatewayRecipe): GatewayRecipe | null {
  const ingredients = recipe.ingredients.map((ingredient) => ({
    ...ingredient,
    itemId: ingredient.itemId ? limitContextString(ingredient.itemId) : undefined,
    productId: ingredient.productId ? limitContextString(ingredient.productId) : null,
    normalizedName: limitContextString(ingredient.normalizedName),
    unit: ingredient.unit ? limitContextString(ingredient.unit) : null,
  }));
  if (
    recipe.ingredientDataComplete === false ||
    ingredients.length > CONTEXT_LIMITS.catalogIngredientsPerRecipe
  ) {
    return null;
  }
  return {
    ...recipe,
    recipeId: limitContextString(recipe.recipeId),
    title: limitContextString(recipe.title),
    updatedAt: recipe.updatedAt ? limitContextString(recipe.updatedAt) : undefined,
    dietaryTags: recipe.dietaryTags.map((tag) => limitContextString(tag)),
    allergens: recipe.allergens?.map((allergen) => limitContextString(allergen)) ?? null,
    ingredients,
    canonicalIngredientIds: recipe.canonicalIngredientIds?.map(limitContextString),
    ingredientMappingVersion: recipe.ingredientMappingVersion
      ? limitContextString(recipe.ingredientMappingVersion)
      : undefined,
    ...(recipe.allergenProjection
      ? {
        allergenProjection: {
          ...recipe.allergenProjection,
          allergenIds: recipe.allergenProjection.allergenIds,
          conflictingAllergenIds: recipe.allergenProjection.conflictingAllergenIds,
          unknownAllergenIds: recipe.allergenProjection.unknownAllergenIds,
          rulesUpdatedAt: recipe.allergenProjection.rulesUpdatedAt
            ? limitContextString(recipe.allergenProjection.rulesUpdatedAt)
            : null,
          knowledgeVersion: limitContextString(recipe.allergenProjection.knowledgeVersion),
        },
      }
      : {}),
  };
}

function boundShoppingList(
  items: readonly GatewayShoppingListItem[],
  previousTruncated?: boolean,
  previousOmittedCount?: number,
): { items: GatewayShoppingListItem[]; truncated: boolean; omittedCount: number } {
  const limitedItems = limitContextArray(items, CONTEXT_LIMITS.shoppingListItems);
  let remainingRecipeNames = CONTEXT_LIMITS.recipeNamesTotal;
  const boundedItems = limitedItems.values.map((item) => {
    const perItem = limitContextArray(
      item.recipeNames.map((name) => limitContextString(name)),
      CONTEXT_LIMITS.recipeNamesPerShoppingItem,
    );
    const total = limitContextArray(perItem.values, remainingRecipeNames);
    remainingRecipeNames -= total.values.length;
    const metadata = mergeTruncation(
      item.recipeNamesTruncated,
      item.recipeNamesOmittedCount,
      {
        values: [],
        truncated: perItem.truncated || total.truncated,
        omittedCount: perItem.omittedCount + total.omittedCount,
      },
    );
    return {
      ...item,
      itemId: limitContextString(item.itemId),
      productId: item.productId ? limitContextString(item.productId) : null,
      name: limitContextString(item.name),
      unit: limitContextString(item.unit),
      categoryId: item.categoryId ? limitContextString(item.categoryId) : null,
      storeId: item.storeId ? limitContextString(item.storeId) : null,
      checkedAt: item.checkedAt ? limitContextString(item.checkedAt) : null,
      recipeNames: total.values,
      ...(metadata.truncated
        ? {
          recipeNamesTruncated: true,
          recipeNamesOmittedCount: metadata.omittedCount,
        }
        : {}),
    };
  });
  const itemMetadata = mergeTruncation(
    undefined,
    undefined,
    limitedItems as LimitedArray<unknown>,
  );
  return {
    items: boundedItems,
    truncated: previousTruncated === true || itemMetadata.truncated ||
      boundedItems.some((item) => item.recipeNamesTruncated),
    omittedCount: Math.max(0, previousOmittedCount ?? 0) + itemMetadata.omittedCount +
      boundedItems.reduce(
        (sum, item) => sum + (item.recipeNamesOmittedCount ?? 0),
        0,
      ),
  };
}

function boundMealPlan(mealPlan: GatewayMealPlanContext): GatewayMealPlanContext {
  const limitedEntries = limitContextArray(mealPlan.entries, CONTEXT_LIMITS.mealPlanEntries);
  const entries = limitedEntries.values.map((entry) => {
    const customIngredients = limitContextArray(
      entry.customIngredients.map((ingredient) => ({
        name: limitContextString(ingredient.name),
        quantity: ingredient.quantity,
        unit: limitContextString(ingredient.unit),
      })),
      CONTEXT_LIMITS.customIngredientsPerEntry,
    );
    const customMetadata = mergeTruncation(
      entry.customIngredientsTruncated,
      entry.customIngredientsOmittedCount,
      customIngredients as LimitedArray<unknown>,
    );
    return {
      ...entry,
      entryId: limitContextString(entry.entryId),
      date: limitContextString(entry.date),
      title: limitContextString(entry.title),
      recipeId: entry.recipeId ? limitContextString(entry.recipeId) : null,
      customIngredients: customIngredients.values,
      ...(customMetadata.truncated
        ? {
          customIngredientsTruncated: true,
          customIngredientsOmittedCount: customMetadata.omittedCount,
        }
        : {}),
    };
  });
  const metadata = mergeTruncation(
    mealPlan.truncated,
    mealPlan.omittedCount,
    limitedEntries as LimitedArray<unknown>,
  );
  return {
    ...mealPlan,
    weekStartDate: limitContextString(mealPlan.weekStartDate),
    planName: mealPlan.planName ? limitContextString(mealPlan.planName) : null,
    entries,
    ...(metadata.truncated ? { truncated: true, omittedCount: metadata.omittedCount } : {}),
  };
}

export function boundGatewayCookingContext(
  context: GatewayCookingContext,
): GatewayCookingContext {
  const lots = limitContextArray(context.inventory.lots, CONTEXT_LIMITS.inventoryLots);
  const inventoryMetadata = mergeTruncation(
    context.inventory.truncated,
    context.inventory.omittedCount,
    lots as LimitedArray<unknown>,
  );
  const boundedLots = lots.values.map((lot) => ({
    ...lot,
    lotId: limitContextString(lot.lotId),
    productId: lot.productId ? limitContextString(lot.productId) : null,
    normalizedName: limitContextString(lot.normalizedName),
    unit: lot.unit ? limitContextString(lot.unit) : null,
    bestBefore: lot.bestBefore ? limitContextString(lot.bestBefore) : null,
    useBy: lot.useBy ? limitContextString(lot.useBy) : null,
  }));

  const unavailableRecipeIds = new Set(
    (context.unavailableRecipeIds ?? []).map((recipeId) => limitContextString(recipeId)),
  );
  const boundRecipes = (
    recipes: readonly GatewayRecipe[] | undefined,
    limit: number,
  ): GatewayRecipe[] => {
    const limited = limitContextArray(recipes ?? [], limit);
    return limited.values.flatMap((recipe) => {
      const bounded = boundRecipe(recipe);
      if (bounded) return [bounded];
      unavailableRecipeIds.add(limitContextString(recipe.recipeId));
      return [];
    });
  };
  const recipes = boundRecipes(context.recipes, CONTEXT_LIMITS.catalogRecipes);
  const householdRecipes = boundRecipes(
    context.householdRecipes,
    CONTEXT_LIMITS.householdRecipes,
  );
  const shopping = boundShoppingList(
    context.shoppingList ?? [],
    context.shoppingListTruncated,
    context.shoppingListOmittedCount,
  );
  const mealPlan = context.mealPlan ? boundMealPlan(context.mealPlan) : undefined;

  return {
    ...context,
    inventory: {
      ...context.inventory,
      fetchedAt: limitContextString(context.inventory.fetchedAt),
      lots: boundedLots,
      ...(inventoryMetadata.truncated
        ? { truncated: true, omittedCount: inventoryMetadata.omittedCount }
        : {}),
    },
    recipes,
    ...(context.householdRecipes !== undefined ? { householdRecipes } : {}),
    ...(unavailableRecipeIds.size > 0 ? { unavailableRecipeIds: [...unavailableRecipeIds] } : {}),
    shoppingList: shopping.items,
    ...(shopping.truncated
      ? { shoppingListTruncated: true, shoppingListOmittedCount: shopping.omittedCount }
      : {}),
    ...(mealPlan ? { mealPlan } : {}),
  };
}
