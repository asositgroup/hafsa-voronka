ALTER TABLE "users" ADD COLUMN "offer_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "offer_watched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "short_offer_duration" integer;