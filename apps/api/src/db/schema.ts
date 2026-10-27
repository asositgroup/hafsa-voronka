import {
  type AnyPgColumn,
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
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  appointmentPurposes,
  driveImportErrors,
  driveImportStatuses,
  eventTypes,
  funnelSegments,
  type FunnelStatus,
  linkGrantKinds,
  offerAnswers,
  offerVariants,
  type RolloutAudience,
  rolloutAudiences,
  rolloutStatuses,
  segmentEndReasons,
  type TemplateButton,
  templateKinds,
  templateMediaTypes,
  type Utm,
} from "@funnel/shared";

export const botVideoSteps = [
  "confirm",
  "duration",
  "course",
  "price",
  "intro",
  "unlock",
  "summary",
  "done",
  "cancelled",
] as const;
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
    unlockSec: integer("unlock_sec"),
    shortOfferVideoUrl: text("short_offer_video_url"),
    shortOfferDuration: integer("short_offer_duration"),
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
        AND (${t.priceSec} IS NULL OR ${t.priceSec} < ${t.duration})
        AND (${t.unlockSec} IS NULL OR (${t.unlockSec} > 0 AND ${t.unlockSec} < ${t.duration}))`,
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
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  offerStartedAt: timestamp("offer_started_at", { withTimezone: true }),
  offerWatchedAt: timestamp("offer_watched_at", { withTimezone: true }),
  channelClickAt: timestamp("channel_click_at", { withTimezone: true }),
  wroteAdminAt: timestamp("wrote_admin_at", { withTimezone: true }),
  wroteAdminBy: bigint("wrote_admin_by", { mode: "number" }),
  botBlocked: boolean("bot_blocked").default(false).notNull(),
  funnelEpoch: integer("funnel_epoch").default(0).notNull(),
  linkId: bigint("link_id", { mode: "number" }).references((): AnyPgColumn => linkGrants.id),
  videoId: bigint("video_id", { mode: "number" }).references(() => videos.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("users_registered_at_idx").on(t.registeredAt),
    index("users_video_id_idx").on(t.videoId),
  ],
);

export const linkGrants = pgTable(
  "link_grants",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references((): AnyPgColumn => users.id),
    epoch: integer("epoch").default(0).notNull(),
    attempt: smallint("attempt").notNull(),
    day: smallint("day").notNull(),
    kind: text("kind", { enum: linkGrantKinds }).notNull(),
    offerFirst: boolean("offer_first").default(false).notNull(),
    silent: boolean("silent").default(false).notNull(),
    givenAt: timestamp("given_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("link_grants_user_epoch_attempt_idx").on(t.userId, t.epoch, t.attempt),
    index("link_grants_expires_at_idx").on(t.expiresAt),
    check("link_grants_attempt_range", sql`${t.attempt} >= 1`),
    check("link_grants_day_range", sql`${t.day} >= 1`),
  ],
);

export type LinkGrant = typeof linkGrants.$inferSelect;

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
    attempt: smallint("attempt").default(1).notNull(),
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
    introEndSec: integer("intro_end_sec"),
    unlockSec: integer("unlock_sec"),
    sentAsVideo: boolean("sent_as_video").default(false).notNull(),
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

export const botAdminInputKinds = ["mark", "shortVideo"] as const;
export type BotAdminInputKind = (typeof botAdminInputKinds)[number];

export const videoMarkFields = ["introEndSec", "courseStartSec", "priceSec", "unlockSec"] as const;
export type VideoMarkField = (typeof videoMarkFields)[number];

export const botAdminInputs = pgTable("bot_admin_inputs", {
  adminTelegramId: bigint("admin_telegram_id", { mode: "number" }).primaryKey(),
  kind: text("kind", { enum: botAdminInputKinds }).notNull(),
  videoId: bigint("video_id", { mode: "number" })
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  mark: text("mark", { enum: videoMarkFields }),
  shortFileUniqueId: text("short_file_unique_id"),
  shortDuration: integer("short_duration"),
  shortFileUrl: text("short_file_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BotAdminInput = typeof botAdminInputs.$inferSelect;

export const botAdminTestModes = pgTable("bot_admin_test_modes", {
  adminTelegramId: bigint("admin_telegram_id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
});

export const videoImports = pgTable(
  "video_imports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    driveFileId: text("drive_file_id").notNull(),
    title: text("title").notNull(),
    totalBytes: bigint("total_bytes", { mode: "number" }).notNull(),
    durationSec: integer("duration_sec").notNull(),
    status: text("status", { enum: driveImportStatuses }).notNull().default("running"),
    bytesDone: bigint("bytes_done", { mode: "number" }).notNull().default(0),
    error: text("error", { enum: driveImportErrors }),
    videoId: bigint("video_id", { mode: "number" }).references(() => videos.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("video_imports_one_running_idx").on(t.status).where(sql`${t.status} = 'running'`)],
);

export type VideoImport = typeof videoImports.$inferSelect;

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
    timingValue: integer("timing_value").notNull(),
    buttons: jsonb("buttons").$type<TemplateButton[]>().default([]).notNull(),
    statuses: text("statuses").array().$type<FunnelStatus[]>(),
    kind: text("kind", { enum: templateKinds }).default("reminder").notNull(),
    atExpiry: boolean("at_expiry").default(false).notNull(),
    isPermanent: boolean("is_permanent").default(false).notNull(),
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
    check("message_templates_segment_values", sql`${t.segment} in ('A', 'B', 'C') or ${t.deletedAt} is not null`),
    check("message_templates_timing_value_range", sql`${t.timingValue} between 0 and 1439`),
    uniqueIndex("message_templates_one_trigger_idx")
      .on(t.segment, t.day)
      .where(sql`${t.kind} = 'trigger' and ${t.isActive} and ${t.deletedAt} is null`),
    check(
      "message_templates_kind_shape",
      sql`(${t.kind} = 'reminder' and not ${t.atExpiry}) or (${t.kind} = 'trigger' and ${t.segment} in ('A', 'B') and ${t.day} between 2 and 7)`,
    ),
    check(
      "message_templates_statuses_values",
      sql`${t.statuses} is null or (cardinality(${t.statuses}) > 0 and ${t.statuses} <@ array['link_berildi', 'korishni_boshladi', 'dars_yarmida', 'sotuvda_toxtadi', 'narxni_kurdi', 'adminga_yozdi']::text[])`,
    ),
    check("message_templates_media_pair", sql`(${t.mediaType} is null) = (${t.mediaFileId} is null)`),
  ],
);

export type MessageTemplateRow = typeof messageTemplates.$inferSelect;

export type SentLinkTarget = { kind: "admin" | "link"; url: string } | null;

export const sentMessages = pgTable(
  "sent_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    templateId: bigint("template_id", { mode: "number" }).references(() => messageTemplates.id),
    botTextKey: text("bot_text_key"),
    linkId: bigint("link_id", { mode: "number" }).references(() => linkGrants.id),
    segmentRunId: bigint("segment_run_id", { mode: "number" })
      .notNull()
      .references(() => segmentRuns.id),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    slot: text("slot").default("").notNull(),
    clickToken: uuid("click_token").defaultRandom().notNull().unique(),
    linkTargets: jsonb("link_targets").$type<SentLinkTarget[]>().default([]).notNull(),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sendError: text("send_error"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deleteError: text("delete_error"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sent_messages_run_template_slot_idx").on(t.segmentRunId, t.templateId, t.slot),
    index("sent_messages_user_sent_idx").on(t.userId, t.sentAt),
    index("sent_messages_undeleted_idx")
      .on(t.sentAt)
      .where(sql`${t.sentAt} is not null and ${t.deletedAt} is null and ${t.deleteError} is null`),
    index("sent_messages_template_idx").on(t.templateId),
    index("sent_messages_link_idx").on(t.linkId),
    check("sent_messages_source", sql`(${t.templateId} is null) <> (${t.botTextKey} is null)`),
  ],
);

export type SentMessage = typeof sentMessages.$inferSelect;

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    fromBot: boolean("from_bot").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deleteError: text("delete_error"),
  },
  (t) => [
    uniqueIndex("chat_messages_chat_message_idx").on(t.chatId, t.messageId),
    index("chat_messages_undeleted_idx")
      .on(t.sentAt)
      .where(sql`${t.deletedAt} is null and ${t.deleteError} is null`),
  ],
);

export type ChatMessage = typeof chatMessages.$inferSelect;

export const secondChanceOffers = pgTable(
  "second_chance_offers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    epoch: integer("epoch").default(0).notNull(),
    occasion: smallint("occasion").notNull(),
    variant: text("variant", { enum: offerVariants }).notNull(),
    expiredLinkId: bigint("expired_link_id", { mode: "number" })
      .notNull()
      .references(() => linkGrants.id),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    sentMessageId: bigint("sent_message_id", { mode: "number" }).references(() => sentMessages.id),
    skipped: boolean("skipped").default(false).notNull(),
    answer: text("answer", { enum: offerAnswers }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    grantedLinkId: bigint("granted_link_id", { mode: "number" }).references(() => linkGrants.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("second_chance_offers_user_epoch_occasion_idx").on(t.userId, t.epoch, t.occasion),
    index("second_chance_offers_sent_message_idx").on(t.sentMessageId),
    check("second_chance_offers_occasion_range", sql`${t.occasion} between 1 and 7`),
    check("second_chance_offers_answer_pair", sql`(${t.answer} is null) = (${t.answeredAt} is null)`),
  ],
);

export type SecondChanceOffer = typeof secondChanceOffers.$inferSelect;

export const watchAppointments = pgTable(
  "watch_appointments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    offerId: bigint("offer_id", { mode: "number" }).references(() => secondChanceOffers.id),
    purpose: text("purpose", { enum: appointmentPurposes }).notNull(),
    chosenAt: timestamp("chosen_at", { withTimezone: true }).notNull(),
    preRemindAt: timestamp("pre_remind_at", { withTimezone: true }),
    preSentMessageId: bigint("pre_sent_message_id", { mode: "number" }).references(() => sentMessages.id),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    firedMessageId: bigint("fired_message_id", { mode: "number" }).references(() => sentMessages.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("watch_appointments_one_pending_idx")
      .on(t.userId)
      .where(sql`${t.firedAt} is null and ${t.cancelledAt} is null`),
    index("watch_appointments_due_idx")
      .on(t.chosenAt)
      .where(sql`${t.firedAt} is null and ${t.cancelledAt} is null`),
    check("watch_appointments_closed_once", sql`${t.firedAt} is null or ${t.cancelledAt} is null`),
  ],
);

export type WatchAppointment = typeof watchAppointments.$inferSelect;

export const rolloutRecipientStates = ["pending", "restarted", "sent", "blocked", "skipped", "failed"] as const;
export type RolloutRecipientState = (typeof rolloutRecipientStates)[number];

export const videoRollouts = pgTable(
  "video_rollouts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    videoId: bigint("video_id", { mode: "number" })
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    audiences: text("audiences").array().$type<RolloutAudience[]>().notNull(),
    sinceDays: integer("since_days"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: rolloutStatuses }).notNull().default("scheduled"),
    previewCount: integer("preview_count").notNull(),
    targetCount: integer("target_count"),
    sentCount: integer("sent_count").default(0).notNull(),
    blockedCount: integer("blocked_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("video_rollouts_one_open_idx")
      .on(sql`(true)`)
      .where(sql`${t.status} in ('scheduled', 'running')`),
    index("video_rollouts_video_idx").on(t.videoId, t.createdAt),
    check(
      "video_rollouts_audiences_values",
      sql`cardinality(${t.audiences}) > 0 and ${t.audiences} <@ array['not_opened', 'halfway', 'saw_price', 'wrote_admin', 'bought']::text[]`,
    ),
    check("video_rollouts_status_values", sql`${t.status} in ('scheduled', 'running', 'done', 'cancelled')`),
    check("video_rollouts_finished_pair", sql`(${t.finishedAt} is null) = (${t.status} in ('scheduled', 'running'))`),
  ],
);

export type VideoRolloutRow = typeof videoRollouts.$inferSelect;

export const videoRolloutRecipients = pgTable(
  "video_rollout_recipients",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    rolloutId: bigint("rollout_id", { mode: "number" })
      .notNull()
      .references(() => videoRollouts.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    audience: text("audience", { enum: rolloutAudiences }).notNull(),
    state: text("state", { enum: rolloutRecipientStates }).notNull().default("pending"),
    linkId: bigint("link_id", { mode: "number" }).references(() => linkGrants.id),
    sentMessageId: bigint("sent_message_id", { mode: "number" }).references(() => sentMessages.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("video_rollout_recipients_rollout_user_idx").on(t.rolloutId, t.userId),
    index("video_rollout_recipients_open_idx")
      .on(t.rolloutId, t.state, t.id)
      .where(sql`${t.state} in ('pending', 'restarted')`),
  ],
);

export type VideoRolloutRecipient = typeof videoRolloutRecipients.$inferSelect;
