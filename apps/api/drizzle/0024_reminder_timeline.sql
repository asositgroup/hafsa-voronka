ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_timing_type_values";--> statement-breakpoint
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_occasion_shape";--> statement-breakpoint
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_night_notice_shape";--> statement-breakpoint
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_day_time_range";--> statement-breakpoint
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_segment_values";--> statement-breakpoint
ALTER TABLE "watch_appointments" DROP CONSTRAINT IF EXISTS "watch_appointments_offer_shape";--> statement-breakpoint
DROP INDEX "message_templates_occasion_slot_idx";--> statement-breakpoint
DROP INDEX "message_templates_night_notice_idx";--> statement-breakpoint
DO $$
DECLARE
  dropped record;
  moved record;
BEGIN
  FOR dropped IN SELECT "id", "text" FROM "message_templates" WHERE "segment" = 'D' AND "day" = 7 AND "deleted_at" IS NULL ORDER BY "id" LOOP
    RAISE INFO 'reminder-timeline: dropped occasion 7 text #%: %', dropped."id", left(dropped."text", 120);
  END LOOP;
  FOR moved IN SELECT "id" FROM "message_templates" WHERE "timing_type" = 'day_time' AND "day" = 1 AND "deleted_at" IS NULL ORDER BY "id" LOOP
    RAISE INFO 'reminder-timeline: day-1 clock reminder #% moved to day 2', moved."id";
  END LOOP;
END $$;--> statement-breakpoint
INSERT INTO "message_templates" ("segment", "day", "position", "text", "media_type", "media_file_id", "timing_type", "timing_value", "buttons", "statuses", "attempts", "is_active")
SELECT 'A', "d"."day" + 1, coalesce((SELECT max("t"."position") FROM "message_templates" "t" WHERE "t"."segment" = 'A' AND "t"."day" = "d"."day" + 1 AND "t"."deleted_at" IS NULL), -1) + 1, "d"."text", "d"."media_type", "d"."media_file_id", 'day_time', 600, "d"."buttons", NULL, NULL, "d"."is_active"
FROM "message_templates" "d"
WHERE "d"."segment" = 'D' AND "d"."deleted_at" IS NULL AND "d"."statuses" = array['link_berildi'] AND "d"."day" <= 6
ORDER BY "d"."day", "d"."id";--> statement-breakpoint
INSERT INTO "message_templates" ("segment", "day", "position", "text", "media_type", "media_file_id", "timing_type", "timing_value", "buttons", "statuses", "attempts", "is_active")
SELECT 'B', "d"."day" + 1, coalesce((SELECT max("t"."position") FROM "message_templates" "t" WHERE "t"."segment" = 'B' AND "t"."day" = "d"."day" + 1 AND "t"."deleted_at" IS NULL), -1) + 1, "d"."text", "d"."media_type", "d"."media_file_id", 'day_time', 600, "d"."buttons", NULL, NULL, "d"."is_active"
FROM (
  SELECT DISTINCT ON ("day") *
  FROM "message_templates"
  WHERE "segment" = 'D' AND "deleted_at" IS NULL AND "day" <= 6 AND ('korishni_boshladi' = any("statuses") OR "statuses" = array['link_berildi'])
  ORDER BY "day", ('korishni_boshladi' = any("statuses")) DESC, "id"
) "d"
ORDER BY "d"."day";--> statement-breakpoint
UPDATE "message_templates" SET "day" = least(7, greatest(0, "timing_value") / 1440 + 1), "timing_value" = greatest(0, "timing_value") % 1440 WHERE "timing_type" = 'after_entry';--> statement-breakpoint
UPDATE "message_templates" SET "day" = 1, "timing_value" = greatest(0, least(1439, (SELECT coalesce((SELECT CASE WHEN "value" ~ '^[0-9]{1,15}$' THEN nullif("value"::bigint, 0) END FROM "settings" WHERE "key" = 'LINK_TTL_HOURS'), 24)) * 60 - "timing_value")) WHERE "timing_type" = 'before_expiry';--> statement-breakpoint
UPDATE "message_templates" SET "day" = 2 WHERE "timing_type" = 'day_time' AND "day" = 1;--> statement-breakpoint
UPDATE "message_templates" SET "deleted_at" = coalesce("deleted_at", now()), "timing_value" = 0 WHERE "timing_type" IN ('night_notice', 'occasion');--> statement-breakpoint
UPDATE "segment_runs" SET "ended_at" = now(), "end_reason" = 'relinked' WHERE "segment" = 'D' AND "ended_at" IS NULL;--> statement-breakpoint
INSERT INTO "segment_runs" ("user_id", "segment", "entered_at", "attempt")
SELECT "ended"."user_id",
  CASE
    WHEN "u"."offer_watched_at" IS NOT NULL OR "wp"."max_position" >= "v"."price_sec" THEN 'C'
    WHEN "wp"."user_id" IS NULL OR ("wp"."started_at" IS NULL AND "wp"."max_position" = 0) THEN 'A'
    ELSE 'B'
  END,
  (date_trunc('day', now() AT TIME ZONE 'Asia/Tashkent') - interval '1 day') AT TIME ZONE 'Asia/Tashkent',
  coalesce("g"."attempt", "ended"."attempt")
FROM "segment_runs" "ended"
JOIN "users" "u" ON "u"."id" = "ended"."user_id"
LEFT JOIN "link_grants" "g" ON "g"."id" = "u"."link_id"
LEFT JOIN "watch_progress" "wp" ON "wp"."user_id" = "u"."id"
LEFT JOIN "videos" "v" ON "v"."id" = "u"."video_id"
WHERE "ended"."segment" = 'D' AND "ended"."end_reason" = 'relinked' AND "ended"."ended_at" = now()
  AND NOT "u"."bot_blocked" AND "u"."wrote_admin_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "segment_runs" "other" WHERE "other"."user_id" = "ended"."user_id" AND "other"."ended_at" IS NULL);--> statement-breakpoint
UPDATE "settings" SET "value" = jsonb_set("value"::jsonb, '{B,total}', 'null'::jsonb)::text, "updated_at" = now()
WHERE "key" = 'MESSAGE_CAPS' AND CASE WHEN pg_input_is_valid("value", 'jsonb') THEN ("value"::jsonb #> '{B,total}') = '7'::jsonb ELSE false END;--> statement-breakpoint
ALTER TABLE "message_templates" DROP COLUMN "timing_type";--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_timing_value_range" CHECK ("message_templates"."timing_value" between 0 and 1439);--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_segment_values" CHECK ("message_templates"."segment" in ('A', 'B', 'C') or "message_templates"."deleted_at" is not null);