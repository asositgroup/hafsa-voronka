import { Composer } from "grammy";
import { findByTelegramId, logEvent } from "@/funnel/users";
import { answerLater } from "@/links/service";
import { recordMessageClick } from "@/messages/clicks";
import { sendBotText } from "@/telegram/texts";

async function recordLater(telegramId: number, ref: string, op: string) {
  if (!ref.startsWith("s")) return;
  const user = await findByTelegramId(telegramId);
  if (!user) return;
  const sentId = Number(ref.slice(1));
  if (await answerLater(user.id, sentId)) {
    await recordMessageClick(sentId, user.id, "callback", { op });
    return;
  }
  await logEvent("reminder_later", { userId: user.id, visitorId: user.visitorId, meta: { ref, choice: null } });
  if (op !== "wa") await recordMessageClick(sentId, user.id, "callback", { op });
}

export const reminderComposer = new Composer();

reminderComposer.callbackQuery(/^mt:(w|wa|l):([ts]\d+)(?::([bek]))?$/, async (ctx) => {
  const [, op, ref] = ctx.match;
  const chatId = ctx.chat?.id;
  await ctx.answerCallbackQuery();
  if (!chatId) return;
  await sendBotText(ctx.api, chatId, "laterAck");
  await recordLater(ctx.from.id, ref, op);
});
