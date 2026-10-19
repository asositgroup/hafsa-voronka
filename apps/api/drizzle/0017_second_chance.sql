CREATE TABLE "link_grants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"attempt" smallint NOT NULL,
	"kind" text NOT NULL,
	"offer_first" boolean DEFAULT false NOT NULL,
	"given_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_grants_attempt_range" CHECK ("link_grants"."attempt" >= 1)
);
--> statement-breakpoint
CREATE TABLE "second_chance_offers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"occasion" smallint NOT NULL,
	"variant" text NOT NULL,
	"expired_link_id" bigint NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"sent_message_id" bigint,
	"skipped" boolean DEFAULT false NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"granted_link_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "second_chance_offers_occasion_range" CHECK ("second_chance_offers"."occasion" between 1 and 7),
	CONSTRAINT "second_chance_offers_answer_pair" CHECK (("second_chance_offers"."answer" is null) = ("second_chance_offers"."answered_at" is null))
);
--> statement-breakpoint
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_segment_values";--> statement-breakpoint
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_timing_type_values";--> statement-breakpoint
ALTER TABLE "sent_messages" ALTER COLUMN "template_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "attempts" smallint[];--> statement-breakpoint
ALTER TABLE "segment_runs" ADD COLUMN "attempt" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD COLUMN "bot_text_key" text;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD COLUMN "link_id" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "link_id" bigint;--> statement-breakpoint
ALTER TABLE "link_grants" ADD CONSTRAINT "link_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "second_chance_offers" ADD CONSTRAINT "second_chance_offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "second_chance_offers" ADD CONSTRAINT "second_chance_offers_expired_link_id_link_grants_id_fk" FOREIGN KEY ("expired_link_id") REFERENCES "public"."link_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "second_chance_offers" ADD CONSTRAINT "second_chance_offers_sent_message_id_sent_messages_id_fk" FOREIGN KEY ("sent_message_id") REFERENCES "public"."sent_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "second_chance_offers" ADD CONSTRAINT "second_chance_offers_granted_link_id_link_grants_id_fk" FOREIGN KEY ("granted_link_id") REFERENCES "public"."link_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "link_grants_user_attempt_idx" ON "link_grants" USING btree ("user_id","attempt");--> statement-breakpoint
CREATE INDEX "link_grants_expires_at_idx" ON "link_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "second_chance_offers_user_occasion_idx" ON "second_chance_offers" USING btree ("user_id","occasion");--> statement-breakpoint
CREATE INDEX "second_chance_offers_sent_message_idx" ON "second_chance_offers" USING btree ("sent_message_id");--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_link_id_link_grants_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."link_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_link_id_link_grants_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."link_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_templates_occasion_slot_idx" ON "message_templates" USING btree ("day","statuses") WHERE "message_templates"."segment" = 'D' and "message_templates"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sent_messages_link_idx" ON "sent_messages" USING btree ("link_id");--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_occasion_shape" CHECK (("message_templates"."timing_type" = 'occasion') = ("message_templates"."segment" = 'D') and ("message_templates"."timing_type" <> 'occasion' or ("message_templates"."timing_value" = 0 and "message_templates"."statuses" is not null)));--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_attempts_values" CHECK ("message_templates"."attempts" is null or (cardinality("message_templates"."attempts") > 0 and "message_templates"."attempts" <@ array[1, 2, 3, 4, 5, 6, 7, 8]::smallint[] and "message_templates"."segment" in ('A', 'B')));--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_segment_values" CHECK ("message_templates"."segment" in ('A', 'B', 'C', 'D'));--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_timing_type_values" CHECK ("message_templates"."timing_type" in ('after_entry', 'day_time', 'before_expiry', 'night_notice', 'occasion'));--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_source" CHECK (("sent_messages"."template_id" is null) <> ("sent_messages"."bot_text_key" is null));--> statement-breakpoint
INSERT INTO "link_grants" ("user_id", "attempt", "kind", "offer_first", "given_at", "expires_at") SELECT "id", 1, 'initial', false, COALESCE("link_given_at", "registered_at"), "link_expires_at" FROM "users" WHERE "registered_at" IS NOT NULL;--> statement-breakpoint
UPDATE "users" SET "link_id" = "link_grants"."id" FROM "link_grants" WHERE "link_grants"."user_id" = "users"."id";--> statement-breakpoint
UPDATE "sent_messages" SET "link_id" = "users"."link_id" FROM "users" WHERE "users"."id" = "sent_messages"."user_id" AND "users"."link_id" IS NOT NULL;--> statement-breakpoint
UPDATE "message_templates" SET "buttons" = (SELECT jsonb_agg(CASE WHEN "b"->>'kind' = 'when_menu' THEN jsonb_set("b", '{kind}', '"later"') ELSE "b" END ORDER BY "ord") FROM jsonb_array_elements("message_templates"."buttons") WITH ORDINALITY AS "e"("b", "ord")) WHERE "buttons" @> '[{"kind":"when_menu"}]'::jsonb;
