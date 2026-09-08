PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fridge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`location_id` text,
	`product_id` text,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1000 NOT NULL,
	`unit` text DEFAULT 'piece' NOT NULL,
	`expiry_date` text,
	`added_by` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	`package_size` integer,
	`package_size_unit` text,
	`opened_at` text,
	`vacuum_sealed` integer DEFAULT false NOT NULL,
	`expiry_user_set` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_fridge_items`(`id`, `household_id`, `location_id`, `product_id`, `name`, `quantity`, `unit`, `expiry_date`, `added_by`, `created_at`, `updated_at`, `deleted_at`, `_dirty`, `package_size`, `package_size_unit`, `opened_at`, `vacuum_sealed`, `expiry_user_set`) SELECT `id`, `household_id`, `location_id`, `product_id`, `name`, `quantity`, `unit`, `expiry_date`, `added_by`, `created_at`, `updated_at`, `deleted_at`, `_dirty`, `package_size`, `package_size_unit`, `opened_at`, `vacuum_sealed`, `expiry_user_set` FROM `fridge_items`;--> statement-breakpoint
DROP TABLE `fridge_items`;--> statement-breakpoint
ALTER TABLE `__new_fridge_items` RENAME TO `fridge_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text,
	`reversal_of` text,
	`household_id` text NOT NULL,
	`fridge_item_id` text,
	`product_id` text,
	`actor` text,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`location_id` text,
	`reason` text,
	`previous_expiry_date` text,
	`origin_item_id` text,
	`origin_quantity` integer,
	`notes` text,
	`undone` integer DEFAULT false NOT NULL,
	`sync_sequence` integer,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "transactions_type_check" CHECK("type" in ('in', 'out', 'waste', 'open')),
	CONSTRAINT "transactions_quantity_check" CHECK("quantity" > 0),
	CONSTRAINT "transactions_reason_check" CHECK("reason" is null or "reason" in ('expired', 'spoiled', 'other')),
	CONSTRAINT "transactions_reason_matches_waste" CHECK(("type" = 'waste') = ("reason" is not null)),
	CONSTRAINT "transactions_previous_expiry_only_for_open" CHECK("previous_expiry_date" is null or "type" = 'open'),
	CONSTRAINT "transactions_operation_id_move_type" CHECK("operation_id" is null or "type" in ('in', 'out')),
	CONSTRAINT "transactions_notes_length_check" CHECK("notes" is null or length("notes") <= 500)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`(`id`, `operation_id`, `reversal_of`, `household_id`, `fridge_item_id`, `product_id`, `actor`, `type`, `quantity`, `location_id`, `reason`, `previous_expiry_date`, `origin_item_id`, `origin_quantity`, `notes`, `undone`, `sync_sequence`, `created_at`, `updated_at`, `deleted_at`, `_dirty`) SELECT `id`, `operation_id`, `reversal_of`, `household_id`, `fridge_item_id`, `product_id`, `actor`, `type`, `quantity`, `location_id`, `reason`, `previous_expiry_date`, `origin_item_id`, `origin_quantity`, `notes`, `undone`, `sync_sequence`, `created_at`, `updated_at`, `deleted_at`, `_dirty` FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `fridge_items_hh_idx` ON `fridge_items` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `fridge_items_loc_idx` ON `fridge_items` (`location_id`);--> statement-breakpoint
CREATE INDEX `fridge_items_dirty_idx` ON `fridge_items` (`_dirty`) WHERE "fridge_items"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `transactions_hh_idx` ON `transactions` (`household_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_fridge_item_idx` ON `transactions` (`fridge_item_id`);--> statement-breakpoint
CREATE INDEX `transactions_operation_idx` ON `transactions` (`operation_id`);--> statement-breakpoint
CREATE INDEX `transactions_reversal_idx` ON `transactions` (`reversal_of`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_single_reversal_idx` ON `transactions` (`household_id`,`reversal_of`) WHERE "transactions"."reversal_of" is not null and "transactions"."operation_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_move_reversal_type_idx` ON `transactions` (`household_id`,`reversal_of`,`type`) WHERE "transactions"."reversal_of" is not null and "transactions"."operation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_operation_type_idx` ON `transactions` (`operation_id`,`type`) WHERE "transactions"."operation_id" is not null;--> statement-breakpoint
CREATE INDEX `transactions_dirty_idx` ON `transactions` (`_dirty`) WHERE "transactions"."_dirty" = 1;