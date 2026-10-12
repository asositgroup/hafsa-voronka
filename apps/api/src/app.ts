import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { normalizeUzPhone } from "@funnel/shared";
import { initDataAuth, type AuthVariables } from "@/auth";
import { db } from "@/db";
import { watchProgress } from "@/db/schema";
import { env } from "@/env";
import {
  findByTelegramId,
  logEvent,
  registerUserRecord,
  upsertUser,
} from "@/funnel/users";
import { uz } from "@/i18n/uz";
import { enqueueLead, formatLeadRow, sendLeadInline } from "@/sheets";
import { bot } from "@/telegram/bot";

function hasWebhookSecret(header: string | undefined) {
  if (!header) return false;
  const expected = Buffer.from(env.WEBHOOK_SECRET);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
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

  const allowedOrigins = new Set([
    env.WEB_URL,
    ...(env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : []),
  ]);

  app.use(
    "/app/*",
    cors({
      origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      maxAge: 86400,
    }),
  );

  app.use("/app/*", initDataAuth);

  app.post("/app/session", async (c) => {
    const tgUser = c.get("telegramUser");
    const { user } = await upsertUser(tgUser, c.get("startParam"));

    await logEvent("app_open", {
      userId: user.id,
      visitorId: user.visitorId,
    });

    const [progress] = await db()
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.userId, user.id))
      .limit(1);

    return c.json({
      registered: user.registeredAt !== null,
      name: user.name,
      phoneSet: Boolean(user.phone),
      completed: user.completedAt !== null,
      progress: {
        lastPosition: progress?.lastPosition ?? 0,
        maxPosition: progress?.maxPosition ?? 0,
      },
      config: {
        videoUrl: env.VIDEO_URL,
        poster: env.VIDEO_POSTER_URL,
        duration: env.VIDEO_DURATION_SEC,
        seekLock: env.SEEK_LOCK,
        gateProceed: env.GATE_PROCEED,
        channelUrl: env.CHANNEL_URL,
      },
    });
  });

  app.post("/app/register", async (c) => {
    let body: { name?: unknown; phone?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ field: "name", message: uz.validation.nameRequired }, 422);
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 60) {
      return c.json({ field: "name", message: uz.validation.nameRequired }, 422);
    }

    const tgUser = c.get("telegramUser");
    let user = await findByTelegramId(tgUser.id);
    if (!user) {
      const created = await upsertUser(tgUser, c.get("startParam"));
      user = created.user;
    }

    if (user.registeredAt !== null) {
      return c.json({ ok: true });
    }

    let phoneToSave: string;
    let verifiedToSave: boolean;

    if (user.phoneVerified && user.phone) {
      phoneToSave = user.phone;
      verifiedToSave = true;
    } else {
      const rawPhone = typeof body?.phone === "string" ? body.phone : "";
      const normalized = normalizeUzPhone(rawPhone);
      if (!normalized) {
        return c.json({ field: "phone", message: uz.validation.phoneRequired }, 422);
      }
      phoneToSave = normalized;
      verifiedToSave = false;
    }

    const updated = await registerUserRecord(user.id, name, phoneToSave, verifiedToSave);
    await logEvent("registered", {
      userId: user.id,
      visitorId: user.visitorId,
    });

    if (env.SHEETS_ENABLED) {
      const row = formatLeadRow(updated);
      enqueueLead(user.id, row)
        .then((entry) => sendLeadInline(entry))
        .catch((err) => {
          console.error("Sheets send error:", err);
        });
    }

    return c.json({ ok: true });
  });

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
