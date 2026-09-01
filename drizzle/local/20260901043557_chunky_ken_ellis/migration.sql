ALTER TABLE `households` ADD `plus_active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `plus_expires_at` text;--> statement-breakpoint
ALTER TABLE `households` ADD `plus_updated_at` text;--> statement-breakpoint
ALTER TABLE `households` ADD `ai_active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `ai_expires_at` text;--> statement-breakpoint
ALTER TABLE `households` ADD `ai_updated_at` text;--> statement-breakpoint
ALTER TABLE `households` ADD `ai_subscriber_id` text;--> statement-breakpoint
ALTER TABLE `households` DROP COLUMN `premium_active`;--> statement-breakpoint
ALTER TABLE `households` DROP COLUMN `premium_expires_at`;--> statement-breakpoint
ALTER TABLE `households` DROP COLUMN `premium_updated_at`;