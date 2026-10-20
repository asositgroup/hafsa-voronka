import type { Message } from "grammy/types";

export type VideoPayload = {
  fileId: string;
  fileUniqueId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
  sentAsVideo: boolean;
};

export function videoPayload(message: Message): VideoPayload | null {
  if (message.video) {
    const video = message.video;
    return {
      fileId: video.file_id,
      fileUniqueId: video.file_unique_id,
      fileName: video.file_name ?? null,
      mimeType: video.mime_type ?? null,
      fileSize: video.file_size ?? null,
      duration: video.duration > 0 ? video.duration : null,
      sentAsVideo: true,
    };
  }
  const document = message.document;
  if (document?.mime_type?.startsWith("video/")) {
    return {
      fileId: document.file_id,
      fileUniqueId: document.file_unique_id,
      fileName: document.file_name ?? null,
      mimeType: document.mime_type,
      fileSize: document.file_size ?? null,
      duration: null,
      sentAsVideo: false,
    };
  }
  return null;
}
