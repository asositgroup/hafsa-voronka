import { Bot, InlineKeyboard } from "grammy";
import { normalizeContactPhone } from "@funnel/shared";
import { env } from "@/env";
import { uz } from "@/i18n/uz";
import {
  findByTelegramId,
  logEvent,
  saveContactPhone,
  setBotBlocked,
  upsertUser,
} from "@/funnel/users";

function watchKeyboard(completed: boolean) {
  const keyboard = new InlineKeyboard().webApp(uz.bot.watchButton, `${env.WEB_URL}/app`);
  return completed ? keyboard.row().url(uz.bot.channelButton, env.CHANNEL_URL) : keyboard;
}

function createBot() {
  const bot = new Bot(env.BOT_TOKEN);

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const { user, isNew } = await upsertUser(ctx.from, ctx.match || undefined);
    await logEvent("bot_start", {
      userId: user.id,
      visitorId: user.visitorId,
      meta: { param: ctx.match || null, isNew },
    });
    const name = ctx.from.first_name;
    const completed = user.completedAt !== null;
    await ctx.reply(completed ? uz.bot.welcomeBack(name) : uz.bot.welcome(name), {
      reply_markup: watchKeyboard(completed),
    });
  });

  bot.on("message:contact", async (ctx) => {
    if (!ctx.from) return;
    const contact = ctx.message.contact;
    if (contact.user_id === ctx.from.id) {
      const phone = normalizeContactPhone(contact.phone_number);
      const user = await saveContactPhone(ctx.from, phone);
      await ctx.reply(uz.bot.contactConfirmed, {
        reply_markup: watchKeyboard(Boolean(user.completedAt)),
      });
      return;
    }
    await ctx.reply(uz.bot.contactMismatch);
  });

  bot.on("message", async (ctx) => {
    const user = await findByTelegramId(ctx.from.id);
    await ctx.reply(uz.bot.fallback, {
      reply_markup: watchKeyboard(Boolean(user?.completedAt)),
    });
  });

  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (status === "kicked") await setBotBlocked(ctx.myChatMember.from.id, true);
    if (status === "member") await setBotBlocked(ctx.myChatMember.from.id, false);
  });

  bot.catch((err) => {
    console.error("bot error", err.error);
  });

  return bot;
}

let instance: Bot | undefined;

export function bot() {
  instance ??= createBot();
  return instance;
}
