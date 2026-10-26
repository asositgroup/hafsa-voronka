import { and, eq, isNull, sql } from "drizzle-orm";
import { type FunnelSegment, linkBoundSegments } from "@funnel/shared";
import { db } from "@/db";
import { linkGrants, segmentRuns, users, videos, watchProgress } from "@/db/schema";
import { cancelPendingAppointments } from "@/links/appointmentStore";
import { endReasonFor, NO_VIDEO_MARKS, segmentFor, statusFor } from "./status";

type Executor = Pick<ReturnType<typeof db>, "select">;

async function snapshot(executor: Executor, userId: number) {
  const [row] = await executor
    .select({
      user: users,
      progress: watchProgress,
      video: videos,
      open: segmentRuns,
      attempt: linkGrants.attempt,
    })
    .from(users)
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .leftJoin(segmentRuns, and(eq(segmentRuns.userId, users.id), isNull(segmentRuns.endedAt)))
    .leftJoin(linkGrants, eq(linkGrants.id, users.linkId))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return undefined;

  const status = statusFor(row.progress ?? undefined, row.video ?? NO_VIDEO_MARKS, row.user);
  const target: FunnelSegment | null = row.user.botBlocked ? null : segmentFor(status);
  const attempt = row.attempt ?? 1;
  const unchanged =
    target === (row.open?.segment ?? null) &&
    (target === null || !linkBoundSegments.includes(target) || row.open?.attempt === attempt);
  return {
    target,
    attempt,
    unchanged,
    open: row.open,
    endReason: (open: FunnelSegment) =>
      endReasonFor(open, target, { botBlocked: row.user.botBlocked, wroteAdmin: row.user.wroteAdminAt !== null }),
  };
}

export async function syncSegment(userId: number, now = new Date()): Promise<void> {
  const optimistic = await snapshot(db(), userId);
  if (!optimistic || optimistic.unchanged) return;

  await db().transaction(async (tx) => {
    await tx.execute(sql`select id from ${users} where ${users.id} = ${userId} for update`);
    const current = await snapshot(tx, userId);
    if (!current || current.unchanged) return;

    if (current.open) {
      await tx
        .update(segmentRuns)
        .set({ endedAt: now, endReason: current.endReason(current.open.segment) })
        .where(eq(segmentRuns.id, current.open.id));
    }
    if (current.target === null) await cancelPendingAppointments(tx, userId, now);
    if (current.target !== null) {
      await tx.insert(segmentRuns).values({ userId, segment: current.target, enteredAt: now, attempt: current.attempt });
    }
  });
}
