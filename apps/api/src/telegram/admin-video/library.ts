import { isInMarkRange, parseMmSs } from "@funnel/shared";
import { type CallbackQueryContext, Composer, type Context } from "grammy";
import { type BotAdminInput, type VideoMarkField, videoMarkFields } from "@/db/schema";
import { uz } from "@/i18n/uz";
import {
  activateVideo,
  archiveVideo,
  deleteVideo,
  findAdminVideo,
  unarchiveVideo,
  updateVideo,
  type VideoFailure,
  type VideoResult,
} from "@/videos/adminService";
import { rangeErrorText } from "./checklist";
import { clearIdleInput, clearInput, isShortMidUpload, pendingInputOf, setShortDuration, startInput } from "./inputs";
import { finishShortVideo } from "./shortVideo";
import {
  cancelKeyboard,
  cardView,
  deleteConfirmView,
  failureText,
  listView,
  markPromptView,
  markRangeOf,
  marksView,
  OPTIONAL_MARKS,
  otherMarksOf,
  sendCard,
  type View,
} from "./views";

const texts = uz.bot.videoLibrary;
const errors = uz.bot.adminVideo.errors;

type Callback = CallbackQueryContext<Context>;

function isMarkField(value: string | undefined): value is VideoMarkField {
  return videoMarkFields.some((field) => field === value);
}

async function show(ctx: Callback, view: View) {
  await ctx.editMessageText(view.text, { reply_markup: view.keyboard }).catch(() => {});
}

async function showCard(ctx: Callback, videoId: number, notice?: string) {
  const item = await findAdminVideo(videoId);
  await show(ctx, item ? cardView(item, notice) : await listView(0, texts.failures.not_found));
}

async function alert(ctx: Callback, failure: VideoFailure) {
  await ctx.answerCallbackQuery({ text: failureText(failure), show_alert: true });
}

async function runAction(ctx: Callback, videoId: number, action: Promise<VideoResult>, done: string) {
  const result = await action;
  if (!result.ok) {
    await alert(ctx, result);
    await showCard(ctx, videoId);
    return;
  }
  await ctx.answerCallbackQuery({ text: done });
  await showCard(ctx, videoId);
}

export const libraryComposer = new Composer<Context>();

export async function replyVideoList(ctx: Context) {
  if (!ctx.from) return;
  await clearIdleInput(ctx.from.id);
  const view = await listView(0);
  await ctx.reply(view.text, { reply_markup: view.keyboard });
}

libraryComposer.command("videolar", (ctx) => replyVideoList(ctx));

libraryComposer.callbackQuery(/^vl:([a-z]+):(\d+)(?::(\w+))?$/, async (ctx) => {
  const [, action, rawId, extra] = ctx.match;
  const id = Number(rawId);
  const adminTelegramId = ctx.from.id;

  switch (action) {
    case "list":
      await ctx.answerCallbackQuery();
      await show(ctx, await listView(id));
      return;
    case "show":
      await ctx.answerCallbackQuery();
      await showCard(ctx, id);
      return;
    case "act":
      await runAction(ctx, id, activateVideo(id), texts.done.activated);
      return;
    case "arch":
      await runAction(ctx, id, archiveVideo(id), texts.done.archived);
      return;
    case "unarch":
      await runAction(ctx, id, unarchiveVideo(id), texts.done.unarchived);
      return;
    case "shortdel":
      await runAction(ctx, id, updateVideo(id, { shortOfferVideoUrl: null }), texts.done.shortRemoved);
      return;
    case "delyes": {
      const result = await deleteVideo(id);
      if (!result.ok) {
        await alert(ctx, result);
        await showCard(ctx, id);
        return;
      }
      await ctx.answerCallbackQuery({ text: texts.done.deleted });
      await show(ctx, await listView(0, texts.done.deleted));
      return;
    }
    case "cancel":
      await clearInput(adminTelegramId);
      await ctx.answerCallbackQuery({ text: uz.bot.adminVideo.cancelled });
      await showCard(ctx, id);
      return;
  }

  const item = await findAdminVideo(id);
  if (!item) {
    await ctx.answerCallbackQuery({ text: texts.failures.not_found, show_alert: true });
    await show(ctx, await listView(0));
    return;
  }

  switch (action) {
    case "del":
      await ctx.answerCallbackQuery();
      await show(ctx, deleteConfirmView(item));
      return;
    case "marks":
      await ctx.answerCallbackQuery();
      await show(ctx, marksView(item));
      return;
    case "mark":
      if (!isMarkField(extra)) break;
      await startInput(adminTelegramId, "mark", id, extra);
      await ctx.answerCallbackQuery();
      await show(ctx, markPromptView(item, extra));
      return;
    case "clear": {
      const input = await pendingInputOf(adminTelegramId);
      if (input?.kind !== "mark" || input.videoId !== id || !input.mark || !OPTIONAL_MARKS.includes(input.mark)) break;
      const result = await updateVideo(id, { [input.mark]: null });
      if (!result.ok) {
        await alert(ctx, result);
        return;
      }
      await clearInput(adminTelegramId);
      await ctx.answerCallbackQuery({ text: texts.done.markSaved });
      await showCard(ctx, id, texts.done.markSaved);
      return;
    }
    case "short":
      await startInput(adminTelegramId, "shortVideo", id);
      await ctx.answerCallbackQuery();
      await show(ctx, { text: texts.askShort, keyboard: cancelKeyboard(id) });
      return;
  }
  await ctx.answerCallbackQuery();
});

async function handleMarkText(ctx: Context, input: BotAdminInput & { mark: VideoMarkField }, text: string) {
  const adminTelegramId = input.adminTelegramId;
  const item = await findAdminVideo(input.videoId);
  if (!item) {
    await clearInput(adminTelegramId);
    await ctx.reply(texts.failures.not_found);
    return;
  }
  const reprompt = async (error?: string) => {
    const view = markPromptView(item, input.mark, error);
    await ctx.reply(view.text, { reply_markup: view.keyboard });
  };

  const seconds = parseMmSs(text);
  if (seconds === null) {
    await reprompt(errors.invalidTime);
    return;
  }

  const range = markRangeOf(item, input.mark);
  if (!isInMarkRange(range, seconds)) {
    const marks = otherMarksOf(item, input.mark);
    await reprompt(rangeErrorText(input.mark, seconds, range, marks, item.duration) ?? undefined);
    return;
  }

  const result = await updateVideo(input.videoId, { [input.mark]: seconds });
  if (!result.ok) {
    await reprompt(failureText(result));
    return;
  }
  await clearInput(adminTelegramId);
  await sendCard(ctx.api, adminTelegramId, input.videoId, texts.done.markSaved);
}

async function handleShortText(ctx: Context, input: BotAdminInput, text: string) {
  if (input.shortFileUniqueId === null) {
    await ctx.reply(texts.waitingShort, { reply_markup: cancelKeyboard(input.videoId) });
    return;
  }
  if (input.shortDuration !== null) {
    await ctx.reply(texts.shortUploading);
    return;
  }

  const seconds = parseMmSs(text);
  if (seconds === null || seconds <= 0) {
    const reason = seconds === null ? errors.invalidTime : errors.durationNotPositive;
    await ctx.reply(`${reason}\n\n${texts.askShortDuration}`, { reply_markup: cancelKeyboard(input.videoId) });
    return;
  }

  const updated = await setShortDuration(input.adminTelegramId, seconds);
  if (!updated) return;
  if (isShortMidUpload(updated)) {
    await ctx.reply(texts.shortUploading);
    return;
  }
  await finishShortVideo(ctx.api, input.adminTelegramId);
}

export async function handlePendingText(ctx: Context, input: BotAdminInput, text: string) {
  if (input.kind === "mark" && input.mark) {
    await handleMarkText(ctx, { ...input, mark: input.mark }, text);
    return;
  }
  await handleShortText(ctx, input, text);
}
