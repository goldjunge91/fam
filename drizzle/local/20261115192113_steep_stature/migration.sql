PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recipe_component_items` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`household_id` text NOT NULL,
	`product_id` text,
	`sub_component_id` text,
	`grams` real,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`quantity` real,
	`unit` text,
	`optional` integer DEFAULT false NOT NULL,
	`note` text,
	`source_text` text,
	`ingredient_source_type` text,
	`ingredient_source_id` text,
	`ingredient_source_url` text,
	`ingredient_source_version` text,
	`ingredient_source_license` text,
	`ingredient_mapping` text DEFAULT '{"version":1,"status":"unknown","ingredientIds":[],"complete":false}' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_recipe_component_items`(`id`, `component_id`, `recipe_id`, `household_id`, `product_id`, `sub_component_id`, `grams`, `created_at`, `updated_at`, `deleted_at`, `_dirty`, `quantity`, `unit`, `optional`, `note`, `source_text`, `ingredient_source_type`, `ingredient_source_id`, `ingredient_source_url`, `ingredient_source_version`, `ingredient_source_license`, `ingredient_mapping`) SELECT `id`, `component_id`, `recipe_id`, `household_id`, `product_id`, `sub_component_id`, `grams`, `created_at`, `updated_at`, `deleted_at`, `_dirty`, `quantity`, `unit`, `optional`, `note`, `source_text`, `ingredient_source_type`, `ingredient_source_id`, `ingredient_source_url`, `ingredient_source_version`, `ingredient_source_license`, `ingredient_mapping` FROM `recipe_component_items`;--> statement-breakpoint
DROP TABLE `recipe_component_items`;--> statement-breakpoint
ALTER TABLE `__new_recipe_component_items` RENAME TO `recipe_component_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `recipe_component_items_component_idx` ON `recipe_component_items` (`component_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipe_component_items_dirty_idx` ON `recipe_component_items` (`_dirty`) WHERE "recipe_component_items"."_dirty" = 1;