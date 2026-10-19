CREATE TABLE "sent_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"template_id" bigint NOT NULL,
	"segment_run_id" bigint NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"click_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"link_targets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"telegram_message_id" bigint,
	"sent_at" timestamp with time zone,
	"send_error" text,
	"deleted_at" timestamp with time zone,
	"delete_error" text,
	"clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sent_messages_click_token_unique" UNIQUE("click_token")
);
--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_segment_run_id_segment_runs_id_fk" FOREIGN KEY ("segment_run_id") REFERENCES "public"."segment_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sent_messages_run_template_idx" ON "sent_messages" USING btree ("segment_run_id","template_id");--> statement-breakpoint
CREATE INDEX "sent_messages_user_sent_idx" ON "sent_messages" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "sent_messages_undeleted_idx" ON "sent_messages" USING btree ("sent_at") WHERE "sent_messages"."sent_at" is not null and "sent_messages"."deleted_at" is null and "sent_messages"."delete_error" is null;--> statement-breakpoint
CREATE INDEX "sent_messages_template_idx" ON "sent_messages" USING btree ("template_id");