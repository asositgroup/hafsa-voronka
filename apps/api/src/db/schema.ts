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
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { eventTypes, type Utm } from "@funnel/shared";

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
      sql`${t.duration} > 0 AND (${t.courseStartSec} IS NULL OR ${t.priceSec} IS NULL OR ${t.courseStartSec} < ${t.priceSec}) AND (${t.priceSec} IS NULL OR ${t.priceSec} < ${t.duration})`,
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
