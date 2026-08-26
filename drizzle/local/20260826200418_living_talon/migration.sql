CREATE TABLE `local_recipe_preferences` (
	`user_id` text NOT NULL,
	`recipe_key` text NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`rating` integer,
	`note` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT `local_recipe_preferences_pk` PRIMARY KEY(`user_id`, `recipe_key`),
	CONSTRAINT "local_recipe_preferences_favorite_check" CHECK("is_favorite" in (0, 1)),
	CONSTRAINT "local_recipe_preferences_rating_check" CHECK("rating" is null or "rating" between 1 and 10)
);
--> statement-breakpoint
CREATE INDEX `local_recipe_preferences_user_idx` ON `local_recipe_preferences` (`user_id`,`updated_at`);