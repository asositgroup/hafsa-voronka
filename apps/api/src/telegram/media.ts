import { Readable } from "node:stream";
import { type Api, InputFile } from "grammy";
import type { TemplateMediaType } from "@funnel/shared";
import { env } from "@/env";
import { openTelegramFile } from "@/telegram/files";

const defaultExtensions: Record<TemplateMediaType, string> = { photo: "jpg", video: "mp4", voice: "ogg" };

export function botMediaChat() {
  if (env.MEDIA_CHAT_ID) return { chatId: env.MEDIA_CHAT_ID, threadId: undefined };
  if (env.LEADS_CHAT_ID) return { chatId: env.LEADS_CHAT_ID, threadId: env.LEADS_THREAD_ID };
  return null;
}

export async function uploadToMediaChat(api: Api, type: TemplateMediaType, file: File): Promise<string> {
  const target = botMediaChat()!;
  const input = new InputFile(
    new Uint8Array(await file.arrayBuffer()),
    file.name || `upload.${defaultExtensions[type]}`,
  );
  const options = { message_thread_id: target.threadId, disable_notification: true };
  let fileId: string;
  let messageId: number;
  if (type === "photo") {
    const message = await api.sendPhoto(target.chatId, input, options);
    fileId = message.photo[message.photo.length - 1].file_id;
    messageId = message.message_id;
  } else if (type === "video") {
    const message = await api.sendVideo(target.chatId, input, { ...options, supports_streaming: true });
    fileId = message.video.file_id;
    messageId = message.message_id;
  } else {
    const message = await api.sendVoice(target.chatId, input, options);
    fileId = message.voice.file_id;
    messageId = message.message_id;
  }
  await api.deleteMessage(target.chatId, messageId).catch((error) => console.error("Media upload cleanup failed:", error));
  return fileId;
}

export async function downloadBotMedia(api: Api, fileId: string) {
  const { stream } = await openTelegramFile(api, fileId);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>);
}
