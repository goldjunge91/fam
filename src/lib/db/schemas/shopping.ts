import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const shoppingListItems = sqliteTable(
  'shopping_list_items',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    productId: text('product_id'),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('piece'),
    categoryId: text('category_id'),
    categorySource: text('category_source'),
    categoryClassifierVersion: text('category_classifier_version'),
    sortIndex: integer('sort_index').notNull().default(0),
    checkedAt: text('checked_at'),
    checkedBy: text('checked_by'),
    addedBy: text('added_by'),
    ...mirrorColumns(),
    storeId: text('store_id'),
    priceEstimate: real('price_estimate'),
    recipeNames: text('recipe_names').notNull().default('[]'),
    packageSize: real('package_size'),
    packageSizeUnit: text('package_size_unit'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check(
      'shopping_list_items_category_id_check',
      sql`${table.categoryId} in (
        'fresh_produce','bakery','chilled_dairy_eggs','ambient_milk_drinks',
        'chilled_plant_based','meat_poultry','fish_seafood','deli',
        'pasta_tomato','rice_world_foods','breakfast','baking','oils_spices',
        'condiments','canned_jars','ready_meals','snacks','sweets',
        'cold_drinks','hot_drinks','alcohol','frozen','baby','pets',
        'household','personal_care','other','produce','convenience',
        'hot_beverages','pantry_staples','cooking_baking','canned_sauces',
        'beverages','drugstore','baby_kids','pet_supplies','deli_cold_cuts',
        'plant_based','dairy_eggs','checkout','deli_meat','pantry_canned',
        'pantry_dry','dairy'
      )`,
    ),
    check(
      'shopping_list_items_category_source_check',
      sql`${table.categorySource} in ('user','store_preference','household_preference','off_taxonomy','name_fallback')`,
    ),
    check(
      'shopping_list_items_classifier_version_check',
      sql`${table.categoryClassifierVersion} is null or length(trim(${table.categoryClassifierVersion})) between 1 and 100`,
    ),
    index('shopping_list_items_hh_idx').on(table.householdId, table.deletedAt),
    index('shopping_list_items_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
    index('shopping_list_items_store_idx').on(table.storeId),
  ],
);

export const shoppingCategoryPreferences = sqliteTable(
  'shopping_category_preferences',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    storeId: text('store_id'),
    keyType: text('key_type').notNull(),
    normalizedKeyValue: text('normalized_key_value').notNull(),
    categoryId: text('category_id'),
    createdBy: text('created_by'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check(
      'shopping_category_preferences_key_type_check',
      sql`${table.keyType} in ('product', 'name')`,
    ),
    check(
      'shopping_category_preferences_normalized_key_check',
      sql`length(${table.normalizedKeyValue}) between 1 and 500 and ${table.normalizedKeyValue} = lower(trim(${table.normalizedKeyValue}))`,
    ),
    uniqueIndex('shopping_category_preferences_household_key_v18')
      .on(table.householdId, table.keyType, table.normalizedKeyValue)
      .where(sql`${table.storeId} is null`),
    uniqueIndex('shopping_category_preferences_store_key_v18')
      .on(table.householdId, table.storeId, table.keyType, table.normalizedKeyValue)
      .where(sql`${table.storeId} is not null`),
    index('shopping_category_preferences_hh_idx_v18').on(
      table.householdId,
      table.updatedAt,
      table.id,
    ),
    index('shopping_category_preferences_dirty_idx_v18')
      .on(table.dirty)
      .where(sql`${table.dirty} = 1`),
  ],
);

export const shoppingHistory = sqliteTable(
  'shopping_history',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    completedBy: text('completed_by'),
    completedAt: text('completed_at').notNull(),
    itemName: text('item_name').notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    categoryId: text('category_id'),
    categorySource: text('category_source'),
    categoryClassifierVersion: text('category_classifier_version'),
    productId: text('product_id'),
    locationKind: text('location_kind'),
    expiryDate: text('expiry_date'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check(
      'shopping_history_category_id_check',
      sql`${table.categoryId} in (
        'fresh_produce','bakery','chilled_dairy_eggs','ambient_milk_drinks',
        'chilled_plant_based','meat_poultry','fish_seafood','deli',
        'pasta_tomato','rice_world_foods','breakfast','baking','oils_spices',
        'condiments','canned_jars','ready_meals','snacks','sweets',
        'cold_drinks','hot_drinks','alcohol','frozen','baby','pets',
        'household','personal_care','other','produce','convenience',
        'hot_beverages','pantry_staples','cooking_baking','canned_sauces',
        'beverages','drugstore','baby_kids','pet_supplies','deli_cold_cuts',
        'plant_based','dairy_eggs','checkout','deli_meat','pantry_canned',
        'pantry_dry','dairy'
      )`,
    ),
    check(
      'shopping_history_category_source_check',
      sql`${table.categorySource} in ('user','store_preference','household_preference','off_taxonomy','name_fallback')`,
    ),
    check(
      'shopping_history_classifier_version_check',
      sql`${table.categoryClassifierVersion} is null or length(trim(${table.categoryClassifierVersion})) between 1 and 100`,
    ),
    index('shopping_history_hh_idx').on(table.householdId, table.completedAt),
  ],
);

export const stores = sqliteTable(
  'stores',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...mirrorColumns(),
    categoryOrder: text('category_order'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('stores_hh_idx').on(table.householdId, table.sortOrder),
    index('stores_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const shoppingCategoryFeedbackEvents = sqliteTable(
  'shopping_category_feedback_events',
  {
    eventId: text('event_id').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    taxonomyVersion: text('taxonomy_version').notNull(),
    eventType: text('event_type').notNull(),
    inputMethod: text('input_method').notNull(),
    householdId: text('household_id').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    shoppingListItemId: text('shopping_list_item_id').notNull(),
    productKeyType: text('product_key_type').notNull(),
    productKey: text('product_key').notNull(),
    productId: text('product_id'),
    barcode: text('barcode'),
    productName: text('product_name').notNull(),
    storeId: text('store_id'),
    preferenceScope: text('preference_scope').notNull(),
    oldPlacementZone: text('old_placement_zone').notNull(),
    newPlacementZone: text('new_placement_zone').notNull(),
    predictedPlacementZone: text('predicted_placement_zone').notNull(),
    oldCategorySource: text('old_category_source').notNull(),
    newCategorySource: text('new_category_source').notNull(),
    predictedProductFamily: text('predicted_product_family').notNull(),
    predictedProductForm: text('predicted_product_form').notNull(),
    classifierVersion: text('classifier_version').notNull(),
    platform: text('platform').notNull(),
    appVersion: text('app_version').notNull(),
    buildChannel: text('build_channel').notNull(),
    clientCreatedAt: text('client_created_at').notNull(),
    dirty: integer('_dirty', { mode: 'boolean' }).notNull().default(true),
    syncedAt: integer('synced_at'),
  },
  (table) => [
    primaryKey({ columns: [table.eventId] }),
    check(
      'shopping_category_feedback_event_type_check',
      sql`${table.eventType} in ('manual_reassign', 'reset_to_automatic')`,
    ),
    check(
      'shopping_category_feedback_input_method_check',
      sql`${table.inputMethod} in ('add_form', 'edit_form')`,
    ),
    check(
      'shopping_category_feedback_product_key_type_check',
      sql`${table.productKeyType} in ('product', 'barcode', 'name')`,
    ),
    check(
      'shopping_category_feedback_preference_scope_check',
      sql`${table.preferenceScope} in ('store', 'household')`,
    ),
    check(
      'shopping_category_feedback_platform_check',
      sql`${table.platform} in ('ios', 'android', 'web')`,
    ),
    index('shopping_category_feedback_events_hh_idx').on(
      table.householdId,
      table.clientCreatedAt,
      table.eventId,
    ),
    index('shopping_category_feedback_events_product_idx').on(
      table.productKeyType,
      table.productKey,
    ),
  ],
);
