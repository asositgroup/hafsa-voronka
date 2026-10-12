import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { db } from "@/db";
import { env } from "@/env";
import { bot } from "@/telegram/bot";

function hasWebhookSecret(header: string | undefined) {
  if (!header) return false;
  const expected = Buffer.from(env.WEBHOOK_SECRET);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createApp() {
  const app = new Hono();
  const handleUpdate = webhookCallback(bot(), "hono");

  app.get("/health", async (c) => {
    await db().execute(sql`select 1`);
    return c.json({ ok: true });
  });

  app.post("/bot", (c) => {
    if (!hasWebhookSecret(c.req.header("x-telegram-bot-api-secret-token"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return handleUpdate(c);
  });

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
