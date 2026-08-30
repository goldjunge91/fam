CREATE TABLE `injection_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`medication_name` text NOT NULL,
	`dose` real NOT NULL,
	`unit` text DEFAULT 'mg' NOT NULL,
	`cadence_days` integer NOT NULL,
	`anchor_at` text NOT NULL,
	`reminder_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "injection_plans_medication_name_check" CHECK(length(trim("medication_name")) between 1 and 200),
	CONSTRAINT "injection_plans_dose_check" CHECK("dose" > 0),
	CONSTRAINT "injection_plans_unit_check" CHECK("unit" in ('mg', 'ml', 'units', 'mcg', 'pills')),
	CONSTRAINT "injection_plans_cadence_days_check" CHECK("cadence_days" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `injection_plans_user_id_idx` ON `injection_plans` (`user_id`);