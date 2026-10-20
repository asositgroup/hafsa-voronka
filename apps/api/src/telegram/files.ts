import { open, unlink } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { Readable } from "node:stream";
import { Api } from "grammy";
import { env } from "@/env";

export type TelegramFile = { stream: Readable; size?: number; localPath?: string };

const LOCAL_SERVER_DOWNLOAD_TIMEOUT_SECONDS = 3600;

let localServerApi: Api | undefined;

function downloadApi(api: Api) {
  if (!env.BOT_API_ROOT) return api;
  localServerApi ??= new Api(env.BOT_TOKEN, {
    apiRoot: env.BOT_API_ROOT,
    timeoutSeconds: LOCAL_SERVER_DOWNLOAD_TIMEOUT_SECONDS,
  });
  return localServerApi;
}

export async function openTelegramFile(api: Api, fileId: string): Promise<TelegramFile> {
  const file = await downloadApi(api).getFile(fileId);
  if (!file.file_path) throw new Error("Telegram returned no file path");

  if (isAbsolute(file.file_path)) {
    const handle = await open(file.file_path, "r");
    return {
      stream: handle.createReadStream(),
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
