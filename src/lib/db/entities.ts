import { repairFridgeItemForeignKeyViolation } from '@/features/inventory/repair-fridge-item-push';
import { repairShoppingListItemForeignKeyViolation } from '@/features/shopping-list/repair-shopping-list-item-push';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';

export type ForeignKeyViolationResolver = (
  ctx: { db: SqlDatabase; supabase: TypedSupabaseClient },
  payload: Record<string, unknown>,
  error: { code?: string; message?: string },
) => Promise<Record<string, unknown> | null>;

export type EntityMeta = {
  entity: Entity;
  /** Lokaler und entfernter Tabellenname sind identisch — deshalb derselbe Typ wie `entity`. */
  table: Entity;
  /** false bei 'products' und 'households' — dort gibt es serverseitig kein deleted_at (harte Loeschung). */
  hasServerTombstone: boolean;
  /** false bei 'products' und 'households' — beide global, kein household_id-Praefix. */
  householdScoped: boolean;
  /** Push-only-Entitaeten werden nie gepullt und brauchen keine Server-Spiegelantwort. */
  pushOnly?: boolean;
  /** Normalisiert Mengen-Einheiten aus Nutzereingaben auf den gemeinsamen Inventory-Vertrag. */
  normalizeQuantityUnits?: true;
  /** Append-only-Tabelle ohne updated_at/deleted_at auf dem Server. */
  appendOnly?: true;
  /** Remote-Pull-Cursor; Transaktionen werden nach created_at inkrementell geladen. */
  syncCursorColumn?: 'updated_at' | 'created_at';
  /** Spalten ohne updated_at/deleted_at/_dirty, id zuerst. 1:1 aus migrations.ts's V1_MIRRORS. */
  columns: readonly string[];
  /** Optionale Fehlerreparatur-Strategie, siehe `ForeignKeyViolationResolver`. */
  onForeignKeyViolation?: ForeignKeyViolationResolver;
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
    onForeignKeyViolation: repairFridgeItemForeignKeyViolation,
    normalizeQuantityUnits: true,
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
      'opened_at',
      'vacuum_sealed',
      'expiry_user_set',
    ],
  },
  transactions: {
    entity: 'transactions',
    table: 'transactions',
    hasServerTombstone: false,
    householdScoped: true,
    appendOnly: true,
    syncCursorColumn: 'created_at',
    columns: [
      'id',
      'household_id',
      'fridge_item_id',
      'product_id',
      'actor',
      'type',
      'quantity',
      'location_id',
      'reason',
      'previous_expiry_date',
      'notes',
      'undone',
      'created_at',
    ],
  },
  shopping_list_items: {
    entity: 'shopping_list_items',
    table: 'shopping_list_items',
    hasServerTombstone: true,
    householdScoped: true,
    onForeignKeyViolation: repairShoppingListItemForeignKeyViolation,
    normalizeQuantityUnits: true,
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
      'store_id',
      'key_type',
      'normalized_key_value',
      'category_id',
      'created_by',
      'created_at',
    ],
  },
  shopping_category_feedback_events: {
    entity: 'shopping_category_feedback_events',
    table: 'shopping_category_feedback_events',
    hasServerTombstone: false,
    householdScoped: true,
    pushOnly: true,
    columns: [
      'event_id',
      'schema_version',
      'taxonomy_version',
      'event_type',
      'input_method',
      'household_id',
      'actor_user_id',
      'shopping_list_item_id',
      'product_key_type',
      'product_key',
      'product_id',
      'barcode',
      'product_name',
      'store_id',
      'preference_scope',
      'old_placement_zone',
      'new_placement_zone',
      'predicted_placement_zone',
      'old_category_source',
      'new_category_source',
      'predicted_product_family',
      'predicted_product_form',
      'classifier_version',
      'platform',
      'app_version',
      'build_channel',
      'client_created_at',
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
      'plus_active',
      'plus_expires_at',
      'plus_updated_at',
      'ai_active',
      'ai_expires_at',
      'ai_updated_at',
      'ai_subscriber_id',
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
    normalizeQuantityUnits: true,
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
  favorite_brochure_stores: {
    entity: 'favorite_brochure_stores',
    table: 'favorite_brochure_stores',
    hasServerTombstone: true,
    householdScoped: false,
    columns: ['id', 'user_id', 'store_id', 'created_at'],
  },
  medication_logs: {
    entity: 'medication_logs',
    table: 'medication_logs',
    hasServerTombstone: true,
    householdScoped: false,
    columns: [
      'id',
      'user_id',
      'child_profile_id',
      'medication_name',
      'dose',
      'unit',
      'injection_site',
      'administered_at',
      'notes',
      'created_at',
    ],
  },
  symptom_logs: {
    entity: 'symptom_logs',
    table: 'symptom_logs',
    hasServerTombstone: true,
    householdScoped: false,
    columns: [
      'id',
      'user_id',
      'child_profile_id',
      'logged_at',
      'appetite_level',
      'satiety_level',
      'nausea_level',
      'side_effects',
      'notes',
      'created_at',
    ],
  },
};

export const ALL_ENTITIES: readonly Entity[] = [
  'storage_locations',
  'stores',
  'fridge_items',
  'transactions',
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
  'favorite_brochure_stores',
  'medication_logs',
  'symptom_logs',
];

/** Push-only-Events, die bewusst nicht in ALL_ENTITIES (Pull) stehen. */
export const PUSH_ONLY_ENTITIES: readonly Entity[] = ['shopping_category_feedback_events'];

export function hasServerTombstone(entity: Entity): boolean {
  return ENTITIES[entity].hasServerTombstone;
}

export function metaOf(entity: Entity): EntityMeta {
  return ENTITIES[entity];
}
