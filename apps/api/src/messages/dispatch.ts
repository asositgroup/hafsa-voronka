import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { type Api, GrammyError, HttpError, InlineKeyboard } from "grammy";
import type { Message } from "grammy/types";
import {
  type BotButtonKey,
  type BotMessageKey,
  type FunnelSegment,
  type FunnelStatus,
  isInRolloutWindow,
  linkBoundSegments,
  type TemplateButton,
} from "@funnel/shared";
import { db, rawClient } from "@/db";
import {
  linkGrants,
  messageTemplates,
  type MessageTemplateRow,
  type SentLinkTarget,
  sentMessages,
  users,
  segmentRuns,
  type VideoRolloutRecipient,
  videoRolloutRecipients,
  videos,
  watchAppointments,
  watchProgress,
} from "@/db/schema";
import { env } from "@/env";
import { syncSegment } from "@/funnel/segments";
import { NO_VIDEO_MARKS, statusFor } from "@/funnel/status";
import { logEvent } from "@/funnel/users";
import { refreshUserLeadCards } from "@/leads/service";
import { type LessonState, lessonState, reopenWithin } from "@/links/service";
import { linkTtlHours, messageCaps } from "@/settings/service";
import { isAdminTelegramId, notAdminTelegramId } from "@/telegram/admins";
import { bot } from "@/telegram/bot";
import { isBlockedError, markBlocked } from "@/telegram/blocked";
import { cleanupChatMessages } from "@/telegram/chatLog";
import { botText, sendBotText } from "@/telegram/texts";
import { watchAppUrl } from "@/telegram/watchUrl";
import { uz } from "@/i18n/uz";
import {
  cancelIfVideoInactive,
  cancelledStragglers,
  dueRollout,
  priorPrompt,
  promptRunId,
  refreshRolloutProgress,
  restartRecipient,
  ROLLOUT_PROMPT_KEY,
  rolloutBatch,
  settleRecipient,
  startRollout,
} from "@/videos/rollout/run";
import { templateContextFor } from "./context";
import { renderTemplate, type ButtonWrap } from "./render";
import { activeTemplateRows, toTemplate } from "./repo";
import {
  CHAIN_MS,
  DAY_MS,
  isWatchingNow,
  nextPendingDue,
  pickNext,
  type PlanItem,
  planChain,
  segmentChainInput,
  type SendUsage,
  tashkentDayStart,
  type WatchSnapshot,
} from "./plan";
import { sendRendered } from "./send";

const DISPATCH_LOCK_KEY = 849204814;
const DISPATCH_INTERVAL_MS = 60_000;
const MAX_USERS_PER_TICK = 1000;
const API_GAP_MS = 35;
const HOUR_MS = 3_600_000;
const SWEEP_AGE_MS = 47 * HOUR_MS;
const SWEEP_HARD_MS = 47 * HOUR_MS + 50 * 60_000;
const DELETE_LIMIT_MS = 48 * HOUR_MS;
const INTERRUPTED_MS = 10 * 60_000;
const SWEEP_BATCH_SIZE = 500;
const APPOINTMENT_BATCH_SIZE = 500;
const ROLLOUT_BATCH_SIZE = 300;
const DEFAULT_RETRY_AFTER_SEC = 30;
const MESSAGE_NOT_FOUND = "message to delete not found";

export type DispatchOptions = { api?: Api; now?: () => Date; gapMs?: number };

type Pace = () => Promise<void>;
type SendResult = "ok" | "skip" | "abort";
type Delivery = "ok" | "blocked" | "retry" | "failed" | "abort";

type Candidate = {
  runId: number;
  userId: number;
  segment: FunnelSegment;
  enteredAt: Date;
  attempt: number;
  telegramId: number;
  linkId: number | null;
  linkExpiresAt: Date | null;
  sentTemplateIds: number[];
  deferredSent: boolean;
  usage: SendUsage;
  status: FunnelStatus | null;
  watch: WatchSnapshot;
};

type Pick = { candidate: Candidate; item: PlanItem<MessageTemplateRow> };

type DeletableRow = { id: number; telegramMessageId: number; sentAt: Date };

let pausedUntil = 0;

function createPacer(gapMs: number): Pace {
  let last = 0;
  return async () => {
    const wait = last + gapMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
  };
}

export function trackedWrap(
  clickToken: string,
  sentId: number,
  buttons: TemplateButton[],
  targets: SentLinkTarget[],
): ButtonWrap {
  return {
    url(url, index) {
      targets[index] = { kind: buttons[index].kind as "admin" | "link", url };
      return `${env.API_URL}/r/${clickToken}/${index}`;
    },
    webApp(url) {
      return `${url}${url.includes("?") ? "&" : "?"}m=${sentId}`;
    },
  };
}

const chainAllowed = sql`not exists (select 1 from ${linkGrants} where ${linkGrants.id} = ${users.linkId} and ${linkGrants.silent})`;

async function loadCandidates(now: Date, userId?: number): Promise<Candidate[]> {
  const dayStart = tashkentDayStart(now).toISOString();
  const since = new Date(now.getTime() - CHAIN_MS - DAY_MS);
  const rows = await db()
    .select({
      runId: segmentRuns.id,
      userId: segmentRuns.userId,
      segment: segmentRuns.segment,
      enteredAt: segmentRuns.enteredAt,
      attempt: segmentRuns.attempt,
      telegramId: users.telegramId,
      linkId: users.linkId,
      linkExpiresAt: users.linkExpiresAt,
      registeredAt: users.registeredAt,
      wroteAdminAt: users.wroteAdminAt,
      offerWatchedAt: users.offerWatchedAt,
      maxPosition: watchProgress.maxPosition,
      startedAt: watchProgress.startedAt,
      lastBeatAt: watchProgress.lastBeatAt,
      playing: watchProgress.playing,
      duration: videos.duration,
      introEndSec: videos.introEndSec,
      courseStartSec: videos.courseStartSec,
      priceSec: videos.priceSec,
      sentTemplateIds: sql<string[]>`coalesce(array_agg(${sentMessages.templateId}) filter (where ${sentMessages.templateId} is not null), '{}')::bigint[]`,
      deferredSent: sql<boolean>`coalesce(bool_or(${sentMessages.templateId} is not null and ${sentMessages.dueAt} = ${users.linkExpiresAt}), false)`,
      sentToday: sql<number>`(select count(*) from sent_messages c where c.user_id = ${segmentRuns.userId} and c.template_id is not null and c.sent_at >= ${dayStart}::timestamptz)::int`,
      runToday: sql<number>`(count(*) filter (where ${sentMessages.templateId} is not null and ${sentMessages.sentAt} >= ${dayStart}::timestamptz))::int`,
      runTotal: sql<number>`(count(${sentMessages.sentAt}) filter (where ${sentMessages.templateId} is not null))::int`,
    })
    .from(segmentRuns)
    .innerJoin(users, eq(users.id, segmentRuns.userId))
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .leftJoin(sentMessages, eq(sentMessages.segmentRunId, segmentRuns.id))
    .where(
      and(
        isNull(segmentRuns.endedAt),
        eq(users.botBlocked, false),
        isNull(users.wroteAdminAt),
        notAdminTelegramId(users.telegramId),
        chainAllowed,
        gt(segmentRuns.enteredAt, since),
        userId === undefined ? undefined : eq(segmentRuns.userId, userId),
      ),
    )
    .groupBy(segmentRuns.id, users.id, watchProgress.userId, videos.id);
  return rows.map((row) => ({
    runId: row.runId,
    userId: row.userId,
    segment: row.segment,
    enteredAt: row.enteredAt,
    attempt: row.attempt,
    telegramId: row.telegramId,
    linkId: row.linkId,
    linkExpiresAt: row.linkExpiresAt,
    sentTemplateIds: row.sentTemplateIds.map(Number),
    deferredSent: row.deferredSent,
    usage: { today: row.sentToday, runToday: row.runToday, runTotal: row.runTotal },
    status: statusFor(
      row.maxPosition === null ? undefined : { maxPosition: row.maxPosition, startedAt: row.startedAt },
      row.duration === null
        ? NO_VIDEO_MARKS
        : {
            duration: row.duration,
            introEndSec: row.introEndSec,
            courseStartSec: row.courseStartSec,
            priceSec: row.priceSec,
          },
      row,
    ),
    watch: { lastBeatAt: row.lastBeatAt, playing: row.playing ?? false },
  }));
}

async function markInterrupted(now: Date) {
  await db()
    .update(sentMessages)
    .set({ sendError: "interrupted" })
    .where(
      and(
        isNull(sentMessages.sentAt),
        isNull(sentMessages.sendError),
        lt(sentMessages.createdAt, new Date(now.getTime() - INTERRUPTED_MS)),
      ),
    );
}

function pauseFor(error: GrammyError, now: Date) {
  const retryAfter = error.parameters.retry_after ?? DEFAULT_RETRY_AFTER_SEC;
  pausedUntil = now.getTime() + retryAfter * 1000;
}

async function deleteSent(
  api: Api,
  chatId: number,
  row: DeletableRow,
  now: Date,
  pace: Pace,
): Promise<"ok" | "abort"> {
  const mark = (values: { deletedAt: Date } | { deleteError: string }) =>
    db().update(sentMessages).set(values).where(eq(sentMessages.id, row.id));

  if (now.getTime() - row.sentAt.getTime() >= DELETE_LIMIT_MS) {
    await mark({ deleteError: "too_old" });
    return "ok";
  }
  try {
    await pace();
    await api.deleteMessage(chatId, row.telegramMessageId);
    await mark({ deletedAt: now });
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 429) {
      pauseFor(error, now);
      return "abort";
    }
    if (isBlockedError(error) || (error instanceof GrammyError && error.description.includes(MESSAGE_NOT_FOUND))) {
      await mark({ deletedAt: now });
    } else {
      await mark({ deleteError: error instanceof Error ? error.message : String(error) });
    }
  }
  return "ok";
}

async function deletePrevious(
  api: Api,
  userId: number,
  chatId: number,
  newId: number,
  now: Date,
  pace: Pace,
): Promise<"ok" | "abort"> {
  const rows = await db()
    .select({ id: sentMessages.id, telegramMessageId: sentMessages.telegramMessageId, sentAt: sentMessages.sentAt })
    .from(sentMessages)
    .where(
      and(
        eq(sentMessages.userId, userId),
        ne(sentMessages.id, newId),
        isNotNull(sentMessages.sentAt),
        isNotNull(sentMessages.telegramMessageId),
        isNull(sentMessages.deletedAt),
        isNull(sentMessages.deleteError),
      ),
    )
    .orderBy(asc(sentMessages.id));
  for (const row of rows) {
    const result = await deleteSent(
      api,
      chatId,
      { id: row.id, telegramMessageId: row.telegramMessageId!, sentAt: row.sentAt! },
      now,
      pace,
    );
    if (result === "abort") return "abort";
  }
  return "ok";
}

async function sendOne(api: Api, pick: Pick, now: Date, pace: Pace): Promise<SendResult> {
  const { candidate, item } = pick;
  const { userId, runId, telegramId } = candidate;
  const nowIso = now.toISOString();

  const reserved = await db().execute<{ id: string; click_token: string }>(sql`
    insert into sent_messages (user_id, template_id, link_id, segment_run_id, due_at, created_at)
    select ${userId}, ${item.template.id}, (select link_id from users where id = ${userId}), ${runId}, ${item.sendAt.toISOString()}::timestamptz, ${nowIso}::timestamptz
    where exists (
        select 1 from segment_runs r join users u on u.id = r.user_id
        where r.id = ${runId} and r.ended_at is null and u.bot_blocked = false and u.wrote_admin_at is null
          and not exists (select 1 from link_grants g where g.id = u.link_id and g.silent)
      )
      and exists (
        select 1 from message_templates t
        where t.id = ${item.template.id} and t.is_active and t.deleted_at is null
      )
    on conflict (segment_run_id, template_id, slot) do nothing
    returning id, click_token
  `);
  if (reserved.length === 0) return "skip";
  const id = Number(reserved[0].id);
  const clickToken = reserved[0].click_token;

  const release = () => db().delete(sentMessages).where(eq(sentMessages.id, id));

  const [row] = await db().select().from(messageTemplates).where(eq(messageTemplates.id, item.template.id));
  const context = await templateContextFor(userId, now);
  if (!row || !context) {
    await release();
    return "skip";
  }

  if ((await deletePrevious(api, userId, telegramId, id, now, pace)) === "abort") {
    await release();
    return "abort";
  }

  const targets: SentLinkTarget[] = row.buttons.map(() => null);
  const rendered = renderTemplate(toTemplate(row), context, {
    ref: `s${id}`,
    wrap: trackedWrap(clickToken, id, row.buttons, targets),
  });
  await db().update(sentMessages).set({ linkTargets: targets }).where(eq(sentMessages.id, id));

  const delivery = await deliver(id, userId, now, pace, () => sendRendered(api, telegramId, rendered));
  return delivery === "ok" || delivery === "abort" ? delivery : "skip";
}

async function deliver(
  id: number,
  userId: number,
  now: Date,
  pace: Pace,
  send: () => Promise<Message>,
): Promise<Delivery> {
  try {
    await pace();
    const message = await send();
    await db()
      .update(sentMessages)
      .set({ sentAt: now, telegramMessageId: message.message_id })
      .where(eq(sentMessages.id, id));
    return "ok";
  } catch (error) {
    if (isBlockedError(error)) {
      await db()
        .update(sentMessages)
        .set({ sendError: (error as GrammyError).description })
        .where(eq(sentMessages.id, id));
      await markBlocked(userId);
      return "blocked";
    }
    if (error instanceof GrammyError && error.error_code === 429) {
      await db().delete(sentMessages).where(eq(sentMessages.id, id));
      pauseFor(error, now);
      return "abort";
    }
    if (error instanceof HttpError || (error instanceof GrammyError && error.error_code >= 500)) {
      await db().delete(sentMessages).where(eq(sentMessages.id, id));
      return "retry";
    }
    console.error(`Message ${id} failed:`, error);
    await db()
      .update(sentMessages)
      .set({ sendError: error instanceof Error ? error.message : String(error) })
      .where(eq(sentMessages.id, id));
    return "failed";
  }
}

type SystemMessage = {
  userId: number;
  telegramId: number;
  key: BotMessageKey;
  button?: BotButtonKey;
  vars?: Record<string, string>;
  runId?: number;
};

async function openRunId(userId: number): Promise<number | null> {
  const [run] = await db()
    .select({ id: segmentRuns.id })
    .from(segmentRuns)
    .where(and(eq(segmentRuns.userId, userId), isNull(segmentRuns.endedAt)))
    .limit(1);
  return run?.id ?? null;
}

async function sendSystem(
  api: Api,
  message: SystemMessage,
  now: Date,
  pace: Pace,
): Promise<{ result: Delivery | "skip"; sentMessageId: number | null }> {
  const { userId, telegramId, key, button, vars } = message;
  const runId = message.runId ?? (await openRunId(userId));
  if (runId === null) return { result: "skip", sentMessageId: null };

  const [reserved] = await db()
    .insert(sentMessages)
    .values({
      userId,
      botTextKey: key,
      linkId: sql`(select link_id from users where id = ${userId})`,
      segmentRunId: runId,
      dueAt: now,
      createdAt: now,
    })
    .returning({ id: sentMessages.id });
  const release = () => db().delete(sentMessages).where(eq(sentMessages.id, reserved.id));

  if ((await deletePrevious(api, userId, telegramId, reserved.id, now, pace)) === "abort") {
    await release();
    return { result: "abort", sentMessageId: null };
  }
  const keyboard = button
    ? new InlineKeyboard().webApp(await botText(button), `${watchAppUrl()}?m=${reserved.id}`)
    : undefined;
  const result = await deliver(reserved.id, userId, now, pace, () =>
    sendBotText(api, telegramId, key, vars, keyboard),
  );
  return { result, sentMessageId: result === "ok" ? reserved.id : null };
}

function chainFor(candidate: Candidate, templates: MessageTemplateRow[]) {
  return planChain(
    segmentChainInput(templates, {
      segment: candidate.segment,
      enteredAt: candidate.enteredAt,
      status: candidate.status,
      watch: candidate.watch,
      attempt: candidate.attempt,
      linkExpiresAt: candidate.linkExpiresAt,
      deferredSent: candidate.deferredSent,
    }),
  );
}

async function sendDue(api: Api, now: Date, pace: Pace, candidates: Candidate[]) {
  if (now.getTime() < pausedUntil) return;

  const templates = await db()
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.isActive, true), isNull(messageTemplates.deletedAt)));
  const bySegment = new Map<FunnelSegment, MessageTemplateRow[]>();
  for (const template of templates) {
    bySegment.set(template.segment, [...(bySegment.get(template.segment) ?? []), template]);
  }

  const caps = await messageCaps();
  const picks: Pick[] = [];
  for (const candidate of candidates) {
    if (isWatchingNow(candidate.watch, now)) continue;
    const plan = chainFor(candidate, bySegment.get(candidate.segment) ?? []);
    const item = pickNext(plan, new Set(candidate.sentTemplateIds), now, candidate.usage, caps[candidate.segment]);
    if (item) picks.push({ candidate, item });
  }
  picks.sort((a, b) => a.item.sendAt.getTime() - b.item.sendAt.getTime());

  for (const pick of picks.slice(0, MAX_USERS_PER_TICK)) {
    if ((await sendOne(api, pick, now, pace)) === "abort") return;
  }
}

async function sweepExpiredLinkMessages(api: Api, now: Date, pace: Pace) {
  if (now.getTime() < pausedUntil) return;
  const stale = await db()
    .select({
      id: sentMessages.id,
      telegramMessageId: sentMessages.telegramMessageId,
      sentAt: sentMessages.sentAt,
      telegramId: users.telegramId,
    })
    .from(sentMessages)
    .innerJoin(segmentRuns, eq(segmentRuns.id, sentMessages.segmentRunId))
    .innerJoin(linkGrants, eq(linkGrants.id, sentMessages.linkId))
    .innerJoin(users, eq(users.id, sentMessages.userId))
    .where(
      and(
        inArray(segmentRuns.segment, [...linkBoundSegments]),
        lte(linkGrants.expiresAt, now),
        lt(sentMessages.sentAt, linkGrants.expiresAt),
        gt(sentMessages.sentAt, new Date(now.getTime() - DELETE_LIMIT_MS)),
        isNotNull(sentMessages.telegramMessageId),
        isNull(sentMessages.deletedAt),
        isNull(sentMessages.deleteError),
      ),
    )
    .orderBy(asc(sentMessages.id))
    .limit(SWEEP_BATCH_SIZE);
  for (const row of stale) {
    const result = await deleteSent(
      api,
      row.telegramId,
      { id: row.id, telegramMessageId: row.telegramMessageId!, sentAt: row.sentAt! },
      now,
      pace,
    );
    if (result === "abort") return;
  }
}

type AppointmentRow = {
  appointment: typeof watchAppointments.$inferSelect;
  user: typeof users.$inferSelect;
  state: LessonState;
  lastBeatAt: Date | null;
};

function appointmentStillValid({ appointment, user, state, lastBeatAt }: AppointmentRow): boolean {
  if (user.botBlocked || user.wroteAdminAt !== null || isAdminTelegramId(user.telegramId)) return false;
  if (appointment.purpose === "reopen") return state.closed;
  return !state.closed && !(lastBeatAt && lastBeatAt.getTime() > appointment.createdAt.getTime());
}

async function fireReopen(row: AppointmentRow, now: Date): Promise<boolean> {
  const { appointment, user } = row;
  const ttlHours = await linkTtlHours();
  return db().transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("update");
    const [open] = await tx
      .select({ id: watchAppointments.id })
      .from(watchAppointments)
      .where(
        and(
          eq(watchAppointments.id, appointment.id),
          isNull(watchAppointments.firedAt),
          isNull(watchAppointments.cancelledAt),
        ),
      )
      .for("update");
    if (!open) return false;
    if ((await reopenWithin(tx, user.id, "scheduled", now, ttlHours)) !== "reopened") return false;
    await tx.update(watchAppointments).set({ firedAt: now }).where(eq(watchAppointments.id, appointment.id));
    return true;
  });
}

async function fireRemind(row: AppointmentRow, now: Date): Promise<boolean> {
  const [fired] = await db()
    .update(watchAppointments)
    .set({ firedAt: now })
    .where(
      and(
        eq(watchAppointments.id, row.appointment.id),
        isNull(watchAppointments.firedAt),
        isNull(watchAppointments.cancelledAt),
      ),
    )
    .returning({ id: watchAppointments.id });
  return fired !== undefined;
}

async function processAppointments(api: Api, now: Date, pace: Pace) {
  if (now.getTime() < pausedUntil) return;
  const dueRows = await db()
    .select({
      appointment: watchAppointments,
      user: users,
      lastBeatAt: watchProgress.lastBeatAt,
    })
    .from(watchAppointments)
    .innerJoin(users, eq(users.id, watchAppointments.userId))
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .where(
      and(
        isNull(watchAppointments.firedAt),
        isNull(watchAppointments.cancelledAt),
        or(
          lte(watchAppointments.chosenAt, now),
          and(
            isNull(watchAppointments.preSentMessageId),
            isNotNull(watchAppointments.preRemindAt),
            lte(watchAppointments.preRemindAt, now),
          ),
        ),
      ),
    )
    .orderBy(asc(watchAppointments.chosenAt))
    .limit(APPOINTMENT_BATCH_SIZE);

  for (const dueRow of dueRows) {
    const row: AppointmentRow = { ...dueRow, state: await lessonState(db(), dueRow.user, now) };
    const { appointment, user } = row;
    const userId = user.id;
    if (!appointmentStillValid(row)) {
      await db().update(watchAppointments).set({ cancelledAt: now }).where(eq(watchAppointments.id, appointment.id));
      await refreshUserLeadCards(userId).catch((error) => console.error("Lead card refresh failed:", error));
      continue;
    }

    if (appointment.chosenAt.getTime() > now.getTime()) {
      const sent = await sendSystem(api, { userId, telegramId: user.telegramId, key: "reopenPreReminder" }, now, pace);
      if (sent.sentMessageId !== null) {
        await db()
          .update(watchAppointments)
          .set({ preSentMessageId: sent.sentMessageId })
          .where(eq(watchAppointments.id, appointment.id));
      }
      if (sent.result === "abort") return;
      continue;
    }

    const reopen = appointment.purpose === "reopen";
    if (!(reopen ? await fireReopen(row, now) : await fireRemind(row, now))) continue;
    if (reopen) await syncSegment(userId, now).catch((error) => console.error("Segment sync failed:", error));

    const sent = await sendSystem(
      api,
      {
        userId,
        telegramId: user.telegramId,
        key: reopen ? "reopenNow" : "remindNow",
        button: reopen ? "reopenWatchButton" : "remindWatchButton",
      },
      now,
      pace,
    );
    if (sent.sentMessageId !== null) {
      await db()
        .update(watchAppointments)
        .set({ firedMessageId: sent.sentMessageId })
        .where(eq(watchAppointments.id, appointment.id));
    }
    await logEvent(reopen ? "later_reopened" : "later_reminded", { userId, meta: { appointmentId: appointment.id } });
    await refreshUserLeadCards(userId).catch((error) => console.error("Lead card refresh failed:", error));
    if (sent.result === "abort") return;
  }
}

async function sendRolloutPrompt(
  api: Api,
  recipient: VideoRolloutRecipient,
  now: Date,
  pace: Pace,
): Promise<"abort" | "retry" | "done"> {
  const prior = await priorPrompt(recipient);
  if (prior) {
    await settleRecipient(recipient.id, prior.state, prior.sentMessageId, now);
    return "done";
  }
  const [user] = await db().select().from(users).where(eq(users.id, recipient.userId));
  if (!user || user.botBlocked) {
    await settleRecipient(recipient.id, user ? "blocked" : "skipped", null, now);
    return "done";
  }
  const runId = await promptRunId(user.id);
  if (runId === null) {
    await settleRecipient(recipient.id, "skipped", null, now);
    return "done";
  }
  const sent = await sendSystem(
    api,
    {
      userId: user.id,
      telegramId: user.telegramId,
      key: ROLLOUT_PROMPT_KEY,
      button: "watchButton",
      vars: { name: user.firstName || user.name || uz.bot.defaultName },
      runId,
    },
    now,
    pace,
  );
  if (sent.result === "abort" || sent.result === "retry") return sent.result;
  if (sent.result === "ok") await settleRecipient(recipient.id, "sent", sent.sentMessageId, now);
  else await settleRecipient(recipient.id, sent.result === "blocked" ? "blocked" : "failed", null, now);
  return "done";
}

async function promptRestarted(api: Api, recipientId: number, now: Date, pace: Pace): Promise<"abort" | "ok"> {
  const [restarted] = await db().select().from(videoRolloutRecipients).where(eq(videoRolloutRecipients.id, recipientId));
  if (restarted?.state !== "restarted") return "ok";
  await syncSegment(restarted.userId, now).catch((error) => console.error("Segment sync failed:", error));
  const result = await sendRolloutPrompt(api, restarted, now, pace);
  if (result === "abort") return "abort";
  if (result === "done") {
    await refreshUserLeadCards(restarted.userId).catch((error) => console.error("Lead card refresh failed:", error));
  }
  return "ok";
}

async function finishCancelledPrompts(api: Api, now: Date, pace: Pace): Promise<"abort" | "ok"> {
  const stragglers = await cancelledStragglers(ROLLOUT_BATCH_SIZE);
  const touched = new Set<number>();
  try {
    for (const recipient of stragglers) {
      touched.add(recipient.rolloutId);
      if ((await promptRestarted(api, recipient.id, now, pace)) === "abort") return "abort";
    }
    return "ok";
  } finally {
    for (const rolloutId of touched) await refreshRolloutProgress(rolloutId, now);
  }
}

async function processRollouts(api: Api, now: Date, pace: Pace) {
  if (now.getTime() < pausedUntil) return;
  const due = await dueRollout(now);
  if (due && (await cancelIfVideoInactive(due, now))) return;
  if (!isInRolloutWindow(now)) return;
  if ((await finishCancelledPrompts(api, now, pace)) === "abort" || !due) return;
  const rollout = await startRollout(due, now);
  if (!rollout) return;

  const ttlHours = await linkTtlHours();
  try {
    for (const recipient of await rolloutBatch(rollout.id, ROLLOUT_BATCH_SIZE)) {
      if (recipient.state === "pending") {
        const outcome = await restartRecipient(rollout, recipient, now, ttlHours);
        if (outcome === "stopped") return;
        if (outcome === "skipped") continue;
      }
      if ((await promptRestarted(api, recipient.id, now, pace)) === "abort") return;
    }
  } finally {
    await refreshRolloutProgress(rollout.id, now);
  }
}

async function nextDueForUser(userId: number, now: Date) {
  const [candidate] = await loadCandidates(now, userId);
  if (!candidate) return null;
  const templates = await activeTemplateRows(candidate.segment);
  return nextPendingDue(chainFor(candidate, templates), new Set(candidate.sentTemplateIds), now);
}

async function sweep(api: Api, now: Date, pace: Pace) {
  if (now.getTime() < pausedUntil) return;

  await db()
    .update(sentMessages)
    .set({ deleteError: "too_old" })
    .where(
      and(
        lte(sentMessages.sentAt, new Date(now.getTime() - DELETE_LIMIT_MS)),
        isNotNull(sentMessages.telegramMessageId),
        isNull(sentMessages.deletedAt),
        isNull(sentMessages.deleteError),
      ),
    );

  const rows = await db()
    .select({
      id: sentMessages.id,
      userId: sentMessages.userId,
      telegramMessageId: sentMessages.telegramMessageId,
      sentAt: sentMessages.sentAt,
      telegramId: users.telegramId,
    })
    .from(sentMessages)
    .innerJoin(users, eq(users.id, sentMessages.userId))
    .where(
      and(
        lte(sentMessages.sentAt, new Date(now.getTime() - SWEEP_AGE_MS)),
        gt(sentMessages.sentAt, new Date(now.getTime() - DELETE_LIMIT_MS)),
        isNotNull(sentMessages.telegramMessageId),
        isNull(sentMessages.deletedAt),
        isNull(sentMessages.deleteError),
      ),
    )
    .orderBy(asc(sentMessages.sentAt))
    .limit(SWEEP_BATCH_SIZE);

  for (const row of rows) {
    const sentAt = row.sentAt!;
    if (now.getTime() - sentAt.getTime() < SWEEP_HARD_MS) {
      const next = await nextDueForUser(row.userId, now);
      if (next && next.getTime() <= sentAt.getTime() + SWEEP_HARD_MS) continue;
    }
    const result = await deleteSent(
      api,
      row.telegramId,
      { id: row.id, telegramMessageId: row.telegramMessageId!, sentAt },
      now,
      pace,
    );
    if (result === "abort") return;
  }
}

async function cleanupChat(api: Api, now: Date, pace: Pace) {
  if (now.getTime() < pausedUntil) return;
  try {
    await cleanupChatMessages(api, now, pace);
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 429) pauseFor(error, now);
    else throw error;
  }
}

export async function dispatchMessages(options: DispatchOptions = {}): Promise<void> {
  const api = options.api ?? bot().api;
  const clock = options.now ?? (() => new Date());
  const pace = createPacer(options.gapMs ?? API_GAP_MS);
  const conn = await rawClient().reserve();
  try {
    const [lock] = await conn`SELECT pg_try_advisory_lock(${DISPATCH_LOCK_KEY}) as locked`;
    if (!lock?.locked) return;
    try {
      await markInterrupted(clock());
      await sweepExpiredLinkMessages(api, clock(), pace);
      await processAppointments(api, clock(), pace);
      await processRollouts(api, clock(), pace);
      const candidates = await loadCandidates(clock());
      await sendDue(api, clock(), pace, candidates);
      await sweep(api, clock(), pace);
      await cleanupChat(api, clock(), pace);
    } finally {
      await conn`SELECT pg_advisory_unlock(${DISPATCH_LOCK_KEY})`;
    }
  } finally {
    conn.release();
  }
}

let running: Promise<void> | undefined;
let rerun = false;

export function kickMessageDispatcher() {
  if (running) {
    rerun = true;
    return;
  }
  running = (async () => {
    do {
      rerun = false;
      await dispatchMessages().catch((error) => console.error("Message dispatcher error:", error));
    } while (rerun);
  })().finally(() => {
    running = undefined;
  });
}

export function startMessageDispatchLoop(): () => void {
  kickMessageDispatcher();
  const timer = setInterval(kickMessageDispatcher, DISPATCH_INTERVAL_MS);
  return () => clearInterval(timer);
}
