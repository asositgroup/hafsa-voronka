CREATE TABLE "video_rollout_recipients" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rollout_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"audience" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"link_id" bigint,
	"sent_message_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_rollouts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"video_id" bigint NOT NULL,
	"audiences" text[] NOT NULL,
	"since_days" integer,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"preview_count" integer NOT NULL,
	"target_count" integer,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"blocked_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "video_rollouts_audiences_values" CHECK (cardinality("video_rollouts"."audiences") > 0 and "video_rollouts"."audiences" <@ array['not_opened', 'halfway', 'saw_price', 'wrote_admin', 'bought']::text[]),
	CONSTRAINT "video_rollouts_status_values" CHECK ("video_rollouts"."status" in ('scheduled', 'running', 'done', 'cancelled')),
	CONSTRAINT "video_rollouts_finished_pair" CHECK (("video_rollouts"."finished_at" is null) = ("video_rollouts"."status" in ('scheduled', 'running')))
);
--> statement-breakpoint
DROP INDEX "link_grants_user_attempt_idx";--> statement-breakpoint
DROP INDEX "second_chance_offers_user_occasion_idx";--> statement-breakpoint
ALTER TABLE "link_grants" ADD COLUMN "epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "link_grants" ADD COLUMN "silent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "second_chance_offers" ADD COLUMN "epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "funnel_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "video_rollout_recipients" ADD CONSTRAINT "video_rollout_recipients_rollout_id_video_rollouts_id_fk" FOREIGN KEY ("rollout_id") REFERENCES "public"."video_rollouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_rollout_recipients" ADD CONSTRAINT "video_rollout_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_rollout_recipients" ADD CONSTRAINT "video_rollout_recipients_link_id_link_grants_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."link_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_rollout_recipients" ADD CONSTRAINT "video_rollout_recipients_sent_message_id_sent_messages_id_fk" FOREIGN KEY ("sent_message_id") REFERENCES "public"."sent_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_rollouts" ADD CONSTRAINT "video_rollouts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_rollout_recipients_rollout_user_idx" ON "video_rollout_recipients" USING btree ("rollout_id","user_id");--> statement-breakpoint
CREATE INDEX "video_rollout_recipients_open_idx" ON "video_rollout_recipients" USING btree ("rollout_id","state","id") WHERE "video_rollout_recipients"."state" in ('pending', 'restarted');--> statement-breakpoint
CREATE UNIQUE INDEX "video_rollouts_one_open_idx" ON "video_rollouts" USING btree ((true)) WHERE "video_rollouts"."status" in ('scheduled', 'running');--> statement-breakpoint
CREATE INDEX "video_rollouts_video_idx" ON "video_rollouts" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "link_grants_user_epoch_attempt_idx" ON "link_grants" USING btree ("user_id","epoch","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "second_chance_offers_user_epoch_occasion_idx" ON "second_chance_offers" USING btree ("user_id","epoch","occasion");