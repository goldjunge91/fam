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

const dirty = () => integer('_dirty', { mode: 'boolean' }).notNull().default(false);

const mirrorColumns = () => ({
  createdAt: text('created_at'),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  dirty: dirty(),
});

export const storageLocations = sqliteTable(
  'storage_locations',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('storage_locations_hh_idx').on(table.householdId, table.sortOrder),
    index('storage_locations_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const fridgeItems = sqliteTable(
  'fridge_items',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    locationId: text('location_id'),
    productId: text('product_id'),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('piece'),
    expiryDate: text('expiry_date'),
    addedBy: text('added_by'),
    ...mirrorColumns(),
    packageSize: real('package_size'),
    packageSizeUnit: text('package_size_unit'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('fridge_items_hh_idx').on(table.householdId, table.deletedAt),
    index('fridge_items_loc_idx').on(table.locationId),
    index('fridge_items_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

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

export const products = sqliteTable(
  'products',
  {
    id: text('id').notNull(),
    barcode: text('barcode'),
    name: text('name').notNull(),
    brand: text('brand'),
    kcalPer100: real('kcal_per_100'),
    proteinGPer100: real('protein_g_per_100'),
    carbsGPer100: real('carbs_g_per_100'),
    fatGPer100: real('fat_g_per_100'),
    fiberGPer100: real('fiber_g_per_100'),
    sugarGPer100: real('sugar_g_per_100'),
    saltGPer100: real('salt_g_per_100'),
    servingSizeG: real('serving_size_g'),
    offCategoryTags: text('off_category_tags').default('[]'),
    offLastModifiedAt: text('off_last_modified_at'),
    source: text('source').notNull().default('manual'),
    createdBy: text('created_by'),
    ...mirrorColumns(),
  },
  (table) => [primaryKey({ columns: [table.id] }), index('products_barcode_idx').on(table.barcode)],
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

export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    op: text('op').notNull(),
    payload: text('payload').notNull(),
    createdAt: integer('created_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: integer('next_attempt_at').notNull().default(0),
  },
  (table) => [
    check('outbox_op_check', sql`${table.op} in ('insert', 'update', 'delete', 'restore')`),
    index('outbox_row_idx').on(table.entity, table.entityId, table.id),
    index('outbox_due_idx').on(table.nextAttemptAt, table.id),
  ],
);

export const syncState = sqliteTable(
  'sync_state',
  {
    entity: text('entity').notNull(),
    scope: text('scope').notNull().default('default'),
    lastSyncedAt: text('last_synced_at'),
    lastSyncedId: text('last_synced_id'),
    lastRunAt: integer('last_run_at'),
    lastError: text('last_error'),
  },
  (table) => [primaryKey({ columns: [table.entity, table.scope] })],
);

export const appMeta = sqliteTable(
  'app_meta',
  {
    key: text('key').notNull(),
    value: text('value'),
  },
  (table) => [primaryKey({ columns: [table.key] })],
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

export const households = sqliteTable(
  'households',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    createdBy: text('created_by'),
    ...mirrorColumns(),
    premiumActive: integer('premium_active', { mode: 'boolean' }).notNull().default(false),
    premiumExpiresAt: text('premium_expires_at'),
    premiumUpdatedAt: text('premium_updated_at'),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const productUsage = sqliteTable(
  'product_usage',
  {
    id: text('id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id'),
    feature: text('feature').notNull(),
    mealType: text('meal_type'),
    productId: text('product_id'),
    name: text('name').notNull(),
    brand: text('brand'),
    barcode: text('barcode'),
    unit: text('unit'),
    quantity: real('quantity'),
    kcal: real('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
    usedAt: text('used_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check(
      'product_usage_feature_check',
      sql`${table.feature} in ('fridge', 'shopping_list', 'diary')`,
    ),
    check(
      'product_usage_meal_type_check',
      sql`${table.mealType} in ('breakfast', 'lunch', 'dinner', 'snack')`,
    ),
    index('product_usage_lookup_idx').on(table.userId, table.feature, table.mealType, table.usedAt),
  ],
);

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

export const mealPlans = sqliteTable(
  'meal_plans',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    weekStartDate: text('week_start_date').notNull(),
    createdBy: text('created_by'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('meal_plans_hh_idx').on(table.householdId, table.deletedAt),
    index('meal_plans_week_idx').on(table.householdId, table.weekStartDate),
    index('meal_plans_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const mealPlanEntries = sqliteTable(
  'meal_plan_entries',
  {
    id: text('id').notNull(),
    mealPlanId: text('meal_plan_id').notNull(),
    householdId: text('household_id').notNull(),
    recipeId: text('recipe_id').notNull(),
    entryDate: text('entry_date').notNull(),
    mealSlot: text('meal_slot').notNull(),
    servingsMode: text('servings_mode').notNull().default('portions'),
    portions: real('portions').notNull(),
    peopleCount: integer('people_count'),
    createdBy: text('created_by'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('meal_plan_entries_plan_idx').on(table.mealPlanId, table.deletedAt),
    index('meal_plan_entries_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
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

export const localBrochureStores = sqliteTable(
  'local_brochure_stores',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    logoUrl: text('logo_url'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const localBrochures = sqliteTable(
  'local_brochures',
  {
    id: text('id').notNull(),
    storeId: text('store_id').notNull(),
    title: text('title').notNull(),
    validFrom: text('valid_from').notNull(),
    validUntil: text('valid_until').notNull(),
    coverImage: text('cover_image').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('local_brochures_store_idx').on(table.storeId),
  ],
);

export const localBrochurePages = sqliteTable(
  'local_brochure_pages',
  {
    id: text('id').notNull(),
    brochureId: text('brochure_id').notNull(),
    pageNumber: integer('page_number').notNull(),
    imageUrl: text('image_url').notNull(),
    hotspotsJson: text('hotspots_json').notNull().default('[]'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('local_brochure_pages_brochure_idx').on(table.brochureId, table.pageNumber),
  ],
);

export const favoriteBrochureStores = sqliteTable(
  'favorite_brochure_stores',
  {
    id: text('id').notNull(),
    userId: text('user_id').notNull(),
    storeId: text('store_id').notNull(),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('favorite_brochure_stores_user_idx').on(table.userId, table.deletedAt),
    index('favorite_brochure_stores_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const localBrochureCache = sqliteTable(
  'local_brochure_cache',
  {
    id: integer('id').notNull(),
    zipCode: text('zip_code').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('local_brochure_cache_single_row_check', sql`${table.id} = 1`),
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

export const localDrizzleSchema = {
  appMeta,
  favoriteBrochureStores,
  fridgeItems,
  households,
  localBrochureCache,
  localBrochurePages,
  localBrochureStores,
  localBrochures,
  localRecipePreferences,
  mealPlanEntries,
  mealPlans,
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
};
