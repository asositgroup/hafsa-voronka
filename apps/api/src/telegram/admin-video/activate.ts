import { eq } from "drizzle-orm";
import type { Api } from "grammy";
import { db } from "@/db";
import { botVideoDrafts } from "@/db/schema";
import { uz } from "@/i18n/uz";
import { activateVideo, createVideo } from "@/videos/adminService";

type Outcome =
  | { kind: "ignored" }
  | { kind: "waiting" }
  | { kind: "activated"; videoId: number }
  | { kind: "failed"; code: string };

const tashkentTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tashkent",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function draftTitle(caption: string | null, now = new Date()) {
  const trimmed = caption?.trim();
  if (trimmed) return trimmed;
  const parts = Object.fromEntries(tashkentTime.formatToParts(now).map((part) => [part.type, part.value]));
  return `Bot orqali — ${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

async function resolveActivation(draftId: number, allowDone: boolean): Promise<Outcome & { chatId?: number }> {
  return db().transaction(async (tx) => {
    const [draft] = await tx.select().from(botVideoDrafts).where(eq(botVideoDrafts.id, draftId)).for("update");
    if (!draft) return { kind: "ignored" };
    const chatId = draft.adminTelegramId;

    if (draft.step === "done" || draft.step === "cancelled") {
      if (!allowDone || draft.videoId === null) return { kind: "ignored", chatId };
      const result = await activateVideo(draft.videoId);
      return result.ok ? { kind: "activated", videoId: draft.videoId, chatId } : { kind: "failed", code: result.code, chatId };
    }

    if (draft.step !== "summary") return { kind: "ignored", chatId };

    if (draft.uploadStatus !== "done" || !draft.fileUrl) {
      await tx
        .update(botVideoDrafts)
        .set({ activateOnUpload: true, updatedAt: new Date() })
        .where(eq(botVideoDrafts.id, draftId));
      return { kind: "waiting", chatId };
    }

    let videoId = draft.videoId;
    if (videoId === null) {
      const created = await createVideo({
        title: draftTitle(draft.caption),
        fileUrl: draft.fileUrl,
        duration: draft.duration!,
        courseStartSec: draft.courseStartSec,
        priceSec: draft.priceSec,
      });
      if (!created.ok) return { kind: "failed", code: created.code, chatId };
      videoId = created.video.id;
    }

    const activated = await activateVideo(videoId);
    if (!activated.ok) {
      await tx
        .update(botVideoDrafts)
        .set({ videoId, updatedAt: new Date() })
        .where(eq(botVideoDrafts.id, draftId));
      return { kind: "failed", code: activated.code, chatId };
    }

    await tx
      .update(botVideoDrafts)
      .set({ videoId, step: "done", activateOnUpload: false, updatedAt: new Date() })
      .where(eq(botVideoDrafts.id, draftId));
    return { kind: "activated", videoId, chatId };
  });
}

export async function activateDraft(api: Api, draftId: number, allowDone = false) {
  const outcome = await resolveActivation(draftId, allowDone);
  if (outcome.chatId === undefined || outcome.kind === "ignored") return;

  const texts = uz.bot.adminVideo;
  const text =
    outcome.kind === "waiting"
      ? texts.activating
      : outcome.kind === "activated"
        ? texts.activated.replace("{id}", String(outcome.videoId))
        : texts.activationFailed.replace("{code}", outcome.code);
  await api.sendMessage(outcome.chatId, text);
}
