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
import { uz } from "@/i18n/uz";
import { findMatchingWebLead } from "@/leads/service";

function watchKeyboard(completed: boolean) {
  const keyboard = new InlineKeyboard().webApp(uz.bot.watchButton, `${env.WEB_URL}/app`);
  return completed ? keyboard.row().url(uz.bot.channelButton, env.CHANNEL_URL) : keyboard;
}

function contactKeyboard() {
  return new Keyboard().requestContact(uz.bot.shareContactButton).resized().oneTime();
}

async function registerFromChat(ctx: Context, user: User, phone: string) {
  const webLead = await findMatchingWebLead(user.visitorId, phone);
  const name =
    webLead?.name ||
    (ctx.from && nameFromTelegram(ctx.from)) ||
    ctx.from?.username ||
    uz.bot.defaultName;
  await completeRegistration(user, { name, phone, phoneVerified: true }, { actionSource: "chat" });
  await ctx.reply(uz.bot.registered, { reply_markup: { remove_keyboard: true } });
  await ctx.reply(uz.bot.watchPrompt, { reply_markup: watchKeyboard(false) });
}

function createBot() {
  const root = new Bot(env.BOT_TOKEN);

  root.chatType(["group", "supergroup"]).command("chatid", async (ctx) => {
    const thread = ctx.msg.is_topic_message ? `\nLEADS_THREAD_ID=${ctx.msg.message_thread_id}` : "";
    await ctx.reply(`LEADS_CHAT_ID=${ctx.chat.id}${thread}`, {
      message_thread_id: ctx.msg.is_topic_message ? ctx.msg.message_thread_id : undefined,
    });
  });

  const bot = root.chatType("private");

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
      await ctx.reply(uz.bot.askContact(name), { reply_markup: contactKeyboard() });
      return;
    }

    const completed = user.completedAt !== null;
    await ctx.reply(completed ? uz.bot.welcomeBack(name) : uz.bot.welcome(name), {
      reply_markup: watchKeyboard(completed),
    });
  });

  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply(uz.bot.contactMismatch, { reply_markup: contactKeyboard() });
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
      await ctx.reply(uz.bot.askContactShort, { reply_markup: contactKeyboard() });
      return;
    }
    await ctx.reply(uz.bot.fallback, {
      reply_markup: watchKeyboard(user.completedAt !== null),
    });
  });

  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (status === "kicked") await setBotBlocked(ctx.myChatMember.from.id, true);
    if (status === "member") await setBotBlocked(ctx.myChatMember.from.id, false);
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
