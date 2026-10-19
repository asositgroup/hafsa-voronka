import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { Readable } from "node:stream";
import type { Api } from "grammy";
import { env } from "@/env";

export type TelegramFile = { stream: Readable; size?: number; localPath?: string };

export async function openTelegramFile(api: Api, fileId: string): Promise<TelegramFile> {
  const file = await api.getFile(fileId);
  if (!file.file_path) throw new Error("Telegram returned no file path");

  if (isAbsolute(file.file_path)) {
    return {
      stream: createReadStream(file.file_path),
      size: file.file_size,
      localPath: file.file_path,
    };
  }

  const root = env.BOT_API_ROOT ?? "https://api.telegram.org";
  const response = await fetch(`${root}/file/bot${env.BOT_TOKEN}/${file.file_path}`);
  if (!response.ok || !response.body) throw new Error(`Telegram file download failed with ${response.status}`);
  return {
    stream: Readable.fromWeb(response.body as never),
    size: file.file_size,
  };
}

export async function removeLocalTelegramFile(path: string | undefined) {
  if (!path) return;
  await unlink(path).catch(() => {});
}
