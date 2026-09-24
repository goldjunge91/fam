CREATE TABLE `recipe_step_images` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`household_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipe_step_images_step_idx` ON `recipe_step_images` (`step_id`,`position`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipe_step_images_recipe_idx` ON `recipe_step_images` (`recipe_id`,`position`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipe_step_images_dirty_idx` ON `recipe_step_images` (`_dirty`) WHERE "recipe_step_images"."_dirty" = 1;