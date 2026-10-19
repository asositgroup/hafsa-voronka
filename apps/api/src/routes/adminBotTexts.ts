import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  BOT_MEDIA_LIMITS,
  botMediaTypeFor,
  botTextDefinitions,
  botTextKeySchema,
  botTextUpdateSchema,
  validateBotText,
} from "@funnel/shared";
import { requireAdminAuth } from "@/admin/auth";
import { bot } from "@/telegram/bot";
import { MediaChatUnavailableError, botMediaChat, downloadBotMedia } from "@/telegram/media";
import {
  clearBotMedia,
  defaultBotTexts,
  findBotText,
  listBotTexts,
  resetBotText,
  saveBotText,
  uploadBotMedia,
} from "@/telegram/texts";

export const adminBotTextRoutes = new Hono();

adminBotTextRoutes.use("*", requireAdminAuth);

function parseKey(raw: string) {
  const parsed = botTextKeySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

adminBotTextRoutes.get("/", async (c) => {
  return c.json({ items: await listBotTexts(), mediaEnabled: botMediaChat() !== null });
});

adminBotTextRoutes.put("/:key", async (c) => {
  const key = parseKey(c.req.param("key"));
  if (!key) return c.json({ error: "not_found" }, 404);

  const body = botTextUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);

  const hasMedia = Boolean((await findBotText(key))?.mediaFileId);
  const error = validateBotText(key, body.data.text, hasMedia);
  if (error) return c.json({ error }, 422);

  await saveBotText(key, body.data.text);
  return c.json({ items: await listBotTexts() });
});

adminBotTextRoutes.delete("/:key", async (c) => {
  const key = parseKey(c.req.param("key"));
  if (!key) return c.json({ error: "not_found" }, 404);
  await resetBotText(key);
  return c.json({ items: await listBotTexts() });
});

adminBotTextRoutes.post(
  "/:key/media",
  bodyLimit({ maxSize: BOT_MEDIA_LIMITS.video + 1024 * 1024, onError: (c) => c.json({ error: "too_large" }, 413) }),
  async (c) => {
    const key = parseKey(c.req.param("key"));
    if (!key || botTextDefinitions[key].kind !== "message") return c.json({ error: "not_found" }, 404);
    if (!botMediaChat()) return c.json({ error: "media_not_configured" }, 503);

    const form = await c.req.parseBody().catch(() => null);
    const file = form?.file;
    if (!(file instanceof File)) return c.json({ error: "invalid_request" }, 400);

    const type = botMediaTypeFor(file.type);
    if (!type) return c.json({ error: "unsupported_type" }, 415);
    if (file.size > BOT_MEDIA_LIMITS[type]) return c.json({ error: "too_large" }, 413);

    const current = (await findBotText(key))?.text ?? defaultBotTexts[key];
    if (validateBotText(key, current, true) === "too_long") return c.json({ error: "caption_too_long" }, 422);

    try {
      await uploadBotMedia(bot().api, key, type, file);
    } catch (error) {
      if (error instanceof MediaChatUnavailableError) return c.json({ error: "media_chat_unavailable" }, 503);
      throw error;
    }
    return c.json({ items: await listBotTexts() });
  },
);

adminBotTextRoutes.delete("/:key/media", async (c) => {
  const key = parseKey(c.req.param("key"));
  if (!key) return c.json({ error: "not_found" }, 404);
  await clearBotMedia(key);
  return c.json({ items: await listBotTexts() });
});

adminBotTextRoutes.get("/:key/media", async (c) => {
  const key = parseKey(c.req.param("key"));
  const row = key ? await findBotText(key) : undefined;
  if (!row?.mediaFileId || !row.mediaType) return c.json({ error: "not_found" }, 404);

  const upstream = await downloadBotMedia(bot().api, row.mediaFileId).catch(() => null);
  if (!upstream?.ok || !upstream.body) return c.json({ error: "not_found" }, 404);

  return new Response(upstream.body, {
    headers: {
      "content-type": row.mediaType === "photo" ? "image/jpeg" : "video/mp4",
      "cache-control": "private, max-age=300",
    },
  });
});
