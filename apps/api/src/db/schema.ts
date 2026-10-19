import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  eventTypes,
  funnelSegments,
  segmentEndReasons,
  type TemplateButton,
  templateMediaTypes,
  timingTypes,
  type Utm,
} from "@funnel/shared";

export const botVideoSteps = ["confirm", "duration", "course", "price", "summary", "done", "cancelled"] as const;
export type BotVideoStep = (typeof botVideoSteps)[number];

export const botVideoUploadStatuses = ["idle", "pending", "uploading", "done", "failed"] as const;
export type BotVideoUploadStatus = (typeof botVideoUploadStatuses)[number];

export const videos = pgTable(
  "videos",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    title: text("title").notNull(),
    fileUrl: text("file_url").notNull(),
    duration: integer("duration").notNull(),
    introEndSec: integer("intro_end_sec"),
    courseStartSec: integer("course_start_sec"),
    priceSec: integer("price_sec"),
    shortOfferVideoUrl: text("short_offer_video_url"),
    isActive: boolean("is_active").default(false).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("videos_one_active_idx").on(t.isActive).where(sql`${t.isActive}`),
    check(
      "videos_marks_order",
      sql`${t.duration} > 0
        AND (${t.introEndSec} IS NULL OR (${t.introEndSec} >= 0 AND ${t.introEndSec} < COALESCE(${t.courseStartSec}, ${t.priceSec}, ${t.duration})))
        AND (${t.courseStartSec} IS NULL OR ${t.courseStartSec} > 0)
        AND (${t.courseStartSec} IS NULL OR ${t.priceSec} IS NULL OR ${t.courseStartSec} < ${t.priceSec})
        AND (${t.priceSec} IS NULL OR ${t.priceSec} < ${t.duration})`,
    ),
  ],
);

export type Video = typeof videos.$inferSelect;

export const users = pgTable(
  "users",
  {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).unique().notNull(),
  username: text("username"),
  firstName: text("first_name"),
  languageCode: text("language_code"),
  name: text("name"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  startParam: text("start_param"),
  visitorId: text("visitor_id"),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  fbclid: text("fbclid"),
  registeredAt: timestamp("registered_at", { withTimezone: true }),
  linkGivenAt: timestamp("link_given_at", { withTimezone: true }),
  linkExpiresAt: timestamp("link_expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  channelClickAt: timestamp("channel_click_at", { withTimezone: true }),
  botBlocked: boolean("bot_blocked").default(false).notNull(),
  videoId: bigint("video_id", { mode: "number" }).references(() => videos.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("users_registered_at_idx").on(t.registeredAt),
    index("users_video_id_idx").on(t.videoId),
  ],
);

export const segmentRuns = pgTable(
  "segment_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    segment: text("segment", { enum: funnelSegments }).notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason", { enum: segmentEndReasons }),
  },
  (t) => [
    uniqueIndex("segment_runs_one_open_idx").on(t.userId).where(sql`${t.endedAt} is null`),
    index("segment_runs_user_entered_idx").on(t.userId, t.enteredAt),
    check("segment_runs_end_pair", sql`(${t.endedAt} is null) = (${t.endReason} is null)`),
  ],
);

export type SegmentRun = typeof segmentRuns.$inferSelect;

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id),
    visitorId: text("visitor_id"),
    type: text("type", { enum: eventTypes }).notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("events_type_created_at_idx").on(t.type, t.createdAt),
    index("events_visitor_id_idx").on(t.visitorId),
    index("events_user_id_type_idx").on(t.userId, t.type),
  ],
);

export const watchProgress = pgTable("watch_progress", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => users.id),
  maxPosition: real("max_position").default(0).notNull(),
  watchedSecs: real("watched_secs").default(0).notNull(),
  lastBeatAt: timestamp("last_beat_at", { withTimezone: true }),
  lastPosition: real("last_position").default(0).notNull(),
  playing: boolean("playing").default(false).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completed: boolean("completed").default(false).notNull(),
});

export const campaignLinks = pgTable("campaign_links", {
  code: text("code").primaryKey(),
  utm: jsonb("utm").$type<Utm>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;

export const leads = pgTable(
  "leads",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    source: text("source", { enum: ["web", "bot"] }).notNull(),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id),
    visitorId: text("visitor_id"),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    utmSource: text("utm_source"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    fbclid: text("fbclid"),
    pageUrl: text("page_url"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    formSubmittedAt: timestamp("form_submitted_at", { withTimezone: true }),
    notifyVersion: integer("notify_version").default(1).notNull(),
    notifiedVersion: integer("notified_version").default(0).notNull(),
    notifyMessageId: integer("notify_message_id"),
    notifyAttempts: integer("notify_attempts").default(0).notNull(),
    notifyError: text("notify_error"),
    completionNotified: boolean("completion_notified").default(false).notNull(),
    sheetsSyncedVersion: integer("sheets_synced_version").default(0).notNull(),
    sheetsAttempts: integer("sheets_attempts").default(0).notNull(),
    sheetsError: text("sheets_error"),
    assigneeTelegramId: bigint("assignee_telegram_id", { mode: "number" }),
    assigneeName: text("assignee_name"),
    assigneeUsername: text("assignee_username"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    outcome: text("outcome", { enum: ["won", "lost"] }),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
  },
  (t) => [
    index("leads_visitor_id_idx").on(t.visitorId),
    index("leads_phone_idx").on(t.phone),
    index("leads_user_id_idx").on(t.userId),
  ],
);

export type Lead = typeof leads.$inferSelect;

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const botTexts = pgTable("bot_texts", {
  key: text("key").primaryKey(),
  text: text("text"),
  mediaType: text("media_type"),
  mediaFileId: text("media_file_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BotTextRow = typeof botTexts.$inferSelect;

export const botVideoDrafts = pgTable(
  "bot_video_drafts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    adminTelegramId: bigint("admin_telegram_id", { mode: "number" }).notNull(),
    fileId: text("file_id").notNull(),
    fileUniqueId: text("file_unique_id").notNull().unique(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    fileSize: bigint("file_size", { mode: "number" }),
    caption: text("caption"),
    duration: integer("duration"),
    step: text("step", { enum: botVideoSteps }).notNull().default("confirm"),
    courseStartSec: integer("course_start_sec"),
    priceSec: integer("price_sec"),
    uploadStatus: text("upload_status", { enum: botVideoUploadStatuses }).notNull().default("idle"),
    uploadClaimedAt: timestamp("upload_claimed_at", { withTimezone: true }),
    progressMessageId: bigint("progress_message_id", { mode: "number" }),
    r2Key: text("r2_key"),
    fileUrl: text("file_url"),
    uploadError: text("upload_error"),
    activateOnUpload: boolean("activate_on_upload").default(false).notNull(),
    videoId: bigint("video_id", { mode: "number" }).references(() => videos.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("bot_video_drafts_one_open_idx")
      .on(t.adminTelegramId)
      .where(sql`${t.step} not in ('done', 'cancelled')`),
  ],
);

export type BotVideoDraft = typeof botVideoDrafts.$inferSelect;

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    segment: text("segment", { enum: funnelSegments }).notNull(),
    day: smallint("day").notNull(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    mediaType: text("media_type", { enum: templateMediaTypes }),
    mediaFileId: text("media_file_id"),
    timingType: text("timing_type", { enum: timingTypes }).notNull(),
    timingValue: integer("timing_value").notNull(),
    buttons: jsonb("buttons").$type<TemplateButton[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("message_templates_day_idx")
      .on(t.segment, t.day, t.position)
      .where(sql`${t.deletedAt} is null`),
    check("message_templates_day_range", sql`${t.day} between 1 and 7`),
    check("message_templates_segment_values", sql`${t.segment} in ('A', 'B', 'C')`),
    check(
      "message_templates_timing_type_values",
      sql`${t.timingType} in ('after_entry', 'day_time', 'before_expiry')`,
    ),
    check("message_templates_media_pair", sql`(${t.mediaType} is null) = (${t.mediaFileId} is null)`),
    check(
      "message_templates_day_time_range",
      sql`${t.timingType} <> 'day_time' or ${t.timingValue} between 420 and 1379`,
    ),
  ],
);

export type MessageTemplateRow = typeof messageTemplates.$inferSelect;
