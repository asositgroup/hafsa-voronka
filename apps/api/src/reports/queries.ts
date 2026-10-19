import { sql } from "drizzle-orm";
import {
  ATTRIBUTION_WINDOW_HOURS,
  DEFAULT_LESSON_START_SEC,
  plainTextPreview,
  type AdminReportResponse,
  type FunnelSegment,
  type MessageReportRow,
  type VideoReportRow,
} from "@funnel/shared";
import { db } from "@/db";

type DateRange = { from: string; to: string };

export async function getVideoReport({ from, to }: DateRange): Promise<VideoReportRow[]> {
  const rows = await db().execute<{
    id: string | number;
    title: string;
    is_active: boolean;
    archived: boolean;
    course_start_sec: number | null;
    price_sec: number | null;
    given: string | number;
    opened: string | number;
    left_early: string | number;
    reached_course: string | number;
    reached_price: string | number;
    wrote_admin: string | number;
  }>(sql`
    SELECT
      v.id, v.title, v.is_active, (v.archived_at IS NOT NULL) AS archived,
      v.course_start_sec, v.price_sec,
      count(*) AS given,
      count(*) FILTER (WHERE ao.last_open_at IS NOT NULL OR wp.started_at IS NOT NULL) AS opened,
      count(*) FILTER (WHERE (ao.last_open_at IS NOT NULL OR wp.started_at IS NOT NULL)
        AND coalesce(wp.max_position, 0) < coalesce(v.intro_end_sec, ${DEFAULT_LESSON_START_SEC}::int)
        AND greatest(wp.last_beat_at, ao.last_open_at, wp.started_at) < now() - interval '30 minutes') AS left_early,
      count(*) FILTER (WHERE v.course_start_sec IS NOT NULL AND coalesce(wp.max_position, 0) >= v.course_start_sec) AS reached_course,
      count(*) FILTER (WHERE v.price_sec IS NOT NULL AND coalesce(wp.max_position, 0) >= v.price_sec) AS reached_price,
      count(*) FILTER (WHERE u.channel_click_at IS NOT NULL) AS wrote_admin
    FROM users u
    JOIN videos v ON v.id = u.video_id
    LEFT JOIN watch_progress wp ON wp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT max(e.created_at) AS last_open_at FROM events e
      WHERE e.user_id = u.id AND e.type = 'app_open'
    ) ao ON true
    WHERE u.link_given_at IS NOT NULL
      AND (u.link_given_at AT TIME ZONE 'Asia/Tashkent')::date >= ${from}::date
      AND (u.link_given_at AT TIME ZONE 'Asia/Tashkent')::date <= ${to}::date
    GROUP BY v.id
    ORDER BY v.is_active DESC, v.created_at DESC
  `);

  return rows.map((row) => ({
    videoId: Number(row.id),
    title: row.title,
    isActive: row.is_active,
    archived: row.archived,
    given: Number(row.given),
    opened: Number(row.opened),
    leftEarly: Number(row.left_early),
    reachedCourse: row.course_start_sec === null ? null : Number(row.reached_course),
    reachedPrice: row.price_sec === null ? null : Number(row.reached_price),
    wroteAdmin: Number(row.wrote_admin),
  }));
}

export async function getMessageReport({ from, to }: DateRange): Promise<MessageReportRow[]> {
  const rows = await db().execute<{
    id: string | number;
    segment: FunnelSegment;
    day: number;
    position: number;
    text: string;
    deleted: boolean;
    sent: string | number;
    clicked: string | number;
    price_after: string | number;
    clicked_price_after: string | number;
    admin_after: string | number;
    clicked_admin_after: string | number;
  }>(sql`
    WITH sent AS (
      SELECT sm.id, sm.user_id, sm.template_id, sm.sent_at, sm.clicked_at,
        least(
          sm.sent_at + make_interval(hours => ${ATTRIBUTION_WINDOW_HOURS}::int),
          coalesce((SELECT min(n.sent_at) FROM sent_messages n
                    WHERE n.user_id = sm.user_id AND n.sent_at > sm.sent_at), 'infinity'::timestamptz)
        ) AS window_end
      FROM sent_messages sm
      WHERE sm.telegram_message_id IS NOT NULL AND sm.sent_at IS NOT NULL
        AND (sm.sent_at AT TIME ZONE 'Asia/Tashkent')::date >= ${from}::date
        AND (sm.sent_at AT TIME ZONE 'Asia/Tashkent')::date <= ${to}::date
    ),
    price AS (
      SELECT e.user_id, min(e.created_at) AS at FROM events e
      WHERE e.type = 'price_reached' AND e.user_id IN (SELECT user_id FROM sent)
      GROUP BY e.user_id
    ),
    scored AS (
      SELECT s.template_id, (s.clicked_at IS NOT NULL) AS clicked,
        (p.at > s.sent_at AND p.at <= s.window_end) AS price_after,
        (u.channel_click_at > s.sent_at AND u.channel_click_at <= s.window_end) AS admin_after
      FROM sent s JOIN users u ON u.id = s.user_id LEFT JOIN price p ON p.user_id = s.user_id
    )
    SELECT t.id, t.segment, t.day, t.position, t.text, (t.deleted_at IS NOT NULL) AS deleted,
      count(*) AS sent,
      count(*) FILTER (WHERE sc.clicked) AS clicked,
      count(*) FILTER (WHERE sc.price_after) AS price_after,
      count(*) FILTER (WHERE sc.clicked AND sc.price_after) AS clicked_price_after,
      count(*) FILTER (WHERE sc.admin_after) AS admin_after,
      count(*) FILTER (WHERE sc.clicked AND sc.admin_after) AS clicked_admin_after
    FROM scored sc JOIN message_templates t ON t.id = sc.template_id
    GROUP BY t.id
    ORDER BY t.segment, t.day, t.position, t.id
  `);

  return rows.map((row) => {
    const afterSegmentC = row.segment === "C";
    return {
      templateId: Number(row.id),
      segment: row.segment,
      day: Number(row.day),
      position: Number(row.position),
      preview: plainTextPreview(row.text),
      deleted: row.deleted,
      sent: Number(row.sent),
      clicked: Number(row.clicked),
      priceAfter: afterSegmentC ? null : Number(row.price_after),
      clickedPriceAfter: afterSegmentC ? null : Number(row.clicked_price_after),
      adminAfter: Number(row.admin_after),
      clickedAdminAfter: Number(row.clicked_admin_after),
    };
  });
}

export async function getReport(range: DateRange): Promise<AdminReportResponse> {
  const [videos, messages] = await Promise.all([getVideoReport(range), getMessageReport(range)]);
  return { from: range.from, to: range.to, videos, messages };
}
