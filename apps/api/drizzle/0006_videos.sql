CREATE TABLE "videos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"file_url" text NOT NULL,
	"duration" integer NOT NULL,
	"intro_end_sec" integer,
	"course_start_sec" integer,
	"price_sec" integer,
	"short_offer_video_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_marks_order" CHECK ("videos"."duration" > 0 AND ("videos"."course_start_sec" IS NULL OR "videos"."price_sec" IS NULL OR "videos"."course_start_sec" < "videos"."price_sec") AND ("videos"."price_sec" IS NULL OR "videos"."price_sec" < "videos"."duration"))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "video_id" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "videos_one_active_idx" ON "videos" USING btree ("is_active") WHERE "videos"."is_active";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_video_id_idx" ON "users" USING btree ("video_id");