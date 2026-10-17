import { sql } from "drizzle-orm";
import type {
  AdminLeadsResponse,
  AdminStatsResponse,
  CampaignStat,
  DailyStat,
  DropoffStat,
  FunnelStep,
  LeadItem,
} from "@funnel/shared";
import { db } from "@/db";
import { env } from "@/env";
import { formatTashkentDate, listDaysInRange } from "./dates";

const FUNNEL_STEP_NAMES: Record<string, string> = {
  landing_view: "Saytga kirdi",
  cta_click: "Tugmani bosdi",
  lead_submitted: "Formani to‘ldirdi",
  bot_start: "Botga o‘tdi",
  registered: "Ro‘yxatdan o‘tdi",
  video_start: "Videoni boshladi",
  video_complete: "Darsni ko‘rdi (70%)",
  channel_click: "Adminga yozdi",
};

const ORDERED_FUNNEL_STEPS = [
  "landing_view",
  "cta_click",
  "lead_submitted",
  "bot_start",
  "registered",
  "video_start",
  "video_complete",
  "channel_click",
] as const;

export type QueryFilters = {
  from: string;
  to: string;
  source?: string;
  campaign?: string;
};

export async function getFunnelAndKpis(filters: QueryFilters): Promise<{
  funnel: FunnelStep[];
  kpis: AdminStatsResponse["kpis"];
}> {
  const result = await db().execute<{ type: string; count: string | number }>(sql`
    SELECT
      type,
      CASE
        WHEN type IN ('landing_view', 'cta_click', 'lead_submitted') THEN count(DISTINCT visitor_id)
        ELSE count(DISTINCT user_id)
      END AS count
    FROM (
      SELECT
        e.type,
        e.visitor_id,
        e.user_id
      FROM events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE
        (e.created_at AT TIME ZONE 'Asia/Tashkent')::date >= ${filters.from}::date
        AND (e.created_at AT TIME ZONE 'Asia/Tashkent')::date <= ${filters.to}::date
        AND e.type IN ('landing_view', 'cta_click', 'lead_submitted', 'bot_start', 'registered', 'video_start', 'video_complete', 'channel_click')
        AND (
          (e.type IN ('landing_view', 'cta_click', 'lead_submitted')
           AND (
             (${filters.source ?? null}::text IS NULL AND ${filters.campaign ?? null}::text IS NULL)
             OR e.visitor_id IN (
               SELECT lv.visitor_id
               FROM events lv
               WHERE lv.type = 'landing_view'
                 AND (${filters.source ?? null}::text IS NULL OR lv.meta->>'utm_source' = ${filters.source ?? null})
                 AND (${filters.campaign ?? null}::text IS NULL OR lv.meta->>'utm_campaign' = ${filters.campaign ?? null})
             )
           ))
          OR
          (e.type NOT IN ('landing_view', 'cta_click', 'lead_submitted')
           AND (${filters.source ?? null}::text IS NULL OR u.utm_source = ${filters.source ?? null})
           AND (${filters.campaign ?? null}::text IS NULL OR u.utm_campaign = ${filters.campaign ?? null}))
        )
    ) sub
    GROUP BY type
  `);

  const countMap = new Map<string, number>();
  for (const row of result) {
    countMap.set(row.type, Number(row.count) || 0);
  }

  const funnel: FunnelStep[] = [];
  for (let i = 0; i < ORDERED_FUNNEL_STEPS.length; i++) {
    const step = ORDERED_FUNNEL_STEPS[i];
    const count = countMap.get(step) ?? 0;
    let conversionRate = 100;
    if (i > 0) {
      const prevCount = funnel[i - 1].count;
      conversionRate = prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : 0;
    }
    funnel.push({
      step,
      name: FUNNEL_STEP_NAMES[step] ?? step,
      count,
      conversionRate,
    });
  }

  const landingViews = countMap.get("landing_view") ?? 0;
  const botStarts = countMap.get("bot_start") ?? 0;
  const registrations = countMap.get("registered") ?? 0;
  const completions = countMap.get("video_complete") ?? 0;
  const channelClicks = countMap.get("channel_click") ?? 0;
  const conversionRate = landingViews > 0 ? Math.round((channelClicks / landingViews) * 1000) / 10 : 0;

  return {
    funnel,
    kpis: {
      landingViews,
      botStarts,
      registrations,
      completions,
      channelClicks,
      conversionRate,
    },
  };
}

export async function getDailySeries(filters: QueryFilters): Promise<DailyStat[]> {
  const result = await db().execute<{
    date: string;
    registrations: string | number;
    completions: string | number;
  }>(sql`
    SELECT
      to_char(e.created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS date,
      count(DISTINCT CASE WHEN e.type = 'registered' THEN e.user_id END) AS registrations,
      count(DISTINCT CASE WHEN e.type = 'video_complete' THEN e.user_id END) AS completions
    FROM events e
    JOIN users u ON u.id = e.user_id
    WHERE
      e.type IN ('registered', 'video_complete')
      AND (e.created_at AT TIME ZONE 'Asia/Tashkent')::date >= ${filters.from}::date
      AND (e.created_at AT TIME ZONE 'Asia/Tashkent')::date <= ${filters.to}::date
      AND (${filters.source ?? null}::text IS NULL OR u.utm_source = ${filters.source ?? null})
      AND (${filters.campaign ?? null}::text IS NULL OR u.utm_campaign = ${filters.campaign ?? null})
    GROUP BY to_char(e.created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')
    ORDER BY date ASC
  `);

  const dataMap = new Map<string, { registrations: number; completions: number }>();
  for (const row of result) {
    dataMap.set(row.date, {
      registrations: Number(row.registrations) || 0,
      completions: Number(row.completions) || 0,
    });
  }

  const allDays = listDaysInRange(filters.from, filters.to);
  return allDays.map((date) => {
    const item = dataMap.get(date);
    return {
      date,
      registrations: item?.registrations ?? 0,
      completions: item?.completions ?? 0,
    };
  });
}

export async function getCampaignStats(filters: QueryFilters): Promise<CampaignStat[]> {
  const result = await db().execute<{
    source: string;
    campaign: string;
    content: string;
    bot_starts: string | number;
    registrations: string | number;
    completions: string | number;
    channel_clicks: string | number;
  }>(sql`
    SELECT
      coalesce(u.utm_source, '') AS source,
      coalesce(u.utm_campaign, '') AS campaign,
      coalesce(u.utm_content, '') AS content,
      count(DISTINCT CASE WHEN e.type = 'bot_start' THEN e.user_id END) AS bot_starts,
      count(DISTINCT CASE WHEN e.type = 'registered' THEN e.user_id END) AS registrations,
      count(DISTINCT CASE WHEN e.type = 'video_complete' THEN e.user_id END) AS completions,
      count(DISTINCT CASE WHEN e.type = 'channel_click' THEN e.user_id END) AS channel_clicks
    FROM events e
    JOIN users u ON u.id = e.user_id
    WHERE
      (e.created_at AT TIME ZONE 'Asia/Tashkent')::date >= ${filters.from}::date
      AND (e.created_at AT TIME ZONE 'Asia/Tashkent')::date <= ${filters.to}::date
      AND (${filters.source ?? null}::text IS NULL OR u.utm_source = ${filters.source ?? null})
      AND (${filters.campaign ?? null}::text IS NULL OR u.utm_campaign = ${filters.campaign ?? null})
    GROUP BY coalesce(u.utm_source, ''), coalesce(u.utm_campaign, ''), coalesce(u.utm_content, '')
    ORDER BY registrations DESC, bot_starts DESC
  `);

  return result.map((row) => {
    const botStarts = Number(row.bot_starts) || 0;
    const registrations = Number(row.registrations) || 0;
    const completions = Number(row.completions) || 0;
    const channelClicks = Number(row.channel_clicks) || 0;
    const completionRate = registrations > 0 ? Math.round((completions / registrations) * 1000) / 10 : 0;
    return {
      source: row.source,
      campaign: row.campaign,
      content: row.content,
      botStarts,
      registrations,
      completions,
      completionRate,
      channelClicks,
    };
  });
}

export async function getWatchDropoff(filters: QueryFilters): Promise<DropoffStat[]> {
  const duration = env.VIDEO_DURATION_SEC;
  const [row] = await db().execute<{
    total_registered: string | number;
    p10: string | number;
    p20: string | number;
    p30: string | number;
    p40: string | number;
    p50: string | number;
    p60: string | number;
    p70: string | number;
    p80: string | number;
    p90: string | number;
    p100: string | number;
  }>(sql`
    SELECT
      count(u.id) AS total_registered,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.1 * ${duration} THEN 1 END) AS p10,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.2 * ${duration} THEN 1 END) AS p20,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.3 * ${duration} THEN 1 END) AS p30,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.4 * ${duration} THEN 1 END) AS p40,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.5 * ${duration} THEN 1 END) AS p50,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.6 * ${duration} THEN 1 END) AS p60,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.7 * ${duration} THEN 1 END) AS p70,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.8 * ${duration} THEN 1 END) AS p80,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 0.9 * ${duration} THEN 1 END) AS p90,
      count(CASE WHEN coalesce(wp.max_position, 0) >= 1.0 * ${duration} THEN 1 END) AS p100
    FROM users u
    LEFT JOIN watch_progress wp ON wp.user_id = u.id
    WHERE
      u.registered_at IS NOT NULL
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date >= ${filters.from}::date
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date <= ${filters.to}::date
      AND (${filters.source ?? null}::text IS NULL OR u.utm_source = ${filters.source ?? null})
      AND (${filters.campaign ?? null}::text IS NULL OR u.utm_campaign = ${filters.campaign ?? null})
  `);

  const totalRegistered = Number(row?.total_registered) || 0;
  const dropoff: DropoffStat[] = [];
  const pValues = [
    Number(row?.p10) || 0,
    Number(row?.p20) || 0,
    Number(row?.p30) || 0,
    Number(row?.p40) || 0,
    Number(row?.p50) || 0,
    Number(row?.p60) || 0,
    Number(row?.p70) || 0,
    Number(row?.p80) || 0,
    Number(row?.p90) || 0,
    Number(row?.p100) || 0,
  ];

  for (let k = 1; k <= 10; k++) {
    const percent = k * 10;
    const count = pValues[k - 1];
    const share = totalRegistered > 0 ? Math.round((count / totalRegistered) * 1000) / 10 : 0;
    dropoff.push({
      percent,
      count,
      share,
    });
  }

  return dropoff;
}

export async function getHealthStats(): Promise<AdminStatsResponse["health"]> {
  const [row] = await db().execute<{
    sheets_backlog: string | number;
    sheets_failures: string | number;
    last_bot_start_at: string | null;
    last_event_at: string | null;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM leads WHERE notify_version > sheets_synced_version AND sheets_attempts < 10) AS sheets_backlog,
      (SELECT count(*)::int FROM leads WHERE notify_version > sheets_synced_version AND sheets_attempts >= 10) AS sheets_failures,
      (SELECT to_char(max(created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM events WHERE type = 'bot_start') AS last_bot_start_at,
      (SELECT to_char(max(created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM events) AS last_event_at
  `);

  return {
    sheetsBacklog: Number(row?.sheets_backlog) || 0,
    sheetsFailures: Number(row?.sheets_failures) || 0,
    lastBotStartAt: row?.last_bot_start_at ?? null,
    lastEventAt: row?.last_event_at ?? null,
  };
}

export async function getLeads(
  filters: QueryFilters,
  page = 1,
  pageSize = 50,
): Promise<AdminLeadsResponse> {
  const duration = env.VIDEO_DURATION_SEC;
  const offset = (page - 1) * pageSize;

  const [countRow] = await db().execute<{ total: string | number }>(sql`
    SELECT count(u.id) AS total
    FROM users u
    WHERE
      u.registered_at IS NOT NULL
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date >= ${filters.from}::date
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date <= ${filters.to}::date
      AND (${filters.source ?? null}::text IS NULL OR u.utm_source = ${filters.source ?? null})
      AND (${filters.campaign ?? null}::text IS NULL OR u.utm_campaign = ${filters.campaign ?? null})
  `);
  const total = Number(countRow?.total) || 0;

  const rows = await db().execute<{
    id: number;
    registered_at: string;
    name: string | null;
    phone: string | null;
    username: string | null;
    source: string | null;
    campaign: string | null;
    max_position: string | number;
    completed: boolean;
    channel_clicked: boolean;
  }>(sql`
    SELECT
      u.id,
      to_char(u.registered_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS registered_at,
      u.name,
      u.phone,
      u.username,
      u.utm_source AS source,
      u.utm_campaign AS campaign,
      coalesce(wp.max_position, 0) AS max_position,
      coalesce(u.completed_at IS NOT NULL OR wp.completed IS TRUE, false) AS completed,
      (u.channel_click_at IS NOT NULL) AS channel_clicked
    FROM users u
    LEFT JOIN watch_progress wp ON wp.user_id = u.id
    WHERE
      u.registered_at IS NOT NULL
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date >= ${filters.from}::date
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date <= ${filters.to}::date
      AND (${filters.source ?? null}::text IS NULL OR u.utm_source = ${filters.source ?? null})
      AND (${filters.campaign ?? null}::text IS NULL OR u.utm_campaign = ${filters.campaign ?? null})
    ORDER BY u.registered_at DESC, u.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const leads: LeadItem[] = rows.map((r) => {
    const maxPos = Number(r.max_position) || 0;
    const progressPercent = duration > 0 ? Math.min(100, Math.round((maxPos / duration) * 100)) : 0;
    return {
      id: Number(r.id),
      registeredAt: r.registered_at,
      name: r.name,
      phone: r.phone,
      username: r.username,
      source: r.source,
      campaign: r.campaign,
      progressPercent,
      completed: Boolean(r.completed),
      channelClicked: Boolean(r.channel_clicked),
    };
  });

  return {
    leads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function getLeadsCsv(filters: QueryFilters): Promise<string> {
  const duration = env.VIDEO_DURATION_SEC;
  const rows = await db().execute<{
    id: number;
    registered_at: string;
    name: string | null;
    phone: string | null;
    username: string | null;
    source: string | null;
    campaign: string | null;
    max_position: string | number;
    completed: boolean;
    channel_clicked: boolean;
  }>(sql`
    SELECT
      u.id,
      to_char(u.registered_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS registered_at,
      u.name,
      u.phone,
      u.username,
      u.utm_source AS source,
      u.utm_campaign AS campaign,
      coalesce(wp.max_position, 0) AS max_position,
      coalesce(u.completed_at IS NOT NULL OR wp.completed IS TRUE, false) AS completed,
      (u.channel_click_at IS NOT NULL) AS channel_clicked
    FROM users u
    LEFT JOIN watch_progress wp ON wp.user_id = u.id
    WHERE
      u.registered_at IS NOT NULL
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date >= ${filters.from}::date
      AND (u.registered_at AT TIME ZONE 'Asia/Tashkent')::date <= ${filters.to}::date
      AND (${filters.source ?? null}::text IS NULL OR u.utm_source = ${filters.source ?? null})
      AND (${filters.campaign ?? null}::text IS NULL OR u.utm_campaign = ${filters.campaign ?? null})
    ORDER BY u.registered_at DESC, u.id DESC
  `);

  const headers = [
    "Ro'yxatdan o'tgan sana",
    "Ism",
    "Telefon",
    "Username",
    "Manba",
    "Kampaniya",
    "Ko'rish foizi",
    "Tugatilgan",
    "Adminga yozgan",
  ];

  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const r of rows) {
    const maxPos = Number(r.max_position) || 0;
    const progressPercent = duration > 0 ? Math.min(100, Math.round((maxPos / duration) * 100)) : 0;
    const line = [
      formatTashkentDate(r.registered_at),
      r.name ?? "",
      r.phone ?? "",
      r.username ? `@${r.username.replace(/^@/, "")}` : "",
      r.source ?? "",
      r.campaign ?? "",
      `${progressPercent}%`,
      r.completed ? "Ha" : "Yo'q",
      r.channel_clicked ? "Ha" : "Yo'q",
    ].map(escapeCsvCell).join(",");
    lines.push(line);
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
