import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { eventTypes, type Utm } from "@funnel/shared";

export const users = pgTable("users", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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

export const sheetsQueue = pgTable("sheets_queue", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" }).references(() => users.id),
  row: jsonb("row").$type<unknown[]>().notNull(),
  attempts: integer("attempts").default(0).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: text("last_error"),
});

export type User = typeof users.$inferSelect;
