CREATE TABLE `medication_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`child_profile_id` text,
	`medication_name` text NOT NULL,
	`dose` real,
	`unit` text DEFAULT 'mg' NOT NULL,
	`injection_site` text,
	`administered_at` text NOT NULL,
	`notes` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `symptom_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`child_profile_id` text,
	`logged_at` text NOT NULL,
	`appetite_level` integer,
	`satiety_level` integer,
	`nausea_level` integer,
	`side_effects` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`_dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `medication_logs_user_time_idx` ON `medication_logs` (`user_id`,`administered_at`);--> statement-breakpoint
CREATE INDEX `medication_logs_child_idx` ON `medication_logs` (`child_profile_id`);--> statement-breakpoint
CREATE INDEX `medication_logs_dirty_idx` ON `medication_logs` (`_dirty`) WHERE "medication_logs"."_dirty" = 1;--> statement-breakpoint
CREATE INDEX `symptom_logs_user_time_idx` ON `symptom_logs` (`user_id`,`logged_at`);--> statement-breakpoint
CREATE INDEX `symptom_logs_child_idx` ON `symptom_logs` (`child_profile_id`);--> statement-breakpoint
CREATE INDEX `symptom_logs_dirty_idx` ON `symptom_logs` (`_dirty`) WHERE "symptom_logs"."_dirty" = 1;