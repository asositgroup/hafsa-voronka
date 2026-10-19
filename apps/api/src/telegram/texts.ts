import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { type Api, InputFile } from "grammy";
import type { ForceReply, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from "grammy/types";
import {
  type BotMediaType,
  type BotMessageKey,
  type BotTextItem,
  type BotTextKey,
  botTextDefinitions,
  botTextKeys,
} from "@funnel/shared";
import { db } from "@/db";
import { type BotTextRow, botTexts } from "@/db/schema";
import { env } from "@/env";
import { openTelegramFile } from "@/telegram/files";

export const defaultBotTexts: Record<BotTextKey, string> = {
  askContact:
    "Assalomu alaykum, {name}! 👋\n\nHafsa ustozaning «Arab tilini o'rganishdagi 5 muhim qadam» video darsi sizni kutmoqda: 12 yillik tajriba, atigi 17 daqiqada.\n\nDarsni bepul olish uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing. Bir soniya ham ketmaydi 👇",
  askContactShort:
    "Bepul darsgacha bir qadam qoldi! 👇\nPastdagi «📱 Raqamni yuborish» tugmasini bosing, dars darhol ochiladi.",
  welcome:
    "Qaytganingizdan xursandmiz, {name}! 👋\n\nVideo dars hali ham sizni kutmoqda. Atigi 17 daqiqa, arab tilini qayerdan boshlashni aniq bilib olasiz 👇",
  welcomeBack:
    "Yana xush kelibsiz, {name}! 🌿\n\nDarsni qayta ko'rishingiz mumkin. Arab tilini Hafsa ustoza bilan chuqurroq o'rganmoqchi bo'lsangiz, adminga yozing. Sizga mos yo'lni ko'rsatib beradi.",
  registered: "Ajoyib, siz ro'yxatdan o'tdingiz! ✅",
  watchPrompt:
    "🎁 Video dars tayyor!\n\nUnda arab tilini to'g'ri boshlash uchun 5 ta muhim qadamni bilib olasiz. Ko'pchilik aynan shu qadamlarni bilmagani uchun yarim yo'lda to'xtab qoladi.\n\n17 daqiqa ajrating va hoziroq ko'ring 👇",
  completion:
    "Barakalla! 🎉 Darsni ko'rib chiqdingiz. Bu arab tilini o'rganishdagi eng muhim qadam: to'g'ri boshlash.\n\nEndi bilganlaringizni amalda qo'llash vaqti. Arab tilini Hafsa ustoza bilan davom ettirmoqchimisiz yoki savollaringiz bormi? Adminga yozing, sizga batafsil ma'lumot beradi 👇",
  fallback: "Video darsni ko'rish uchun pastdagi tugmani bosing 👇",
  shareContactButton: "📱 Raqamni yuborish",
  watchButton: "▶️ Bepul darsni ko'rish",
  channelButton: "✍️ Adminga yozish",
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
  const text = render(row?.text ?? defaultBotTexts[key], vars);
  const options = { reply_markup: replyMarkup };

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

export function botMediaChat() {
  if (env.MEDIA_CHAT_ID) return { chatId: env.MEDIA_CHAT_ID, threadId: undefined };
  if (env.LEADS_CHAT_ID) return { chatId: env.LEADS_CHAT_ID, threadId: env.LEADS_THREAD_ID };
  return null;
}

export async function uploadBotMedia(api: Api, key: BotTextKey, type: BotMediaType, file: File) {
  const target = botMediaChat()!;
  const input = new InputFile(new Uint8Array(await file.arrayBuffer()), file.name || `${key}.${type === "photo" ? "jpg" : "mp4"}`);
  const options = { message_thread_id: target.threadId, disable_notification: true };
  let fileId: string;
  let messageId: number;
  if (type === "photo") {
    const message = await api.sendPhoto(target.chatId, input, options);
    fileId = message.photo[message.photo.length - 1].file_id;
    messageId = message.message_id;
  } else {
    const message = await api.sendVideo(target.chatId, input, { ...options, supports_streaming: true });
    fileId = message.video.file_id;
    messageId = message.message_id;
  }
  await api.deleteMessage(target.chatId, messageId).catch((error) => console.error("Media upload cleanup failed:", error));
  await upsert(key, { mediaType: type, mediaFileId: fileId });
}

export async function downloadBotMedia(api: Api, fileId: string) {
  const { stream } = await openTelegramFile(api, fileId);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>);
}
