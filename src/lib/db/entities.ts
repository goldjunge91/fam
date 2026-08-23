import type { Entity } from '@/lib/db/types';

export type EntityMeta = {
  entity: Entity;
  table: Entity;
  /** `false` fuer Tabellen ohne serverseitigen Tombstone. */
  hasServerTombstone: boolean;
  /** `false` fuer globale Tabellen ohne `household_id`. */
  householdScoped: boolean;
  /** Fachspalten ohne Sync-Metadaten, `id` zuerst. */
  columns: readonly string[];
};

export const ENTITIES: Readonly<Record<Entity, EntityMeta>> = {
  storage_locations: {
    entity: 'storage_locations',
    table: 'storage_locations',
    hasServerTombstone: true,
    householdScoped: true,
    columns: ['id', 'household_id', 'name', 'kind', 'sort_order', 'created_at'],
  },
  stores: {
    entity: 'stores',
    table: 'stores',
    hasServerTombstone: true,
    householdScoped: true,
    columns: ['id', 'household_id', 'name', 'color', 'sort_order', 'category_order', 'created_at'],
  },
  fridge_items: {
    entity: 'fridge_items',
    table: 'fridge_items',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'household_id',
      'location_id',
      'product_id',
      'name',
      'quantity',
      'unit',
      'package_size',
      'package_size_unit',
      'expiry_date',
      'added_by',
      'created_at',
    ],
  },
  shopping_list_items: {
    entity: 'shopping_list_items',
    table: 'shopping_list_items',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'household_id',
      'product_id',
      'name',
      'quantity',
      'unit',
      'package_size',
      'package_size_unit',
      'category_id',
      'category_source',
      'category_classifier_version',
      'sort_index',
      'store_id',
      'price_estimate',
      'recipe_names',
      'checked_at',
      'checked_by',
      'added_by',
      'created_at',
    ],
  },
  shopping_category_preferences: {
    entity: 'shopping_category_preferences',
    table: 'shopping_category_preferences',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'household_id',
      'key_type',
      'normalized_key_value',
      'category_id',
      'created_by',
      'created_at',
    ],
  },
  products: {
    entity: 'products',
    table: 'products',
    hasServerTombstone: false,
    householdScoped: false,
    columns: [
      'id',
      'barcode',
      'name',
      'brand',
      'kcal_per_100',
      'protein_g_per_100',
      'carbs_g_per_100',
      'fat_g_per_100',
      'fiber_g_per_100',
      'sugar_g_per_100',
      'salt_g_per_100',
      'serving_size_g',
      'off_category_tags',
      'off_last_modified_at',
      'source',
      'created_by',
      'created_at',
    ],
  },
  households: {
    entity: 'households',
    table: 'households',
    hasServerTombstone: false,
    householdScoped: false,
    columns: [
      'id',
      'name',
      'created_by',
      'created_at',
      'premium_active',
      'premium_expires_at',
      'premium_updated_at',
    ],
  },
  recipes: {
    entity: 'recipes',
    table: 'recipes',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'household_id',
      'title',
      'instructions',
      'cover_image_path',
      'cook_time_minutes',
      'difficulty',
      'dish_types',
      'dietary_tags',
      'hashtags',
      'default_servings',
      'created_by',
      'created_at',
    ],
  },
  recipe_components: {
    entity: 'recipe_components',
    table: 'recipe_components',
    hasServerTombstone: true,
    householdScoped: true,
    columns: ['id', 'recipe_id', 'household_id', 'name', 'serving_grams', 'created_at'],
  },
  recipe_component_items: {
    entity: 'recipe_component_items',
    table: 'recipe_component_items',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'component_id',
      'recipe_id',
      'household_id',
      'product_id',
      'sub_component_id',
      'grams',
      'quantity',
      'unit',
      'created_at',
    ],
  },
  recipe_steps: {
    entity: 'recipe_steps',
    table: 'recipe_steps',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'recipe_id',
      'household_id',
      'position',
      'text',
      'image_path',
      'timer_minutes',
      'created_at',
    ],
  },
  recipe_step_ingredients: {
    entity: 'recipe_step_ingredients',
    table: 'recipe_step_ingredients',
    hasServerTombstone: true,
    householdScoped: true,
    columns: ['id', 'step_id', 'item_id', 'household_id', 'created_at'],
  },
  meal_plans: {
    entity: 'meal_plans',
    table: 'meal_plans',
    hasServerTombstone: true,
    householdScoped: true,
    columns: ['id', 'household_id', 'name', 'week_start_date', 'created_by', 'created_at'],
  },
  meal_plan_entries: {
    entity: 'meal_plan_entries',
    table: 'meal_plan_entries',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'meal_plan_id',
      'household_id',
      'recipe_id',
      'entry_date',
      'meal_slot',
      'servings_mode',
      'portions',
      'people_count',
      'created_by',
      'created_at',
    ],
  },
};

/** `households` wird nutzerspezifisch vom Bootstrap-Sync statt je Haushalt gepullt. */
export const ALL_ENTITIES: readonly Entity[] = [
  'storage_locations',
  'stores',
  'fridge_items',
  'shopping_list_items',
  'shopping_category_preferences',
  'products',
  'recipes',
  'recipe_components',
  'recipe_component_items',
  'recipe_steps',
  'recipe_step_ingredients',
  'meal_plans',
  'meal_plan_entries',
];

export function hasServerTombstone(entity: Entity): boolean {
  return ENTITIES[entity].hasServerTombstone;
}

export function metaOf(entity: Entity): EntityMeta {
  return ENTITIES[entity];
}
