import { Composer } from "grammy";
import { findByTelegramId, logEvent } from "@/funnel/users";
import { answerLater } from "@/links/service";
import { recordMessageClick } from "@/messages/clicks";
import { askWhen, laterComposer } from "@/telegram/later";
import { sendBotText } from "@/telegram/texts";

async function recordLater(userId: number, visitorId: string | null, ref: string, op: string) {
  const sentId = Number(ref.slice(1));
  if (await answerLater(userId, sentId)) {
    await recordMessageClick(sentId, userId, "callback", { op });
    return;
  }
  await logEvent("reminder_later", { userId, visitorId, meta: { ref, choice: null } });
  if (op !== "wa") await recordMessageClick(sentId, userId, "callback", { op });
}

export const reminderComposer = new Composer();

reminderComposer.use(laterComposer);

reminderComposer.callbackQuery(/^mt:(w|wa|l):([ts]\d+)(?::([bek]))?$/, async (ctx) => {
  const [, op, ref] = ctx.match;
  const chatId = ctx.chat?.id;
  await ctx.answerCallbackQuery();
  if (!chatId) return;
  if (ref.startsWith("t")) {
    await sendBotText(ctx.api, chatId, "laterAck");
    return;
  }
  const user = await findByTelegramId(ctx.from.id);
  if (!user) {
    await sendBotText(ctx.api, chatId, "offerClosed");
    return;
  }
  await recordLater(user.id, user.visitorId, ref, op);
  await askWhen(ctx.api, chatId, user);
});
