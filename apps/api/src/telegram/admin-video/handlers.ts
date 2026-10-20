import { and, eq, inArray, ne, not } from "drizzle-orm";
import { Composer, type Context, InlineKeyboard } from "grammy";
import { formatMmSs, type VideoMarkKey } from "@funnel/shared";
import { db } from "@/db";
import { type BotVideoDraft, botVideoDrafts } from "@/db/schema";
import { env } from "@/env";
import { uz } from "@/i18n/uz";
import { isAdminTelegramId } from "@/telegram/admins";
import { activateDraft } from "./activate";
import { findDraft, updateDraftAtStep } from "./drafts";
import { clearInput, pendingInputOf } from "./inputs";
import { handlePendingText, libraryComposer } from "./library";
import { checklistText, errorText, type MarkStatus, rangeErrorText, rangeHint } from "./checklist";
import {
  canGoBack,
  type DraftInput,
  isMarkStep,
  isOptionalStep,
  keepableValue,
  MARK_STEPS,
  type MarkStep,
  markStepFields,
  marksBefore,
  type ReplyKey,
  stepRange,
  TEXT_STEPS,
  type TransitionError,
  transition,
} from "./machine";
import { type VideoPayload, videoPayload } from "./payload";
import { receiveShortVideo } from "./shortVideo";
import { runUpload } from "./upload";

const MB = 1024 * 1024;
const MAX_FILE_BYTES = 2000 * MB;
const CLOUD_API_FILE_BYTES = 20 * MB;

const texts = uz.bot.adminVideo;

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

function stepOfMark(key: VideoMarkKey): MarkStep {
  return MARK_STEPS.find((step) => markStepFields[step] === key)!;
}

function statusAt(step: BotVideoDraft["step"]) {
  const current = isMarkStep(step) ? MARK_STEPS.indexOf(step) : step === "summary" ? MARK_STEPS.length : -1;
  return (key: VideoMarkKey): MarkStatus => {
    const index = MARK_STEPS.indexOf(stepOfMark(key));
    return index < current ? "done" : index === current ? "current" : "pending";
  };
}

function draftChecklist(draft: BotVideoDraft) {
  const duration = draft.step === "duration" ? null : draft.duration;
  return checklistText(duration, draft, statusAt(draft.step));
}

function summaryText(draft: BotVideoDraft) {
  return texts.summary
    .replace("{checklist}", draftChecklist(draft))
    .replace("{upload}", texts.uploadState[draft.uploadStatus]);
}

function summaryKeyboard(id: number) {
  return activateKeyboard(id).row().text(texts.back, `vup:back:${id}`);
}

type Reply = { text: string; keyboard?: InlineKeyboard };

const questionTexts = {
  intro: texts.askIntro,
  course: texts.askCourse,
  price: texts.askPrice,
  unlock: texts.askUnlock,
} as const satisfies Record<MarkStep, string>;

function markQuestion(draft: BotVideoDraft, step: MarkStep): Reply {
  const field = markStepFields[step];
  const hint = rangeHint(field, stepRange(draft, step), marksBefore(draft, step), draft.duration ?? 0, "back");
  const keyboard = new InlineKeyboard();
  const kept = keepableValue(draft, step);
  if (kept !== null) keyboard.text(texts.keep.replace("{value}", formatMmSs(kept)), `vup:keep:${draft.id}`).row();
  if (isOptionalStep(step)) keyboard.text(texts.skip, `vup:skip:${draft.id}`).row();
  if (canGoBack(step)) keyboard.text(texts.back, `vup:back:${draft.id}`);
  return { text: `${draftChecklist(draft)}\n\n${questionTexts[step]}\n${hint}`, keyboard };
}

function questionFor(draft: BotVideoDraft): Reply {
  if (isMarkStep(draft.step)) return markQuestion(draft, draft.step);
  return { text: `${draftChecklist(draft)}\n\n${texts.askDuration}` };
}

function replyFor(key: ReplyKey, draft: BotVideoDraft): Reply | null {
  switch (key) {
    case "askDuration":
    case "askIntro":
    case "askCourse":
    case "askPrice":
    case "askUnlock":
      return questionFor(draft);
    case "summary":
      return { text: summaryText(draft), keyboard: summaryKeyboard(draft.id) };
    case "cancelled":
      return { text: texts.cancelled };
    case "activating":
      return null;
  }
}

function errorMessage(draft: BotVideoDraft, error: Exclude<TransitionError, { error: "wrongStep" }>) {
  if (error.error !== "outOfRange") return texts.errors[error.error];
  if (!isMarkStep(draft.step)) return null;
  const step = draft.step;
  const range = stepRange(draft, step);
  return rangeErrorText(markStepFields[step], error.value, range, marksBefore(draft, step), draft.duration ?? 0);
}

async function replyError(ctx: Context, draft: BotVideoDraft, error: TransitionError) {
  if (error.error === "wrongStep") return;
  const question = questionFor(draft);
  const message = errorMessage(draft, error);
  const text = message ? `${errorText(message)}\n\n${question.text}` : question.text;
  await ctx.reply(text, { reply_markup: question.keyboard });
}

async function sendReply(ctx: Context, key: ReplyKey, draft: BotVideoDraft, hint?: string) {
  const reply = replyFor(key, draft);
  if (reply) await ctx.reply(hint ? `${hint}\n\n${reply.text}` : reply.text, { reply_markup: reply.keyboard });
}

async function openDraftOf(adminTelegramId: number) {
  const [draft] = await db()
    .select()
    .from(botVideoDrafts)
    .where(and(eq(botVideoDrafts.adminTelegramId, adminTelegramId), not(inArray(botVideoDrafts.step, ["done", "cancelled"]))))
    .limit(1);
  return draft;
}

async function applyInput(ctx: Context, draft: BotVideoDraft, input: DraftInput): Promise<BotVideoDraft | TransitionError> {
  const result = transition(draft, input);
  if ("error" in result) return result;

  const { uploadStatus, ...rest } = result.patch;
  const keepsUpload = draft.uploadStatus === "uploading" || draft.uploadStatus === "done";
  const updated = await updateDraftAtStep(draft.id, draft.step, {
    ...rest,
    ...(uploadStatus && !keepsUpload ? { uploadStatus } : {}),
  });
  if (!updated) return { error: "wrongStep" };

  const hint = input.type === "confirm" && input.yes && updated.sentAsVideo ? texts.sendAsFileHint : undefined;
  await sendReply(ctx, result.reply, updated, hint);
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
      sentAsVideo: payload.sentAsVideo,
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
          introEndSec: null,
          unlockSec: null,
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
    await ctx.reply(summaryText(open), { reply_markup: summaryKeyboard(open.id) });
  } else {
    const question = questionFor(open);
    await ctx.reply(question.text, { reply_markup: question.keyboard });
  }
}

export const adminVideoComposer = new Composer<Context>();

const admin = adminVideoComposer.filter((ctx) => isAdminTelegramId(ctx.from?.id));

admin.use(libraryComposer);

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

  const input = await pendingInputOf(ctx.from.id);
  if (input?.kind === "shortVideo") {
    await receiveShortVideo(ctx, input, payload);
    return;
  }

  await saveDraft(ctx, ctx.from.id, payload, message.caption?.trim() || null);
}

admin.on("message:video", handleVideoMessage);
admin.on("message:document", handleVideoMessage);

admin.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  const input = await pendingInputOf(ctx.from.id);

  if (text === "/bekor" && input) {
    await clearInput(ctx.from.id);
    await ctx.reply(texts.cancelled);
    return;
  }
  if (input && !text.startsWith("/")) {
    await handlePendingText(ctx, input, text);
    return;
  }

  const draft = await openDraftOf(ctx.from.id);
  if (!draft) return next();

  if (text === "/bekor") {
    await applyInput(ctx, draft, { type: "cancel" });
    return;
  }
  if (text.startsWith("/") || !TEXT_STEPS.some((step) => step === draft.step)) return next();

  const outcome = await applyInput(ctx, draft, { type: "text", value: text });
  if ("error" in outcome) await replyError(ctx, draft, outcome);
});

admin.callbackQuery(/^vup:(yes|no|act|retry|skip|keep|back):(\d+)$/, async (ctx) => {
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
    action === "act"
      ? { type: "activate" }
      : action === "skip" || action === "keep" || action === "back"
        ? { type: action }
        : { type: "confirm", yes: action === "yes" };
  await ctx.answerCallbackQuery();
  const outcome = await applyInput(ctx, draft, input);
  if ("error" in outcome) {
    await replyError(ctx, draft, outcome);
    return;
  }
  await ctx.editMessageReplyMarkup().catch(() => {});
});
