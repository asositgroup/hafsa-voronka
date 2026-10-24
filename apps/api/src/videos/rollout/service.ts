import { and, desc, eq, inArray } from "drizzle-orm";
import {
  type RolloutCreate,
  type RolloutFilter,
  type RolloutScheduleError,
  type VideoRollout,
  validateRolloutSchedule,
} from "@funnel/shared";
import { db } from "@/db";
import { type VideoRolloutRow, videoRollouts, videos } from "@/db/schema";
import { countRolloutAudience } from "./audience";

export const openRolloutStatuses = ["scheduled", "running"] as const;

export type RolloutFailure =
  | { ok: false; code: "not_found" }
  | { ok: false; code: "video_not_active" }
  | { ok: false; code: "rollout_in_progress" }
  | { ok: false; code: "rollout_finished" }
  | { ok: false; code: RolloutScheduleError };

export type RolloutResult = { ok: true; rollout: VideoRollout } | RolloutFailure;

export function rolloutResponse(row: VideoRolloutRow): VideoRollout {
  return {
    id: row.id,
    videoId: row.videoId,
    audiences: row.audiences,
    sinceDays: row.sinceDays,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    previewCount: row.previewCount,
    targetCount: row.targetCount,
    sentCount: row.sentCount,
    blockedCount: row.blockedCount,
    skippedCount: row.skippedCount,
    failedCount: row.failedCount,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export function rolloutFilterOf(row: Pick<VideoRolloutRow, "audiences" | "sinceDays">): RolloutFilter {
  return { audiences: row.audiences, sinceDays: row.sinceDays };
}

function postgresCode(error: unknown): string | undefined {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code ?? candidate?.cause?.code;
}

async function findVideo(id: number) {
  const [video] = await db().select().from(videos).where(eq(videos.id, id)).limit(1);
  return video;
}

export async function previewRollout(
  videoId: number,
  filter: RolloutFilter,
  now = new Date(),
): Promise<{ ok: true; count: number } | { ok: false; code: "not_found" }> {
  if (!(await findVideo(videoId))) return { ok: false, code: "not_found" };
  return { ok: true, count: await countRolloutAudience(db(), filter, videoId, now) };
}

export async function listRollouts(videoId: number): Promise<VideoRollout[] | null> {
  if (!(await findVideo(videoId))) return null;
  const rows = await db()
    .select()
    .from(videoRollouts)
    .where(eq(videoRollouts.videoId, videoId))
    .orderBy(desc(videoRollouts.createdAt), desc(videoRollouts.id));
  return rows.map(rolloutResponse);
}

export async function createRollout(videoId: number, input: RolloutCreate, now = new Date()): Promise<RolloutResult> {
  const video = await findVideo(videoId);
  if (!video) return { ok: false, code: "not_found" };
  if (!video.isActive) return { ok: false, code: "video_not_active" };

  const scheduledAt = input.scheduledAt === null ? null : new Date(input.scheduledAt);
  const scheduleError = validateRolloutSchedule(scheduledAt, now);
  if (scheduleError) return { ok: false, code: scheduleError };

  const filter: RolloutFilter = { audiences: input.audiences, sinceDays: input.sinceDays };
  try {
    const [row] = await db()
      .insert(videoRollouts)
      .values({
        videoId,
        audiences: [...filter.audiences],
        sinceDays: filter.sinceDays,
        scheduledAt: scheduledAt ?? now,
        previewCount: await countRolloutAudience(db(), filter, videoId, now),
        createdAt: now,
      })
      .returning();
    return { ok: true, rollout: rolloutResponse(row) };
  } catch (error) {
    if (postgresCode(error) === "23505") return { ok: false, code: "rollout_in_progress" };
    throw error;
  }
}

export async function cancelRollout(videoId: number, rolloutId: number, now = new Date()): Promise<RolloutResult> {
  const [row] = await db()
    .select()
    .from(videoRollouts)
    .where(and(eq(videoRollouts.id, rolloutId), eq(videoRollouts.videoId, videoId)))
    .limit(1);
  if (!row) return { ok: false, code: "not_found" };

  const [cancelled] = await db()
    .update(videoRollouts)
    .set({ status: "cancelled", finishedAt: now })
    .where(and(eq(videoRollouts.id, rolloutId), inArray(videoRollouts.status, [...openRolloutStatuses])))
    .returning();
  if (!cancelled) return { ok: false, code: "rollout_finished" };
  return { ok: true, rollout: rolloutResponse(cancelled) };
}
