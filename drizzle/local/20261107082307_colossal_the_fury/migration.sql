CREATE TABLE `chef_conversation_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text,
	`client_request_id` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`user_text` text NOT NULL,
	`request_payload` text NOT NULL,
	`response_payload` text NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "chef_turns_user_text_check" CHECK(length(trim("user_text")) between 1 and 8000),
	CONSTRAINT "chef_turns_fingerprint_check" CHECK(length("request_fingerprint") = 64 and "request_fingerprint" not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE TABLE `chef_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`created_by` text,
	`last_activity_at` text NOT NULL,
	`continued_from_id` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "chef_conversations_parent_not_self" CHECK("continued_from_id" is null or "continued_from_id" <> "id")
);
--> statement-breakpoint
CREATE TABLE `chef_recipe_history` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`household_id` text NOT NULL,
	`title` text NOT NULL,
	`recipe_payload` text NOT NULL,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL,
	CONSTRAINT "chef_recipe_history_title_check" CHECK(length(trim("title")) between 1 and 8000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chef_turns_client_request_idx` ON `chef_conversation_turns` (`client_request_id`);--> statement-breakpoint
CREATE INDEX `chef_turns_household_created_idx` ON `chef_conversation_turns` (`household_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `chef_turns_conversation_created_idx` ON `chef_conversation_turns` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `chef_conversations_household_activity_idx` ON `chef_conversations` (`household_id`,`last_activity_at`,`id`);--> statement-breakpoint
CREATE INDEX `chef_conversations_household_updated_idx` ON `chef_conversations` (`household_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chef_recipe_history_turn_idx` ON `chef_recipe_history` (`turn_id`);--> statement-breakpoint
CREATE INDEX `chef_recipe_history_household_created_idx` ON `chef_recipe_history` (`household_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `chef_recipe_history_conversation_created_idx` ON `chef_recipe_history` (`conversation_id`,`created_at`,`id`);