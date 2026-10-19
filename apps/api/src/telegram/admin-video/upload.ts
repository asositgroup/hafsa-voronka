import { extname } from "node:path";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { type Api, InlineKeyboard } from "grammy";
import { db } from "@/db";
import { type BotVideoDraft, botVideoDrafts } from "@/db/schema";
import { uz } from "@/i18n/uz";
import { uploadStream } from "@/storage/r2";
import { openTelegramFile, removeLocalTelegramFile } from "@/telegram/files";
import { activateDraft } from "./activate";

const PROGRESS_INTERVAL_MS = 5000;
const STALE_CLAIM_MINUTES = 10;

const running = new Set<Promise<void>>();

export async function awaitUploads() {
  while (running.size > 0) await Promise.all([...running]);
}

function objectKey(draft: BotVideoDraft) {
  const fromName = extname(draft.fileName ?? "").slice(1).toLowerCase();
  const fromMime = draft.mimeType?.split("/")[1]?.toLowerCase();
  const extension = [fromName, fromMime, "mp4"].find((value) => value && /^[a-z0-9]{2,5}$/.test(value));
  return `videos/bot/${draft.fileUniqueId}.${extension}`;
}

async function claimDraft(draftId: number): Promise<BotVideoDraft | undefined> {
  const [draft] = await db()
    .update(botVideoDrafts)
    .set({ uploadStatus: "uploading", uploadClaimedAt: new Date(), uploadError: null, updatedAt: new Date() })
    .where(
      and(
        eq(botVideoDrafts.id, draftId),
        or(
          inArray(botVideoDrafts.uploadStatus, ["idle", "pending", "failed"]),
          and(
            eq(botVideoDrafts.uploadStatus, "uploading"),
            lt(botVideoDrafts.uploadClaimedAt, sql`now() - make_interval(mins => ${STALE_CLAIM_MINUTES})`),
          ),
        ),
      ),
    )
    .returning();
  return draft;
}

async function performUpload(api: Api, draftId: number) {
  const draft = await claimDraft(draftId);
  if (!draft) return;

  const chatId = draft.adminTelegramId;
  const texts = uz.bot.adminVideo;
  const progressText = (percent: number) => texts.progress.replace("{percent}", String(percent));
  let localPath: string | undefined;
  let activateAfterUpload = false;

  try {
    const progressMessage = await api.sendMessage(chatId, progressText(0));
    await db()
      .update(botVideoDrafts)
      .set({ progressMessageId: progressMessage.message_id })
      .where(eq(botVideoDrafts.id, draftId));

    const file = await openTelegramFile(api, draft.fileId);
    localPath = file.localPath;
    const totalBytes = draft.fileSize ?? file.size;

    let lastTick = Date.now();
    let lastPercent = 0;
    const result = await uploadStream({
      key: objectKey(draft),
      body: file.stream,
      contentType: draft.mimeType ?? "video/mp4",
      contentLength: totalBytes ?? undefined,
      onProgress: (bytes) => {
        if (Date.now() - lastTick < PROGRESS_INTERVAL_MS) return;
        lastTick = Date.now();
        void db()
          .update(botVideoDrafts)
          .set({ uploadClaimedAt: new Date() })
          .where(eq(botVideoDrafts.id, draftId))
          .catch((error) => console.error("Upload claim refresh failed:", error));
        const percent = totalBytes ? Math.min(99, Math.floor((bytes / totalBytes) * 100)) : 0;
        if (percent === lastPercent) return;
        lastPercent = percent;
        void api
          .editMessageText(chatId, progressMessage.message_id, progressText(percent))
          .catch(() => {});
      },
    });

    const [done] = await db()
      .update(botVideoDrafts)
      .set({ uploadStatus: "done", fileUrl: result.url, r2Key: result.key, uploadError: null, updatedAt: new Date() })
      .where(eq(botVideoDrafts.id, draftId))
      .returning();
    await removeLocalTelegramFile(localPath);
    await api.editMessageText(chatId, progressMessage.message_id, texts.uploadDone).catch(() => {});

    activateAfterUpload = done.activateOnUpload;
  } catch (error) {
    console.error("Bot video upload failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    await db()
      .update(botVideoDrafts)
      .set({ uploadStatus: "failed", uploadError: message, updatedAt: new Date() })
      .where(eq(botVideoDrafts.id, draftId));
    await api
      .sendMessage(chatId, texts.uploadFailed.replace("{error}", message), {
        reply_markup: new InlineKeyboard().text(texts.retry, `vup:retry:${draftId}`),
      })
      .catch((sendError) => console.error("Upload failure notice failed:", sendError));
    return;
  }

  if (activateAfterUpload) await activateDraft(api, draftId);
}

export function runUpload(api: Api, draftId: number) {
  const task = performUpload(api, draftId)
    .catch((error) => console.error("Bot video upload crashed:", error))
    .finally(() => {
      running.delete(task);
    });
  running.add(task);
  return task;
}

export async function resumeBotUploads(api: Api) {
  const resumable = await db()
    .update(botVideoDrafts)
    .set({ uploadStatus: "pending", uploadClaimedAt: null })
    .where(
      and(
        inArray(botVideoDrafts.uploadStatus, ["pending", "uploading"]),
        inArray(botVideoDrafts.step, ["duration", "course", "price", "summary"]),
      ),
    )
    .returning({ id: botVideoDrafts.id });
  for (const { id } of resumable) void runUpload(api, id);
}
