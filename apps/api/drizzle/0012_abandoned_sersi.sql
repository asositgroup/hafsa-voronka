ALTER TABLE "videos" DROP CONSTRAINT "videos_marks_order";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "unlocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "unlock_sec" integer;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_marks_order" CHECK ("videos"."duration" > 0
        AND ("videos"."intro_end_sec" IS NULL OR ("videos"."intro_end_sec" >= 0 AND "videos"."intro_end_sec" < COALESCE("videos"."course_start_sec", "videos"."price_sec", "videos"."duration")))
        AND ("videos"."course_start_sec" IS NULL OR "videos"."course_start_sec" > 0)
        AND ("videos"."course_start_sec" IS NULL OR "videos"."price_sec" IS NULL OR "videos"."course_start_sec" < "videos"."price_sec")
        AND ("videos"."price_sec" IS NULL OR "videos"."price_sec" < "videos"."duration")
        AND ("videos"."unlock_sec" IS NULL OR ("videos"."unlock_sec" > 0 AND "videos"."unlock_sec" < "videos"."duration")));
--> statement-breakpoint
UPDATE "users" SET "unlocked_at" = "completed_at" WHERE "completed_at" IS NOT NULL;
