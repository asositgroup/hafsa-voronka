import { serve } from "@hono/node-server";
import { createApp } from "@/app";
import { closeDb } from "@/db";
import { runMigrations } from "@/db/migrate";
import { loadEnv } from "@/env";
import { startLeadNotifyLoop } from "@/leads/notifier";
import { startMessageDispatchLoop } from "@/messages/dispatch";
import { resumeBotUploads } from "@/telegram/admin-video/upload";
import { bot } from "@/telegram/bot";
import { seedVideoFromEnv } from "@/videos/service";

const env = loadEnv();

await runMigrations(env.DATABASE_URL);
await seedVideoFromEnv({ url: env.VIDEO_URL, duration: env.VIDEO_DURATION_SEC });
await bot().init();
await resumeBotUploads(bot().api);

const stopLeadNotify = env.LEADS_CHAT_ID || env.SHEETS_ENABLED ? startLeadNotifyLoop() : undefined;
const stopMessageDispatch = startMessageDispatchLoop();

const server = serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  console.log(`API listening on :${info.port} as @${bot().botInfo.username}`);
});

async function shutdown() {
  stopLeadNotify?.();
  stopMessageDispatch();
  server.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
