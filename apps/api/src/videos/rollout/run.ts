import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { type BotMessageKey, messageOnlyAudiences, type RolloutAudience } from "@funnel/shared";
import { db } from "@/db";
import {
  type RolloutRecipientState,
  segmentRuns,
  sentMessages,
  users,
  type VideoRolloutRecipient,
  videoRolloutRecipients,
  type VideoRolloutRow,
  videoRollouts,
  videos,
} from "@/db/schema";
import { cancelPendingAppointments } from "@/links/appointmentStore";
import { currentFunnelDay, insertGrant } from "@/links/service";
import { moveUserToVideo } from "@/videos/adminService";
import { rolloutAudienceOf, snapshotRolloutAudience } from "./audience";
import { openRolloutStatuses, rolloutFilterOf } from "./service";

export const ROLLOUT_PROMPT_KEY = "rolloutPrompt" satisfies BotMessageKey;

export type RestartOutcome = "restarted" | "skipped" | "stopped";

export type PriorPrompt = { state: "sent" | "blocked" | "failed"; sentMessageId: number | null } | null;

export async function dueRollout(now: Date): Promise<VideoRolloutRow | undefined> {
  const [row] = await db()
    .select()
    .from(videoRollouts)
    .where(
      or(
        eq(videoRollouts.status, "running"),
        and(eq(videoRollouts.status, "scheduled"), lte(videoRollouts.scheduledAt, now)),
      ),
    )
    .orderBy(asc(videoRollouts.id))
    .limit(1);
  return row;
}

export async function cancelIfVideoInactive(rollout: VideoRolloutRow, now: Date): Promise<boolean> {
  const [video] = await db().select({ isActive: videos.isActive }).from(videos).where(eq(videos.id, rollout.videoId));
  if (video?.isActive) return false;
  await db()
    .update(videoRollouts)
    .set({ status: "cancelled", finishedAt: now })
    .where(and(eq(videoRollouts.id, rollout.id), inArray(videoRollouts.status, [...openRolloutStatuses])));
  return true;
}

export async function startRollout(rollout: VideoRolloutRow, now: Date): Promise<VideoRolloutRow | undefined> {
  return db().transaction(async (tx) => {
    const [locked] = await tx.select().from(videoRollouts).where(eq(videoRollouts.id, rollout.id)).for("update");
    if (!locked || locked.status !== "scheduled") return locked?.status === "running" ? locked : undefined;
    await snapshotRolloutAudience(tx, locked.id, rolloutFilterOf(locked), locked.videoId, now);
    const [{ value }] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(videoRolloutRecipients)
      .where(eq(videoRolloutRecipients.rolloutId, locked.id));
    const [running] = await tx
      .update(videoRollouts)
      .set({ status: "running", targetCount: value })
      .where(eq(videoRollouts.id, locked.id))
      .returning();
    return running;
  });
}

export async function rolloutBatch(rolloutId: number, limit: number): Promise<VideoRolloutRecipient[]> {
  return db()
    .select()
    .from(videoRolloutRecipients)
    .where(
      and(
        eq(videoRolloutRecipients.rolloutId, rolloutId),
        inArray(videoRolloutRecipients.state, ["pending", "restarted"]),
      ),
    )
    .orderBy(sql`${videoRolloutRecipients.state} = 'pending'`, asc(videoRolloutRecipients.id))
    .limit(limit);
}

export async function cancelledStragglers(limit: number): Promise<VideoRolloutRecipient[]> {
  const rows = await db()
    .select({ recipient: videoRolloutRecipients })
    .from(videoRolloutRecipients)
    .innerJoin(videoRollouts, eq(videoRollouts.id, videoRolloutRecipients.rolloutId))
    .where(and(eq(videoRollouts.status, "cancelled"), eq(videoRolloutRecipients.state, "restarted")))
    .orderBy(asc(videoRolloutRecipients.id))
    .limit(limit);
  return rows.map((row) => row.recipient);
}

export function restartsChain(audience: RolloutAudience): boolean {
  return !messageOnlyAudiences.includes(audience);
}

export async function restartRecipient(
  rollout: VideoRolloutRow,
  recipient: VideoRolloutRecipient,
  now: Date,
  ttlHours: number,
): Promise<RestartOutcome> {
  return db().transaction(async (tx): Promise<RestartOutcome> => {
    const [current] = await tx
      .select({ status: videoRollouts.status })
      .from(videoRollouts)
      .where(eq(videoRollouts.id, rollout.id))
      .for("share");
    if (current?.status !== "running") return "stopped";
    const [video] = await tx.select().from(videos).where(eq(videos.id, rollout.videoId));
    if (!video?.isActive) return "stopped";

    await tx.select({ id: users.id }).from(users).where(eq(users.id, recipient.userId)).for("update");
    const [open] = await tx
      .select({ state: videoRolloutRecipients.state })
      .from(videoRolloutRecipients)
      .where(eq(videoRolloutRecipients.id, recipient.id))
      .for("update");
    if (open?.state !== "pending") return open?.state === "restarted" ? "restarted" : "skipped";

    const audience = await rolloutAudienceOf(tx, recipient.userId, rolloutFilterOf(rollout), rollout.videoId, now);
    if (audience === null) {
      await tx
        .update(videoRolloutRecipients)
        .set({ state: "skipped", updatedAt: now })
        .where(eq(videoRolloutRecipients.id, recipient.id));
      return "skipped";
    }

    const chain = restartsChain(audience);
    await moveUserToVideo(tx, recipient.userId, video);
    await cancelPendingAppointments(tx, recipient.userId, now);
    if (chain) {
      await tx
        .update(users)
        .set({ funnelEpoch: sql`${users.funnelEpoch} + 1` })
        .where(eq(users.id, recipient.userId));
      await tx
        .update(segmentRuns)
        .set({ endedAt: now, endReason: "rollout" })
        .where(and(eq(segmentRuns.userId, recipient.userId), isNull(segmentRuns.endedAt)));
    }
    const [holder] = await tx
      .select({ linkId: users.linkId, linkExpiresAt: users.linkExpiresAt })
      .from(users)
      .where(eq(users.id, recipient.userId));
    const grant = await insertGrant(tx, recipient.userId, {
      kind: "rollout",
      offerFirst: false,
      now,
      ttlHours,
      day: chain || !holder ? 1 : await currentFunnelDay(tx, holder, now),
      silent: !chain,
    });
    await tx
      .update(videoRolloutRecipients)
      .set({ state: "restarted", audience, linkId: grant.id, updatedAt: now })
      .where(eq(videoRolloutRecipients.id, recipient.id));
    return "restarted";
  });
}

export async function priorPrompt(recipient: VideoRolloutRecipient): Promise<PriorPrompt> {
  if (recipient.linkId === null) return null;
  const [row] = await db()
    .select({
      id: sentMessages.id,
      sentAt: sentMessages.sentAt,
      sendError: sentMessages.sendError,
      botBlocked: users.botBlocked,
    })
    .from(sentMessages)
    .innerJoin(users, eq(users.id, sentMessages.userId))
    .where(
      and(
        eq(sentMessages.userId, recipient.userId),
        eq(sentMessages.botTextKey, ROLLOUT_PROMPT_KEY),
        eq(sentMessages.linkId, recipient.linkId),
      ),
    )
    .orderBy(desc(sentMessages.id))
    .limit(1);
  if (!row) return null;
  if (row.sentAt) return { state: "sent", sentMessageId: row.id };
  return { state: row.botBlocked ? "blocked" : "failed", sentMessageId: null };
}

export async function promptRunId(userId: number): Promise<number | null> {
  const [run] = await db()
    .select({ id: segmentRuns.id })
    .from(segmentRuns)
    .where(eq(segmentRuns.userId, userId))
    .orderBy(sql`${segmentRuns.endedAt} is null desc`, desc(segmentRuns.id))
    .limit(1);
  return run?.id ?? null;
}

export async function settleRecipient(
  recipientId: number,
  state: Exclude<RolloutRecipientState, "pending" | "restarted">,
  sentMessageId: number | null,
  now: Date,
) {
  await db()
    .update(videoRolloutRecipients)
    .set({ state, sentMessageId, updatedAt: now })
    .where(and(eq(videoRolloutRecipients.id, recipientId), eq(videoRolloutRecipients.state, "restarted")));
}

export async function refreshRolloutProgress(rolloutId: number, now: Date) {
  const [counts] = await db()
    .select({
      sent: sql<number>`(count(*) filter (where ${videoRolloutRecipients.state} = 'sent'))::int`,
      blocked: sql<number>`(count(*) filter (where ${videoRolloutRecipients.state} = 'blocked'))::int`,
      skipped: sql<number>`(count(*) filter (where ${videoRolloutRecipients.state} = 'skipped'))::int`,
      failed: sql<number>`(count(*) filter (where ${videoRolloutRecipients.state} = 'failed'))::int`,
      open: sql<number>`(count(*) filter (where ${videoRolloutRecipients.state} in ('pending', 'restarted')))::int`,
    })
    .from(videoRolloutRecipients)
    .where(eq(videoRolloutRecipients.rolloutId, rolloutId));
  const totals = {
    sentCount: counts.sent,
    blockedCount: counts.blocked,
    skippedCount: counts.skipped,
    failedCount: counts.failed,
  };
  await db().update(videoRollouts).set(totals).where(eq(videoRollouts.id, rolloutId));
  if (counts.open === 0) {
    await db()
      .update(videoRollouts)
      .set({ status: "done", finishedAt: now })
      .where(and(eq(videoRollouts.id, rolloutId), eq(videoRollouts.status, "running")));
  }
}
