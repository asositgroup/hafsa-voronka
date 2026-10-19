CREATE TABLE "watch_appointments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"offer_id" bigint,
	"purpose" text NOT NULL,
	"chosen_at" timestamp with time zone NOT NULL,
	"pre_remind_at" timestamp with time zone,
	"pre_sent_message_id" bigint,
	"fired_at" timestamp with time zone,
	"fired_message_id" bigint,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_appointments_offer_shape" CHECK (("watch_appointments"."purpose" = 'reopen') = ("watch_appointments"."offer_id" is not null)),
	CONSTRAINT "watch_appointments_closed_once" CHECK ("watch_appointments"."fired_at" is null or "watch_appointments"."cancelled_at" is null)
);
--> statement-breakpoint
ALTER TABLE "watch_appointments" ADD CONSTRAINT "watch_appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_appointments" ADD CONSTRAINT "watch_appointments_offer_id_second_chance_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."second_chance_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_appointments" ADD CONSTRAINT "watch_appointments_pre_sent_message_id_sent_messages_id_fk" FOREIGN KEY ("pre_sent_message_id") REFERENCES "public"."sent_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_appointments" ADD CONSTRAINT "watch_appointments_fired_message_id_sent_messages_id_fk" FOREIGN KEY ("fired_message_id") REFERENCES "public"."sent_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watch_appointments_one_pending_idx" ON "watch_appointments" USING btree ("user_id") WHERE "watch_appointments"."fired_at" is null and "watch_appointments"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "watch_appointments_due_idx" ON "watch_appointments" USING btree ("chosen_at") WHERE "watch_appointments"."fired_at" is null and "watch_appointments"."cancelled_at" is null;