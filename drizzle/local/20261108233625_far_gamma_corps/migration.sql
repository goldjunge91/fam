CREATE TABLE `applied_assistant_shopping_proposals` (
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`proposal_key` text NOT NULL,
	`applied_at` integer NOT NULL,
	CONSTRAINT `applied_assistant_shopping_proposals_pk` PRIMARY KEY(`user_id`, `household_id`, `proposal_key`)
);
