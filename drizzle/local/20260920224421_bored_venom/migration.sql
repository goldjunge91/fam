CREATE TABLE `receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`household_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`product_id` text,
	`category_id` text,
	`quantity` real,
	`unit` text,
	`package_size` real,
	`package_size_unit` text,
	`line_total_cents` integer,
	`review_status` text DEFAULT 'needs_review' NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "receipt_items_position_check" CHECK("position" >= 0),
	CONSTRAINT "receipt_items_quantity_check" CHECK("quantity" is null or "quantity" > 0),
	CONSTRAINT "receipt_items_package_size_check" CHECK("package_size" is null or "package_size" > 0),
	CONSTRAINT "receipt_items_line_total_cents_check" CHECK("line_total_cents" is null or "line_total_cents" >= 0),
	CONSTRAINT "receipt_items_review_status_check" CHECK("review_status" in ('needs_review', 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`store_id` text,
	`purchase_date` text,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`total_cents` integer,
	`processing_status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`confirmed_by` text,
	`confirmed_at` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "receipts_currency_check" CHECK("currency" = 'EUR'),
	CONSTRAINT "receipts_total_cents_check" CHECK("total_cents" is null or "total_cents" >= 0),
	CONSTRAINT "receipts_processing_status_check" CHECK("processing_status" in ('draft', 'processing', 'needs_review', 'confirmed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `receipt_items_receipt_idx` ON `receipt_items` (`receipt_id`,`position`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `receipt_items_hh_idx` ON `receipt_items` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `receipt_items_dirty_idx` ON `receipt_items` (`_dirty`) WHERE "receipt_items"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `receipts_hh_idx` ON `receipts` (`household_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `receipts_store_idx` ON `receipts` (`store_id`);--> statement-breakpoint
CREATE INDEX `receipts_dirty_idx` ON `receipts` (`_dirty`) WHERE "receipts"."_dirty" = 1;