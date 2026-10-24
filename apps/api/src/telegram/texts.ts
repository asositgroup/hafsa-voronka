import { eq } from "drizzle-orm";
import type { Api } from "grammy";
import type { ForceReply, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from "grammy/types";
import {
  type BotMediaType,
  type BotMessageKey,
  type BotTextItem,
  type BotTextKey,
  botTextDefinitions,
  botTextKeys,
  escapeHtml,
  sanitizeTelegramHtml,
} from "@funnel/shared";
import { db } from "@/db";
import { type BotTextRow, botTexts } from "@/db/schema";
import { uploadToMediaChat } from "@/telegram/media";

export const defaultBotTexts: Record<BotTextKey, string> = {
  welcome:
    "Qaytganingizdan xursandmiz, {name}! 👋\n\nVideo dars hali ham sizni kutmoqda. Qisqa darsda arab tilini qayerdan boshlashni aniq bilib olasiz 👇",
  welcomeBack:
    "Yana xush kelibsiz, {name}! 🌿\n\nDarsni qayta ko'rishingiz mumkin. Arab tilini Hafsa ustoza bilan chuqurroq o'rganmoqchi bo'lsangiz, adminga yozing. Sizga mos yo'lni ko'rsatib beradi.",
  watchPrompt:
    "Assalomu alaykum, {name}! 👋\n\n🎁 Video dars tayyor!\n\nUnda arab tilini to'g'ri boshlash uchun 5 ta muhim qadamni bilib olasiz. Ko'pchilik aynan shu qadamlarni bilmagani uchun yarim yo'lda to'xtab qoladi.\n\nBiroz vaqt ajrating va hoziroq ko'ring 👇",
  completion:
    "Barakalla! 🎉 Darsni ko'rib chiqdingiz. Bu arab tilini o'rganishdagi eng muhim qadam: to'g'ri boshlash.\n\nEndi bilganlaringizni amalda qo'llash vaqti. Arab tilini Hafsa ustoza bilan davom ettirmoqchimisiz yoki savollaringiz bormi? Adminga yozing, sizga batafsil ma'lumot beradi 👇",
  fallback: "Video darsni ko'rish uchun pastdagi tugmani bosing 👇",
  laterAck: "Mayli, qulay vaqtda ko'rib chiqing. Dars sizni kutmoqda 🌿",
  laterAsk: "Yaxshi! Qachon ko'rishingiz qulay? 🕐\n\nShu vaqtda darsni siz uchun qayta ochib, eslatib qo'yaman 👇",
  laterPickDay: "Qaysi kuni ko'rishingiz qulay? 📅",
  laterPickHour: "Soat nechada? Toshkent vaqti bilan 🕐",
  laterConfirmed: "Zo'r! 🙌 {vaqt} — darsingizni ochib, eslatib qo'yaman ✅",
  laterTooLate:
    "Dars {link_tugash_vaqti} da o'chadi, shuning uchun bundan keyin qulay vaqt qolmadi 😔\n\nHoziroq ko'rib oling, ko'p vaqtingizni olmaydi 👇",
  reopenPreReminder: "1 soatdan keyin bonus darsingiz ochiladi, choy tayyorlab qo'ying 🙂",
  reopenNow: "Bonus darsingiz yana ochildi! 🎁\n\nLink 24 soat amal qiladi. Tayyor bo'lsangiz, boshlang 👇",
  remindNow: "Eslatib qo'ydim, dars sizni kutmoqda! ⏰\n\nTayyor bo'lsangiz, davom eting 👇",
  offerClosed: "Bu tugma eskirgan 🙂 Darsga qaytish uchun /start bosing.",
  watchButton: "▶️ Bepul darsni ko'rish",
  channelButton: "✍️ Adminga yozish",
  laterTonight: "🌙 Bugun kechqurun ({soat})",
  laterTomorrowMorning: "🌅 Ertaga ertalab ({soat})",
  laterTomorrowEvening: "🌙 Ertaga kechqurun ({soat})",
  laterOther: "🕐 Boshqa vaqt",
  dayToday: "Bugun",
  dayTomorrow: "Ertaga",
  dayAfterTomorrow: "Indinga",
  reopenWatchButton: "▶️ Darsni boshlash",
  remindWatchButton: "▶️ Darsni davom ettirish",
};

type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;

let cache: Map<string, BotTextRow> | undefined;

async function overrides() {
  cache ??= new Map((await db().select().from(botTexts)).map((row) => [row.key, row]));
  return cache;
}

export function invalidateBotTexts() {
  cache = undefined;
}

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

function renderHtml(template: string, vars: Record<string, string>) {
  const sanitized = sanitizeTelegramHtml(template);
  const html = sanitized.ok ? sanitized.html : escapeHtml(template);
  return render(
    html,
    Object.fromEntries(Object.entries(vars).map(([name, value]) => [name, escapeHtml(value)])),
  );
}

export async function botText(key: BotTextKey, vars: Record<string, string> = {}) {
  const row = (await overrides()).get(key);
  return render(row?.text ?? defaultBotTexts[key], vars);
}

export async function sendBotText(
  api: Api,
  chatId: number,
  key: BotMessageKey,
  vars: Record<string, string> = {},
  replyMarkup?: ReplyMarkup,
) {
  const row = (await overrides()).get(key);
  const text = renderHtml(row?.text ?? defaultBotTexts[key], vars);
  const options = { reply_markup: replyMarkup, parse_mode: "HTML" as const };

  if (row?.mediaFileId && row.mediaType === "photo") {
    return api.sendPhoto(chatId, row.mediaFileId, { ...options, caption: text });
  }
  if (row?.mediaFileId && row.mediaType === "video") {
    return api.sendVideo(chatId, row.mediaFileId, { ...options, caption: text, supports_streaming: true });
  }
  return api.sendMessage(chatId, text, options);
}

export async function listBotTexts(): Promise<BotTextItem[]> {
  const rows = await overrides();
  return botTextKeys.map((key) => {
    const row = rows.get(key);
    return {
      key,
      kind: botTextDefinitions[key].kind,
      placeholders: [...botTextDefinitions[key].placeholders],
      defaultText: defaultBotTexts[key],
      text: row?.text ?? null,
      media: row?.mediaFileId && row.mediaType ? { type: row.mediaType as BotMediaType } : null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function findBotText(key: BotTextKey) {
  return (await overrides()).get(key);
}

async function upsert(key: BotTextKey, values: Partial<Pick<BotTextRow, "text" | "mediaType" | "mediaFileId">>) {
  await db()
    .insert(botTexts)
    .values({ key, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({ target: botTexts.key, set: { ...values, updatedAt: new Date() } });
  invalidateBotTexts();
}

export async function saveBotText(key: BotTextKey, text: string) {
  await upsert(key, { text: text === defaultBotTexts[key] ? null : text });
}

export async function resetBotText(key: BotTextKey) {
  await db().delete(botTexts).where(eq(botTexts.key, key));
  invalidateBotTexts();
}

export async function clearBotMedia(key: BotTextKey) {
  await upsert(key, { mediaType: null, mediaFileId: null });
}

export async function uploadBotMedia(api: Api, key: BotTextKey, type: BotMediaType, file: File) {
  const fileId = await uploadToMediaChat(api, type, file);
  await upsert(key, { mediaType: type, mediaFileId: fileId });
}
