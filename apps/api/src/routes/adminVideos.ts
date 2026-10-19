import { Hono, type Context } from "hono";
import {
  type UploadStartResponse,
  uploadAbortRequestSchema,
  uploadCompleteRequestSchema,
  uploadStartRequestSchema,
  videoCreateSchema,
  videoUpdateSchema,
  VIDEO_PART_SIZE,
} from "@funnel/shared";
import { requireAdminAuth } from "@/admin/auth";
import { isBrowserUploadKey, newVideoKey, r2 } from "@/storage/r2";
import {
  activateVideo,
  archiveVideo,
  createVideo,
  deleteVideo,
  listAdminVideos,
  unarchiveVideo,
  updateVideo,
  type VideoFailure,
} from "@/videos/adminService";

export const adminVideoRoutes = new Hono();

adminVideoRoutes.use("*", requireAdminAuth);

const MAX_PRESIGNED_PARTS = 256;
const PART_URL_TTL_SEC = 86400;

const conflictCodes = new Set(["archived", "video_active", "video_in_use", "activation_conflict"]);

async function snapshot() {
  return { items: await listAdminVideos(), uploadsEnabled: r2() !== null };
}

function failureResponse(c: Context, failure: VideoFailure) {
  if (failure.code === "not_found") return c.json({ error: "not_found" }, 404);
  if (failure.code === "invalid_file_url") return c.json({ error: "invalid_request" }, 400);
  if (failure.code === "video_in_use") return c.json({ error: failure.code, userCount: failure.userCount }, 409);
  if (conflictCodes.has(failure.code)) return c.json({ error: failure.code }, 409);
  return c.json({ error: failure.code }, 422);
}

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

adminVideoRoutes.get("/", async (c) => c.json(await snapshot()));

adminVideoRoutes.post("/", async (c) => {
  const body = videoCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);

  const result = await createVideo(body.data);
  if (!result.ok) return failureResponse(c, result);
  return c.json(await snapshot(), 201);
});

adminVideoRoutes.post("/uploads", async (c) => {
  const store = r2();
  if (!store) return c.json({ error: "uploads_not_configured" }, 503);

  const body = uploadStartRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);

  const partCount = Math.ceil(body.data.size / VIDEO_PART_SIZE);
  if (partCount > MAX_PRESIGNED_PARTS) return c.json({ error: "invalid_request" }, 400);

  const key = newVideoKey(body.data.kind);
  const uploadId = await store.createMultipart(key, "video/mp4");
  try {
    const parts = await Promise.all(
      Array.from({ length: partCount }, async (_, index) => ({
        partNumber: index + 1,
        url: await store.presignPart(key, uploadId, index + 1, PART_URL_TTL_SEC),
      })),
    );
    const response: UploadStartResponse = { key, uploadId, partSize: VIDEO_PART_SIZE, parts };
    return c.json(response);
  } catch (error) {
    await store.abortMultipart(key, uploadId).catch(() => {});
    throw error;
  }
});

adminVideoRoutes.post("/uploads/complete", async (c) => {
  const store = r2();
  if (!store) return c.json({ error: "uploads_not_configured" }, 503);

  const body = uploadCompleteRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success || !isBrowserUploadKey(body.data.key)) return c.json({ error: "invalid_request" }, 400);

  const parts = [...body.data.parts].sort((a, b) => a.partNumber - b.partNumber);
  await store.completeMultipart(body.data.key, body.data.uploadId, parts);
  return c.json({ fileUrl: store.publicUrl(body.data.key) });
});

adminVideoRoutes.post("/uploads/abort", async (c) => {
  const store = r2();
  if (!store) return c.json({ error: "uploads_not_configured" }, 503);

  const body = uploadAbortRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success || !isBrowserUploadKey(body.data.key)) return c.json({ error: "invalid_request" }, 400);

  await store.abortMultipart(body.data.key, body.data.uploadId);
  return c.json({ ok: true });
});

adminVideoRoutes.patch("/:id{[0-9]+}", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return c.json({ error: "not_found" }, 404);

  const body = videoUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);

  const result = await updateVideo(id, body.data);
  if (!result.ok) return failureResponse(c, result);
  return c.json(await snapshot());
});

for (const [action, run] of [
  ["activate", activateVideo],
  ["archive", archiveVideo],
  ["unarchive", unarchiveVideo],
] as const) {
  adminVideoRoutes.post(`/:id{[0-9]+}/${action}`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null) return c.json({ error: "not_found" }, 404);

    const result = await run(id);
    if (!result.ok) return failureResponse(c, result);
    return c.json(await snapshot());
  });
}

adminVideoRoutes.delete("/:id{[0-9]+}", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return c.json({ error: "not_found" }, 404);

  const result = await deleteVideo(id);
  if (!result.ok) return failureResponse(c, result);
  return c.json(await snapshot());
});
