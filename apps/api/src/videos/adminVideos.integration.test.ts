import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { users, videos } from "@/db/schema";
import { hashPassword } from "@/admin/auth";
import { setR2ForTests, type R2Part, type R2Store } from "@/storage/r2";
import { createTestVideo, ensureActiveTestVideo } from "@/test/videos";

const testDbUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "test-admin-password-2026";
const SESSION_SECRET = "supersecret-session-secret-key-32chars!!";
const PUBLIC_BASE = "https://video.example.com";
const MIB = 1024 * 1024;

describe.skipIf(!testDbUrl)("Admin videos integration", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let token: string;
  let originalActiveId: number;
  const createdIds: number[] = [];
  const deleted: string[] = [];
  const completed: { key: string; uploadId: string; partNumbers: number[] }[] = [];

  const store: R2Store = {
    createMultipart: vi.fn(async () => "upload-1"),
    presignPart: vi.fn(async (key, _id, partNumber) => `https://signed.example.com/${key}?part=${partNumber}`),
    uploadPart: vi.fn(async () => "etag"),
    completeMultipart: vi.fn(async (key: string, uploadId: string, parts: R2Part[]) => {
      completed.push({ key, uploadId, partNumbers: parts.map((part) => part.partNumber) });
    }),
    abortMultipart: vi.fn(async () => {}),
    deleteObject: vi.fn(async (key) => {
      deleted.push(key);
    }),
    publicUrl: (key) => `${PUBLIC_BASE}/${key}`,
  };

  const call = (path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}) => {
    const { json, auth = true, ...rest } = init;
    return app.request(`/admin/videos${path}`, {
      ...rest,
      headers: {
        ...(auth ? { authorization: `Bearer ${token}` } : {}),
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  };

  const post = (path: string, json?: unknown) => call(path, { method: "POST", json });
  const fileUrl = (name: string) => `${PUBLIC_BASE}/videos/test-${name}/main.mp4`;

  async function make(overrides: Partial<typeof videos.$inferInsert> = {}) {
    const video = await createTestVideo({ fileUrl: fileUrl(String(Math.random())), ...overrides });
    createdIds.push(video.id);
    return video;
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      BOT_TOKEN: "123456:TEST-token",
      BOT_USERNAME: "test_bot",
      WEBHOOK_SECRET: "test-secret-0123456789",
      API_URL: "https://api.example.com",
      WEB_URL: "https://example.com",
      DATABASE_URL: testDbUrl,
      CHANNEL_URL: "https://t.me/example",
      VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
      ADMIN_PASSWORD_HASH: await hashPassword(TEST_PASSWORD),
      SESSION_SECRET,
      R2_ACCOUNT_ID: "acc",
      R2_BUCKET: "funnel-video",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_BASE_URL: PUBLIC_BASE,
    });

    await runMigrations(testDbUrl!);
    originalActiveId = (await ensureActiveTestVideo()).id;
    setR2ForTests(store);
    app = (await import("@/app")).createApp();

    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": `203.0.113.${Date.now() % 250}` },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });
    token = ((await login.json()) as { token: string }).token;
  });

  afterAll(async () => {
    setR2ForTests(null);
    await db().update(videos).set({ isActive: false }).where(eq(videos.isActive, true));
    await db().update(videos).set({ isActive: true }).where(eq(videos.id, originalActiveId));
    if (createdIds.length > 0) {
      await db().update(users).set({ videoId: originalActiveId }).where(inArray(users.videoId, createdIds));
      await db().delete(videos).where(inArray(videos.id, createdIds));
    }
    await closeDb();
  });

  it("requires admin auth", async () => {
    expect((await call("", { auth: false })).status).toBe(401);
    expect((await call("/uploads", { method: "POST", auth: false })).status).toBe(401);
  });

  it("creates an inactive video from a public url and rejects foreign urls or zero duration", async () => {
    const created = await post("", { title: "  Yangi dars ", fileUrl: fileUrl("a"), duration: 600 });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { items: { id: number; title: string; isActive: boolean }[]; uploadsEnabled: boolean };
    expect(body.uploadsEnabled).toBe(true);
    const item = body.items.find((video) => video.title === "Yangi dars");
    expect(item?.isActive).toBe(false);
    createdIds.push(item!.id);

    expect((await post("", { title: "x", fileUrl: "https://evil.example.com/a.mp4", duration: 600 })).status).toBe(400);
    expect((await post("", { title: "x", fileUrl: fileUrl("b"), duration: 0 })).status).toBe(400);
    expect((await post("", { title: "", fileUrl: fileUrl("b"), duration: 10 })).status).toBe(400);
  });

  it("validates mark ordering on patch", async () => {
    const video = await make({ duration: 900 });
    const patch = (json: unknown) => call(`/${video.id}`, { method: "PATCH", json });

    expect(await (await patch({ priceSec: 900 })).json()).toEqual({ error: "price_after_duration" });
    expect((await patch({ priceSec: 900 })).status).toBe(422);
    expect(await (await patch({ courseStartSec: 100, priceSec: 100 })).json()).toEqual({ error: "course_after_price" });
    expect(await (await patch({ priceSec: 500, introEndSec: 500 })).json()).toEqual({ error: "intro_after_course" });
    expect(await (await patch({ unlockSec: 900 })).json()).toEqual({ error: "unlock_out_of_range" });
    expect((await patch({ unlockSec: 900 })).status).toBe(422);
    expect((await patch({ unlockSec: 0 })).status).toBe(422);
    expect((await patch({ introEndSec: -1 })).status).toBe(400);
    expect((await patch({ unknown: 1 })).status).toBe(400);

    const ok = await patch({ introEndSec: 20, courseStartSec: 60, priceSec: 500, unlockSec: 300 });
    expect(ok.status).toBe(200);
    const [row] = await db().select().from(videos).where(eq(videos.id, video.id));
    expect([row.introEndSec, row.courseStartSec, row.priceSec, row.unlockSec]).toEqual([20, 60, 500, 300]);

    expect((await patch({ unlockSec: null })).status).toBe(200);
    const [cleared] = await db().select().from(videos).where(eq(videos.id, video.id));
    expect(cleared.unlockSec).toBeNull();

    expect((await call("/999999999", { method: "PATCH", json: { title: "x" } })).status).toBe(404);
  });

  it("refuses to activate without a price", async () => {
    const video = await make();
    const res = await post(`/${video.id}/activate`);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "price_required" });
  });

  it("activates exactly one video and deactivates the previous one", async () => {
    const first = await make({ priceSec: 300 });
    const second = await make({ priceSec: 400 });

    expect((await post(`/${first.id}/activate`)).status).toBe(200);
    expect((await post(`/${first.id}/activate`)).status).toBe(200);
    expect((await post(`/${second.id}/activate`)).status).toBe(200);

    const active = await db().select().from(videos).where(eq(videos.isActive, true));
    expect(active.map((video) => video.id)).toEqual([second.id]);
  });

  it("returns 409 for archived activation and for archiving the active video", async () => {
    const archived = await make({ priceSec: 300, archivedAt: new Date() });
    expect((await post(`/${archived.id}/activate`)).status).toBe(409);

    const active = await make({ priceSec: 300 });
    await post(`/${active.id}/activate`);
    const res = await post(`/${active.id}/archive`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "video_active" });

    const idle = await make();
    expect((await post(`/${idle.id}/archive`)).status).toBe(200);
    expect((await post(`/${idle.id}/unarchive`)).status).toBe(200);
    const [row] = await db().select().from(videos).where(eq(videos.id, idle.id));
    expect(row.archivedAt).toBeNull();
  });

  it("refuses to delete a video that has users and deletes an unused one with its files", async () => {
    const used = await make();
    await db()
      .insert(users)
      .values([
        { telegramId: Date.now() * 10 + 1, firstName: "A", videoId: used.id },
        { telegramId: Date.now() * 10 + 2, firstName: "B", videoId: used.id },
      ]);
    const blocked = await call(`/${used.id}`, { method: "DELETE" });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({ error: "video_in_use", userCount: 2 });

    deleted.length = 0;
    const unused = await make({
      fileUrl: fileUrl("gone"),
      shortOfferVideoUrl: `${PUBLIC_BASE}/videos/test-gone/offer.mp4`,
    });
    const res = await call(`/${unused.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await db().select().from(videos).where(eq(videos.id, unused.id))).toHaveLength(0);
    expect(deleted).toEqual(["videos/test-gone/main.mp4", "videos/test-gone/offer.mp4"]);
  });

  it("stores the short clip with its duration and clears both when it is removed", async () => {
    const video = await make();
    const offerUrl = `${PUBLIC_BASE}/videos/test-offer/offer.mp4`;

    const withoutDuration = await call(`/${video.id}`, { method: "PATCH", json: { shortOfferVideoUrl: offerUrl } });
    expect(withoutDuration.status).toBe(400);

    const added = await call(`/${video.id}`, {
      method: "PATCH",
      json: { shortOfferVideoUrl: offerUrl, shortOfferDuration: 75 },
    });
    expect(added.status).toBe(200);
    const [stored] = await db().select().from(videos).where(eq(videos.id, video.id));
    expect(stored).toMatchObject({ shortOfferVideoUrl: offerUrl, shortOfferDuration: 75 });

    deleted.length = 0;
    const removed = await call(`/${video.id}`, { method: "PATCH", json: { shortOfferVideoUrl: null } });
    expect(removed.status).toBe(200);
    const [cleared] = await db().select().from(videos).where(eq(videos.id, video.id));
    expect(cleared).toMatchObject({ shortOfferVideoUrl: null, shortOfferDuration: null });
    expect(deleted).toEqual(["videos/test-offer/offer.mp4"]);
  });

  it("lists user counts", async () => {
    const video = await make();
    await db().insert(users).values({ telegramId: Date.now() * 10 + 3, firstName: "C", videoId: video.id });
    const body = (await (await call("")).json()) as { items: { id: number; userCount: number }[] };
    expect(body.items.find((item) => item.id === video.id)?.userCount).toBe(1);
  });

  it("presigns one url per 16 MiB part and completes uploads under the public base", async () => {
    const start = await post("/uploads", { kind: "main", size: 40 * MIB });
    expect(start.status).toBe(200);
    const started = (await start.json()) as { key: string; uploadId: string; partSize: number; parts: { partNumber: number }[] };
    expect(started.parts.map((part) => part.partNumber)).toEqual([1, 2, 3]);
    expect(started.partSize).toBe(16 * MIB);
    expect(started.key).toMatch(/^videos\/[0-9a-f-]{36}\/main\.mp4$/);

    const done = await post("/uploads/complete", {
      key: started.key,
      uploadId: started.uploadId,
      parts: [
        { partNumber: 3, etag: "c" },
        { partNumber: 1, etag: "a" },
        { partNumber: 2, etag: "b" },
      ],
    });
    expect(done.status).toBe(200);
    expect(await done.json()).toEqual({ fileUrl: `${PUBLIC_BASE}/${started.key}` });
    expect(completed.at(-1)?.key).toBe(started.key);

    expect((await post("/uploads", { kind: "other", size: 10 })).status).toBe(400);
    expect((await post("/uploads", { kind: "main", size: 0 })).status).toBe(400);
  });

  it("rejects keys outside the browser upload namespace on complete and abort", async () => {
    const parts = [{ partNumber: 1, etag: "a" }];
    expect((await post("/uploads/complete", { key: "videos/bot/x.mp4", uploadId: "u", parts })).status).toBe(400);
    expect((await post("/uploads/abort", { key: "../x", uploadId: "u" })).status).toBe(400);
    expect(
      (await post("/uploads/abort", { key: "videos/00000000-0000-0000-0000-000000000000/main.mp4", uploadId: "u" })).status,
    ).toBe(200);
  });

  it("returns 503 for uploads when R2 is not configured", async () => {
    setR2ForTests(null);
    const saved = Object.fromEntries(
      ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"].map((name) => [name, process.env[name]]),
    );
    vi.resetModules();
    for (const name of Object.keys(saved)) delete process.env[name];
    const freshApp = (await import("@/app")).createApp();
    const res = await freshApp.request("/admin/videos/uploads", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ kind: "main", size: 10 }),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "uploads_not_configured" });
    Object.assign(process.env, saved);
  });
});
