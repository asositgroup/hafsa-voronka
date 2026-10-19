import { Bot, type Context, InlineKeyboard, Keyboard } from "grammy";
import { normalizeContactPhone } from "@funnel/shared";
import type { User } from "@/db/schema";
import { env } from "@/env";
import { completeRegistration, nameFromTelegram } from "@/funnel/registration";
import {
  findByTelegramId,
  logEvent,
  saveContactPhone,
  setBotBlocked,
  upsertUser,
} from "@/funnel/users";
import { syncSegment } from "@/funnel/segments";
import { uz } from "@/i18n/uz";
import { applyLeadAction } from "@/leads/actions";
import type { LeadAction } from "@/leads/card";
import { findMatchingWebLead } from "@/leads/service";
import { markBlockedByTelegramId } from "@/telegram/blocked";
import { adminVideoComposer } from "@/telegram/admin-video/handlers";
import { reminderComposer } from "@/telegram/reminders";
import { watchAppUrl } from "@/telegram/watchUrl";
import { botText, sendBotText } from "@/telegram/texts";

async function watchKeyboard(completed: boolean) {
  const keyboard = new InlineKeyboard().webApp(await botText("watchButton"), watchAppUrl());
  return completed ? keyboard.row().url(await botText("channelButton"), env.CHANNEL_URL) : keyboard;
}

async function contactKeyboard() {
  return new Keyboard().requestContact(await botText("shareContactButton")).resized().oneTime();
}

async function registerFromChat(ctx: Context, user: User, phone: string) {
  const webLead = await findMatchingWebLead(user.visitorId, phone);
  const name =
    webLead?.name ||
    (ctx.from && nameFromTelegram(ctx.from)) ||
    ctx.from?.username ||
    uz.bot.defaultName;
  await completeRegistration(user, { name, phone, phoneVerified: true }, { actionSource: "chat" });
  await sendBotText(ctx.api, ctx.chat!.id, "registered", {}, { remove_keyboard: true });
  await sendBotText(ctx.api, ctx.chat!.id, "watchPrompt", {}, await watchKeyboard(false));
}

function isLeadsChat(chat: { id: number; username?: string } | undefined) {
  const configured = env.LEADS_CHAT_ID;
  if (!configured || !chat) return false;
  return configured === String(chat.id) || (chat.username !== undefined && configured === `@${chat.username}`);
}

function createBot() {
  const root = new Bot(env.BOT_TOKEN, { client: { apiRoot: env.BOT_API_ROOT } });

  root.chatType(["group", "supergroup"]).command("chatid", async (ctx) => {
    const thread = ctx.msg.is_topic_message ? `\nLEADS_THREAD_ID=${ctx.msg.message_thread_id}` : "";
    await ctx.reply(`LEADS_CHAT_ID=${ctx.chat.id}${thread}`, {
      message_thread_id: ctx.msg.is_topic_message ? ctx.msg.message_thread_id : undefined,
    });
  });

  root.callbackQuery(/^lead:(claim|won|lost|wrote):(\d+)$/, async (ctx) => {
    if (!isLeadsChat(ctx.chat)) {
      await ctx.answerCallbackQuery();
      return;
    }
    const actor = {
      id: ctx.from.id,
      name: nameFromTelegram(ctx.from) || ctx.from.username || String(ctx.from.id),
      username: ctx.from.username,
    };
    const result = await applyLeadAction(Number(ctx.match[2]), ctx.match[1] as LeadAction, actor);
    await ctx.answerCallbackQuery({ text: result.reply, show_alert: !result.ok });
  });

  const bot = root.chatType("private");

  bot.use(adminVideoComposer);
  bot.use(reminderComposer);

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const { user, isNew } = await upsertUser(ctx.from, ctx.match || undefined);
    await logEvent("bot_start", {
      userId: user.id,
      visitorId: user.visitorId,
      meta: { param: ctx.match || null, isNew },
    });
    const name = ctx.from.first_name;

    if (user.registeredAt === null) {
      await sendBotText(ctx.api, ctx.chat.id, "askContact", { name }, await contactKeyboard());
      return;
    }

    const completed = user.completedAt !== null;
    await sendBotText(ctx.api, ctx.chat.id, completed ? "welcomeBack" : "welcome", { name }, await watchKeyboard(completed));
  });

  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply(uz.bot.contactMismatch, { reply_markup: await contactKeyboard() });
      return;
    }

    const phone = normalizeContactPhone(contact.phone_number);
    const user = await saveContactPhone(ctx.from, phone);
    if (user.registeredAt === null) {
      await registerFromChat(ctx, user, phone);
      return;
    }
    await ctx.reply(uz.bot.contactConfirmed, { reply_markup: { remove_keyboard: true } });
  });

  bot.on("message", async (ctx) => {
    const user = await findByTelegramId(ctx.from.id);
    if (!user?.registeredAt) {
      await sendBotText(ctx.api, ctx.chat.id, "askContactShort", {}, await contactKeyboard());
      return;
    }
    await sendBotText(ctx.api, ctx.chat.id, "fallback", {}, await watchKeyboard(user.completedAt !== null));
  });

  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    const telegramId = ctx.myChatMember.from.id;
    if (status === "kicked") {
      await markBlockedByTelegramId(telegramId).catch((error) => console.error("Segment sync failed:", error));
    }
    if (status === "member") {
      const unblocked = await setBotBlocked(telegramId, false);
      if (unblocked) {
        await syncSegment(unblocked.id).catch((error) => console.error("Segment sync failed:", error));
      }
    }
  });

  root.catch((err) => {
    console.error("bot error", err.error);
  });

  return root;
}

let instance: Bot | undefined;

export function bot() {
  instance ??= createBot();
  return instance;
}
