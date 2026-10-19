import { and, eq, isNull, sql } from "drizzle-orm";
import type { FunnelSegment, SegmentEndReason } from "@funnel/shared";
import { db } from "@/db";
import { segmentRuns, users, videos, watchProgress } from "@/db/schema";
import { segmentFor, statusFor } from "./status";

type Executor = Pick<ReturnType<typeof db>, "select">;

const noVideoMarks = { duration: 1, introEndSec: null, courseStartSec: null, priceSec: null };

async function snapshot(executor: Executor, userId: number) {
  const [row] = await executor
    .select({ user: users, progress: watchProgress, video: videos, open: segmentRuns })
    .from(users)
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .leftJoin(segmentRuns, and(eq(segmentRuns.userId, users.id), isNull(segmentRuns.endedAt)))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return undefined;

  const target: FunnelSegment | null = row.user.botBlocked
    ? null
    : segmentFor(statusFor(row.progress ?? undefined, row.video ?? noVideoMarks, row.user));
  const endReason: SegmentEndReason = target !== null ? "advanced" : row.user.botBlocked ? "bot_blocked" : "wrote_admin";
  return { target, endReason, open: row.open };
}

export async function syncSegment(userId: number, now = new Date()): Promise<void> {
  const optimistic = await snapshot(db(), userId);
  if (!optimistic || optimistic.target === (optimistic.open?.segment ?? null)) return;

  await db().transaction(async (tx) => {
    await tx.execute(sql`select id from ${users} where ${users.id} = ${userId} for update`);
    const current = await snapshot(tx, userId);
    if (!current || current.target === (current.open?.segment ?? null)) return;

    if (current.open) {
      await tx
        .update(segmentRuns)
        .set({ endedAt: now, endReason: current.endReason })
        .where(eq(segmentRuns.id, current.open.id));
    }
    if (current.target !== null) {
      await tx.insert(segmentRuns).values({ userId, segment: current.target, enteredAt: now });
    }
  });
}
