CREATE TABLE "leads" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"user_id" bigint,
	"visitor_id" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"utm_source" text,
	"utm_campaign" text,
	"utm_content" text,
	"fbclid" text,
	"page_url" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_at" timestamp with time zone,
	"notify_version" integer DEFAULT 1 NOT NULL,
	"notified_version" integer DEFAULT 0 NOT NULL,
	"notify_message_id" integer,
	"notify_attempts" integer DEFAULT 0 NOT NULL,
	"notify_error" text,
	"completion_notified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_visitor_id_idx" ON "leads" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "leads_phone_idx" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "leads_user_id_idx" ON "leads" USING btree ("user_id");