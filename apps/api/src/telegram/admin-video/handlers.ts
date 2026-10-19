import { and, eq, inArray, ne, not } from "drizzle-orm";
import { Composer, type Context, InlineKeyboard } from "grammy";
import type { Message } from "grammy/types";
import { formatMmSs } from "@funnel/shared";
import { db } from "@/db";
import { type BotVideoDraft, botVideoDrafts } from "@/db/schema";
import { env } from "@/env";
import { uz } from "@/i18n/uz";
import { isAdminTelegramId } from "@/telegram/admins";
import { activateDraft } from "./activate";
import { findDraft, updateDraftAtStep } from "./drafts";
import { type DraftInput, type ErrorKey, type ReplyKey, transition } from "./machine";
import { runUpload } from "./upload";

const MB = 1024 * 1024;
const MAX_FILE_BYTES = 2000 * MB;
const CLOUD_API_FILE_BYTES = 20 * MB;
const TEXT_STEPS = ["duration", "course", "price"] as const;

const texts = uz.bot.adminVideo;

type VideoPayload = {
  fileId: string;
  fileUniqueId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
};

function videoPayload(message: Message): VideoPayload | null {
  if (message.video) {
    const video = message.video;
    return {
      fileId: video.file_id,
      fileUniqueId: video.file_unique_id,
      fileName: video.file_name ?? null,
      mimeType: video.mime_type ?? null,
      fileSize: video.file_size ?? null,
      duration: video.duration > 0 ? video.duration : null,
    };
  }
  const document = message.document;
  if (document?.mime_type?.startsWith("video/")) {
    return {
      fileId: document.file_id,
      fileUniqueId: document.file_unique_id,
      fileName: document.file_name ?? null,
      mimeType: document.mime_type,
      fileSize: document.file_size ?? null,
      duration: null,
    };
  }
  return null;
}

function confirmKeyboard(id: number) {
  return new InlineKeyboard().text(texts.yes, `vup:yes:${id}`).text(texts.no, `vup:no:${id}`);
}

function activateKeyboard(id: number) {
  return new InlineKeyboard().text(texts.activate, `vup:act:${id}`);
}

function confirmText(draft: BotVideoDraft) {
  return texts.confirm
    .replace("{name}", draft.fileName ?? draft.caption ?? "video")
    .replace("{size}", draft.fileSize ? (draft.fileSize / MB).toFixed(1) : "?")
    .replace("{duration}", draft.duration ? formatMmSs(draft.duration) : texts.durationUnknown);
}

function summaryText(draft: BotVideoDraft) {
  return texts.summary
    .replace("{duration}", formatMmSs(draft.duration ?? 0))
    .replace("{course}", formatMmSs(draft.courseStartSec ?? 0))
    .replace("{price}", formatMmSs(draft.priceSec ?? 0))
    .replace("{upload}", texts.uploadState[draft.uploadStatus]);
}

function replyFor(key: ReplyKey, draft: BotVideoDraft): { text: string; keyboard?: InlineKeyboard } | null {
  switch (key) {
    case "askDuration":
      return { text: texts.askDuration };
    case "askCourse":
      return { text: texts.askCourse };
    case "askPrice":
      return { text: texts.askPrice };
    case "summary":
      return { text: summaryText(draft), keyboard: activateKeyboard(draft.id) };
    case "cancelled":
      return { text: texts.cancelled };
    case "activating":
      return null;
  }
}

function questionFor(draft: BotVideoDraft) {
  if (draft.step === "duration") return texts.askDuration;
  if (draft.step === "course") return texts.askCourse;
  return texts.askPrice;
}

async function sendReply(ctx: Context, key: ReplyKey, draft: BotVideoDraft) {
  const reply = replyFor(key, draft);
  if (reply) await ctx.reply(reply.text, { reply_markup: reply.keyboard });
}

async function openDraftOf(adminTelegramId: number) {
  const [draft] = await db()
    .select()
    .from(botVideoDrafts)
    .where(and(eq(botVideoDrafts.adminTelegramId, adminTelegramId), not(inArray(botVideoDrafts.step, ["done", "cancelled"]))))
    .limit(1);
  return draft;
}

async function applyInput(ctx: Context, draft: BotVideoDraft, input: DraftInput): Promise<BotVideoDraft | ErrorKey> {
  const result = transition(draft, input);
  if ("error" in result) return result.error;

  const { uploadStatus, ...rest } = result.patch;
  const keepsUpload = draft.uploadStatus === "uploading" || draft.uploadStatus === "done";
  const updated = await updateDraftAtStep(draft.id, draft.step, {
    ...rest,
    ...(uploadStatus && !keepsUpload ? { uploadStatus } : {}),
  });
  if (!updated) return "wrongStep";

  await sendReply(ctx, result.reply, updated);
  if (result.effects.includes("startUpload")) void runUpload(ctx.api, updated.id);
  if (result.effects.includes("activate")) await activateDraft(ctx.api, updated.id);
  return updated;
}

async function saveDraft(ctx: Context, adminTelegramId: number, payload: VideoPayload, caption: string | null) {
  const existing = await db()
    .select()
    .from(botVideoDrafts)
    .where(eq(botVideoDrafts.fileUniqueId, payload.fileUniqueId))
    .limit(1);
  if (existing[0]?.videoId != null) {
    await ctx.reply(texts.alreadyAdded.replace("{id}", String(existing[0].videoId)), {
      reply_markup: activateKeyboard(existing[0].id),
    });
    return;
  }

  const fresh = await db().transaction(async (tx) => {
    await tx
      .update(botVideoDrafts)
      .set({ step: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(botVideoDrafts.adminTelegramId, adminTelegramId),
          not(inArray(botVideoDrafts.step, ["done", "cancelled"])),
          ne(botVideoDrafts.fileUniqueId, payload.fileUniqueId),
        ),
      );
    const values = {
      adminTelegramId,
      fileId: payload.fileId,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      fileSize: payload.fileSize,
      caption,
      duration: payload.duration,
    };
    const [row] = await tx
      .insert(botVideoDrafts)
      .values({ ...values, fileUniqueId: payload.fileUniqueId })
      .onConflictDoUpdate({
        target: botVideoDrafts.fileUniqueId,
        set: {
          ...values,
          step: "confirm",
          courseStartSec: null,
          priceSec: null,
          activateOnUpload: false,
          videoId: null,
          updatedAt: new Date(),
        },
        setWhere: inArray(botVideoDrafts.step, ["done", "cancelled"]),
      })
      .returning();
    return row;
  });

  if (fresh) {
    await ctx.reply(confirmText(fresh), { reply_markup: confirmKeyboard(fresh.id) });
    return;
  }

  const open = existing[0] ?? (await openDraftOf(adminTelegramId));
  if (!open) return;
  if (open.step === "confirm") {
    await ctx.reply(confirmText(open), { reply_markup: confirmKeyboard(open.id) });
  } else if (open.step === "summary") {
    await ctx.reply(summaryText(open), { reply_markup: activateKeyboard(open.id) });
  } else {
    await ctx.reply(questionFor(open));
  }
}

export const adminVideoComposer = new Composer<Context>();

const admin = adminVideoComposer.filter((ctx) => isAdminTelegramId(ctx.from?.id));

async function handleVideoMessage(ctx: Context, next: () => Promise<void>) {
  const message = ctx.message;
  const payload = message && videoPayload(message);
  if (!message || !payload || !ctx.from) return next();

  if (payload.fileSize !== null && payload.fileSize > MAX_FILE_BYTES) {
    await ctx.reply(texts.tooLarge);
    return;
  }
  if (payload.fileSize !== null && payload.fileSize > CLOUD_API_FILE_BYTES && !env.BOT_API_ROOT) {
    await ctx.reply(texts.needLocalApi);
    return;
  }

  await saveDraft(ctx, ctx.from.id, payload, message.caption?.trim() || null);
}

admin.on("message:video", handleVideoMessage);
admin.on("message:document", handleVideoMessage);

admin.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  const draft = await openDraftOf(ctx.from.id);
  if (!draft) return next();

  if (text === "/bekor") {
    await applyInput(ctx, draft, { type: "cancel" });
    return;
  }
  if (text.startsWith("/") || !TEXT_STEPS.some((step) => step === draft.step)) return next();

  const outcome = await applyInput(ctx, draft, { type: "text", value: text });
  if (typeof outcome === "string" && outcome !== "wrongStep") {
    await ctx.reply(`${texts.errors[outcome]}\n\n${questionFor(draft)}`);
  }
});

admin.callbackQuery(/^vup:(yes|no|act|retry):(\d+)$/, async (ctx) => {
  const [, action, rawId] = ctx.match;
  const draft = await findDraft(Number(rawId));
  if (!draft || draft.adminTelegramId !== ctx.from.id) {
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "retry") {
    await ctx.answerCallbackQuery();
    if (draft.uploadStatus === "failed" && draft.step !== "cancelled" && draft.step !== "done") {
      void runUpload(ctx.api, draft.id);
    }
    return;
  }

  if (action === "act" && draft.videoId !== null && (draft.step === "done" || draft.step === "cancelled")) {
    await ctx.answerCallbackQuery();
    await activateDraft(ctx.api, draft.id, true);
    return;
  }

  const input: DraftInput =
    action === "act" ? { type: "activate" } : { type: "confirm", yes: action === "yes" };
  await ctx.answerCallbackQuery();
  const outcome = await applyInput(ctx, draft, input);
  if (typeof outcome !== "string") await ctx.editMessageReplyMarkup().catch(() => {});
});
