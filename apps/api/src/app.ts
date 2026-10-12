import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { initDataAuth } from "@/auth";
import { db } from "@/db";
import { env } from "@/env";
import { adminRoutes } from "@/routes/admin";
import { leadRoutes } from "@/routes/leads";
import { miniappRoutes } from "@/routes/miniapp";
import { trackRoutes } from "@/routes/track";
import { videoRoutes } from "@/routes/video";
import { bot } from "@/telegram/bot";

function hasWebhookSecret(header: string | undefined) {
  if (!header) return false;
  const expected = Buffer.from(env.WEBHOOK_SECRET);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function webOrigins() {
  const extra = env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  return new Set([env.WEB_URL, ...extra]);
}

export function createApp() {
  const app = new Hono();
  const handleUpdate = webhookCallback(bot(), "hono");
  const origins = webOrigins();
  const originFor = (origin: string) => (origins.has(origin) ? origin : null);

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

  const publicCors = cors({
    origin: originFor,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 86400,
  });

  app.use("/app/*", publicCors);
  app.use("/app/*", initDataAuth);
  app.route("/app", miniappRoutes);
  app.route("/app", videoRoutes);

  app.use("/track", publicCors);
  app.route("/track", trackRoutes);

  app.use("/leads", publicCors);
  app.route("/leads", leadRoutes);

  app.use(
    "/admin/*",
    cors({
      origin: originFor,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      maxAge: 86400,
    }),
  );
  app.route("/admin", adminRoutes);

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
