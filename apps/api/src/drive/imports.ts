import { and, eq } from "drizzle-orm";
import { type DriveImportError, VIDEO_MAX_BYTES } from "@funnel/shared";
import { db } from "@/db";
import { type VideoImport, videoImports } from "@/db/schema";
import { env } from "@/env";
import { newVideoKey, r2, UploadTooLargeError, uploadStream } from "@/storage/r2";
import { createVideo } from "@/videos/adminService";
import { DriveError, type DriveFileRef, downloadDriveFile, getDriveVideo, parseDriveLink } from "./client";

const PROGRESS_INTERVAL_MS = 2000;
const MAX_TITLE_LENGTH = 120;

export type StartImportFailure = DriveImportError | "uploads_not_configured" | "import_in_progress";
export type StartImportResult = { ok: true; item: VideoImport } | { ok: false; code: StartImportFailure };

const running = new Set<Promise<void>>();

export async function awaitDriveImports() {
  while (running.size > 0) await Promise.all([...running]);
}

export function driveConfig() {
  const serviceAccountEmail = env.GOOGLE_SA_EMAIL ?? null;
  return {
    enabled: Boolean(serviceAccountEmail && env.GOOGLE_SA_KEY && r2()),
    serviceAccountEmail,
  };
}

export async function getDriveImport(id: number): Promise<VideoImport | undefined> {
  const [row] = await db().select().from(videoImports).where(eq(videoImports.id, id)).limit(1);
  return row;
}

export async function failInterruptedImports() {
  await db()
    .update(videoImports)
    .set({ status: "failed", error: "interrupted", updatedAt: new Date() })
    .where(eq(videoImports.status, "running"));
}

function defaultTitle(name: string) {
  return name.replace(/\.mp4$/i, "").trim().slice(0, MAX_TITLE_LENGTH) || "Video";
}

function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return (candidate?.code ?? candidate?.cause?.code) === "23505";
}

function failureCode(error: unknown): DriveImportError {
  if (error instanceof DriveError) return error.code;
  if (error instanceof UploadTooLargeError) return "too_large";
  return "download_failed";
}

export async function startDriveImport(input: { url: string; title?: string }): Promise<StartImportResult> {
  if (!driveConfig().enabled) return { ok: false, code: "uploads_not_configured" };

  const ref = parseDriveLink(input.url);
  if (!ref) return { ok: false, code: "invalid_link" };

  let video: Awaited<ReturnType<typeof getDriveVideo>>;
  try {
    video = await getDriveVideo(ref);
  } catch (error) {
    return { ok: false, code: failureCode(error) };
  }

  let item: VideoImport;
  try {
    [item] = await db()
      .insert(videoImports)
      .values({
        driveFileId: video.fileId,
        title: input.title ?? defaultTitle(video.name),
        totalBytes: video.size,
        durationSec: video.durationSec,
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, code: "import_in_progress" };
    throw error;
  }

  const task = performImport(item, ref)
    .catch((error) => console.error("Drive import crashed:", error))
    .finally(() => {
      running.delete(task);
    });
  running.add(task);
  return { ok: true, item };
}

async function failImport(id: number, error: DriveImportError) {
  await db()
    .update(videoImports)
    .set({ status: "failed", error, updatedAt: new Date() })
    .where(eq(videoImports.id, id));
}

async function performImport(item: VideoImport, ref: DriveFileRef) {
  let lastTick = Date.now();
  try {
    const body = await downloadDriveFile(ref);
    const result = await uploadStream({
      key: newVideoKey("main"),
      body,
      contentType: "video/mp4",
      contentLength: item.totalBytes,
      maxBytes: VIDEO_MAX_BYTES,
      onProgress: (bytes) => {
        if (Date.now() - lastTick < PROGRESS_INTERVAL_MS) return;
        lastTick = Date.now();
        void db()
          .update(videoImports)
          .set({ bytesDone: bytes, updatedAt: new Date() })
          .where(and(eq(videoImports.id, item.id), eq(videoImports.status, "running")))
          .catch((error) => console.error("Drive import progress failed:", error));
      },
    });

    const created = await createVideo({ title: item.title, fileUrl: result.url, duration: item.durationSec });
    if (!created.ok) {
      await r2()?.deleteObject(result.key).catch(() => {});
      await failImport(item.id, "download_failed");
      return;
    }

    await db()
      .update(videoImports)
      .set({ status: "done", bytesDone: item.totalBytes, videoId: created.video.id, error: null, updatedAt: new Date() })
      .where(eq(videoImports.id, item.id));
  } catch (error) {
    console.error("Drive import failed:", error);
    await failImport(item.id, failureCode(error));
  }
}
