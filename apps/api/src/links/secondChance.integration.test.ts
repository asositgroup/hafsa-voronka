import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { type FunnelStatus, sessionResponseSchema, type TemplateButton } from "@funnel/shared";
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
  watchProgress,
} from "@/db/schema";
import { signInitData } from "@/telegram/initData";
import { isolatedDatabase } from "@/test/isolatedDb";
import { setTestEnv, TEST_BOT_TOKEN } from "@/test/env";
import { createTestVideo, ensureActiveTestVideo } from "@/test/videos";

const isolatedDb = isolatedDatabase("vf_second_chance");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TASHKENT = 5 * HOUR;
const noPrice: FunnelStatus[] = ["korishni_boshladi", "dars_yarmida", "sotuvda_toxtadi"];
const offerButtons: TemplateButton[] = [
  { kind: "again", text: "Ha, ko'raman" },
  { kind: "later", text: "Keyinroq, ko'raman" },
];

type ApiCall = { method: string; payload: Record<string, unknown> };

describe.skipIf(!isolatedDb.url)("Second chance after the link expires", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let testBot: Bot;
  let dispatchMessages: typeof import("@/messages/dispatch").dispatchMessages;
  let syncSegment: typeof import("@/funnel/segments").syncSegment;
  let acceptSecondChance: typeof import("@/links/service").acceptSecondChance;
  let markWroteAdmin: typeof import("@/funnel/channel").markWroteAdmin;
  let markRegistered: typeof import("@/funnel/users").markRegistered;
  let blockedChats = new Set<number>();
  let messageSeq = 1000;
  let telegramSeq = 70_000;
  let updateId = 1;
  let testIndex = 0;
  let entry = new Date();
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    await isolatedDb.create();
    setTestEnv({ DATABASE_URL: isolatedDb.url!, SESSION_SECRET: "second-chance-session-secret-0123456789" });
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
      const body = payload as Record<string, unknown>;
      calls.push({ method, payload: body });
      if (method.startsWith("send") && blockedChats.has(body.chat_id as number)) {
        return { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } as never;
      }
      if (method.startsWith("send")) return { ok: true, result: { message_id: ++messageSeq } } as never;
      return { ok: true, result: true } as never;
    });
    ({ dispatchMessages } = await import("@/messages/dispatch"));
    ({ syncSegment } = await import("@/funnel/segments"));
    ({ acceptSecondChance } = await import("@/links/service"));
    ({ markWroteAdmin } = await import("@/funnel/channel"));
    ({ markRegistered } = await import("@/funnel/users"));
    app = (await import("@/app")).createApp();
    await ensureActiveTestVideo();
  });

  beforeEach(async () => {
    calls.length = 0;
    blockedChats = new Set();
    messageSeq = 1000;
    testIndex += 1;
    entry = new Date(Date.UTC(2028, 0, 5, 5, 0, 0) + testIndex * 40 * DAY);
    await db().delete(secondChanceOffers);
    await db().delete(sentMessages);
    await db().delete(events);
    await db().delete(segmentRuns);
    await db().delete(messageTemplates);
    await db().delete(watchProgress);
    await db().update(users).set({ linkId: null });
    await db().delete(linkGrants);
    await db().delete(users);
  });

  afterAll(async () => {
    await closeDb();
    await isolatedDb.drop();
  });

  const at = (minutes: number, base = entry) => new Date(base.getTime() + minutes * MINUTE);
  const tick = (now: Date) => dispatchMessages({ api: testBot.api, now: () => now, gapMs: 0 });
  const sends = () => calls.filter((call) => call.method.startsWith("send"));
  const sentTexts = () => sends().map((call) => call.payload.text ?? call.payload.caption);
  const deletes = () => calls.filter((call) => call.method === "deleteMessage");

  async function linkedUser(options: {
    givenAt?: Date;
    expiresAt: Date;
    videoId?: number;
    maxPosition?: number;
  }) {
    const givenAt = options.givenAt ?? entry;
    const [user] = await db()
      .insert(users)
      .values({
        telegramId: ++telegramSeq,
        firstName: "Ali",
        name: "Ali",
        registeredAt: givenAt,
        linkGivenAt: givenAt,
        linkExpiresAt: options.expiresAt,
        videoId: options.videoId,
      })
      .returning();
    const [grant] = await db()
      .insert(linkGrants)
      .values({ userId: user.id, attempt: 1, kind: "initial", givenAt, expiresAt: options.expiresAt })
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
    return { ...user, linkId: grant.id, grant };
  }

  async function template(values: Partial<typeof messageTemplates.$inferInsert>) {
    const [row] = await db()
      .insert(messageTemplates)
      .values({ segment: "A", day: 1, position: 0, text: "Matn", timingType: "after_entry", timingValue: 60, ...values })
      .returning();
    return row;
  }

  function afsus(day: number, text: string, statuses: FunnelStatus[] = ["link_berildi"]) {
    return template({ segment: "D", day, text, timingType: "occasion", timingValue: 0, statuses, buttons: offerButtons });
  }

  async function runsOf(userId: number) {
    return db().select().from(segmentRuns).where(eq(segmentRuns.userId, userId)).orderBy(asc(segmentRuns.id));
  }

  async function offersOf(userId: number) {
    return db()
      .select()
      .from(secondChanceOffers)
      .where(eq(secondChanceOffers.userId, userId))
      .orderBy(asc(secondChanceOffers.occasion));
  }

  async function grantsOf(userId: number) {
    return db().select().from(linkGrants).where(eq(linkGrants.userId, userId)).orderBy(asc(linkGrants.attempt));
  }

  function initData(telegramId: number) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: telegramId, first_name: "Ali" }),
    });
    params.set("hash", signInitData(params, TEST_BOT_TOKEN));
    return `tma ${params.toString()}`;
  }

  async function session(telegramId: number, body: Record<string, unknown> = { reason: "open" }) {
    const res = await app.request("/app/session", {
      method: "POST",
      headers: { authorization: initData(telegramId), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return sessionResponseSchema.parse(await res.json());
  }

  function tap(telegramId: number, data: string) {
    return testBot.handleUpdate({
      update_id: updateId++,
      callback_query: {
        id: String(updateId),
        from: { id: telegramId, is_bot: false, first_name: "Ali" },
        chat_instance: "ci",
        data,
        message: {
          message_id: 800,
          date: Math.floor(Date.now() / 1000),
          chat: { id: telegramId, type: "private", first_name: "Ali" },
        },
      },
    } as never);
  }

  function recentDaytime() {
    const now = Date.now();
    const local = now + TASHKENT;
    const tenToday = Math.floor(local / DAY) * DAY + 10 * HOUR - TASHKENT;
    return new Date(tenToday <= now ? tenToday : tenToday - DAY);
  }

  it("gives every registration its first link grant", async () => {
    const [user] = await db().insert(users).values({ telegramId: ++telegramSeq, firstName: "Ali" }).returning();
    const registered = await markRegistered(user.id, { name: "Ali", phone: "+998901234567", phoneVerified: true });
    const [grant] = await grantsOf(user.id);
    expect(grant).toMatchObject({ attempt: 1, kind: "initial", offerFirst: false });
    expect(registered).toMatchObject({ linkId: grant.id, linkGivenAt: grant.givenAt, linkExpiresAt: grant.expiresAt });
    await syncSegment(user.id);
    expect((await runsOf(user.id))[0]).toMatchObject({ segment: "A", attempt: 1 });
  });

  it("ends the chain at expiry, deletes that link's reminders and sends the first «afsus»", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await template({ text: "A1" });
    await template({ text: "Oxirgi", timingType: "before_expiry", timingValue: 60, position: 1 });
    await template({ text: "Ertangi", timingValue: 25 * 60, day: 2 });
    await afsus(1, "Afsus, bonus dars o'chib ketdi");
    await afsus(1, "Kurs qismini ko'rmay qoldingiz", noPrice);

    await tick(at(61));
    await tick(at(23 * 60));
    expect(sentTexts()).toEqual(["A1", "Oxirgi"]);
    const chainRows = await db().select().from(sentMessages).where(eq(sentMessages.userId, user.id));
    expect(chainRows.every((row) => row.linkId === user.linkId)).toBe(true);

    calls.length = 0;
    await tick(at(24 * 60));
    expect(calls.map((call) => call.method)).toEqual(["deleteMessage", "sendMessage"]);
    expect(sends()[0].payload).toMatchObject({ text: "Afsus, bonus dars o'chib ketdi" });
    const keyboard = (sends()[0].payload.reply_markup as { inline_keyboard: { text: string; web_app?: { url: string }; callback_data?: string }[][] })
      .inline_keyboard;
    expect(keyboard[0][0].web_app?.url).toMatch(/\/app\?start=again&m=\d+$/);
    expect(keyboard[1][0].callback_data).toMatch(/^mt:l:s\d+$/);

    const [aRun, dRun] = await runsOf(user.id);
    expect(aRun).toMatchObject({ segment: "A", endReason: "expired", endedAt: at(24 * 60) });
    expect(dRun).toMatchObject({ segment: "D", endedAt: null, attempt: 1 });
    const [offer] = await offersOf(user.id);
    expect(offer).toMatchObject({ occasion: 1, variant: "not_opened", expiredLinkId: user.linkId, skipped: false, answer: null });
    expect(offer.sentMessageId).not.toBeNull();

    await tick(at(25 * 60 + 1));
    expect(sentTexts()).toEqual(["Afsus, bonus dars o'chib ketdi"]);
  });

  it("sends the §3.8 text to people who stopped before the price", async () => {
    const video = await createTestVideo({ introEndSec: 100, courseStartSec: 300, priceSec: 600 });
    const user = await linkedUser({ expiresAt: at(24 * 60), videoId: video.id, maxPosition: 200 });
    expect((await runsOf(user.id))[0].segment).toBe("B");
    await afsus(1, "Afsus, bonus dars o'chib ketdi");
    await afsus(1, "Kurs qismini ko'rmay qoldingiz", noPrice);
    await tick(at(24 * 60));
    expect(sentTexts()).toEqual(["Kurs qismini ko'rmay qoldingiz"]);
    expect((await offersOf(user.id))[0].variant).toBe("no_price");
  });

  it("reopens the lesson for 24h once on «Ha» and keeps the progress", async () => {
    const base = recentDaytime();
    const video = await createTestVideo({ introEndSec: 100, courseStartSec: 300, priceSec: 600 });
    const user = await linkedUser({ givenAt: new Date(base.getTime() - DAY), expiresAt: base, videoId: video.id, maxPosition: 200 });
    await afsus(1, "Kurs qismini ko'rmay qoldingiz", noPrice);
    await tick(base);
    expect(sentTexts()).toEqual(["Kurs qismini ko'rmay qoldingiz"]);

    const before = await session(user.telegramId);
    expect(before).toMatchObject({ expired: true, secondChance: true });

    const opened = await session(user.telegramId, { reason: "open", start: "again" });
    expect(opened).toMatchObject({ expired: false, secondChance: false });
    expect(opened.progress).toMatchObject({ lastPosition: 200, maxPosition: 200 });

    const grants = await grantsOf(user.id);
    expect(grants.map((grant) => [grant.attempt, grant.kind, grant.offerFirst])).toEqual([
      [1, "initial", false],
      [2, "again", true],
    ]);
    const [fresh] = await db().select().from(users).where(eq(users.id, user.id));
    expect(fresh.linkId).toBe(grants[1].id);
    expect(fresh.linkExpiresAt!.getTime()).toBeGreaterThanOrEqual(grants[1].givenAt.getTime() + 24 * HOUR);
    const runs = await runsOf(user.id);
    expect(runs.map((run) => [run.segment, run.endReason, run.attempt])).toEqual([
      ["B", "expired", 1],
      ["D", "relinked", 1],
      ["B", null, 2],
    ]);
    const [offer] = await offersOf(user.id);
    expect(offer).toMatchObject({ answer: "again", grantedLinkId: grants[1].id });
    const [progress] = await db().select().from(watchProgress).where(eq(watchProgress.userId, user.id));
    expect(progress).toMatchObject({ maxPosition: 200, lastPosition: 200 });

    await session(user.telegramId, { reason: "open", start: "again" });
    const res = await app.request("/app/second-chance/accept", {
      method: "POST",
      headers: { authorization: initData(user.telegramId) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "already" });
    expect(await grantsOf(user.id)).toHaveLength(2);
    expect((await db().select().from(events).where(eq(events.type, "second_chance_again"))).length).toBe(1);
  });

  it("renews from the expired screen without waiting for an offer, as often as asked", async () => {
    const user = await linkedUser({ givenAt: new Date(Date.now() - 20 * DAY), expiresAt: new Date(Date.now() - 19 * DAY) });
    const accept = () =>
      app.request("/app/second-chance/accept", {
        method: "POST",
        headers: { authorization: initData(user.telegramId) },
      });

    const res = await accept();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "granted" });
    const grants = await grantsOf(user.id);
    expect(grants.map((grant) => grant.kind)).toEqual(["initial", "again"]);
    expect(grants[1].expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await offersOf(user.id)).toHaveLength(0);
    expect((await session(user.telegramId)).expired).toBe(false);

    await db().update(users).set({ linkExpiresAt: new Date(Date.now() - DAY) }).where(eq(users.id, user.id));
    expect((await accept()).status).toBe(200);
    expect(await grantsOf(user.id)).toHaveLength(3);
  });

  it("answers 409 to people who reached the price, since their link never closes", async () => {
    const video = await createTestVideo({ introEndSec: 100, courseStartSec: 300, priceSec: 600 });
    const user = await linkedUser({
      givenAt: new Date(Date.now() - 2 * DAY),
      expiresAt: new Date(Date.now() - DAY),
      videoId: video.id,
      maxPosition: 700,
    });
    const res = await app.request("/app/second-chance/accept", {
      method: "POST",
      headers: { authorization: initData(user.telegramId) },
    });
    expect(res.status).toBe(409);
    expect(await grantsOf(user.id)).toHaveLength(1);
  });

  it("restarts the §1 chain from the new link and sends only texts meant for it", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await template({ text: "Birinchi link", attempts: [1] });
    await template({ text: "Ikkinchi link", attempts: [2], position: 1 });
    await template({ text: "Har bir link", timingValue: 120, position: 2 });
    await afsus(1, "Afsus");
    await tick(at(61));
    await tick(at(121));
    await tick(at(24 * 60));
    expect(sentTexts()).toEqual(["Birinchi link", "Har bir link", "Afsus"]);

    const reopenedAt = at(26 * 60);
    expect(await acceptSecondChance(user.id, reopenedAt)).toBe("granted");
    expect(await acceptSecondChance(user.id, at(26 * 60 + 5))).toBe("already");
    const [, , aRun] = await runsOf(user.id);
    expect(aRun).toMatchObject({ segment: "A", attempt: 2, enteredAt: reopenedAt, endedAt: null });

    await tick(at(60, reopenedAt));
    await tick(at(120, reopenedAt));
    expect(sentTexts()).toEqual(["Birinchi link", "Har bir link", "Afsus", "Ikkinchi link", "Har bir link"]);
    const [, reopened] = await grantsOf(user.id);
    const chain = await db().select().from(sentMessages).where(eq(sentMessages.segmentRunId, aRun.id));
    expect(chain.map((row) => row.linkId)).toEqual([reopened.id, reopened.id]);
  });

  it("offers again when the reopened link expires too, with the next page", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    await afsus(2, "Afsus 2");
    await tick(at(24 * 60));
    await acceptSecondChance(user.id, at(25 * 60));
    const [, second] = await grantsOf(user.id);
    await tick(second.expiresAt!);
    expect(sentTexts()).toEqual(["Afsus 1", "Afsus 2"]);
    const offers = await offersOf(user.id);
    expect(offers.map((offer) => [offer.occasion, offer.expiredLinkId])).toEqual([
      [1, user.linkId],
      [2, second.id],
    ]);
    expect((await runsOf(user.id)).map((run) => [run.segment, run.endReason])).toEqual([
      ["A", "expired"],
      ["D", "relinked"],
      ["A", "expired"],
      ["D", null],
    ]);
  });

  it("stops after seven ignored offers in seven days, one per day, never repeating a text", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    for (let day = 1; day <= 7; day += 1) await afsus(day, `Afsus ${day}`);
    const expiry = at(24 * 60);
    for (let day = 0; day <= 7; day += 1) {
      await tick(at(day * 24 * 60, expiry));
      await tick(at(day * 24 * 60 + 30, expiry));
    }
    expect(sentTexts()).toEqual([1, 2, 3, 4, 5, 6, 7].map((day) => `Afsus ${day}`));
    const runs = await runsOf(user.id);
    expect(runs[runs.length - 1]).toMatchObject({ segment: "D", endReason: "offers_exhausted", endedAt: at(7 * 24 * 60, expiry) });
    await tick(at(8 * 24 * 60, expiry));
    expect(sends()).toHaveLength(7);
  });

  it("skips an empty page and offers the next one a day later", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    await afsus(3, "Afsus 3");
    const expiry = at(24 * 60);
    await tick(expiry);
    await tick(at(24 * 60, expiry));
    await tick(at(48 * 60, expiry));
    expect(sentTexts()).toEqual(["Afsus 1", "Afsus 3"]);
    expect((await offersOf(user.id)).map((offer) => [offer.occasion, offer.skipped])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
  });

  it("records «Keyinroq», acknowledges it and still offers the next day", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    await afsus(2, "Afsus 2");
    const expiry = at(24 * 60);
    await tick(expiry);
    const [offer] = await offersOf(user.id);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`);
    expect(String(sends().at(-1)?.payload.text)).toContain("Qachon ko'rishingiz qulay?");
    const [answered] = await offersOf(user.id);
    expect(answered.answer).toBe("later");
    expect((await db().select().from(events).where(eq(events.type, "second_chance_later"))).length).toBe(1);
    await tick(at(24 * 60, expiry));
    expect(sentTexts().at(-1)).toBe("Afsus 2");
  });

  it("stops offering once the user wrote to admin or blocked the bot", async () => {
    const writer = await linkedUser({ expiresAt: at(24 * 60) });
    const blocker = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    await afsus(2, "Afsus 2");
    const expiry = at(24 * 60);
    await tick(expiry);
    expect(sends()).toHaveLength(2);

    await markWroteAdmin(writer.id, null, at(60, expiry));
    blockedChats.add(blocker.telegramId);
    await tick(at(24 * 60, expiry));
    await tick(at(24 * 60 + 1, expiry));
    expect(sends().map((call) => call.payload.chat_id)).toEqual([writer.telegramId, blocker.telegramId, blocker.telegramId]);
    expect((await runsOf(writer.id)).at(-1)).toMatchObject({ segment: "D", endReason: "wrote_admin" });
    expect((await runsOf(blocker.id)).at(-1)).toMatchObject({ segment: "D", endReason: "bot_blocked" });
    expect(await offersOf(writer.id)).toHaveLength(1);
    expect((await offersOf(blocker.id)).map((offer) => offer.skipped)).toEqual([false, true]);
  });

  it("does not open a second chance for links that expired more than seven days ago", async () => {
    const user = await linkedUser({ givenAt: at(-9 * 24 * 60), expiresAt: at(-8 * 24 * 60) });
    await afsus(1, "Afsus 1");
    await tick(entry);
    expect(sends()).toHaveLength(0);
    expect((await runsOf(user.id)).map((run) => [run.segment, run.endReason])).toEqual([["A", "offers_exhausted"]]);
  });

  it("keeps people who reached the price in the progrev chain after expiry", async () => {
    const video = await createTestVideo({ introEndSec: 100, courseStartSec: 300, priceSec: 600 });
    const user = await linkedUser({ expiresAt: at(24 * 60), videoId: video.id, maxPosition: 700 });
    await template({ segment: "C", text: "Progrev", timingValue: 25 * 60, day: 2 });
    await afsus(1, "Afsus 1");
    await tick(at(24 * 60));
    await tick(at(25 * 60));
    expect(sentTexts()).toEqual(["Progrev"]);
    expect((await runsOf(user.id)).map((run) => [run.segment, run.endReason])).toEqual([["C", null]]);
    expect(deletes()).toHaveLength(0);
  });
});
