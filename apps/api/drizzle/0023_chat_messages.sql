CREATE TABLE "chat_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chat_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"from_bot" boolean NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_error" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_chat_message_idx" ON "chat_messages" USING btree ("chat_id","message_id");--> statement-breakpoint
CREATE INDEX "chat_messages_undeleted_idx" ON "chat_messages" USING btree ("sent_at") WHERE "chat_messages"."deleted_at" is null and "chat_messages"."delete_error" is null;