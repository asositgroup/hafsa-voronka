import { Readable } from "node:stream";
import { type Api, GrammyError, InputFile } from "grammy";
import type { TemplateMediaType } from "@funnel/shared";
import { env } from "@/env";
import { openTelegramFile } from "@/telegram/files";

const defaultExtensions: Record<TemplateMediaType, string> = { photo: "jpg", video: "mp4", voice: "ogg" };

export function botMediaChat() {
  if (env.MEDIA_CHAT_ID) return { chatId: env.MEDIA_CHAT_ID, threadId: undefined };
  if (env.LEADS_CHAT_ID) return { chatId: env.LEADS_CHAT_ID, threadId: env.LEADS_THREAD_ID };
  return null;
}

export class MediaChatUnavailableError extends Error {}

function isMediaChatUnreachable(error: unknown) {
  if (!(error instanceof GrammyError)) return false;
  return error.error_code === 403 || /chat not found|not enough rights|have no rights|chat_write_forbidden/i.test(error.description);
}

export async function uploadToMediaChat(api: Api, type: TemplateMediaType, file: File): Promise<string> {
  const target = botMediaChat()!;
  const input = new InputFile(
    new Uint8Array(await file.arrayBuffer()),
    file.name || `upload.${defaultExtensions[type]}`,
  );
  let fileId: string;
  let messageId: number;
  try {
    ({ fileId, messageId } = await sendToMediaChat(api, type, target, input));
  } catch (error) {
    if (isMediaChatUnreachable(error)) throw new MediaChatUnavailableError();
    throw error;
  }
  await api.deleteMessage(target.chatId, messageId).catch((error) => console.error("Media upload cleanup failed:", error));
  return fileId;
}

async function sendToMediaChat(
  api: Api,
  type: TemplateMediaType,
  target: NonNullable<ReturnType<typeof botMediaChat>>,
  input: InputFile,
): Promise<{ fileId: string; messageId: number }> {
  const options = { message_thread_id: target.threadId, disable_notification: true };
  if (type === "photo") {
    const message = await api.sendPhoto(target.chatId, input, options);
    return { fileId: message.photo[message.photo.length - 1].file_id, messageId: message.message_id };
  }
  if (type === "video") {
    const message = await api.sendVideo(target.chatId, input, { ...options, supports_streaming: true });
    return { fileId: message.video.file_id, messageId: message.message_id };
  }
  const message = await api.sendVoice(target.chatId, input, options);
  return { fileId: message.voice.file_id, messageId: message.message_id };
}

export async function downloadBotMedia(api: Api, fileId: string) {
  const { stream } = await openTelegramFile(api, fileId);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>);
}
