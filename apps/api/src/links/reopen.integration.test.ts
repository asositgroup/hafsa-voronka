import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { sessionResponseSchema } from "@funnel/shared";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  events,
  linkGrants,
  messageTemplates,
  secondChanceOffers,
  segmentRuns,
  sentMessages,
  users,
  videos,
  watchAppointments,
  watchProgress,
} from "@/db/schema";
import { linkExpiryFor } from "@/messages/plan";
import { signInitData } from "@/telegram/initData";
import { isolatedDatabase } from "@/test/isolatedDb";
import { setTestEnv, TEST_BOT_TOKEN } from "@/test/env";
import { ensureActiveTestVideo } from "@/test/videos";

const isolatedDb = isolatedDatabase("vf_reopen");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type ApiCall = { method: string; payload: Record<string, unknown> };

describe.skipIf(!isolatedDb.url)("Reopening a closed lesson", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let testBot: Bot;
  let dispatchMessages: typeof import("@/messages/dispatch").dispatchMessages;
  let syncSegment: typeof import("@/funnel/segments").syncSegment;
  let reopenLesson: typeof import("@/links/service").reopenLesson;
  let markWroteAdmin: typeof import("@/funnel/channel").markWroteAdmin;
  let messageSeq = 1000;
  let telegramSeq = 80_000;
  let updateId = 1;
  let testIndex = 0;
  let entry = new Date();
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    await isolatedDb.create();
    setTestEnv({ DATABASE_URL: isolatedDb.url!, SESSION_SECRET: "reopen-session-secret-0123456789" });
    await runMigrations(isolatedDb.url!);
    testBot = (await import("@/telegram/bot")).bot();
    testBot.botInfo = {
      id: 1,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    } as Bot["botInfo"];
    testBot.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      if (method.startsWith("send")) return { ok: true, result: { message_id: ++messageSeq } } as never;
      return { ok: true, result: true } as never;
    });
    ({ dispatchMessages } = await import("@/messages/dispatch"));
    ({ syncSegment } = await import("@/funnel/segments"));
    ({ reopenLesson } = await import("@/links/service"));
    ({ markWroteAdmin } = await import("@/funnel/channel"));
    app = (await import("@/app")).createApp();
    await ensureActiveTestVideo();
  });

  beforeEach(async () => {
    calls.length = 0;
    messageSeq = 1000;
    testIndex += 1;
    entry = new Date(Date.UTC(2028, 0, 5, 5, 0, 0) + testIndex * 40 * DAY);
    await db().delete(watchAppointments);
    await db().delete(secondChanceOffers);
    await db().delete(sentMessages);
    await db().delete(events);
    await db().delete(segmentRuns);
    await db().delete(messageTemplates);
    await db().delete(watchProgress);
    await db().update(users).set({ linkId: null });
    await db().delete(linkGrants);
    await db().delete(users);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(entry);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await closeDb();
    await isolatedDb.drop();
  });

  const at = (minutes: number, base = entry) => new Date(base.getTime() + minutes * MINUTE);
  const tick = (now: Date) => dispatchMessages({ api: testBot.api, now: () => now, gapMs: 0 });
  const sends = () => calls.filter((call) => call.method.startsWith("send"));
  const sentTexts = () => sends().map((call) => call.payload.text ?? call.payload.caption);

  async function closedUser(options: { maxPosition?: number } = {}) {
    const givenAt = at(-25 * 60);
    const expiresAt = at(-60);
    const [user] = await db()
      .insert(users)
      .values({
        telegramId: ++telegramSeq,
        firstName: "Ali",
        name: "Ali",
        registeredAt: givenAt,
        linkGivenAt: givenAt,
        linkExpiresAt: expiresAt,
      })
      .returning();
    const [grant] = await db()
      .insert(linkGrants)
      .values({ userId: user.id, attempt: 1, day: 1, kind: "initial", givenAt, expiresAt })
      .returning();
    await db().update(users).set({ linkId: grant.id }).where(eq(users.id, user.id));
    if (options.maxPosition !== undefined) {
      await db().insert(watchProgress).values({
        userId: user.id,
        maxPosition: options.maxPosition,
        lastPosition: options.maxPosition,
        startedAt: givenAt,
        lastBeatAt: givenAt,
      });
    }
    await syncSegment(user.id, givenAt);
    return { ...user, linkId: grant.id };
  }

  async function expireLink(userId: number) {
    await db().update(users).set({ linkExpiresAt: at(-1) }).where(eq(users.id, userId));
  }

  const runsOf = (userId: number) =>
    db().select().from(segmentRuns).where(eq(segmentRuns.userId, userId)).orderBy(asc(segmentRuns.id));
  const grantsOf = (userId: number) =>
    db().select().from(linkGrants).where(eq(linkGrants.userId, userId)).orderBy(asc(linkGrants.attempt));
  const userOf = async (userId: number) => (await db().select().from(users).where(eq(users.id, userId)))[0];

  function initData(telegramId: number) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: telegramId, first_name: "Ali" }),
    });
    params.set("hash", signInitData(params, TEST_BOT_TOKEN));
    return `tma ${params.toString()}`;
  }

  async function sessionJson(telegramId: number, body: Record<string, unknown> = { reason: "open" }) {
    const res = await app.request("/app/session", {
      method: "POST",
      headers: { authorization: initData(telegramId), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return res.json();
  }

  async function session(telegramId: number, body: Record<string, unknown> = { reason: "open" }) {
    return sessionResponseSchema.parse(await sessionJson(telegramId, body));
  }

  const postReopen = (telegramId: number) =>
    app.request("/app/reopen", { method: "POST", headers: { authorization: initData(telegramId) } });

  function sendStart(telegramId: number) {
    return testBot.handleUpdate({
      update_id: updateId++,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: telegramId, type: "private", first_name: "Ali" },
        from: { id: telegramId, is_bot: false, first_name: "Ali" },
        text: "/start",
        entities: [{ type: "bot_command", offset: 0, length: 6 }],
      },
    } as never);
  }

  async function template(values: Partial<typeof messageTemplates.$inferInsert>) {
    const [row] = await db()
      .insert(messageTemplates)
      .values({ segment: "A", day: 1, position: 0, text: "Matn", timingValue: 60, ...values })
      .returning();
    return row;
  }

  async function reopenEvents() {
    return db().select().from(events).where(eq(events.type, "lesson_reopened"));
  }

  it("reopens a closed lesson on «Ha» with a fresh link on the next funnel day", async () => {
    const user = await closedUser();
    const body = await sessionJson(user.telegramId, { reason: "open", start: "again" });
    expect(sessionResponseSchema.parse(body)).toMatchObject({ expired: false });
    expect(body).not.toHaveProperty("secondChance");

    const grants = await grantsOf(user.id);
    expect(grants.map((grant) => [grant.attempt, grant.kind, grant.day])).toEqual([
      [1, "initial", 1],
      [2, "again", 2],
    ]);
    const fresh = await userOf(user.id);
    expect(fresh.linkId).toBe(grants[1].id);
    expect(fresh.linkExpiresAt).toEqual(linkExpiryFor(entry, 24));
    const runs = await runsOf(user.id);
    expect(runs[0]).toMatchObject({ endReason: "relinked" });
    expect(runs.at(-1)).toMatchObject({ segment: "A", attempt: 2, enteredAt: entry, endedAt: null });
    const logged = await reopenEvents();
    expect(logged).toHaveLength(1);
    expect(logged[0].meta).toMatchObject({ source: "again" });
  });

  it("opens a still-open lesson on «Ha» without a new link or restart", async () => {
    const user = await closedUser();
    await db().update(users).set({ linkExpiresAt: at(60) }).where(eq(users.id, user.id));
    const [openRun] = (await runsOf(user.id)).filter((run) => run.endedAt === null);

    const opened = await session(user.telegramId, { reason: "open", start: "again" });
    expect(opened.expired).toBe(false);
    expect(await grantsOf(user.id)).toHaveLength(1);
    expect((await runsOf(user.id)).filter((run) => run.endedAt === null).map((run) => run.id)).toEqual([openRun.id]);
    expect(await reopenEvents()).toHaveLength(0);
  });

  it("reopens from the lesson-closed screen", async () => {
    const user = await closedUser();
    expect((await session(user.telegramId)).expired).toBe(true);

    const first = await postReopen(user.telegramId);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, result: "reopened" });
    const second = await postReopen(user.telegramId);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, result: "open" });
    expect(await grantsOf(user.id)).toHaveLength(2);
    expect((await reopenEvents())[0].meta).toMatchObject({ source: "screen" });
  });

  it("answers 409 on the closed screen for a user who wrote to the admin", async () => {
    const user = await closedUser();
    await markWroteAdmin(user.id, null, at(-30));
    const res = await postReopen(user.telegramId);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "reopen_closed" });
    expect(await grantsOf(user.id)).toHaveLength(1);
  });

  it("reopens on /start after the link closed and still sends the welcome", async () => {
    const user = await closedUser();
    await sendStart(user.telegramId);

    const grants = await grantsOf(user.id);
    expect(grants.map((grant) => [grant.attempt, grant.day])).toEqual([
      [1, 1],
      [2, 1],
    ]);
    expect(String(sends()[0].payload.text)).toContain("Qaytganingizdan xursandmiz");
    expect((await reopenEvents())[0].meta).toMatchObject({ source: "start" });
  });

  it("has no reopen limit", async () => {
    const user = await closedUser();
    for (let cycle = 0; cycle < 9; cycle += 1) {
      await session(user.telegramId, { reason: "open", start: "again" });
      await expireLink(user.id);
    }
    expect((await grantsOf(user.id)).at(-1)?.attempt).toBe(10);
  });

  it("starts B at the sales part after a reopen", async () => {
    const video = await ensureActiveTestVideo();
    const { courseStartSec, shortOfferVideoUrl, shortOfferDuration } = video;
    try {
      await db()
        .update(videos)
        .set({ courseStartSec: 300, shortOfferVideoUrl: "https://video.example.com/short.mp4", shortOfferDuration: 90 })
        .where(eq(videos.id, video.id));
      const user = await closedUser({ maxPosition: 30 });

      const opened = await session(user.telegramId, { reason: "open", start: "again" });
      expect((await grantsOf(user.id))[1]).toMatchObject({ kind: "again", offerFirst: true });
      expect(opened.offerFirst).toEqual({ url: "https://video.example.com/short.mp4", duration: 90 });

      await db()
        .update(videos)
        .set({ shortOfferVideoUrl: null, shortOfferDuration: null })
        .where(eq(videos.id, video.id));
      expect((await session(user.telegramId)).startsAtCourse).toBe(true);
    } finally {
      await db()
        .update(videos)
        .set({ courseStartSec, shortOfferVideoUrl, shortOfferDuration })
        .where(eq(videos.id, video.id));
    }
  });

  it("runs the day-3 reminders from the tap and sends the day-4 trigger at the expiry", async () => {
    const user = await closedUser();
    await db().update(users).set({ linkExpiresAt: at(-25 * 60) }).where(eq(users.id, user.id));
    await template({ text: "Kun 1", timingValue: 30 });
    await template({ day: 3, text: "Kun 3 +30", timingValue: 30 });
    await template({ day: 3, kind: "trigger", atExpiry: true, text: "Kun 3 taklif" });
    await template({ day: 4, kind: "trigger", atExpiry: true, text: "Kun 4 taklif" });

    expect(await reopenLesson(user.id, "again", entry)).toBe("reopened");
    expect((await grantsOf(user.id)).at(-1)).toMatchObject({ attempt: 2, day: 3 });

    await tick(at(29));
    await tick(at(30));
    await tick(at(31));
    expect(sentTexts()).toEqual(["Kun 3 +30"]);

    const expiry = (await userOf(user.id)).linkExpiresAt!;
    calls.length = 0;
    await tick(expiry);
    await tick(at(1, expiry));
    expect(sentTexts()).toEqual(["Kun 4 taklif"]);
  });

  it("reopens once under concurrent taps", async () => {
    const user = await closedUser();
    const results = await Promise.all([reopenLesson(user.id, "again"), reopenLesson(user.id, "screen")]);
    expect([...results].sort()).toEqual(["open", "reopened"]);
    expect(await grantsOf(user.id)).toHaveLength(2);
  });
});
