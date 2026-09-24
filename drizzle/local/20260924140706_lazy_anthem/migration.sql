CREATE TABLE `outbox_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`outbox_id` integer NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_error_kind` text,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT "outbox_history_status_check" CHECK("status" in ('queued', 'failed', 'pushed', 'discarded')),
	CONSTRAINT "outbox_history_last_error_kind_check" CHECK("last_error_kind" is null or "last_error_kind" in ('transient', 'permanent'))
);
--> statement-breakpoint
CREATE INDEX `outbox_history_created_idx` ON `outbox_history` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `outbox_history_outbox_idx` ON `outbox_history` (`outbox_id`);--> statement-breakpoint
INSERT INTO outbox_history
  (outbox_id, entity, entity_id, op, payload, created_at, status, attempts, last_error, last_error_kind, updated_at)
SELECT id, entity, entity_id, op, payload, created_at, 'queued', attempts, last_error, last_error_kind, created_at
FROM outbox;
