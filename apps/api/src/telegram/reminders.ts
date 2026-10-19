import { Composer, InlineKeyboard } from "grammy";
import type { EventType } from "@funnel/shared";
import { findByTelegramId, logEvent } from "@/funnel/users";
import { uz } from "@/i18n/uz";

const copy = uz.reminders;

type Choice = keyof typeof copy.options;

const choices: Choice[] = ["b", "e", "k"];

async function logReminderEvent(telegramId: number, type: EventType, ref: string, choice?: string) {
  if (!ref.startsWith("s")) return;
  const user = await findByTelegramId(telegramId);
  if (!user) return;
  await logEvent(type, { userId: user.id, visitorId: user.visitorId, meta: { ref, choice: choice ?? null } });
}

export const reminderComposer = new Composer();

reminderComposer.callbackQuery(/^mt:(w|wa|l):([ts]\d+)(?::([bek]))?$/, async (ctx) => {
  const [, op, ref, choice] = ctx.match;
  const chatId = ctx.chat?.id;
  await ctx.answerCallbackQuery();
  if (!chatId) return;

  if (op === "w") {
    const keyboard = InlineKeyboard.from(
      choices.map((option) => [InlineKeyboard.text(copy.options[option], `mt:wa:${ref}:${option}`)]),
    );
    await ctx.api.sendMessage(chatId, copy.whenQuestion, { reply_markup: keyboard });
    await logReminderEvent(ctx.from.id, "reminder_when_open", ref);
    return;
  }

  if (op === "wa") {
    if (!choice) return;
    await ctx.editMessageText(copy.acks[choice as Choice], { reply_markup: { inline_keyboard: [] } });
    await logReminderEvent(ctx.from.id, "reminder_when_answer", ref, choice);
    return;
  }

  await ctx.api.sendMessage(chatId, copy.laterAck);
  await logReminderEvent(ctx.from.id, "reminder_later", ref);
});
