CREATE TABLE `repwise_auth_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repwise_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `repwise_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repwise_credentials_email_unique` ON `repwise_credentials` (`email`);--> statement-breakpoint
CREATE TABLE `repwise_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `repwise_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
