ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_timing_type_values";--> statement-breakpoint
DROP INDEX "sent_messages_run_template_idx";--> statement-breakpoint
ALTER TABLE "sent_messages" ADD COLUMN "slot" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "message_templates_night_notice_idx" ON "message_templates" USING btree ("segment") WHERE "message_templates"."timing_type" = 'night_notice' and "message_templates"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sent_messages_run_template_slot_idx" ON "sent_messages" USING btree ("segment_run_id","template_id","slot");--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_night_notice_shape" CHECK ("message_templates"."timing_type" <> 'night_notice' or ("message_templates"."timing_value" = 0 and "message_templates"."segment" in ('A', 'B')));--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_timing_type_values" CHECK ("message_templates"."timing_type" in ('after_entry', 'day_time', 'before_expiry', 'night_notice'));