ALTER TABLE "users" ADD COLUMN "wrote_admin_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrote_admin_by" bigint;--> statement-breakpoint
UPDATE "users" SET "wrote_admin_at" = "channel_click_at" WHERE "channel_click_at" IS NOT NULL;
