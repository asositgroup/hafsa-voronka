import { eq, inArray } from "drizzle-orm";
import { GrammyError } from "grammy";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  activeSchema,
  funnelSegments,
  messageTemplateBaseSchema,
  type MessageTemplateInput,
  reorderSchema,
  SAMPLE_CONTEXT,
  type SchedulePreview,
  schedulePreviewRequestSchema,
  TEMPLATE_MEDIA_LIMITS,
  templateMediaTypeFor,
  testSendSchema,
  validateTemplateInput,
  variableValues,
} from "@funnel/shared";
import { requireAdminAuth } from "@/admin/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/env";
import { templateContextFor } from "@/messages/context";
import { renderTemplate } from "@/messages/render";
import { linkExpiryFor, previewChain, segmentChainInput } from "@/messages/plan";
import {
  activeTemplateRows,
  createTemplate,
  findTemplate,
  isNightNoticeConflict,
  listTemplates,
  reorder,
  setActive,
  softDelete,
  StaleOrderError,
  updateTemplate,
} from "@/messages/repo";
import { sendRendered } from "@/messages/send";
import { linkTtlHours } from "@/settings/service";
import { isAdminTelegramId } from "@/telegram/admins";
import { bot } from "@/telegram/bot";
import { botMediaChat, downloadBotMedia, uploadToMediaChat } from "@/telegram/media";

export const adminMessageRoutes = new Hono();

adminMessageRoutes.use("*", requireAdminAuth);

const mediaContentTypes = { photo: "image/jpeg", video: "video/mp4", voice: "audio/ogg" } as const;
const PREFILL_CHANNEL_PATTERN = /^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{4,31}\/?$/;
const MAX_UPLOAD_BYTES = Math.max(...Object.values(TEMPLATE_MEDIA_LIMITS)) + 1024 * 1024;

async function adminOptions() {
  const ids = [...env.ADMIN_TELEGRAM_IDS];
  const rows = ids.length > 0 ? await db().select().from(users).where(inArray(users.telegramId, ids)) : [];
  const byTelegramId = new Map(rows.map((row) => [row.telegramId, row]));
  return ids.map((telegramId) => {
    const row = byTelegramId.get(telegramId);
    const label = row?.name || row?.firstName || (row?.username ? `@${row.username}` : "") || String(telegramId);
    return { telegramId, label };
  });
}

function invalidInput(input: MessageTemplateInput) {
  const issue = validateTemplateInput(input);
  if (!issue) return null;
  return issue.path === "text" ? { error: issue.error, variable: issue.variable } : { error: issue.error };
}

function remainingAt(now: Date, linkExpiresAt: Date) {
  return variableValues({ name: null, firstName: null, lastPositionSec: 0, durationSec: null, linkExpiresAt, now });
}

async function saveTemplate<T>(save: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await save() };
  } catch (error) {
    if (isNightNoticeConflict(error)) return { ok: false };
    throw error;
  }
}

adminMessageRoutes.get("/", async (c) => {
  const segment = funnelSegments.find((value) => value === c.req.query("segment"));
  if (!segment) return c.json({ error: "invalid_request" }, 400);
  return c.json({
    items: await listTemplates(segment),
    admins: await adminOptions(),
    mediaEnabled: botMediaChat() !== null,
    prefillSupported: PREFILL_CHANNEL_PATTERN.test(env.CHANNEL_URL),
  });
});

adminMessageRoutes.post("/", async (c) => {
  const body = messageTemplateBaseSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);
  const invalid = invalidInput(body.data);
  if (invalid) return c.json(invalid, 422);
  const created = await saveTemplate(() => createTemplate(body.data));
  return created.ok ? c.json(created.value, 201) : c.json({ error: "night_notice_exists" }, 409);
});

adminMessageRoutes.post("/preview-schedule", async (c) => {
  const body = schedulePreviewRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);
  const givenAt = new Date(body.data.linkGivenAt);
  const ttlHours = await linkTtlHours();
  const linkExpiresAt = linkExpiryFor(givenAt, ttlHours);
  const preview = previewChain(
    segmentChainInput(await activeTemplateRows(body.data.segment), {
      segment: body.data.segment,
      anchorAt: givenAt,
      linkExpiresAt,
    }),
  );
  const items: SchedulePreview["items"] = [
    ...preview.items.map((item) => {
      const values = remainingAt(item.sendAt, linkExpiresAt);
      return {
        templateId: item.template.id,
        at: item.sendAt.toISOString(),
        kind: item.kind,
        remaining: item.kind === "night_notice" ? values.link_tugash_soati : values.qolgan_vaqt,
      };
    }),
    ...preview.skipped.map((item) => ({
      templateId: item.template.id,
      at: item.rawAt.toISOString(),
      kind: item.reason,
      remaining: remainingAt(item.rawAt, linkExpiresAt).qolgan_vaqt,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return c.json({
    linkGivenAt: givenAt.toISOString(),
    linkExpiresAt: linkExpiresAt.toISOString(),
    extended: linkExpiresAt.getTime() !== givenAt.getTime() + ttlHours * 3_600_000,
    items,
  } satisfies SchedulePreview);
});

adminMessageRoutes.put("/order", async (c) => {
  const body = reorderSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);
  try {
    await reorder(body.data.segment, body.data.day, body.data.ids);
  } catch (error) {
    if (error instanceof StaleOrderError) return c.json({ error: "stale_order" }, 409);
    throw error;
  }
  return c.json({ items: await listTemplates(body.data.segment) });
});

adminMessageRoutes.post(
  "/media",
  bodyLimit({ maxSize: MAX_UPLOAD_BYTES, onError: (c) => c.json({ error: "too_large" }, 413) }),
  async (c) => {
    if (!botMediaChat()) return c.json({ error: "media_not_configured" }, 503);

    const form = await c.req.parseBody().catch(() => null);
    const file = form?.file;
    if (!(file instanceof File)) return c.json({ error: "invalid_request" }, 400);

    const type = templateMediaTypeFor(file.type);
    if (!type) return c.json({ error: "unsupported_type" }, 415);
    if (file.size > TEMPLATE_MEDIA_LIMITS[type]) return c.json({ error: "too_large" }, 413);

    return c.json({ type, fileId: await uploadToMediaChat(bot().api, type, file) });
  },
);

adminMessageRoutes.post("/test", async (c) => {
  const body = testSendSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);
  const { draft, adminTelegramId, templateId } = body.data;
  if (!isAdminTelegramId(adminTelegramId)) return c.json({ error: "forbidden" }, 403);
  const invalid = invalidInput(draft);
  if (invalid) return c.json(invalid, 422);

  const [admin] = await db().select({ id: users.id }).from(users).where(eq(users.telegramId, adminTelegramId));
  const context = (admin && (await templateContextFor(admin.id, new Date()))) || SAMPLE_CONTEXT;
  const rendered = renderTemplate(draft, context, { ref: `t${templateId ?? 0}` });

  try {
    await sendRendered(bot().api, adminTelegramId, rendered);
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 403) return c.json({ error: "admin_not_started" }, 409);
    console.error("Test message failed:", error);
    return c.json({ error: "telegram_error" }, 502);
  }
  return c.json({ ok: true });
});

adminMessageRoutes.put("/:id{[0-9]+}", async (c) => {
  const body = messageTemplateBaseSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);
  const invalid = invalidInput(body.data);
  if (invalid) return c.json(invalid, 422);
  const updated = await saveTemplate(() => updateTemplate(Number(c.req.param("id")), body.data));
  if (!updated.ok) return c.json({ error: "night_notice_exists" }, 409);
  return updated.value ? c.json(updated.value) : c.json({ error: "not_found" }, 404);
});

adminMessageRoutes.patch("/:id{[0-9]+}/active", async (c) => {
  const body = activeSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);
  const updated = await setActive(Number(c.req.param("id")), body.data.isActive);
  return updated ? c.json(updated) : c.json({ error: "not_found" }, 404);
});

adminMessageRoutes.delete("/:id{[0-9]+}", async (c) => {
  return (await softDelete(Number(c.req.param("id")))) ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
});

adminMessageRoutes.get("/:id{[0-9]+}/media", async (c) => {
  const template = await findTemplate(Number(c.req.param("id")));
  if (!template?.media) return c.json({ error: "not_found" }, 404);

  const upstream = await downloadBotMedia(bot().api, template.media.fileId).catch(() => null);
  if (!upstream?.ok || !upstream.body) return c.json({ error: "not_found" }, 404);

  return new Response(upstream.body, {
    headers: {
      "content-type": mediaContentTypes[template.media.type],
      "cache-control": "private, max-age=300",
    },
  });
});
