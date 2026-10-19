import { type Api, Composer, InlineKeyboard } from "grammy";
import {
  type BotButtonKey,
  type LaterDayOffset,
  type LaterQuickSlot,
  laterQuickSlots,
  tashkentClock,
  tashkentDateTime,
} from "@funnel/shared";
import { db } from "@/db";
import type { User } from "@/db/schema";
import { dayOptions, hourOptions, type PickerContext, quickSlots, slotAt } from "@/funnel/laterPicker";
import { findByTelegramId } from "@/funnel/users";
import { laterContextFor, scheduleAppointment } from "@/links/appointments";
import { DAY_MS, tashkentDayStart } from "@/messages/plan";
import { botText, sendBotText } from "@/telegram/texts";
import { watchAppUrl } from "@/telegram/watchUrl";

const HOURS_PER_ROW = 4;

const quickCodes: Record<string, LaterQuickSlot> = { t: "tonight", m: "tomorrowMorning", e: "tomorrowEvening" };

const quickCodeOf: Record<LaterQuickSlot, string> = { tonight: "t", tomorrowMorning: "m", tomorrowEvening: "e" };

const quickButtonKeys: Record<LaterQuickSlot, BotButtonKey> = {
  tonight: "laterTonight",
  tomorrowMorning: "laterTomorrowMorning",
  tomorrowEvening: "laterTomorrowEvening",
};

const dayButtonKeys: Record<LaterDayOffset, BotButtonKey> = {
  0: "dayToday",
  1: "dayTomorrow",
  2: "dayAfterTomorrow",
};

const CALLBACK_PATTERN = /^lt:(?:q:([tme])|(o)|d:([012])|h:([012]):(\d{1,2}))$/;

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

async function pickerFor(user: User, now: Date): Promise<PickerContext | null> {
  const context = await laterContextFor(db(), user, now);
  return context && { now, purpose: context.purpose, expiresAt: context.expiresAt };
}

export async function askWhen(api: Api, chatId: number, user: User, now = new Date()) {
  const picker = await pickerFor(user, now);
  if (!picker) {
    await sendBotText(api, chatId, "offerClosed");
    return;
  }
  if (dayOptions(picker).length === 0) {
    const keyboard = new InlineKeyboard().webApp(await botText("watchButton"), watchAppUrl());
    const expiry = picker.expiresAt ? tashkentDateTime(picker.expiresAt) : "";
    await sendBotText(api, chatId, "laterTooLate", { link_tugash_vaqti: expiry }, keyboard);
    return;
  }
  const keyboard = new InlineKeyboard();
  for (const quick of quickSlots(picker)) {
    const label = await botText(quickButtonKeys[quick.slot], { soat: hourLabel(quick.hour) });
    keyboard.text(label, `lt:q:${quickCodeOf[quick.slot]}`).row();
  }
  keyboard.text(await botText("laterOther"), "lt:o");
  await sendBotText(api, chatId, "laterAsk", {}, keyboard);
}

async function askDay(api: Api, chatId: number, user: User, now: Date) {
  const picker = await pickerFor(user, now);
  const days = picker ? dayOptions(picker) : [];
  if (days.length === 0) {
    await askWhen(api, chatId, user, now);
    return;
  }
  const keyboard = new InlineKeyboard();
  for (const day of days) keyboard.text(await botText(dayButtonKeys[day]), `lt:d:${day}`);
  await sendBotText(api, chatId, "laterPickDay", {}, keyboard);
}

async function askHour(api: Api, chatId: number, user: User, dayOffset: LaterDayOffset, now: Date) {
  const picker = await pickerFor(user, now);
  const hours = picker ? hourOptions(picker, dayOffset) : [];
  if (hours.length === 0) {
    await askDay(api, chatId, user, now);
    return;
  }
  const keyboard = new InlineKeyboard();
  hours.forEach((hour, index) => {
    if (index > 0 && index % HOURS_PER_ROW === 0) keyboard.row();
    keyboard.text(hourLabel(hour), `lt:h:${dayOffset}:${hour}`);
  });
  await sendBotText(api, chatId, "laterPickHour", {}, keyboard);
}

async function choose(api: Api, chatId: number, user: User, chosenAt: Date, now: Date) {
  const result = await scheduleAppointment(user.id, chosenAt, now);
  if (result === "closed") {
    await sendBotText(api, chatId, "offerClosed");
    return;
  }
  if (result === "unavailable") {
    await askWhen(api, chatId, user, now);
    return;
  }
  const dayOffset = Math.round((tashkentDayStart(chosenAt).getTime() - tashkentDayStart(now).getTime()) / DAY_MS);
  const day = await botText(dayButtonKeys[dayOffset as LaterDayOffset]);
  await sendBotText(api, chatId, "laterConfirmed", { vaqt: `${day} ${tashkentClock(chosenAt)}` });
}

export const laterComposer = new Composer();

laterComposer.callbackQuery(/^lt:/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const now = new Date();
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => undefined);

  const user = await findByTelegramId(ctx.from.id);
  const match = CALLBACK_PATTERN.exec(ctx.callbackQuery.data);
  if (!user || !match) {
    await sendBotText(ctx.api, chatId, "offerClosed");
    return;
  }
  const [, quick, other, day, hourDay, hour] = match;
  if (quick) {
    const { dayOffset, hour: quickHour } = laterQuickSlots[quickCodes[quick]];
    await choose(ctx.api, chatId, user, slotAt(now, dayOffset, quickHour), now);
  } else if (other) {
    await askDay(ctx.api, chatId, user, now);
  } else if (day) {
    await askHour(ctx.api, chatId, user, Number(day) as LaterDayOffset, now);
  } else {
    await choose(ctx.api, chatId, user, slotAt(now, Number(hourDay), Number(hour)), now);
  }
});
