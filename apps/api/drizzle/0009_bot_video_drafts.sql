CREATE TABLE "bot_video_drafts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_telegram_id" bigint NOT NULL,
	"file_id" text NOT NULL,
	"file_unique_id" text NOT NULL,
	"file_name" text,
	"mime_type" text,
	"file_size" bigint,
	"caption" text,
	"duration" integer,
	"step" text DEFAULT 'confirm' NOT NULL,
	"course_start_sec" integer,
	"price_sec" integer,
	"upload_status" text DEFAULT 'idle' NOT NULL,
	"upload_claimed_at" timestamp with time zone,
	"progress_message_id" bigint,
	"r2_key" text,
	"file_url" text,
	"upload_error" text,
	"activate_on_upload" boolean DEFAULT false NOT NULL,
	"video_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_video_drafts_file_unique_id_unique" UNIQUE("file_unique_id")
);
--> statement-breakpoint
ALTER TABLE "bot_video_drafts" ADD CONSTRAINT "bot_video_drafts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_video_drafts_one_open_idx" ON "bot_video_drafts" USING btree ("admin_telegram_id") WHERE "bot_video_drafts"."step" not in ('done', 'cancelled');