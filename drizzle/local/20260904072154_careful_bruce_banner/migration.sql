CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`fridge_item_id` text,
	`product_id` text,
	`actor` text,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`location_id` text,
	`reason` text,
	`previous_expiry_date` text,
	`notes` text,
	`undone` integer DEFAULT false NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE `fridge_items` ADD `opened_at` text;--> statement-breakpoint
ALTER TABLE `fridge_items` ADD `vacuum_sealed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `fridge_items` ADD `expiry_user_set` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `transactions_hh_idx` ON `transactions` (`household_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_fridge_item_idx` ON `transactions` (`fridge_item_id`);--> statement-breakpoint
CREATE INDEX `transactions_dirty_idx` ON `transactions` (`_dirty`) WHERE "transactions"."_dirty" = 1;