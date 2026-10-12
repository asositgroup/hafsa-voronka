CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_user_id_type_idx" ON "events" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "users_registered_at_idx" ON "users" USING btree ("registered_at");