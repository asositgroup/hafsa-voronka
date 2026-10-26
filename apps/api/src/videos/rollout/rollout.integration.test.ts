import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { FunnelSegment, RolloutAudience, RolloutCreate, TemplateButton } from "@funnel/shared";
import { hashPassword } from "@/admin/auth";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  events,
  leads,
  linkGrants,
  messageTemplates,
  segmentRuns,
  sentMessages,
  users,
  type Video,
  videoRolloutRecipients,
  videoRollouts,
  videos,
  watchAppointments,
  watchProgress,
} from "@/db/schema";
import { NO_VIDEO_MARKS, statusFor } from "@/funnel/status";
import { funnelStatusSql } from "@/funnel/statusSql";
import { isolatedDatabase } from "@/test/isolatedDb";
import { setTestEnv } from "@/test/env";
import { createTestVideo } from "@/test/videos";

const isolatedDb = isolatedDatabase("vf_rollout");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ADMIN_ID = 555_000;
const TEST_PASSWORD = "rollout-admin-password-2026";
const watchButton: TemplateButton[] = [{ kind: "resume", text: "Ko'rish" }];

type ApiCall = { method: string; payload: Record<string, unknown> };
type Injection = { method: string; error_code: number; description: string; parameters?: Record<string, unknown> };
type UserFixture = {
  position?: number | null;
  started?: boolean;
  videoId?: number | null;
  wroteAdmin?: boolean;
  offerWatched?: boolean;
  registered?: boolean;
  botBlocked?: boolean;
  telegramId?: number;
  linkExpiresAt?: Date | null;
  createdAt?: Date;
  lead?: "won" | "lost" | null;
};

describe.skipIf(!isolatedDb.url)("Video rollout", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let testBot: Bot;
  let dispatchMessages: typeof import("@/messages/dispatch").dispatchMessages;
  let syncSegment: typeof import("@/funnel/segments").syncSegment;
  let insertGrant: typeof import("@/links/service").insertGrant;
  let activateVideo: typeof import("@/videos/adminService").activateVideo;
  let createRollout: typeof import("@/videos/rollout/service").createRollout;
  let cancelRollout: typeof import("@/videos/rollout/service").cancelRollout;
  let countRolloutAudience: typeof import("@/videos/rollout/audience").countRolloutAudience;
  let rolloutBucketSql: typeof import("@/videos/rollout/audience").rolloutBucketSql;
  let oldVideo: Video;
  let newVideo: Video;
  let bareVideo: Video;
  let token: string;
  let blockedChats = new Set<number>();
  let injections: Injection[] = [];
  let messageSeq = 1000;
  let telegramSeq = 80_000;
  let testIndex = 0;
  let now = new Date();
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    await isolatedDb.create();
    setTestEnv({
      DATABASE_URL: isolatedDb.url!,
      SESSION_SECRET: "rollout-session-secret-0123456789abcdef",
      ADMIN_PASSWORD_HASH: await hashPassword(TEST_PASSWORD),
      ADMIN_TELEGRAM_IDS: String(ADMIN_ID),
    });
    await runMigrations(isolatedDb.url!);
    testBot = (await import("@/telegram/bot")).bot();
    testBot.api.config.use(async (_prev, method, payload) => {
      const body = payload as Record<string, unknown>;
      calls.push({ method, payload: body });
      const injected = injections.findIndex((item) => item.method === method);
      if (injected >= 0) {
        const [failure] = injections.splice(injected, 1);
        return {
          ok: false,
          error_code: failure.error_code,
          description: failure.description,
          parameters: failure.parameters,
        } as never;
      }
      if (method.startsWith("send") && blockedChats.has(body.chat_id as number)) {
        return { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } as never;
      }
      if (method.startsWith("send")) return { ok: true, result: { message_id: ++messageSeq } } as never;
      return { ok: true, result: true } as never;
    });
    ({ dispatchMessages } = await import("@/messages/dispatch"));
    ({ syncSegment } = await import("@/funnel/segments"));
    ({ insertGrant } = await import("@/links/service"));
    ({ activateVideo } = await import("@/videos/adminService"));
    ({ createRollout, cancelRollout } = await import("@/videos/rollout/service"));
    ({ countRolloutAudience, rolloutBucketSql } = await import("@/videos/rollout/audience"));
    app = (await import("@/app")).createApp();

    oldVideo = await createTestVideo({ duration: 1000, introEndSec: 100, courseStartSec: 500, priceSec: 800 });
    newVideo = await createTestVideo({ duration: 2000, introEndSec: 200, courseStartSec: 1000, priceSec: 1600 });
    bareVideo = await createTestVideo({ duration: 900 });

    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.77" },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });
    token = ((await login.json()) as { token: string }).token;
  });

  beforeEach(async () => {
    calls.length = 0;
    blockedChats = new Set();
    injections = [];
    testIndex += 1;
    now = new Date(Date.UTC(2029, 0, 5, 5, 0, 0) + testIndex * 40 * DAY);
    await db().delete(videoRolloutRecipients);
    await db().delete(videoRollouts);
    await db().delete(watchAppointments);
    await db().delete(sentMessages);
    await db().delete(events);
    await db().delete(segmentRuns);
    await db().delete(messageTemplates);
    await db().delete(watchProgress);
    await db().delete(leads);
    await db().update(users).set({ linkId: null });
    await db().delete(linkGrants);
    await db().delete(users);
    await db().update(videos).set({ isActive: false });
    await db().update(videos).set({ isActive: true }).where(eq(videos.id, newVideo.id));
  });

  afterAll(async () => {
    await closeDb();
    await isolatedDb.drop();
  });

  const at = (minutes: number, base = now) => new Date(base.getTime() + minutes * MINUTE);
  const tick = (time: Date) => dispatchMessages({ api: testBot.api, now: () => time, gapMs: 0 });
  const sends = () => calls.filter((call) => call.method.startsWith("send"));
  const sendsTo = (telegramId: number) => sends().filter((call) => call.payload.chat_id === telegramId);
  const textOf = (call: ApiCall) => String(call.payload.text ?? call.payload.caption);

  async function makeUser(fixture: UserFixture = {}) {
    const registeredAt = at(-3 * DAY / MINUTE);
    const expiresAt = fixture.linkExpiresAt === undefined ? at(-2 * DAY / MINUTE) : fixture.linkExpiresAt;
    const [user] = await db()
      .insert(users)
      .values({
        telegramId: fixture.telegramId ?? ++telegramSeq,
        firstName: "Ali",
        name: "Ali",
        registeredAt: fixture.registered === false ? null : registeredAt,
        linkGivenAt: registeredAt,
        linkExpiresAt: expiresAt,
        videoId: fixture.videoId === undefined ? oldVideo.id : fixture.videoId,
        wroteAdminAt: fixture.wroteAdmin ? registeredAt : null,
        offerWatchedAt: fixture.offerWatched ? registeredAt : null,
        botBlocked: fixture.botBlocked ?? false,
        createdAt: fixture.createdAt ?? registeredAt,
      })
      .returning();
    const [grant] = await db()
      .insert(linkGrants)
      .values({ userId: user.id, attempt: 1, kind: "initial", givenAt: registeredAt, expiresAt })
      .returning();
    await db().update(users).set({ linkId: grant.id }).where(eq(users.id, user.id));
    if (fixture.position !== undefined && fixture.position !== null) {
      await db().insert(watchProgress).values({
        userId: user.id,
        maxPosition: fixture.position,
        lastPosition: fixture.position,
        startedAt: fixture.started === false ? null : registeredAt,
      });
    }
    if (fixture.lead) {
      await db().insert(leads).values({ source: "bot", userId: user.id, name: "Ali", phone: "+998901234567", outcome: fixture.lead });
    }
    return { ...user, linkId: grant.id };
  }

  async function userRow(id: number) {
    const [row] = await db().select().from(users).where(eq(users.id, id));
    return row;
  }

  async function runsOf(userId: number) {
    return db().select().from(segmentRuns).where(eq(segmentRuns.userId, userId)).orderBy(asc(segmentRuns.id));
  }

  async function grantsOf(userId: number) {
    return db().select().from(linkGrants).where(eq(linkGrants.userId, userId)).orderBy(asc(linkGrants.id));
  }

  async function rolloutRow() {
    const [row] = await db().select().from(videoRollouts).orderBy(asc(videoRollouts.id));
    return row;
  }

  async function recipients() {
    return db().select().from(videoRolloutRecipients).orderBy(asc(videoRolloutRecipients.id));
  }

  async function template(values: Partial<typeof messageTemplates.$inferInsert>) {
    const [row] = await db()
      .insert(messageTemplates)
      .values({ segment: "A", day: 1, position: 0, text: "Matn", timingValue: 60, ...values })
      .returning();
    return row;
  }

  async function startRollout(input: Partial<RolloutCreate> = {}, createdAt = now) {
    const result = await createRollout(
      newVideo.id,
      { audiences: ["not_opened", "halfway", "saw_price"], sinceDays: null, scheduledAt: null, ...input },
      createdAt,
    );
    if (!result.ok) throw new Error(result.code);
    return result.rollout;
  }

  async function bucketOf(userId: number) {
    const [row] = await db()
      .select({ status: funnelStatusSql(), bucket: rolloutBucketSql() })
      .from(users)
      .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
      .leftJoin(videos, eq(videos.id, users.videoId))
      .where(eq(users.id, userId));
    return row;
  }

  describe("audience", () => {
    it("computes the same status in SQL as statusFor", async () => {
      const fixtures: UserFixture[] = [
        {},
        { position: 0, started: false },
        { position: 0 },
        { position: 50 },
        { position: 100 },
        { position: 499.5 },
        { position: 500 },
        { position: 799.9 },
        { position: 800 },
        { position: 950 },
        { position: 10, offerWatched: true },
        { position: 900, wroteAdmin: true },
        { registered: false },
        { videoId: null, position: 0.4 },
        { videoId: null, position: 0.5 },
        { videoId: null },
        { videoId: bareVideo.id, position: 449 },
        { videoId: bareVideo.id, position: 450 },
        { videoId: bareVideo.id, position: 0, started: false },
      ];
      for (const fixture of fixtures) {
        const user = await makeUser(fixture);
        const [row] = await db()
          .select({ user: users, progress: watchProgress, video: videos })
          .from(users)
          .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
          .leftJoin(videos, eq(videos.id, users.videoId))
          .where(eq(users.id, user.id));
        const expected = statusFor(row.progress ?? undefined, row.video ?? NO_VIDEO_MARKS, row.user);
        expect({ fixture, status: (await bucketOf(user.id)).status }).toEqual({ fixture, status: expected });
      }
    });

    it("assigns each user to the first matching bucket", async () => {
      const cases: [UserFixture, RolloutAudience | null][] = [
        [{ lead: "won", wroteAdmin: true, position: 900 }, "bought"],
        [{ lead: "won" }, "bought"],
        [{ lead: "lost", wroteAdmin: true }, "wrote_admin"],
        [{ wroteAdmin: true, offerWatched: true }, "wrote_admin"],
        [{ lead: "lost" }, "not_opened"],
        [{ position: 0, started: false }, "not_opened"],
        [{ position: 0 }, "halfway"],
        [{ position: 150 }, "halfway"],
        [{ position: 600 }, "halfway"],
        [{ position: 850 }, "saw_price"],
        [{ offerWatched: true }, "saw_price"],
        [{ registered: false }, null],
      ];
      for (const [fixture, bucket] of cases) {
        const user = await makeUser(fixture);
        expect({ fixture, bucket: (await bucketOf(user.id)).bucket }).toEqual({ fixture, bucket });
      }
    });

    it("excludes ineligible users and counts exactly what the snapshot sends to", async () => {
      const included = [
        await makeUser(),
        await makeUser({ position: 150 }),
        await makeUser({ position: 850 }),
        await makeUser({ videoId: null }),
        await makeUser({ linkExpiresAt: now }),
      ];
      await makeUser({ registered: false });
      await makeUser({ botBlocked: true });
      await makeUser({ telegramId: ADMIN_ID });
      await makeUser({ videoId: newVideo.id });
      await makeUser({ linkExpiresAt: at(1) });
      await makeUser({ linkExpiresAt: null });
      await makeUser({ wroteAdmin: true });
      await makeUser({ lead: "won" });

      const filter = { audiences: ["not_opened", "halfway", "saw_price"] as RolloutAudience[], sinceDays: null };
      expect(await countRolloutAudience(db(), filter, newVideo.id, now)).toBe(included.length);
      expect(
        await countRolloutAudience(db(), { audiences: ["wrote_admin", "bought"], sinceDays: null }, newVideo.id, now),
      ).toBe(2);
      expect(await countRolloutAudience(db(), { audiences: ["halfway"], sinceDays: null }, newVideo.id, now)).toBe(1);

      const rollout = await startRollout();
      expect(rollout.previewCount).toBe(included.length);
      await tick(now);
      const snapshot = await recipients();
      expect(snapshot.map((row) => row.userId).sort()).toEqual(included.map((user) => user.id).sort());
      expect((await rolloutRow()).targetCount).toBe(included.length);
    });

    it("limits the audience to users who joined within sinceDays", async () => {
      await makeUser({ createdAt: at(-10 * DAY / MINUTE) });
      const recent = await makeUser({ createdAt: at(-2 * DAY / MINUTE) });
      const filter = { audiences: ["not_opened"] as RolloutAudience[], sinceDays: 5 };
      expect(await countRolloutAudience(db(), filter, newVideo.id, now)).toBe(1);
      await startRollout({ audiences: ["not_opened"], sinceDays: 5 });
      await tick(now);
      expect((await recipients()).map((row) => row.userId)).toEqual([recent.id]);
    });
  });

  describe("run", () => {
    it("moves the user, grants a fresh link, restarts the chain and sends the prompt once", async () => {
      const user = await makeUser({ position: 600 });
      await syncSegment(user.id, at(-2 * DAY / MINUTE));
      const [oldRun] = await runsOf(user.id);
      await startRollout();

      await tick(now);

      const row = await userRow(user.id);
      expect(row.videoId).toBe(newVideo.id);
      expect(row.funnelEpoch).toBe(1);
      const [progress] = await db().select().from(watchProgress).where(eq(watchProgress.userId, user.id));
      expect(progress.maxPosition).toBe(newVideo.courseStartSec);

      const grants = await grantsOf(user.id);
      expect(grants).toHaveLength(2);
      expect(grants[1]).toMatchObject({ kind: "rollout", epoch: 1, attempt: 1, silent: false, givenAt: now });
      expect(row.linkId).toBe(grants[1].id);
      expect(row.linkExpiresAt!.getTime()).toBe(now.getTime() + DAY);

      const runs = await runsOf(user.id);
      expect(runs[0]).toMatchObject({ id: oldRun.id, endedAt: now, endReason: "rollout" });
      expect(runs.at(-1)).toMatchObject({ segment: "B", enteredAt: now, attempt: 1, endedAt: null });

      expect(sendsTo(user.telegramId)).toHaveLength(1);
      const prompt = sendsTo(user.telegramId)[0];
      expect(textOf(prompt)).toContain("Yangi dars tayyor");
      expect(textOf(prompt)).toContain("Ali");
      const keyboard = (prompt.payload.reply_markup as { inline_keyboard: { web_app?: { url: string } }[][] })
        .inline_keyboard;
      expect(keyboard[0][0].web_app?.url).toMatch(/\/app\?m=\d+$/);

      const [recipient] = await recipients();
      expect(recipient).toMatchObject({ state: "sent", audience: "halfway", linkId: grants[1].id });
      const [sent] = await db().select().from(sentMessages).where(eq(sentMessages.id, recipient.sentMessageId!));
      expect(sent).toMatchObject({ botTextKey: "rolloutPrompt", linkId: grants[1].id });
      expect(await rolloutRow()).toMatchObject({ status: "done", targetCount: 1, sentCount: 1, finishedAt: now });

      calls.length = 0;
      await tick(at(1));
      expect(sendsTo(user.telegramId)).toHaveLength(0);
    });

    it("marks users who blocked the bot", async () => {
      const user = await makeUser();
      blockedChats.add(user.telegramId);
      await startRollout();
      await tick(now);
      expect((await recipients())[0].state).toBe("blocked");
      expect((await userRow(user.id)).botBlocked).toBe(true);
      expect(await rolloutRow()).toMatchObject({ status: "done", blockedCount: 1, sentCount: 0 });
    });

    it("skips users who stopped being eligible after the snapshot", async () => {
      const first = await makeUser();
      const second = await makeUser();
      await startRollout();
      injections.push({ method: "sendMessage", error_code: 429, description: "Too Many Requests", parameters: { retry_after: 1 } });
      await tick(now);
      const states = await recipients();
      expect(states.map((row) => row.state)).toEqual(["restarted", "pending"]);
      const [user, other] = states[0].userId === first.id ? [first, second] : [second, first];
      await db().update(users).set({ wroteAdminAt: now }).where(eq(users.id, other.id));
      calls.length = 0;
      await tick(at(1));
      expect(sendsTo(user.telegramId)).toHaveLength(1);
      expect(sendsTo(other.telegramId)).toHaveLength(0);
      expect((await recipients()).map((row) => row.state)).toEqual(["sent", "skipped"]);
      expect(await rolloutRow()).toMatchObject({ status: "done", sentCount: 1, skippedCount: 1 });
      expect((await grantsOf(other.id)).length).toBe(1);
      expect((await userRow(other.id)).videoId).toBe(oldVideo.id);
    });

    it("resumes restarted users after a failure without sending twice", async () => {
      const user = await makeUser();
      await startRollout();
      injections.push({ method: "sendMessage", error_code: 502, description: "Bad Gateway" });
      await tick(now);
      expect((await recipients())[0].state).toBe("restarted");
      expect(await rolloutRow()).toMatchObject({ status: "running" });
      expect((await grantsOf(user.id)).filter((grant) => grant.kind === "rollout")).toHaveLength(1);

      calls.length = 0;
      await tick(at(1));
      expect(sendsTo(user.telegramId)).toHaveLength(1);
      expect((await grantsOf(user.id)).filter((grant) => grant.kind === "rollout")).toHaveLength(1);
      expect((await userRow(user.id)).funnelEpoch).toBe(1);
      expect((await recipients())[0].state).toBe("sent");

      await db().update(videoRolloutRecipients).set({ state: "restarted", sentMessageId: null });
      await db().update(videoRollouts).set({ status: "running", finishedAt: null });
      calls.length = 0;
      await tick(at(2));
      expect(sendsTo(user.telegramId)).toHaveLength(0);
      expect((await recipients())[0].state).toBe("sent");
      expect((await recipients())[0].sentMessageId).not.toBeNull();
      expect(await rolloutRow()).toMatchObject({ status: "done", sentCount: 1 });
    });

    it("still sends the prompt to users restarted before the rollout was cancelled", async () => {
      const user = await makeUser();
      const rollout = await startRollout();
      injections.push({ method: "sendMessage", error_code: 502, description: "Bad Gateway" });
      await tick(now);
      expect((await recipients())[0].state).toBe("restarted");

      expect((await cancelRollout(newVideo.id, rollout.id, at(1))).ok).toBe(true);
      const waiting = await makeUser();
      await db()
        .insert(videoRolloutRecipients)
        .values({ rolloutId: rollout.id, userId: waiting.id, audience: "not_opened", state: "pending" });

      calls.length = 0;
      await tick(at(2));
      expect(sendsTo(user.telegramId)).toHaveLength(1);
      expect(sendsTo(waiting.telegramId)).toHaveLength(0);
      const states = Object.fromEntries((await recipients()).map((row) => [row.userId, row.state]));
      expect(states).toEqual({ [user.id]: "sent", [waiting.id]: "pending" });
      expect(await rolloutRow()).toMatchObject({ status: "cancelled", sentCount: 1 });
      expect((await grantsOf(waiting.id)).filter((grant) => grant.kind === "rollout")).toHaveLength(0);
    });

    it("cancels the rollout when its video is no longer active", async () => {
      const user = await makeUser();
      await startRollout();
      await db().update(videos).set({ isActive: false }).where(eq(videos.id, newVideo.id));
      await tick(now);
      expect(sendsTo(user.telegramId)).toHaveLength(0);
      expect(await rolloutRow()).toMatchObject({ status: "cancelled", finishedAt: now });
      expect((await userRow(user.id)).videoId).toBe(oldVideo.id);
    });

    it("cancels open rollouts when another video is activated", async () => {
      await makeUser();
      await startRollout({ scheduledAt: at(60).toISOString() });
      const result = await activateVideo(oldVideo.id);
      expect(result.ok).toBe(true);
      expect((await rolloutRow()).status).toBe("cancelled");
    });

    it("waits for the morning window before sending", async () => {
      const night = at(13 * 60);
      const user = await makeUser({ linkExpiresAt: at(-60, night) });
      await startRollout({}, night);
      await tick(night);
      expect(sendsTo(user.telegramId)).toHaveLength(0);
      expect(await rolloutRow()).toMatchObject({ status: "scheduled", targetCount: null });

      const morning = at(21 * 60);
      await tick(morning);
      expect(sendsTo(user.telegramId)).toHaveLength(1);
      expect(await rolloutRow()).toMatchObject({ status: "done", sentCount: 1 });
    });

    it("does not start a scheduled rollout before its time", async () => {
      const user = await makeUser();
      await startRollout({ scheduledAt: at(120).toISOString() });
      await tick(at(60));
      expect(sendsTo(user.telegramId)).toHaveLength(0);
      expect((await rolloutRow()).status).toBe("scheduled");
      await tick(at(120));
      expect(sendsTo(user.telegramId)).toHaveLength(1);
    });

    it("processes a bounded batch per tick", async () => {
      const givenAt = at(-3 * DAY / MINUTE);
      const expiresAt = at(-2 * DAY / MINUTE);
      const created = await db()
        .insert(users)
        .values(
          Array.from({ length: 301 }, () => ({
            telegramId: ++telegramSeq,
            firstName: "Ali",
            registeredAt: givenAt,
            linkGivenAt: givenAt,
            linkExpiresAt: expiresAt,
            videoId: oldVideo.id,
            createdAt: givenAt,
          })),
        )
        .returning({ id: users.id });
      const grants = await db()
        .insert(linkGrants)
        .values(created.map(({ id }) => ({ userId: id, attempt: 1, kind: "initial" as const, givenAt, expiresAt })))
        .returning({ id: linkGrants.id, userId: linkGrants.userId });
      for (const grant of grants) await db().update(users).set({ linkId: grant.id }).where(eq(users.id, grant.userId));
      await startRollout();

      await tick(now);
      expect(sends()).toHaveLength(300);
      expect(await rolloutRow()).toMatchObject({ status: "running", targetCount: 301, sentCount: 300 });

      calls.length = 0;
      await tick(at(1));
      expect(sends()).toHaveLength(1);
      expect(await rolloutRow()).toMatchObject({ status: "done", sentCount: 301 });
    }, 60_000);

    it("sends message-only audiences the prompt but never a reminder chain", async () => {
      await template({ segment: "A", text: "A zanjir", buttons: watchButton });
      await template({ segment: "B", text: "B zanjir", buttons: watchButton });
      await template({ segment: "C", text: "C zanjir", buttons: watchButton });
      const bought = await makeUser({ lead: "won" });
      const boughtSawPrice = await makeUser({ lead: "won", position: 850 });
      const wrote = await makeUser({ wroteAdmin: true, position: 600 });
      const chain = await makeUser();
      for (const user of [bought, boughtSawPrice, chain]) await syncSegment(user.id, at(-2 * DAY / MINUTE));
      await db()
        .insert(segmentRuns)
        .values({ userId: wrote.id, segment: "B", enteredAt: at(-3 * DAY / MINUTE), endedAt: at(-2 * DAY / MINUTE), endReason: "wrote_admin" });
      await startRollout({ audiences: ["not_opened", "bought", "wrote_admin"] });

      await tick(now);
      for (const user of [bought, boughtSawPrice, wrote, chain]) {
        expect(sendsTo(user.telegramId).map(textOf)).toEqual([expect.stringContaining("Yangi dars tayyor")]);
      }
      for (const user of [bought, boughtSawPrice, wrote]) {
        const row = await userRow(user.id);
        expect(row.funnelEpoch).toBe(0);
        expect(row.videoId).toBe(newVideo.id);
        expect((await grantsOf(user.id)).at(-1)).toMatchObject({ kind: "rollout", silent: true, epoch: 0, attempt: 2 });
      }
      const audiences = new Map((await recipients()).map((row) => [row.userId, [row.audience, row.state]]));
      expect(audiences).toEqual(
        new Map([
          [bought.id, ["bought", "sent"]],
          [boughtSawPrice.id, ["bought", "sent"]],
          [wrote.id, ["wrote_admin", "sent"]],
          [chain.id, ["not_opened", "sent"]],
        ]),
      );

      for (const minutes of [61, 3 * 60, 6 * 60, 24 * 60 + 5, 30 * 60]) {
        calls.length = 0;
        await tick(at(minutes));
        for (const user of [bought, boughtSawPrice, wrote]) expect(sendsTo(user.telegramId)).toHaveLength(0);
        if (minutes === 61) expect(sendsTo(chain.telegramId).map(textOf)).toEqual(["A zanjir"]);
      }
    });
  });

  describe("funnel epoch", () => {
    async function history(user: { id: number; linkId: number }) {
      const oldAt = at(-2 * DAY / MINUTE);
      const [second] = await db()
        .insert(linkGrants)
        .values({ userId: user.id, attempt: 2, kind: "again", givenAt: oldAt, expiresAt: at(-DAY / MINUTE) })
        .returning();
      await db().update(users).set({ linkId: second.id, linkExpiresAt: second.expiresAt }).where(eq(users.id, user.id));
      await syncSegment(user.id, at(-DAY / MINUTE));
      return second;
    }

    it("restarts attempt templates for rolled-out users only", async () => {
      const segment: FunnelSegment = "B";
      await template({ segment, text: "Birinchi link", attempts: [1], buttons: watchButton });
      await template({ segment, text: "Uchinchi link", attempts: [3], buttons: watchButton });

      const rolled = await makeUser({ position: 150 });
      const untouched = await makeUser({ position: 150, createdAt: at(-30 * DAY / MINUTE) });
      await history(rolled);
      await history(untouched);
      await startRollout({ audiences: ["halfway"], sinceDays: 10 });

      await tick(now);
      expect(sendsTo(rolled.telegramId)).toHaveLength(1);
      expect(sendsTo(untouched.telegramId)).toHaveLength(0);

      calls.length = 0;
      await tick(at(61));
      expect(sendsTo(rolled.telegramId).map(textOf)).toEqual(["Birinchi link"]);

      const expiry = (await userRow(rolled.id)).linkExpiresAt!;

      const before = await userRow(untouched.id);
      expect(before.funnelEpoch).toBe(0);
      const grant = await db().transaction((tx) =>
        insertGrant(tx, untouched.id, { kind: "again", offerFirst: false, now: at(6, expiry), ttlHours: 24 }),
      );
      expect(grant).toMatchObject({ epoch: 0, attempt: 3 });
      await syncSegment(untouched.id, at(6, expiry));
      calls.length = 0;
      await tick(at(70, expiry));
      expect(sendsTo(untouched.telegramId).map(textOf)).toEqual(["Uchinchi link"]);
    });
  });

  describe("routes", () => {
    const call = (path: string, init: { method?: string; json?: unknown } = {}) =>
      app.request(`/admin/videos${path}`, {
        method: init.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.json !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      });
    const post = (path: string, json?: unknown) => call(path, { method: "POST", json });
    const futureWindow = () => {
      const local = new Date(Date.now() + 2 * DAY + 5 * HOUR);
      return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 10 - 5)).toISOString();
    };
    const futureNight = () => new Date(new Date(futureWindow()).getTime() + 13 * HOUR).toISOString();

    it("requires admin auth", async () => {
      const res = await app.request(`/admin/videos/${newVideo.id}/rollouts`);
      expect(res.status).toBe(401);
    });

    it("previews, creates, lists and cancels rollouts", async () => {
      await makeUser({ linkExpiresAt: new Date(Date.now() - HOUR) });
      await makeUser({ linkExpiresAt: new Date(Date.now() - HOUR), position: 150 });
      const filter = { audiences: ["not_opened"], sinceDays: null };

      const preview = await post(`/${newVideo.id}/rollouts/preview`, filter);
      expect(preview.status).toBe(200);
      expect(await preview.json()).toEqual({ count: 1 });
      expect((await post(`/999999/rollouts/preview`, filter)).status).toBe(404);
      expect((await post(`/${newVideo.id}/rollouts/preview`, { audiences: [], sinceDays: null })).status).toBe(400);

      expect((await post(`/${newVideo.id}/rollouts`, { ...filter })).status).toBe(400);
      expect((await post(`/999999/rollouts`, { ...filter, scheduledAt: null })).status).toBe(404);
      const inactive = await post(`/${oldVideo.id}/rollouts`, { ...filter, scheduledAt: null });
      expect(inactive.status).toBe(409);
      expect(await inactive.json()).toEqual({ error: "video_not_active" });
      const past = await post(`/${newVideo.id}/rollouts`, { ...filter, scheduledAt: new Date(Date.now() - MINUTE).toISOString() });
      expect(past.status).toBe(422);
      expect(await past.json()).toEqual({ error: "past" });
      const night = await post(`/${newVideo.id}/rollouts`, { ...filter, scheduledAt: futureNight() });
      expect(night.status).toBe(422);
      expect(await night.json()).toEqual({ error: "outside_window" });

      const scheduledAt = futureWindow();
      const created = await post(`/${newVideo.id}/rollouts`, { audiences: ["not_opened", "halfway"], sinceDays: 30, scheduledAt });
      expect(created.status).toBe(201);
      const { rollout } = (await created.json()) as { rollout: Record<string, unknown> };
      expect(rollout).toMatchObject({
        videoId: newVideo.id,
        audiences: ["not_opened", "halfway"],
        sinceDays: 30,
        scheduledAt: new Date(scheduledAt).toISOString(),
        status: "scheduled",
        previewCount: 2,
        targetCount: null,
        sentCount: 0,
        finishedAt: null,
      });

      const busy = await post(`/${newVideo.id}/rollouts`, { ...filter, scheduledAt: null });
      expect(busy.status).toBe(409);
      expect(await busy.json()).toEqual({ error: "rollout_in_progress" });

      expect((await post(`/${oldVideo.id}/rollouts/${rollout.id}/cancel`)).status).toBe(404);
      const cancelled = await post(`/${newVideo.id}/rollouts/${rollout.id}/cancel`);
      expect(cancelled.status).toBe(200);
      expect(((await cancelled.json()) as { rollout: { status: string } }).rollout.status).toBe("cancelled");
      const again = await post(`/${newVideo.id}/rollouts/${rollout.id}/cancel`);
      expect(again.status).toBe(409);
      expect(await again.json()).toEqual({ error: "rollout_finished" });

      const second = await post(`/${newVideo.id}/rollouts`, { ...filter, scheduledAt: null });
      expect(second.status).toBe(201);

      const list = await call(`/${newVideo.id}/rollouts`);
      expect(list.status).toBe(200);
      const { items } = (await list.json()) as { items: { id: number; status: string }[] };
      expect(items.map((item) => item.status)).toEqual(["scheduled", "cancelled"]);
      expect(items[1].id).toBe(rollout.id);
      expect((await call(`/999999/rollouts`)).status).toBe(404);
    });
  });
});
