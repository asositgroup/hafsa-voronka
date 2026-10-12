import { serve } from "@hono/node-server";
import { createApp } from "@/app";
import { closeDb } from "@/db";
import { runMigrations } from "@/db/migrate";
import { loadEnv } from "@/env";
import { startSheetsRetryLoop } from "@/sheets";
import { bot } from "@/telegram/bot";

const env = loadEnv();

await runMigrations(env.DATABASE_URL);
await bot().init();

const stopSheetsRetry = env.SHEETS_ENABLED ? startSheetsRetryLoop() : undefined;

const server = serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  console.log(`API listening on :${info.port} as @${bot().botInfo.username}`);
});

async function shutdown() {
  stopSheetsRetry?.();
  server.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
