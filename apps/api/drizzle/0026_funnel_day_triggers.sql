ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_attempts_values";--> statement-breakpoint
ALTER TABLE "message_templates" DROP COLUMN "attempts";--> statement-breakpoint
ALTER TABLE "link_grants" ADD COLUMN "day" smallint;--> statement-breakpoint
UPDATE "link_grants" "g"
SET "day" = least(7, (("g"."given_at" AT TIME ZONE 'Asia/Tashkent')::date - ("f"."first_given_at" AT TIME ZONE 'Asia/Tashkent')::date) + 1)
FROM (
  SELECT "user_id", "epoch", min("given_at") AS "first_given_at"
  FROM "link_grants"
  GROUP BY "user_id", "epoch"
) "f"
WHERE "f"."user_id" = "g"."user_id" AND "f"."epoch" = "g"."epoch";--> statement-breakpoint
ALTER TABLE "link_grants" ALTER COLUMN "day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "kind" text DEFAULT 'reminder' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "at_expiry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "is_permanent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "message_templates" SET "kind" = 'trigger'
WHERE "id" IN (
  SELECT DISTINCT ON ("segment", "day") "id"
  FROM "message_templates"
  WHERE "segment" IN ('A', 'B') AND "day" BETWEEN 2 AND 7 AND "deleted_at" IS NULL AND "is_active"
    AND ("buttons" @> '[{"kind": "again"}]'::jsonb OR "buttons" @> '[{"kind": "later"}]'::jsonb)
  ORDER BY "segment", "day", "timing_value", "position", "id"
);--> statement-breakpoint
UPDATE "message_templates" "t"
SET "timing_value" = CASE WHEN "r"."n" = 1 THEN 30 ELSE least(1439, ("r"."n" - 1) * 60) END
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "segment", "day" ORDER BY "timing_value", "position", "id") AS "n"
  FROM "message_templates"
  WHERE "segment" IN ('A', 'B') AND "day" BETWEEN 2 AND 7 AND "deleted_at" IS NULL AND "kind" = 'reminder'
) "r"
WHERE "r"."id" = "t"."id";--> statement-breakpoint
CREATE UNIQUE INDEX "message_templates_one_trigger_idx" ON "message_templates" USING btree ("segment","day") WHERE "message_templates"."kind" = 'trigger' and "message_templates"."is_active" and "message_templates"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "link_grants" ADD CONSTRAINT "link_grants_day_range" CHECK ("link_grants"."day" >= 1);--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_kind_shape" CHECK (("message_templates"."kind" = 'reminder' and not "message_templates"."at_expiry") or ("message_templates"."kind" = 'trigger' and "message_templates"."segment" in ('A', 'B') and "message_templates"."day" between 2 and 7));
