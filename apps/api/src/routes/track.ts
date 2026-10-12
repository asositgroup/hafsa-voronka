import { Hono } from "hono";
import { trackRequestSchema } from "@funnel/shared";
import { db } from "@/db";
import { events } from "@/db/schema";
import { clientIp } from "@/http/clientIp";
import { consumeRateLimit } from "@/http/rateLimit";

export const trackRoutes = new Hono();

trackRoutes.post("/", async (c) => {
  const ip = clientIp(c);
  const allowed = await consumeRateLimit(`track:${ip}`, 30, 60);
  if (!allowed) {
    return c.json({ error: "rate_limited" }, 429);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_body" }, 400);
  }

  const parsed = trackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const data = parsed.data;
  const meta: Record<string, string> = {};
  if (data.utm_source !== undefined) meta.utm_source = data.utm_source;
  if (data.utm_campaign !== undefined) meta.utm_campaign = data.utm_campaign;
  if (data.utm_content !== undefined) meta.utm_content = data.utm_content;
  if (data.fbclid !== undefined) meta.fbclid = data.fbclid;
  if (data.referrer !== undefined) meta.referrer = data.referrer;

  await db().insert(events).values({
    type: data.type,
    visitorId: data.visitor_id,
    userId: null,
    meta,
  });

  return c.body(null, 204);
});
