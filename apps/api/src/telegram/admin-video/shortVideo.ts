import type { Api, Context } from "grammy";
import type { BotAdminInput } from "@/db/schema";
import { uz } from "@/i18n/uz";
import { updateVideo } from "@/videos/adminService";
import {
  claimFinishedShort,
  completeShortUpload,
  discardUnusedFile,
  failShortUpload,
  isShortMidUpload,
  resetInterruptedShortUploads,
  setShortFile,
} from "./inputs";
import type { VideoPayload } from "./payload";
import { botObjectKey, streamTelegramFileToR2, trackUpload } from "./upload";
import { cancelKeyboard, failureText, sendCard } from "./views";

const texts = uz.bot.videoLibrary;

export async function finishShortVideo(api: Api, adminTelegramId: number) {
  const input = await claimFinishedShort(adminTelegramId);
  if (!input) return;

  const result = await updateVideo(input.videoId, {
    shortOfferVideoUrl: input.shortFileUrl,
    shortOfferDuration: input.shortDuration,
  });
  if (!result.ok) {
    await discardUnusedFile(input.shortFileUrl);
    await api.sendMessage(adminTelegramId, failureText(result));
    return;
  }
  await sendCard(api, adminTelegramId, input.videoId, texts.done.shortSaved);
}

async function uploadShortVideo(api: Api, adminTelegramId: number, videoId: number, payload: VideoPayload) {
  let fileUrl: string;
  try {
    const key = botObjectKey(payload, `-offer-${videoId}`);
    fileUrl = (await streamTelegramFileToR2(api, adminTelegramId, { ...payload, key })).url;
  } catch (error) {
    console.error("Bot short video upload failed:", error);
    const failed = await failShortUpload(adminTelegramId, payload.fileUniqueId);
    if (!failed) return;
    const message = error instanceof Error ? error.message : String(error);
    await api
      .sendMessage(adminTelegramId, texts.shortUploadFailed, {
        reply_markup: cancelKeyboard(videoId),
      })
      .catch((sendError) => console.error("Short upload failure notice failed:", sendError));
    return;
  }

  const stored = await completeShortUpload(adminTelegramId, payload.fileUniqueId, fileUrl);
  if (!stored) {
    await discardUnusedFile(fileUrl);
    return;
  }
  await finishShortVideo(api, adminTelegramId);
}

export async function receiveShortVideo(ctx: Context, input: BotAdminInput, payload: VideoPayload) {
  if (isShortMidUpload(input) && input.shortFileUniqueId === payload.fileUniqueId) {
    await ctx.reply(texts.shortUploading);
    return;
  }

  const updated = await setShortFile(input.adminTelegramId, payload.fileUniqueId, payload.duration);
  if (!updated) return;
  if (payload.duration === null) {
    await ctx.reply(texts.askShortDuration, { reply_markup: cancelKeyboard(input.videoId) });
  }
  void trackUpload(uploadShortVideo(ctx.api, input.adminTelegramId, input.videoId, payload), "Bot short video upload");
}

export async function resumeShortUploads(api: Api) {
  const interrupted = await resetInterruptedShortUploads();
  for (const { adminTelegramId } of interrupted) {
    await api
      .sendMessage(adminTelegramId, texts.shortInterrupted)
      .catch((error) => console.error("Short upload interruption notice failed:", error));
  }
}
