CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `favorite_brochure_stores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fridge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`location_id` text,
	`product_id` text,
	`name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'piece' NOT NULL,
	`expiry_date` text,
	`added_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`package_size` real,
	`package_size_unit` text
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`premium_active` integer DEFAULT false NOT NULL,
	`premium_expires_at` text,
	`premium_updated_at` text
);
--> statement-breakpoint
CREATE TABLE `local_brochure_cache` (
	`id` integer PRIMARY KEY,
	`zip_code` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "local_brochure_cache_single_row_check" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `local_brochure_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`brochure_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`image_url` text NOT NULL,
	`hotspots_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `local_brochure_stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `local_brochures` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`title` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text NOT NULL,
	`cover_image` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meal_plan_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_plan_id` text NOT NULL,
	`household_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`meal_slot` text NOT NULL,
	`servings_mode` text DEFAULT 'portions' NOT NULL,
	`portions` real NOT NULL,
	`people_count` integer,
	`created_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meal_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`week_start_date` text NOT NULL,
	`created_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "outbox_op_check" CHECK("op" in ('insert', 'update', 'delete', 'restore'))
);
--> statement-breakpoint
CREATE TABLE `product_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text,
	`feature` text NOT NULL,
	`meal_type` text,
	`product_id` text,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`unit` text,
	`quantity` real,
	`kcal` real,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`used_at` text NOT NULL,
	CONSTRAINT "product_usage_feature_check" CHECK("feature" in ('fridge', 'shopping_list', 'diary')),
	CONSTRAINT "product_usage_meal_type_check" CHECK("meal_type" in ('breakfast', 'lunch', 'dinner', 'snack'))
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`brand` text,
	`kcal_per_100` real,
	`protein_g_per_100` real,
	`carbs_g_per_100` real,
	`fat_g_per_100` real,
	`fiber_g_per_100` real,
	`sugar_g_per_100` real,
	`salt_g_per_100` real,
	`serving_size_g` real,
	`off_category_tags` text DEFAULT '[]',
	`off_last_modified_at` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_component_items` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`household_id` text NOT NULL,
	`product_id` text,
	`sub_component_id` text,
	`grams` real NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`quantity` real,
	`unit` text DEFAULT 'g' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_components` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`serving_grams` real,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_step_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`item_id` text NOT NULL,
	`household_id` text NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`household_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`image_path` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`timer_minutes` integer
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text,
	`created_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`cover_image_path` text,
	`cook_time_minutes` integer,
	`difficulty` text,
	`dish_types` text DEFAULT '[]' NOT NULL,
	`dietary_tags` text DEFAULT '[]' NOT NULL,
	`hashtags` text DEFAULT '[]' NOT NULL,
	`default_servings` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_category_feedback_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`schema_version` integer NOT NULL,
	`taxonomy_version` text NOT NULL,
	`event_type` text NOT NULL,
	`input_method` text NOT NULL,
	`household_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`shopping_list_item_id` text NOT NULL,
	`product_key_type` text NOT NULL,
	`product_key` text NOT NULL,
	`product_id` text,
	`barcode` text,
	`product_name` text NOT NULL,
	`store_id` text,
	`preference_scope` text NOT NULL,
	`old_placement_zone` text NOT NULL,
	`new_placement_zone` text NOT NULL,
	`predicted_placement_zone` text NOT NULL,
	`old_category_source` text NOT NULL,
	`new_category_source` text NOT NULL,
	`predicted_product_family` text NOT NULL,
	`predicted_product_form` text NOT NULL,
	`classifier_version` text NOT NULL,
	`platform` text NOT NULL,
	`app_version` text NOT NULL,
	`build_channel` text NOT NULL,
	`client_created_at` text NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`synced_at` integer,
	CONSTRAINT "shopping_category_feedback_event_type_check" CHECK("event_type" in ('manual_reassign', 'reset_to_automatic')),
	CONSTRAINT "shopping_category_feedback_input_method_check" CHECK("input_method" in ('add_form', 'edit_form')),
	CONSTRAINT "shopping_category_feedback_product_key_type_check" CHECK("product_key_type" in ('product', 'barcode', 'name')),
	CONSTRAINT "shopping_category_feedback_preference_scope_check" CHECK("preference_scope" in ('store', 'household')),
	CONSTRAINT "shopping_category_feedback_platform_check" CHECK("platform" in ('ios', 'android', 'web'))
);
--> statement-breakpoint
CREATE TABLE `shopping_category_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`store_id` text,
	`key_type` text NOT NULL,
	`normalized_key_value` text NOT NULL,
	`category_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "shopping_category_preferences_key_type_check" CHECK("key_type" in ('product', 'name')),
	CONSTRAINT "shopping_category_preferences_normalized_key_check" CHECK(length("normalized_key_value") between 1 and 500 and "normalized_key_value" = lower(trim("normalized_key_value")))
);
--> statement-breakpoint
CREATE TABLE `shopping_history` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`completed_by` text,
	`completed_at` text NOT NULL,
	`item_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`category_id` text,
	`category_source` text,
	`category_classifier_version` text,
	`product_id` text,
	`location_kind` text,
	`expiry_date` text,
	`created_at` text NOT NULL,
	CONSTRAINT "shopping_history_category_id_check" CHECK("category_id" in (
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
      )),
	CONSTRAINT "shopping_history_category_source_check" CHECK("category_source" in ('user','store_preference','household_preference','off_taxonomy','name_fallback')),
	CONSTRAINT "shopping_history_classifier_version_check" CHECK("category_classifier_version" is null or length(trim("category_classifier_version")) between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`product_id` text,
	`name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'piece' NOT NULL,
	`category_id` text,
	`category_source` text,
	`category_classifier_version` text,
	`sort_index` integer DEFAULT 0 NOT NULL,
	`checked_at` text,
	`checked_by` text,
	`added_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`store_id` text,
	`price_estimate` real,
	`recipe_names` text DEFAULT '[]' NOT NULL,
	`package_size` real,
	`package_size_unit` text,
	CONSTRAINT "shopping_list_items_category_id_check" CHECK("category_id" in (
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
      )),
	CONSTRAINT "shopping_list_items_category_source_check" CHECK("category_source" in ('user','store_preference','household_preference','off_taxonomy','name_fallback')),
	CONSTRAINT "shopping_list_items_classifier_version_check" CHECK("category_classifier_version" is null or length(trim("category_classifier_version")) between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE `storage_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`category_order` text
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`entity` text NOT NULL,
	`scope` text DEFAULT 'default' NOT NULL,
	`last_synced_at` text,
	`last_synced_id` text,
	`last_run_at` integer,
	`last_error` text,
	CONSTRAINT `sync_state_pk` PRIMARY KEY(`entity`, `scope`)
);
--> statement-breakpoint
CREATE INDEX `favorite_brochure_stores_user_idx` ON `favorite_brochure_stores` (`user_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `favorite_brochure_stores_dirty_idx` ON `favorite_brochure_stores` (`_dirty`) WHERE "favorite_brochure_stores"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `fridge_items_hh_idx` ON `fridge_items` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `fridge_items_loc_idx` ON `fridge_items` (`location_id`);--> statement-breakpoint
CREATE INDEX `fridge_items_dirty_idx` ON `fridge_items` (`_dirty`) WHERE "fridge_items"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `local_brochure_pages_brochure_idx` ON `local_brochure_pages` (`brochure_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `local_brochures_store_idx` ON `local_brochures` (`store_id`);--> statement-breakpoint
CREATE INDEX `meal_plan_entries_plan_idx` ON `meal_plan_entries` (`meal_plan_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `meal_plan_entries_dirty_idx` ON `meal_plan_entries` (`_dirty`) WHERE "meal_plan_entries"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `meal_plans_hh_idx` ON `meal_plans` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `meal_plans_week_idx` ON `meal_plans` (`household_id`,`week_start_date`);--> statement-breakpoint
CREATE INDEX `meal_plans_dirty_idx` ON `meal_plans` (`_dirty`) WHERE "meal_plans"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `outbox_row_idx` ON `outbox` (`entity`,`entity_id`,`id`);--> statement-breakpoint
CREATE INDEX `outbox_due_idx` ON `outbox` (`next_attempt_at`,`id`);--> statement-breakpoint
CREATE INDEX `product_usage_lookup_idx` ON `product_usage` (`user_id`,`feature`,`meal_type`,`used_at`);--> statement-breakpoint
CREATE INDEX `products_barcode_idx` ON `products` (`barcode`);--> statement-breakpoint
CREATE INDEX `recipe_component_items_component_idx` ON `recipe_component_items` (`component_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipe_component_items_dirty_idx` ON `recipe_component_items` (`_dirty`) WHERE "recipe_component_items"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `recipe_components_recipe_idx` ON `recipe_components` (`recipe_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipe_components_dirty_idx` ON `recipe_components` (`_dirty`) WHERE "recipe_components"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `recipe_step_ingredients_step_idx` ON `recipe_step_ingredients` (`step_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipe_step_ingredients_dirty_idx` ON `recipe_step_ingredients` (`_dirty`) WHERE "recipe_step_ingredients"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `recipe_steps_recipe_idx` ON `recipe_steps` (`recipe_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipe_steps_dirty_idx` ON `recipe_steps` (`_dirty`) WHERE "recipe_steps"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `recipes_hh_idx` ON `recipes` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipes_dirty_idx` ON `recipes` (`_dirty`) WHERE "recipes"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `shopping_category_feedback_events_hh_idx` ON `shopping_category_feedback_events` (`household_id`,`client_created_at`,`event_id`);--> statement-breakpoint
CREATE INDEX `shopping_category_feedback_events_product_idx` ON `shopping_category_feedback_events` (`product_key_type`,`product_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_category_preferences_household_key_v18` ON `shopping_category_preferences` (`household_id`,`key_type`,`normalized_key_value`) WHERE "shopping_category_preferences"."store_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_category_preferences_store_key_v18` ON `shopping_category_preferences` (`household_id`,`store_id`,`key_type`,`normalized_key_value`) WHERE "shopping_category_preferences"."store_id" is not null;--> statement-breakpoint
CREATE INDEX `shopping_category_preferences_hh_idx_v18` ON `shopping_category_preferences` (`household_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `shopping_category_preferences_dirty_idx_v18` ON `shopping_category_preferences` (`_dirty`) WHERE "shopping_category_preferences"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `shopping_history_hh_idx` ON `shopping_history` (`household_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_hh_idx` ON `shopping_list_items` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_dirty_idx` ON `shopping_list_items` (`_dirty`) WHERE "shopping_list_items"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `shopping_list_items_store_idx` ON `shopping_list_items` (`store_id`);--> statement-breakpoint
CREATE INDEX `storage_locations_hh_idx` ON `storage_locations` (`household_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `storage_locations_dirty_idx` ON `storage_locations` (`_dirty`) WHERE "storage_locations"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `stores_hh_idx` ON `stores` (`household_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `stores_dirty_idx` ON `stores` (`_dirty`) WHERE "stores"."_dirty" = 1;