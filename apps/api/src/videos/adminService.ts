import { asc, count, desc, eq, sql } from "drizzle-orm";
import {
  type AdminVideoItem,
  type VideoMarkError,
  type videoUpdateSchema,
  validateVideoMarks,
} from "@funnel/shared";
import type { z } from "zod";
import { db } from "@/db";
import { users, type Video, videos } from "@/db/schema";
import { keyFromPublicUrl, r2 } from "@/storage/r2";

export type VideoInput = {
  title: string;
  fileUrl: string;
  duration: number;
  shortOfferVideoUrl?: string | null;
  shortOfferDuration?: number | null;
};
export type VideoPatch = z.infer<typeof videoUpdateSchema>;
export type VideoFailure =
  | { ok: false; code: "not_found" }
  | { ok: false; code: "archived" }
  | { ok: false; code: "video_active" }
  | { ok: false; code: "invalid_file_url" }
  | { ok: false; code: "activation_conflict" }
  | { ok: false; code: "price_required" }
  | { ok: false; code: VideoMarkError }
  | { ok: false; code: "video_in_use"; userCount: number };
export type VideoResult = { ok: true; video: Video } | VideoFailure;

function postgresCode(error: unknown): string | undefined {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code ?? candidate?.cause?.code;
}

async function findVideo(id: number): Promise<Video | undefined> {
  const [video] = await db().select().from(videos).where(eq(videos.id, id)).limit(1);
  return video;
}

async function countUsers(id: number): Promise<number> {
  const [row] = await db().select({ value: count() }).from(users).where(eq(users.videoId, id));
  return row?.value ?? 0;
}

function hasPublicUrl(url: string | null | undefined) {
  return url == null || keyFromPublicUrl(url) !== null;
}

export async function listAdminVideos(): Promise<AdminVideoItem[]> {
  const rows = await db()
    .select({ video: videos, userCount: count(users.id) })
    .from(videos)
    .leftJoin(users, eq(users.videoId, videos.id))
    .groupBy(videos.id)
    .orderBy(desc(videos.isActive), sql`${videos.archivedAt} asc nulls first`, desc(videos.createdAt), asc(videos.id));

  return rows.map(({ video, userCount }) => ({
    id: video.id,
    title: video.title,
    fileUrl: video.fileUrl,
    duration: video.duration,
    introEndSec: video.introEndSec,
    courseStartSec: video.courseStartSec,
    priceSec: video.priceSec,
    unlockSec: video.unlockSec,
    shortOfferVideoUrl: video.shortOfferVideoUrl,
    shortOfferDuration: video.shortOfferDuration,
    isActive: video.isActive,
    archivedAt: video.archivedAt?.toISOString() ?? null,
    createdAt: video.createdAt.toISOString(),
    userCount,
  }));
}

export async function createVideo(
  input: VideoInput & Partial<Pick<VideoPatch, "introEndSec" | "courseStartSec" | "priceSec" | "unlockSec">>,
): Promise<VideoResult> {
  if (keyFromPublicUrl(input.fileUrl) === null || !hasPublicUrl(input.shortOfferVideoUrl)) {
    return { ok: false, code: "invalid_file_url" };
  }

  const markError = validateVideoMarks(input, input.duration, { requirePrice: false });
  if (markError) return { ok: false, code: markError as VideoMarkError };

  const [video] = await db()
    .insert(videos)
    .values({
      title: input.title,
      fileUrl: input.fileUrl,
      duration: input.duration,
      introEndSec: input.introEndSec ?? null,
      courseStartSec: input.courseStartSec ?? null,
      priceSec: input.priceSec ?? null,
      unlockSec: input.unlockSec ?? null,
      shortOfferVideoUrl: input.shortOfferVideoUrl ?? null,
      shortOfferDuration: input.shortOfferVideoUrl ? (input.shortOfferDuration ?? null) : null,
      isActive: false,
    })
    .returning();
  return { ok: true, video };
}

export async function updateVideo(id: number, patch: VideoPatch): Promise<VideoResult> {
  const row = await findVideo(id);
  if (!row) return { ok: false, code: "not_found" };
  if (!hasPublicUrl(patch.shortOfferVideoUrl)) return { ok: false, code: "invalid_file_url" };

  const changes = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as VideoPatch;
  if (changes.shortOfferVideoUrl === null) changes.shortOfferDuration = null;
  const merged = { ...row, ...changes };
  const markError = validateVideoMarks(merged, row.duration, { requirePrice: row.isActive });
  if (markError) return { ok: false, code: markError };

  if (Object.keys(changes).length === 0) return { ok: true, video: row };

  const [video] = await db().update(videos).set(changes).where(eq(videos.id, id)).returning();
  if (row.shortOfferVideoUrl && row.shortOfferVideoUrl !== video.shortOfferVideoUrl) {
    await removeStoredFiles([row.shortOfferVideoUrl]);
  }
  return { ok: true, video };
}

export async function activateVideo(id: number): Promise<VideoResult> {
  try {
    return await db().transaction(async (tx): Promise<VideoResult> => {
      const [row] = await tx.select().from(videos).where(eq(videos.id, id)).for("update");
      if (!row) return { ok: false, code: "not_found" };
      if (row.archivedAt) return { ok: false, code: "archived" };
      if (row.isActive) return { ok: true, video: row };

      const markError = validateVideoMarks(row, row.duration, { requirePrice: true });
      if (markError) return { ok: false, code: markError };

      await tx.update(videos).set({ isActive: false }).where(eq(videos.isActive, true));
      const [video] = await tx.update(videos).set({ isActive: true }).where(eq(videos.id, id)).returning();
      return { ok: true, video };
    });
  } catch (error) {
    if (postgresCode(error) === "23505") return { ok: false, code: "activation_conflict" };
    throw error;
  }
}

export async function archiveVideo(id: number): Promise<VideoResult> {
  const row = await findVideo(id);
  if (!row) return { ok: false, code: "not_found" };
  if (row.isActive) return { ok: false, code: "video_active" };
  if (row.archivedAt) return { ok: true, video: row };

  const [video] = await db().update(videos).set({ archivedAt: new Date() }).where(eq(videos.id, id)).returning();
  return { ok: true, video };
}

export async function unarchiveVideo(id: number): Promise<VideoResult> {
  const row = await findVideo(id);
  if (!row) return { ok: false, code: "not_found" };

  const [video] = await db().update(videos).set({ archivedAt: null }).where(eq(videos.id, id)).returning();
  return { ok: true, video };
}

export async function deleteVideo(id: number): Promise<{ ok: true } | VideoFailure> {
  const row = await findVideo(id);
  if (!row) return { ok: false, code: "not_found" };
  if (row.isActive) return { ok: false, code: "video_active" };

  const userCount = await countUsers(id);
  if (userCount > 0) return { ok: false, code: "video_in_use", userCount };

  try {
    await db().delete(videos).where(eq(videos.id, id));
  } catch (error) {
    if (postgresCode(error) === "23503") {
      return { ok: false, code: "video_in_use", userCount: await countUsers(id) };
    }
    throw error;
  }

  await removeStoredFiles([row.fileUrl, row.shortOfferVideoUrl]);
  return { ok: true };
}

async function removeStoredFiles(urls: (string | null)[]) {
  const store = r2();
  if (!store) return;
  for (const url of urls) {
    const key = url ? keyFromPublicUrl(url) : null;
    if (!key) continue;
    await store.deleteObject(key).catch((error: unknown) => {
      console.error("Failed to delete stored video file", key, error);
    });
  }
}
