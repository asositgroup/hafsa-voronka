CREATE TABLE "bot_admin_inputs" (
	"admin_telegram_id" bigint PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"video_id" bigint NOT NULL,
	"mark" text,
	"short_file_unique_id" text,
	"short_duration" integer,
	"short_file_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot_video_drafts" ADD COLUMN "intro_end_sec" integer;--> statement-breakpoint
ALTER TABLE "bot_video_drafts" ADD COLUMN "unlock_sec" integer;--> statement-breakpoint
ALTER TABLE "bot_video_drafts" ADD COLUMN "sent_as_video" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bot_admin_inputs" ADD CONSTRAINT "bot_admin_inputs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;