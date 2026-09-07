ALTER TABLE `transactions` ADD `reversal_of` text;--> statement-breakpoint
CREATE INDEX `transactions_reversal_idx` ON `transactions` (`reversal_of`);