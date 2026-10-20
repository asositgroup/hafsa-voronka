CREATE TABLE "segment_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"segment" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	CONSTRAINT "segment_runs_end_pair" CHECK (("segment_runs"."ended_at" is null) = ("segment_runs"."end_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "link_given_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "link_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "segment_runs" ADD CONSTRAINT "segment_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "segment_runs_one_open_idx" ON "segment_runs" USING btree ("user_id") WHERE "segment_runs"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "segment_runs_user_entered_idx" ON "segment_runs" USING btree ("user_id","entered_at");
--> statement-breakpoint
UPDATE "users" SET "link_given_at" = "registered_at", "link_expires_at" = greatest("registered_at", now()) + interval '72 hours' WHERE "registered_at" IS NOT NULL;
