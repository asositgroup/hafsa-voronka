import { Hono } from "hono";
import { adminSettingsUpdateSchema } from "@funnel/shared";
import { requireAdminAuth } from "@/admin/auth";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { invalidateSettings, linkTtlHours } from "@/settings/service";

export const adminSettingsRoutes = new Hono();

adminSettingsRoutes.use("*", requireAdminAuth);

adminSettingsRoutes.get("/", async (c) => {
  return c.json({ linkTtlHours: await linkTtlHours() });
});

adminSettingsRoutes.put("/", async (c) => {
  const body = adminSettingsUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);

  const value = String(body.data.linkTtlHours);
  await db()
    .insert(settings)
    .values({ key: "LINK_TTL_HOURS", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  invalidateSettings();

  return c.json({ linkTtlHours: await linkTtlHours() });
});
