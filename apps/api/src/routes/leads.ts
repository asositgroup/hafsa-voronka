import { Hono } from "hono";
import { leadRequestSchema, type LeadResponse } from "@funnel/shared";
import { capiClient, clientIp } from "@/http/clientIp";
import { consumeRateLimit } from "@/http/rateLimit";
import { uz } from "@/i18n/uz";
import { leadEventId, submitWebLead } from "@/leads/service";

export const leadRoutes = new Hono();

export const LEAD_LIMIT_PER_IP = 10;
export const LEAD_LIMIT_PER_VISITOR = 5;
const LEAD_WINDOW_SECS = 600;

leadRoutes.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_body" }, 400);
  }

  const parsed = leadRequestSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") return c.json({ field, message: uz.validation.nameRequired }, 422);
    if (field === "phone") return c.json({ field, message: uz.validation.phoneRequired }, 422);
    return c.json({ error: "invalid_body" }, 400);
  }

  if (parsed.data.website) {
    return c.json({ ok: true, event_id: "lead_0" } satisfies LeadResponse);
  }

  const withinLimits =
    (await consumeRateLimit(`lead:ip:${clientIp(c)}`, LEAD_LIMIT_PER_IP, LEAD_WINDOW_SECS)) &&
    (await consumeRateLimit(`lead:visitor:${parsed.data.visitor_id}`, LEAD_LIMIT_PER_VISITOR, LEAD_WINDOW_SECS));
  if (!withinLimits) {
    return c.json({ error: "rate_limited" }, 429);
  }

  const result = await submitWebLead(parsed.data, capiClient(c));
  if (!result.ok) {
    return c.json({ field: result.field, message: result.message }, 422);
  }
  return c.json({ ok: true, event_id: leadEventId(result.lead) } satisfies LeadResponse);
});
