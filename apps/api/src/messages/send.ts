import type { Api } from "grammy";
import type { Message } from "grammy/types";
import type { RenderedMessage } from "@/messages/render";

export async function sendRendered(api: Api, chatId: number, rendered: RenderedMessage): Promise<Message> {
  const { text, parse_mode, reply_markup, media } = rendered;
  if (!media) {
    return api.sendMessage(chatId, text, { parse_mode, reply_markup, link_preview_options: { is_disabled: true } });
  }
  const options = { caption: text, parse_mode, reply_markup };
  if (media.type === "photo") return api.sendPhoto(chatId, media.fileId, options);
  if (media.type === "video") return api.sendVideo(chatId, media.fileId, { ...options, supports_streaming: true });
  return api.sendVoice(chatId, media.fileId, options);
}
