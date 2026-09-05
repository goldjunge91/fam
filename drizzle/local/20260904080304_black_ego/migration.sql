PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
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
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "transactions_type_check" CHECK("type" in ('in', 'out', 'waste', 'open')),
	CONSTRAINT "transactions_quantity_check" CHECK("quantity" > 0),
	CONSTRAINT "transactions_reason_matches_waste" CHECK(("type" = 'waste') = ("reason" is not null)),
	CONSTRAINT "transactions_previous_expiry_only_for_open" CHECK("previous_expiry_date" is null or "type" = 'open'),
	CONSTRAINT "transactions_notes_length_check" CHECK("notes" is null or length("notes") <= 500)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`(`id`, `household_id`, `fridge_item_id`, `product_id`, `actor`, `type`, `quantity`, `location_id`, `reason`, `previous_expiry_date`, `notes`, `undone`, `created_at`, `updated_at`, `deleted_at`, `_dirty`) SELECT `id`, `household_id`, `fridge_item_id`, `product_id`, `actor`, `type`, `quantity`, `location_id`, `reason`, `previous_expiry_date`, `notes`, `undone`, `created_at`, `updated_at`, `deleted_at`, `_dirty` FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `transactions_hh_idx` ON `transactions` (`household_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_fridge_item_idx` ON `transactions` (`fridge_item_id`);--> statement-breakpoint
CREATE INDEX `transactions_dirty_idx` ON `transactions` (`_dirty`) WHERE "transactions"."_dirty" = 1;