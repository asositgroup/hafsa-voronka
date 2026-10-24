import { Hono } from "hono";
import { adminSettingsUpdateSchema, type AdminSettings } from "@funnel/shared";
import { requireAdminAuth } from "@/admin/auth";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { chatCleanupHours, invalidateSettings, linkTtlHours, messageCaps } from "@/settings/service";

export const adminSettingsRoutes = new Hono();

adminSettingsRoutes.use("*", requireAdminAuth);

async function currentSettings(): Promise<AdminSettings> {
  return {
    linkTtlHours: await linkTtlHours(),
    messageCaps: await messageCaps(),
    chatCleanupHours: await chatCleanupHours(),
  };
}

adminSettingsRoutes.get("/", async (c) => {
  return c.json(await currentSettings());
});

adminSettingsRoutes.put("/", async (c) => {
  const body = adminSettingsUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);

  const values = [
    ...(body.data.linkTtlHours === undefined ? [] : [{ key: "LINK_TTL_HOURS", value: String(body.data.linkTtlHours) }]),
    ...(body.data.messageCaps === undefined ? [] : [{ key: "MESSAGE_CAPS", value: JSON.stringify(body.data.messageCaps) }]),
    ...(body.data.chatCleanupHours === undefined ? [] : [{ key: "CHAT_CLEANUP_HOURS", value: String(body.data.chatCleanupHours) }]),
  ];
  await db().transaction(async (tx) => {
    for (const row of values) {
      await tx
        .insert(settings)
        .values(row)
        .onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: new Date() } });
    }
  });
  invalidateSettings();

  return c.json(await currentSettings());
});
