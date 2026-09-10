ALTER TABLE `recipe_component_items` ADD `optional` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `recipe_component_items` ADD `note` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `prep_time_minutes` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `storage_instructions` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `reheating_instructions` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `cheap_tips` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `substitutions` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `crispiness_level` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `air_fryer_time_minutes` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `air_fryer_temperature_f` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `variant_group` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `variant_type` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `dorm_friendly` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `meal_prep_friendly` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `why_cheap` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `healthier_tips` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `batch_prep_tips` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `optional_add_ins` text DEFAULT '[]' NOT NULL;