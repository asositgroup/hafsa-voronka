import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { sessionResponseSchema } from "@funnel/shared";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { events, linkGrants, segmentRuns, users } from "@/db/schema";
import { signInitData } from "@/telegram/initData";
import { isolatedDatabase } from "@/test/isolatedDb";
import { setTestEnv, TEST_BOT_TOKEN } from "@/test/env";
import { createTestVideo } from "@/test/videos";

const isolatedDb = isolatedDatabase("vf_offer_video");
const START = new Date(1_800_000_000_000);
const after = (secs: number) => new Date(START.getTime() + secs * 1000);
const SHORT_URL = "https://video.example.com/videos/offer/offer.mp4";

describe.skipIf(!isolatedDb.url)("Short course video on a second chance", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let recordOfferProgress: typeof import("./service").recordOfferProgress;
  let recordProgress: typeof import("./service").recordProgress;
  let syncSegment: typeof import("@/funnel/segments").syncSegment;
  let telegramSeq = 80_000;

  beforeAll(async () => {
    await isolatedDb.create();
    setTestEnv({ DATABASE_URL: isolatedDb.url!, SESSION_SECRET: "offer-video-session-secret-0123456789" });
    await runMigrations(isolatedDb.url!);
    ({ recordOfferProgress, recordProgress } = await import("./service"));
    ({ syncSegment } = await import("@/funnel/segments"));
    app = (await import("@/app")).createApp();
  });

  afterAll(async () => {
    await closeDb();
    await isolatedDb.drop();
  });

  async function userWith(options: {
    video: Parameters<typeof createTestVideo>[0];
    offerFirst: boolean;
  }) {
    const video = await createTestVideo({ duration: 1000, courseStartSec: 300, priceSec: 800, ...options.video });
    const [user] = await db()
      .insert(users)
      .values({
        telegramId: ++telegramSeq,
        firstName: "Ali",
        registeredAt: START,
        linkGivenAt: START,
        linkExpiresAt: after(86_400),
        videoId: video.id,
      })
      .returning();
    const [grant] = await db()
      .insert(linkGrants)
      .values({
        userId: user.id,
        attempt: 1,
        day: 1,
        kind: options.offerFirst ? "again" : "initial",
        offerFirst: options.offerFirst,
        givenAt: START,
        expiresAt: after(86_400),
      })
      .returning();
    await db().update(users).set({ linkId: grant.id }).where(eq(users.id, user.id));
    await recordProgress(user.telegramId, { position: 0, event: "play" }, START);
    await recordProgress(user.telegramId, { position: 120, event: "pause" }, after(120));
    await syncSegment(user.id, after(120));
    return { user, video };
  }

  const shortClip = { shortOfferVideoUrl: SHORT_URL, shortOfferDuration: 100 };

  function auth(telegramId: number) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: telegramId, first_name: "Ali" }),
    });
    params.set("hash", signInitData(params, TEST_BOT_TOKEN));
    return `tma ${params.toString()}`;
  }

  async function session(telegramId: number) {
    const res = await app.request("/app/session", {
      method: "POST",
      headers: { authorization: auth(telegramId), "content-type": "application/json" },
      body: JSON.stringify({ reason: "poll" }),
    });
    expect(res.status).toBe(200);
    return sessionResponseSchema.parse(await res.json());
  }

  async function openRuns(userId: number) {
    return db()
      .select()
      .from(segmentRuns)
      .where(and(eq(segmentRuns.userId, userId), isNull(segmentRuns.endedAt)));
  }

  async function reload(userId: number) {
    const [row] = await db().select().from(users).where(eq(users.id, userId));
    return row;
  }

  it("returns the short clip in the session for an offer-first grant", async () => {
    const { user, video } = await userWith({ video: shortClip, offerFirst: true });
    const body = await session(user.telegramId);

    expect(body.offerFirst).toEqual({ url: SHORT_URL, duration: 100 });
    expect(body.videoId).toBe(video.id);
    expect(body.startsAtCourse).toBe(false);
    expect(body.startAt).toBe(120);
    expect(body.config.videoUrl).toBe(video.fileUrl);
  });

  it("does not return the clip for a regular grant", async () => {
    const { user } = await userWith({ video: shortClip, offerFirst: false });
    const body = await session(user.telegramId);

    expect(body.offerFirst).toBeNull();
    expect(body.startsAtCourse).toBe(false);
    expect(body.startAt).toBe(120);
  });

  it("starts at the course start when the video has no clip", async () => {
    const { user } = await userWith({ video: {}, offerFirst: true });
    const body = await session(user.telegramId);

    expect(body.offerFirst).toBeNull();
    expect(body.startsAtCourse).toBe(true);
    expect(body.startAt).toBe(300);
  });

  it("moves the user to segment C when the clip is watched", async () => {
    const { user } = await userWith({ video: shortClip, offerFirst: true });
    expect((await openRuns(user.id)).map((run) => run.segment)).toEqual(["B"]);

    await recordOfferProgress(user.telegramId, { position: 0, event: "play" }, after(200));
    const midway = await recordOfferProgress(user.telegramId, { position: 50, event: "tick" }, after(250));
    expect(midway).toEqual({ ok: true, completed: false });
    expect((await reload(user.id)).offerWatchedAt).toBeNull();

    const done = await recordOfferProgress(user.telegramId, { position: 100, event: "ended" }, after(300));
    expect(done).toEqual({ ok: true, completed: true });

    const row = await reload(user.id);
    expect(row.offerWatchedAt).toEqual(after(300));
    expect(row.unlockedAt).toEqual(after(300));
    expect((await openRuns(user.id)).map((run) => run.segment)).toEqual(["C"]);
    const logged = await db()
      .select()
      .from(events)
      .where(and(eq(events.userId, user.id), eq(events.type, "offer_video_complete")));
    expect(logged).toHaveLength(1);

    const body = await session(user.telegramId);
    expect(body.offerFirst).toBeNull();
    expect(body.startAt).toBe(120);
  });

  it("counts a completion only once", async () => {
    const { user } = await userWith({ video: shortClip, offerFirst: true });
    await recordOfferProgress(user.telegramId, { position: 0, event: "play" }, after(200));
    await recordOfferProgress(user.telegramId, { position: 100, event: "ended" }, after(300));
    await recordOfferProgress(user.telegramId, { position: 100, event: "ended" }, after(400));

    expect((await reload(user.id)).offerWatchedAt).toEqual(after(300));
    const logged = await db()
      .select()
      .from(events)
      .where(and(eq(events.userId, user.id), eq(events.type, "offer_video_complete")));
    expect(logged).toHaveLength(1);
  });

  it("rejects a completion that comes faster than the clip can be watched", async () => {
    const { user } = await userWith({ video: shortClip, offerFirst: true });
    await recordOfferProgress(user.telegramId, { position: 0, event: "play" }, after(200));
    const result = await recordOfferProgress(user.telegramId, { position: 100, event: "ended" }, after(210));

    expect(result).toEqual({ ok: true, completed: false });
    expect((await reload(user.id)).offerWatchedAt).toBeNull();
    expect((await openRuns(user.id)).map((run) => run.segment)).toEqual(["B"]);
  });

  it("rejects a completion without a play beat", async () => {
    const { user } = await userWith({ video: shortClip, offerFirst: true });
    const result = await recordOfferProgress(user.telegramId, { position: 100, event: "ended" }, after(900));

    expect(result).toEqual({ ok: true, completed: false });
    expect((await reload(user.id)).offerWatchedAt).toBeNull();
  });

  it("refuses offer progress when the grant is not offer-first or the video has no clip", async () => {
    const regular = await userWith({ video: shortClip, offerFirst: false });
    expect(await recordOfferProgress(regular.user.telegramId, { position: 0, event: "play" }, after(200))).toEqual({
      ok: false,
      error: "no_offer_video",
    });

    const noClip = await userWith({ video: {}, offerFirst: true });
    expect(await recordOfferProgress(noClip.user.telegramId, { position: 0, event: "play" }, after(200))).toEqual({
      ok: false,
      error: "no_offer_video",
    });
  });

  it("serves offer progress over HTTP", async () => {
    const { user } = await userWith({ video: shortClip, offerFirst: true });
    const res = await app.request("/app/offer-progress", {
      method: "POST",
      headers: { authorization: auth(user.telegramId), "content-type": "application/json" },
      body: JSON.stringify({ position: 0, event: "play" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: false });
    expect((await reload(user.id)).offerStartedAt).not.toBeNull();

    const invalid = await app.request("/app/offer-progress", {
      method: "POST",
      headers: { authorization: auth(user.telegramId), "content-type": "application/json" },
      body: JSON.stringify({ position: -1, event: "play" }),
    });
    expect(invalid.status).toBe(400);
  });
});
