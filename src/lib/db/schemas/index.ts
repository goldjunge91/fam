import {
  favoriteBrochureStores,
  localBrochureCache,
  localBrochurePages,
  localBrochureStores,
  localBrochures,
} from './brochures';
import { households } from './households';
import { fridgeItems, storageLocations } from './inventory';
import { mealPlanEntries, mealPlans } from './meal-planner';
import { products, productUsage } from './products';
import {
  localRecipePreferences,
  recipeComponentItems,
  recipeComponents,
  recipeStepIngredients,
  recipeSteps,
  recipes,
} from './recipes';
import {
  shoppingCategoryFeedbackEvents,
  shoppingCategoryPreferences,
  shoppingHistory,
  shoppingListItems,
  stores,
} from './shopping';
import { appMeta, outbox, syncState } from './system';
import { injectionPlans, medicationLogs, symptomLogs } from './tracking';

export * from './brochures';
export * from './households';
export * from './inventory';
export * from './meal-planner';
export * from './products';
export * from './recipes';
export * from './shopping';
export * from './system';
export * from './tracking';

export const localDrizzleSchema = {
  appMeta,
  favoriteBrochureStores,
  fridgeItems,
  households,
  injectionPlans,
  localBrochureCache,
  localBrochurePages,
  localBrochureStores,
  localBrochures,
  localRecipePreferences,
  mealPlanEntries,
  mealPlans,
  medicationLogs,
  outbox,
  productUsage,
  products,
  recipeComponentItems,
  recipeComponents,
  recipeStepIngredients,
  recipeSteps,
  recipes,
  shoppingCategoryFeedbackEvents,
  shoppingCategoryPreferences,
  shoppingHistory,
  shoppingListItems,
  storageLocations,
  stores,
  syncState,
  symptomLogs,
};
