import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { sessionRequestSchema, type SessionResponse } from "@funnel/shared";
import type { AppEnv } from "@/auth";
import { sendCapiEvent } from "@/capi";
import { db } from "@/db";
import { watchProgress } from "@/db/schema";
import { env } from "@/env";
import { logEvent, markRegistered, upsertUser } from "@/funnel/users";
import { capiClient } from "@/http/clientIp";
import { enqueueLead, formatLeadRow, sendLeadInline } from "@/sheets";
import { validateRegistration } from "./registration";

async function readJson(request: { json: () => Promise<unknown> }) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export const miniappRoutes = new Hono<AppEnv>();

miniappRoutes.post("/session", async (c) => {
  const { reason } = sessionRequestSchema.catch({ reason: "open" }).parse(await readJson(c.req));
  const { user } = await upsertUser(c.get("telegramUser"), c.get("startParam"));

  if (reason === "open") {
    await logEvent("app_open", { userId: user.id, visitorId: user.visitorId });
  }

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
  } satisfies SessionResponse);
});

miniappRoutes.post("/register", async (c) => {
  const { user } = await upsertUser(c.get("telegramUser"), c.get("startParam"));
  if (user.registeredAt !== null) {
    return c.json({ ok: true as const });
  }

  const result = validateRegistration(await readJson(c.req), user);
  if (!result.ok) {
    return c.json({ field: result.field, message: result.message }, 422);
  }

  const registered = await markRegistered(user.id, {
    name: result.name,
    phone: result.phone,
    phoneVerified: result.phoneVerified,
  });
  if (!registered) {
    return c.json({ ok: true as const });
  }

  await logEvent("registered", { userId: user.id, visitorId: user.visitorId });

  void sendCapiEvent({
    name: "CompleteRegistration",
    eventId: `reg_${user.id}`,
    user: registered,
    client: capiClient(c),
  }).catch((error) => console.error("CAPI CompleteRegistration failed:", error));

  if (env.SHEETS_ENABLED) {
    void enqueueLead(user.id, formatLeadRow(registered))
      .then(sendLeadInline)
      .catch((error) => console.error("Sheets send error:", error));
  }

  return c.json({ ok: true as const });
});
