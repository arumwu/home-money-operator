CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`related_id` text,
	`fingerprint` text NOT NULL,
	`dismissed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_fingerprint_unique` ON `alerts` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `alert_created_at_idx` ON `alerts` (`created_at`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`provider` text,
	`category` text DEFAULT '家庭帳單' NOT NULL,
	`amount` integer,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`next_due_date` text NOT NULL,
	`autopay` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bill_due_date_idx` ON `bills` (`next_due_date`);--> statement-breakpoint
CREATE INDEX `bill_status_idx` ON `bills` (`status`);--> statement-breakpoint
CREATE TABLE `gmail_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`gmail_address` text NOT NULL,
	`refresh_token_ciphertext` text NOT NULL,
	`scopes` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`last_history_id` text,
	`watch_expiration` text,
	`last_synced_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_user_unique` ON `gmail_connections` (`user_email`);--> statement-breakpoint
CREATE TABLE `household_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_email_unique` ON `household_members` (`email`);--> statement-breakpoint
CREATE TABLE `invoice_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_message_id` text,
	`source_filename` text,
	`attachment_hash` text,
	`status` text DEFAULT 'received' NOT NULL,
	`invoice_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_message_unique` ON `invoice_imports` (`source`,`source_message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `import_attachment_hash_unique` ON `invoice_imports` (`attachment_hash`);--> statement-breakpoint
CREATE INDEX `import_received_at_idx` ON `invoice_imports` (`received_at`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`name` text NOT NULL,
	`quantity` real,
	`unit_price` integer,
	`amount` integer,
	`category` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_item_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer,
	`invoice_number` text NOT NULL,
	`issued_at` text NOT NULL,
	`merchant_name` text NOT NULL,
	`seller_tax_id` text,
	`total_amount` integer NOT NULL,
	`category` text NOT NULL,
	`source` text DEFAULT 'einvoice' NOT NULL,
	`dedupe_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `invoice_imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_dedupe_key_unique` ON `invoices` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `invoice_issued_at_idx` ON `invoices` (`issued_at`);--> statement-breakpoint
CREATE INDEX `invoice_category_idx` ON `invoices` (`category`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer,
	`occurred_at` text NOT NULL,
	`merchant` text NOT NULL,
	`description` text,
	`amount` integer NOT NULL,
	`category` text NOT NULL,
	`source` text NOT NULL,
	`confidence` real DEFAULT 0.5 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_invoice_unique` ON `transactions` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `transaction_occurred_at_idx` ON `transactions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `transaction_category_idx` ON `transactions` (`category`);