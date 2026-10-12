ALTER TABLE "leads" ADD COLUMN "assignee_telegram_id" bigint;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "assignee_name" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "assignee_username" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "outcome_at" timestamp with time zone;