import { Hono } from "hono";
import {
  progressRequestSchema,
  type OfferProgressResponse,
  type ProgressResponse,
  videoEventRequestSchema,
} from "@funnel/shared";
import type { AppEnv } from "@/auth";
import { capiClient } from "@/http/clientIp";
import { recordOfferProgress, recordProgress, recordVideoEvent } from "@/watch/service";

async function readJson(request: { json: () => Promise<unknown> }) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export const videoRoutes = new Hono<AppEnv>();

videoRoutes.post("/progress", async (c) => {
  c.header("cache-control", "no-store");
  const body = await readJson(c.req);
  const parsed = progressRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const tgUser = c.get("telegramUser");
  const result = await recordProgress(tgUser.id, parsed.data, new Date(), undefined, capiClient(c));
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({
    completed: result.completed,
    unlocked: result.unlocked,
    maxPosition: result.maxPosition,
    remainingSecs: result.remainingSecs,
  } satisfies ProgressResponse);
});

videoRoutes.post("/offer-progress", async (c) => {
  c.header("cache-control", "no-store");
  const parsed = progressRequestSchema.safeParse(await readJson(c.req));
  if (!parsed.success) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const result = await recordOfferProgress(c.get("telegramUser").id, parsed.data);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({ completed: result.completed } satisfies OfferProgressResponse);
});

videoRoutes.post("/event", async (c) => {
  const body = await readJson(c.req);
  const parsed = videoEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const tgUser = c.get("telegramUser");
  const result = await recordVideoEvent(tgUser.id, parsed.data.type);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }

  return c.body(null, 204);
});
