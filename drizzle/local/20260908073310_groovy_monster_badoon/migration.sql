ALTER TABLE `outbox` ADD `last_error_kind` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_error_kind` text,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "outbox_op_check" CHECK("op" in ('insert', 'update', 'delete', 'restore', 'move', 'adjust_quantity', 'correct_quantity', 'reverse_quantity', 'split_open', 'merge_undo_open')),
	CONSTRAINT "outbox_last_error_kind_check" CHECK("last_error_kind" is null or "last_error_kind" in ('transient', 'permanent'))
);
--> statement-breakpoint
INSERT INTO `__new_outbox`(`id`, `entity`, `entity_id`, `op`, `payload`, `created_at`, `attempts`, `last_error`, `next_attempt_at`) SELECT `id`, `entity`, `entity_id`, `op`, `payload`, `created_at`, `attempts`, `last_error`, `next_attempt_at` FROM `outbox`;--> statement-breakpoint
DROP TABLE `outbox`;--> statement-breakpoint
ALTER TABLE `__new_outbox` RENAME TO `outbox`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `outbox_row_idx` ON `outbox` (`entity`,`entity_id`,`id`);--> statement-breakpoint
CREATE INDEX `outbox_due_idx` ON `outbox` (`next_attempt_at`,`id`);