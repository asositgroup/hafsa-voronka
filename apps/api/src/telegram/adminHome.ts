import { eq } from "drizzle-orm";
import { Composer, type Context, InlineKeyboard } from "grammy";
import { formatMmSs, type VideoReportRow } from "@funnel/shared";
import { addDays, getTashkentToday } from "@/admin/dates";
import { db } from "@/db";
import { botAdminTestModes } from "@/db/schema";
import { env } from "@/env";
import { uz } from "@/i18n/uz";
import { getVideoReport } from "@/reports/queries";
import { listAdminVideos } from "@/videos/adminService";
import { isAdminTelegramId } from "./admins";
import { replyVideoList } from "./admin-video/library";

const texts = uz.bot.adminHome;

type View = { text: string; keyboard: InlineKeyboard };

export async function isInTestMode(adminTelegramId: number) {
  const [row] = await db()
    .select({ id: botAdminTestModes.adminTelegramId })
    .from(botAdminTestModes)
    .where(eq(botAdminTestModes.adminTelegramId, adminTelegramId))
    .limit(1);
  return row !== undefined;
}

async function setTestMode(adminTelegramId: number, enabled: boolean) {
  if (enabled) {
    await db().insert(botAdminTestModes).values({ adminTelegramId }).onConflictDoNothing();
    return;
  }
  await db().delete(botAdminTestModes).where(eq(botAdminTestModes.adminTelegramId, adminTelegramId));
}

async function activeVideoLine() {
  const active = (await listAdminVideos()).find((item) => item.isActive);
  if (!active) return texts.noActiveVideo;
  return texts.activeVideo
    .replace("{title}", active.title)
    .replace("{duration}", formatMmSs(active.duration))
    .replace("{users}", String(active.userCount));
}

async function homeView(name: string): Promise<View> {
  const text = `${texts.greeting.replace("{name}", name)}\n\n${await activeVideoLine()}`;
  const keyboard = new InlineKeyboard()
    .text(texts.videos, "ah:videos")
    .row()
    .text(texts.upload, "ah:upload")
    .row()
    .text(texts.stats, "ah:stats")
    .row()
    .url(texts.panel, `${env.WEB_URL}/admin`)
    .row()
    .text(texts.testMode, "ah:test");
  return { text, keyboard };
}

function statsLines(rows: VideoReportRow[]) {
  const sum = (pick: (row: VideoReportRow) => number | null) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
  return texts.statsLines
    .replace("{given}", String(sum((row) => row.given)))
    .replace("{opened}", String(sum((row) => row.opened)))
    .replace("{price}", String(sum((row) => row.reachedPrice)))
    .replace("{admin}", String(sum((row) => row.wroteAdmin)));
}

async function statsView(): Promise<View> {
  const today = getTashkentToday();
  const [todayRows, weekRows] = await Promise.all([
    getVideoReport({ from: today, to: today }),
    getVideoReport({ from: addDays(today, -6), to: today }),
  ]);
  const text = [
    texts.statsTitle,
    `${texts.today}:\n${statsLines(todayRows)}`,
    `${texts.week}:\n${statsLines(weekRows)}`,
  ].join("\n\n");
  return { text, keyboard: new InlineKeyboard().text(texts.refresh, "ah:refresh") };
}

async function replyHome(ctx: Context) {
  const view = await homeView(ctx.from?.first_name ?? uz.bot.defaultName);
  await ctx.reply(view.text, { reply_markup: view.keyboard });
}

export const adminHomeComposer = new Composer<Context>();

const admin = adminHomeComposer.filter((ctx) => isAdminTelegramId(ctx.from?.id));

admin.command("admin", async (ctx) => {
  if (!ctx.from) return;
  await setTestMode(ctx.from.id, false);
  await replyHome(ctx);
});

admin.callbackQuery(/^ah:(videos|upload|stats|refresh|test|home)$/, async (ctx) => {
  const action = ctx.match[1];
  const adminTelegramId = ctx.from.id;
  switch (action) {
    case "videos":
      await ctx.answerCallbackQuery();
      await replyVideoList(ctx);
      return;
    case "upload":
      await ctx.answerCallbackQuery();
      await ctx.reply(texts.uploadHint);
      return;
    case "stats": {
      await ctx.answerCallbackQuery();
      const view = await statsView();
      await ctx.reply(view.text, { reply_markup: view.keyboard });
      return;
    }
    case "refresh": {
      const view = await statsView();
      await ctx.editMessageText(view.text, { reply_markup: view.keyboard }).catch(() => {});
      await ctx.answerCallbackQuery({ text: texts.refreshed });
      return;
    }
    case "test":
      await setTestMode(adminTelegramId, true);
      await ctx.answerCallbackQuery();
      await ctx.reply(texts.testModeOn, {
        reply_markup: new InlineKeyboard().text(texts.backToAdmin, "ah:home"),
      });
      return;
    case "home":
      await setTestMode(adminTelegramId, false);
      await ctx.answerCallbackQuery();
      await replyHome(ctx);
      return;
  }
});

admin.on("message", async (ctx, next) => {
  if (await isInTestMode(ctx.from.id)) return next();
  await replyHome(ctx);
});
