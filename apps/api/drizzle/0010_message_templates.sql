CREATE TABLE "message_templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"segment" text NOT NULL,
	"day" smallint NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"media_type" text,
	"media_file_id" text,
	"timing_type" text NOT NULL,
	"timing_value" integer NOT NULL,
	"buttons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_templates_day_range" CHECK ("message_templates"."day" between 1 and 7),
	CONSTRAINT "message_templates_segment_values" CHECK ("message_templates"."segment" in ('A', 'B', 'C')),
	CONSTRAINT "message_templates_timing_type_values" CHECK ("message_templates"."timing_type" in ('after_entry', 'day_time', 'before_expiry')),
	CONSTRAINT "message_templates_media_pair" CHECK (("message_templates"."media_type" is null) = ("message_templates"."media_file_id" is null)),
	CONSTRAINT "message_templates_day_time_range" CHECK ("message_templates"."timing_type" <> 'day_time' or "message_templates"."timing_value" between 420 and 1379)
);
--> statement-breakpoint
CREATE INDEX "message_templates_day_idx" ON "message_templates" USING btree ("segment","day","position") WHERE "message_templates"."deleted_at" is null;