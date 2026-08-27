import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const recipes = sqliteTable(
  'recipes',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    title: text('title').notNull(),
    instructions: text('instructions'),
    createdBy: text('created_by'),
    ...mirrorColumns(),
    coverImagePath: text('cover_image_path'),
    cookTimeMinutes: integer('cook_time_minutes'),
    difficulty: text('difficulty'),
    dishTypes: text('dish_types').notNull().default('[]'),
    dietaryTags: text('dietary_tags').notNull().default('[]'),
    hashtags: text('hashtags').notNull().default('[]'),
    defaultServings: integer('default_servings').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('recipes_hh_idx').on(table.householdId, table.deletedAt),
    index('recipes_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const recipeComponents = sqliteTable(
  'recipe_components',
  {
    id: text('id').notNull(),
    recipeId: text('recipe_id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    servingGrams: real('serving_grams'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('recipe_components_recipe_idx').on(table.recipeId, table.deletedAt),
    index('recipe_components_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const recipeComponentItems = sqliteTable(
  'recipe_component_items',
  {
    id: text('id').notNull(),
    componentId: text('component_id').notNull(),
    recipeId: text('recipe_id').notNull(),
    householdId: text('household_id').notNull(),
    productId: text('product_id'),
    subComponentId: text('sub_component_id'),
    grams: real('grams').notNull(),
    ...mirrorColumns(),
    quantity: real('quantity'),
    unit: text('unit').notNull().default('g'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('recipe_component_items_component_idx').on(table.componentId, table.deletedAt),
    index('recipe_component_items_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const recipeSteps = sqliteTable(
  'recipe_steps',
  {
    id: text('id').notNull(),
    recipeId: text('recipe_id').notNull(),
    householdId: text('household_id').notNull(),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    imagePath: text('image_path'),
    ...mirrorColumns(),
    timerMinutes: integer('timer_minutes'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('recipe_steps_recipe_idx').on(table.recipeId, table.deletedAt),
    index('recipe_steps_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const recipeStepIngredients = sqliteTable(
  'recipe_step_ingredients',
  {
    id: text('id').notNull(),
    stepId: text('step_id').notNull(),
    itemId: text('item_id').notNull(),
    householdId: text('household_id').notNull(),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('recipe_step_ingredients_step_idx').on(table.stepId, table.deletedAt),
    index('recipe_step_ingredients_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const localRecipePreferences = sqliteTable(
  'local_recipe_preferences',
  {
    userId: text('user_id').notNull(),
    recipeKey: text('recipe_key').notNull(),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    rating: integer('rating'),
    note: text('note'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeKey] }),
    check('local_recipe_preferences_favorite_check', sql`${table.isFavorite} in (0, 1)`),
    check(
      'local_recipe_preferences_rating_check',
      sql`${table.rating} is null or ${table.rating} between 1 and 10`,
    ),
    index('local_recipe_preferences_user_idx').on(table.userId, table.updatedAt),
  ],
);
