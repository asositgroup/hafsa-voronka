import { and, asc, eq, gt, isNotNull, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { type Api, GrammyError, HttpError } from "grammy";
import type { FunnelSegment, TemplateButton } from "@funnel/shared";
import { db, rawClient } from "@/db";
import { messageTemplates, type MessageTemplateRow, type SentLinkTarget, sentMessages, users, segmentRuns } from "@/db/schema";
import { env } from "@/env";
import { bot } from "@/telegram/bot";
import { isBlockedError, markBlocked } from "@/telegram/blocked";
import { templateContextFor } from "./context";
import { renderTemplate, type ButtonWrap } from "./render";
import { toTemplate } from "./repo";
import {
  CHAIN_MS,
  DAY_MS,
  type DueItem,
  nextPendingDue,
  pendingSchedule,
  pickNext,
  tashkentDayStart,
} from "./schedule";
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
const DEFAULT_RETRY_AFTER_SEC = 30;
const MESSAGE_NOT_FOUND = "message to delete not found";

export type DispatchOptions = { api?: Api; now?: () => Date; gapMs?: number };

type Pace = () => Promise<void>;
type SendResult = "ok" | "skip" | "abort";

type Candidate = {
  runId: number;
  userId: number;
  segment: FunnelSegment;
  enteredAt: Date;
  telegramId: number;
  linkExpiresAt: Date | null;
  sentTemplateIds: number[];
  sentToday: number;
};

type Pick = { candidate: Candidate; item: DueItem<MessageTemplateRow> };

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

async function loadCandidates(now: Date, userId?: number): Promise<Candidate[]> {
  const dayStart = tashkentDayStart(now).toISOString();
  const since = new Date(now.getTime() - CHAIN_MS - DAY_MS);
  const rows = await db()
    .select({
      runId: segmentRuns.id,
      userId: segmentRuns.userId,
      segment: segmentRuns.segment,
      enteredAt: segmentRuns.enteredAt,
      telegramId: users.telegramId,
      linkExpiresAt: users.linkExpiresAt,
      sentTemplateIds: sql<number[]>`coalesce(array_agg(${sentMessages.templateId}) filter (where ${sentMessages.id} is not null), '{}')::int[]`,
      sentToday: sql<number>`(select count(*) from sent_messages c where c.user_id = ${segmentRuns.userId} and c.sent_at >= ${dayStart}::timestamptz)::int`,
    })
    .from(segmentRuns)
    .innerJoin(users, eq(users.id, segmentRuns.userId))
    .leftJoin(sentMessages, eq(sentMessages.segmentRunId, segmentRuns.id))
    .where(
      and(
        isNull(segmentRuns.endedAt),
        eq(users.botBlocked, false),
        isNull(users.wroteAdminAt),
        gt(segmentRuns.enteredAt, since),
        userId === undefined ? undefined : eq(segmentRuns.userId, userId),
      ),
    )
    .groupBy(segmentRuns.id, users.id);
  return rows;
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
    insert into sent_messages (user_id, template_id, segment_run_id, due_at, created_at)
    select ${userId}, ${item.template.id}, ${runId}, ${item.dueAt.toISOString()}::timestamptz, ${nowIso}::timestamptz
    where exists (
        select 1 from segment_runs r join users u on u.id = r.user_id
        where r.id = ${runId} and r.ended_at is null and u.bot_blocked = false and u.wrote_admin_at is null
      )
      and exists (
        select 1 from message_templates t
        where t.id = ${item.template.id} and t.is_active and t.deleted_at is null
      )
    on conflict (segment_run_id, template_id) do nothing
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

  try {
    await pace();
    const message = await sendRendered(api, telegramId, rendered);
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
      return "skip";
    }
    if (error instanceof GrammyError && error.error_code === 429) {
      await release();
      pauseFor(error, now);
      return "abort";
    }
    if (error instanceof HttpError || (error instanceof GrammyError && error.error_code >= 500)) {
      await release();
      return "skip";
    }
    console.error(`Message ${id} failed:`, error);
    await db()
      .update(sentMessages)
      .set({ sendError: error instanceof Error ? error.message : String(error) })
      .where(eq(sentMessages.id, id));
    return "skip";
  }
}

async function sendDue(api: Api, now: Date, pace: Pace) {
  if (now.getTime() < pausedUntil) return;

  const templates = await db()
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.isActive, true), isNull(messageTemplates.deletedAt)));
  const bySegment = new Map<FunnelSegment, MessageTemplateRow[]>();
  for (const template of templates) {
    bySegment.set(template.segment, [...(bySegment.get(template.segment) ?? []), template]);
  }

  const picks: Pick[] = [];
  for (const candidate of await loadCandidates(now)) {
    const pending = pendingSchedule(
      bySegment.get(candidate.segment) ?? [],
      { enteredAt: candidate.enteredAt, linkExpiresAt: candidate.linkExpiresAt },
      new Set(candidate.sentTemplateIds),
    );
    const item = pickNext(pending, now, candidate.sentToday);
    if (item) picks.push({ candidate, item });
  }
  picks.sort((a, b) => a.item.dueAt.getTime() - b.item.dueAt.getTime());

  for (const pick of picks.slice(0, MAX_USERS_PER_TICK)) {
    if ((await sendOne(api, pick, now, pace)) === "abort") return;
  }
}

async function nextDueForUser(userId: number, now: Date) {
  const [candidate] = await loadCandidates(now, userId);
  if (!candidate) return null;
  const templates = await db()
    .select()
    .from(messageTemplates)
    .where(
      and(
        eq(messageTemplates.isActive, true),
        isNull(messageTemplates.deletedAt),
        eq(messageTemplates.segment, candidate.segment),
      ),
    );
  const pending = pendingSchedule(
    templates,
    { enteredAt: candidate.enteredAt, linkExpiresAt: candidate.linkExpiresAt },
    new Set(candidate.sentTemplateIds),
  );
  return nextPendingDue(pending, now);
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
      await sendDue(api, clock(), pace);
      await sweep(api, clock(), pace);
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
