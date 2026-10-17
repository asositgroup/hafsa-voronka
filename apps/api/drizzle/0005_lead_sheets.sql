DROP TABLE "sheets_queue" CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "form_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sheets_synced_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sheets_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sheets_error" text;