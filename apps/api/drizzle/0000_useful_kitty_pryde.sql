CREATE TABLE "campaign_links" (
	"code" text PRIMARY KEY NOT NULL,
	"utm" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"visitor_id" text,
	"type" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheets_queue" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"row" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" text,
	"first_name" text,
	"language_code" text,
	"name" text,
	"phone" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"start_param" text,
	"visitor_id" text,
	"utm_source" text,
	"utm_campaign" text,
	"utm_content" text,
	"fbclid" text,
	"registered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"channel_click_at" timestamp with time zone,
	"bot_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "watch_progress" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"max_position" real DEFAULT 0 NOT NULL,
	"watched_secs" real DEFAULT 0 NOT NULL,
	"last_beat_at" timestamp with time zone,
	"last_position" real DEFAULT 0 NOT NULL,
	"playing" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets_queue" ADD CONSTRAINT "sheets_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_type_created_at_idx" ON "events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "events_visitor_id_idx" ON "events" USING btree ("visitor_id");