CREATE TABLE "video_imports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"drive_file_id" text NOT NULL,
	"title" text NOT NULL,
	"total_bytes" bigint NOT NULL,
	"duration_sec" integer NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"bytes_done" bigint DEFAULT 0 NOT NULL,
	"error" text,
	"video_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_imports" ADD CONSTRAINT "video_imports_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_imports_one_running_idx" ON "video_imports" USING btree ("status") WHERE "video_imports"."status" = 'running';