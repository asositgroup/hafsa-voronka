import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { events, users, watchProgress } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { signInitData } from "@/telegram/initData";
import { recordProgress, recordVideoEvent } from "./service";

const testDbUrl = process.env.TEST_DATABASE_URL;
const BOT_TOKEN = "123456:TEST-token";

describe.skipIf(!testDbUrl)("Video Integration Tests", () => {
  let createApp: typeof import("@/app").createApp;

  beforeAll(async () => {
    Object.assign(process.env, {
      BOT_TOKEN,
      BOT_USERNAME: "test_bot",
      WEBHOOK_SECRET: "test-secret-0123456789",
      API_URL: "https://api.example.com",
      WEB_URL: "https://example.com",
      DATABASE_URL: testDbUrl,
      CHANNEL_URL: "https://t.me/example",
      VIDEO_URL: "https://video.example.com/master.mp4",
      VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
      VIDEO_DURATION_SEC: "100",
      COMPLETE_THRESHOLD: "0.95",
    });

    await runMigrations(testDbUrl!);
    const appModule = await import("@/app");
    createApp = appModule.createApp;
  });

  afterAll(async () => {
    await closeDb();
  });

  function makeAuthHeader(userId: number) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: userId, first_name: "TestUser" }),
    });
    params.set("hash", signInitData(params, BOT_TOKEN));
    return `tma ${params.toString()}`;
  }

  function makeInitData(userId: number) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: userId, first_name: "TestUser" }),
    });
    params.set("hash", signInitData(params, BOT_TOKEN));
    return params.toString();
  }

  async function createRegisteredUser(telegramId: number) {
    const [user] = await db()
      .insert(users)
      .values({
        telegramId,
        firstName: "TestUser",
        name: "Test User",
        phone: "+998901234567",
        phoneVerified: true,
        registeredAt: new Date(),
      })
      .returning();
    return user;
  }

  it("handles a full playthrough via simulated beats with controlled time and logs milestones", async () => {
    const telegramId = Math.floor(Math.random() * 1000000) + 100000;
    const user = await createRegisteredUser(telegramId);

    const startTime = new Date(1700000000000);
    const playRes = await recordProgress(
      telegramId,
      { position: 0, event: "play" },
      startTime,
      { duration: 100, threshold: 0.95 },
    );
    expect(playRes.ok).toBe(true);
    if (!playRes.ok) return;
    expect(playRes.completed).toBe(false);
    expect(playRes.maxPosition).toBe(0);

    const [rowAfterPlay] = await db()
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.userId, user.id));
    expect(rowAfterPlay.startedAt).toEqual(startTime);

    for (let sec = 10; sec <= 90; sec += 10) {
      const beatTime = new Date(startTime.getTime() + sec * 1000);
      const res = await recordProgress(
        telegramId,
        { position: sec, event: "tick" },
        beatTime,
        { duration: 100, threshold: 0.95 },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.completed).toBe(false);
      expect(res.maxPosition).toBe(sec);
    }

    const midEvents = await db()
      .select()
      .from(events)
      .where(eq(events.userId, user.id));
    const milestoneTypes = midEvents.map((e) => e.type);
    expect(milestoneTypes).toContain("progress_25");
    expect(milestoneTypes).toContain("progress_50");
    expect(milestoneTypes).toContain("progress_75");

    const completeTime = new Date(startTime.getTime() + 100000);
    const completeRes = await recordProgress(
      telegramId,
      { position: 100, event: "tick" },
      completeTime,
      { duration: 100, threshold: 0.95 },
    );
    expect(completeRes.ok).toBe(true);
    if (!completeRes.ok) return;
    expect(completeRes.completed).toBe(true);

    const [userAfterComplete] = await db()
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(userAfterComplete.completedAt).toEqual(completeTime);

    const allEvents = await db()
      .select()
      .from(events)
      .where(eq(events.userId, user.id));
    const completeEvents = allEvents.filter((e) => e.type === "video_complete");
    expect(completeEvents.length).toBe(1);
  });

  it("sets completed_at exactly once even with subsequent beats", async () => {
    const telegramId = Math.floor(Math.random() * 1000000) + 200000;
    const user = await createRegisteredUser(telegramId);

    const t0 = new Date(1700000000000);
    await recordProgress(telegramId, { position: 0, event: "play" }, t0, {
      duration: 100,
      threshold: 0.95,
    });

    const t1 = new Date(t0.getTime() + 96000);
    await recordProgress(telegramId, { position: 96, event: "tick" }, t1, {
      duration: 100,
      threshold: 0.95,
    });

    const [user1] = await db().select().from(users).where(eq(users.id, user.id));
    expect(user1.completedAt).toEqual(t1);

    const t2 = new Date(t0.getTime() + 150000);
    const repeatRes = await recordProgress(
      telegramId,
      { position: 100, event: "ended" },
      t2,
      { duration: 100, threshold: 0.95 },
    );
    expect(repeatRes.ok).toBe(true);
    if (!repeatRes.ok) return;
    expect(repeatRes.completed).toBe(true);

    const [user2] = await db().select().from(users).where(eq(users.id, user.id));
    expect(user2.completedAt).toEqual(t1);

    const completeEvents = (
      await db().select().from(events).where(eq(events.userId, user.id))
    ).filter((e) => e.type === "video_complete");
    expect(completeEvents.length).toBe(1);
  });

  it("does not double-credit on concurrent duplicate beats", async () => {
    const telegramId = Math.floor(Math.random() * 1000000) + 300000;
    const user = await createRegisteredUser(telegramId);

    const t0 = new Date(1700000000000);
    await recordProgress(telegramId, { position: 0, event: "play" }, t0, {
      duration: 100,
      threshold: 0.95,
    });

    const t1 = new Date(t0.getTime() + 10000);
    const beat = { position: 10, event: "tick" as const };
    const config = { duration: 100, threshold: 0.95 };

    const promises = Array.from({ length: 5 }, () =>
      recordProgress(telegramId, beat, t1, config),
    );
    const results = await Promise.all(promises);
    expect(results.every((r) => r.ok)).toBe(true);

    const [progress] = await db()
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.userId, user.id));
    expect(progress.watchedSecs).toBeCloseTo(10);
    expect(progress.maxPosition).toBeCloseTo(10);
  });

  it("sets channel_click_at exactly once", async () => {
    const telegramId = Math.floor(Math.random() * 1000000) + 400000;
    const user = await createRegisteredUser(telegramId);

    const t1 = new Date(1700000000000);
    const res1 = await recordVideoEvent(telegramId, "channel_click", t1);
    expect(res1.ok).toBe(true);

    const [user1] = await db().select().from(users).where(eq(users.id, user.id));
    expect(user1.channelClickAt).toEqual(t1);

    const t2 = new Date(1700001000000);
    const res2 = await recordVideoEvent(telegramId, "channel_click", t2);
    expect(res2.ok).toBe(true);

    const [user2] = await db().select().from(users).where(eq(users.id, user.id));
    expect(user2.channelClickAt).toEqual(t1);

    const clickEvents = (
      await db().select().from(events).where(eq(events.userId, user.id))
    ).filter((e) => e.type === "channel_click");
    expect(clickEvents.length).toBe(2);
  });

  it("returns 404 for an unregistered user", async () => {
    const app = createApp();
    const unregisteredTelegramId = Math.floor(Math.random() * 1000000) + 500000;

    const res = await app.request("/app/progress", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(unregisteredTelegramId),
        "content-type": "application/json",
      },
      body: JSON.stringify({ position: 10, event: "tick" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("not_registered");
  });

  it("returns 404 for a user who exists in DB but registeredAt is null", async () => {
    const app = createApp();
    const incompleteUserId = Math.floor(Math.random() * 1000000) + 600000;

    await db().insert(users).values({
      telegramId: incompleteUserId,
      firstName: "Incomplete",
      registeredAt: null,
    });

    const res = await app.request("/app/progress", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(incompleteUserId),
        "content-type": "application/json",
      },
      body: JSON.stringify({ position: 10, event: "tick" }),
    });

    expect(res.status).toBe(404);
  });

  it("handles beacon body with text/plain content type", async () => {
    const app = createApp();
    const telegramId = Math.floor(Math.random() * 1000000) + 700000;
    await createRegisteredUser(telegramId);

    const res = await app.request("/app/event", {
      method: "POST",
      headers: {
        "content-type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify({
        initData: makeInitData(telegramId),
        type: "video_start",
      }),
    });

    expect(res.status).toBe(204);

    const [user] = await db().select().from(users).where(eq(users.telegramId, telegramId));
    const startEvents = (
      await db().select().from(events).where(eq(events.userId, user.id))
    ).filter((e) => e.type === "video_start");
    expect(startEvents.length).toBe(1);
  });
});
