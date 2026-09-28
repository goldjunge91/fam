ALTER TABLE `meal_plan_entries` ADD `custom_title` text;--> statement-breakpoint
ALTER TABLE `meal_plan_entries` ADD `custom_ingredients` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meal_plan_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_plan_id` text NOT NULL,
	`household_id` text NOT NULL,
	`recipe_id` text,
	`custom_title` text,
	`custom_ingredients` text DEFAULT '[]' NOT NULL,
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
INSERT INTO `__new_meal_plan_entries`(`id`, `meal_plan_id`, `household_id`, `recipe_id`, `entry_date`, `meal_slot`, `servings_mode`, `portions`, `people_count`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `_dirty`) SELECT `id`, `meal_plan_id`, `household_id`, `recipe_id`, `entry_date`, `meal_slot`, `servings_mode`, `portions`, `people_count`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `_dirty` FROM `meal_plan_entries`;--> statement-breakpoint
DROP TABLE `meal_plan_entries`;--> statement-breakpoint
ALTER TABLE `__new_meal_plan_entries` RENAME TO `meal_plan_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `meal_plan_entries_plan_idx` ON `meal_plan_entries` (`meal_plan_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `meal_plan_entries_dirty_idx` ON `meal_plan_entries` (`_dirty`) WHERE "meal_plan_entries"."_dirty" = 1;