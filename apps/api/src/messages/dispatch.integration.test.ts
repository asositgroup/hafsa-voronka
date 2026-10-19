import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import postgres from "postgres";
import type { FunnelSegment, TemplateButton } from "@funnel/shared";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { events, messageTemplates, segmentRuns, sentMessages, settings, users, type Video, watchProgress } from "@/db/schema";
import { signInitData } from "@/telegram/initData";
import { createTestVideo, ensureActiveTestVideo } from "@/test/videos";
import { setTestEnv, TEST_BOT_TOKEN } from "@/test/env";

const serverDbUrl = process.env.TEST_DATABASE_URL;
const isolatedDbName = `vf_dispatch_${process.pid}`;
const testDbUrl = serverDbUrl && Object.assign(new URL(serverDbUrl), { pathname: `/${isolatedDbName}` }).toString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const API_URL = "https://api.example.com";

type ApiCall = { method: string; payload: Record<string, unknown> };
type Injection = { method: string; error_code: number; description: string; parameters?: Record<string, unknown> };

describe.skipIf(!testDbUrl)("Message dispatcher", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let testBot: Bot;
  let dispatchMessages: typeof import("@/messages/dispatch").dispatchMessages;
  let adminChatUrl: typeof import("@/messages/render").adminChatUrl;
  let blockedChats = new Set<number>();
  let injections: Injection[] = [];
  let messageSeq = 1000;
  let updateId = 1;
  let testIndex = 0;
  let entry = new Date();
  let telegramSeq = 9000;
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName}`);
    await admin.unsafe(`create database ${isolatedDbName}`);
    await admin.end();
    setTestEnv({
      DATABASE_URL: testDbUrl!,
      SESSION_SECRET: "dispatch-session-secret-0123456789abcdef",
    });
    await runMigrations(testDbUrl!);
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
    ({ adminChatUrl } = await import("@/messages/render"));
    app = (await import("@/app")).createApp();
    await ensureActiveTestVideo();
  });

  beforeEach(async () => {
    calls.length = 0;
    blockedChats = new Set();
    injections = [];
    messageSeq = 1000;
    testIndex += 1;
    entry = new Date(Date.UTC(2027, 0, 5, 5, 0, 0) + testIndex * 40 * DAY);
    await db().delete(sentMessages);
    await db().delete(events);
    await db().delete(segmentRuns);
    await db().delete(messageTemplates);
    await db().delete(watchProgress);
    await db().delete(users);
  });

  afterAll(async () => {
    await closeDb();
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName} with (force)`);
    await admin.end();
  });

  const at = (minutes: number, base = entry) => new Date(base.getTime() + minutes * MINUTE);
  const localDate = (date: Date) => new Date(date.getTime() + 5 * HOUR).toISOString().slice(0, 10);

  const tick = (now: Date) => dispatchMessages({ api: testBot.api, now: () => now, gapMs: 0 });

  const sends = () => calls.filter((call) => call.method.startsWith("send"));
  const deletes = () => calls.filter((call) => call.method === "deleteMessage");

  async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
    const [user] = await db()
      .insert(users)
      .values({
        telegramId: ++telegramSeq,
        firstName: "Ali",
        name: "Ali",
        registeredAt: entry,
        linkExpiresAt: at(72 * 60),
        ...overrides,
      })
      .returning();
    return user;
  }

  async function openRun(userId: number, segment: FunnelSegment = "A", enteredAt = entry) {
    const [run] = await db().insert(segmentRuns).values({ userId, segment, enteredAt }).returning();
    return run;
  }

  async function closeRun(runId: number, endedAt: Date, endReason: "advanced" | "wrote_admin" | "bot_blocked" = "advanced") {
    await db().update(segmentRuns).set({ endedAt, endReason }).where(eq(segmentRuns.id, runId));
  }

  async function makeTemplate(overrides: Partial<typeof messageTemplates.$inferInsert> = {}) {
    const [template] = await db()
      .insert(messageTemplates)
      .values({
        segment: "A",
        day: 1,
        position: 0,
        text: "Salom, <b>{ism}</b>!",
        timingType: "after_entry",
        timingValue: 60,
        ...overrides,
      })
      .returning();
    return template;
  }

  async function rows() {
    return db().select().from(sentMessages).orderBy(sentMessages.id);
  }

  async function setup(overrides: Partial<typeof messageTemplates.$inferInsert> = {}) {
    const user = await makeUser();
    const run = await openRun(user.id);
    const template = await makeTemplate(overrides);
    return { user, run, template };
  }

  it("sends a due message with the rendered text", async () => {
    const { user, template } = await setup();
    await tick(at(61));
    expect(sends()).toHaveLength(1);
    expect(sends()[0].method).toBe("sendMessage");
    expect(sends()[0].payload).toMatchObject({ chat_id: user.telegramId, text: "Salom, <b>Ali</b>!" });
    const [row] = await rows();
    expect(row).toMatchObject({ userId: user.id, templateId: template.id, telegramMessageId: 1001 });
    expect(row.sentAt).toEqual(at(61));
    expect(row.dueAt).toEqual(at(60));
  });

  it("does not send the same message twice", async () => {
    await setup();
    await tick(at(61));
    await tick(at(61));
    await tick(at(62));
    expect(sends()).toHaveLength(1);
  });

  it("waits until the message is due", async () => {
    await setup();
    await tick(at(59));
    expect(sends()).toHaveLength(0);
  });

  it("never sends a message past the grace period", async () => {
    await setup();
    await tick(at(180));
    expect(sends()).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });

  it("sends one message per tick and deletes the previous one first", async () => {
    await setup({ text: "Bir", position: 0 });
    await makeTemplate({ text: "Ikki", position: 1 });
    await tick(at(60));
    expect(sends().map((call) => call.payload.text)).toEqual(["Bir"]);
    await tick(at(61));
    expect(calls.map((call) => call.method)).toEqual(["sendMessage", "deleteMessage", "sendMessage"]);
    expect(deletes()[0].payload).toMatchObject({ message_id: 1001 });
    expect(sends()[1].payload.text).toBe("Ikki");
    const [first, second] = await rows();
    expect(first.deletedAt).toEqual(at(61));
    expect(second.deletedAt).toBeNull();
  });

  it("treats an already deleted message as deleted", async () => {
    await setup({ position: 0 });
    await makeTemplate({ position: 1 });
    await tick(at(60));
    injections.push({ method: "deleteMessage", error_code: 400, description: "Bad Request: message to delete not found" });
    await tick(at(61));
    const [first] = await rows();
    expect(first.deletedAt).toEqual(at(61));
    expect(first.deleteError).toBeNull();
    expect(sends()).toHaveLength(2);
  });

  it("records other delete errors and still sends", async () => {
    await setup({ position: 0 });
    await makeTemplate({ position: 1 });
    await tick(at(60));
    injections.push({ method: "deleteMessage", error_code: 400, description: "Bad Request: can't be deleted" });
    await tick(at(61));
    const [first] = await rows();
    expect(first.deletedAt).toBeNull();
    expect(first.deleteError).toContain("can't be deleted");
    expect(sends()).toHaveLength(2);
  });

  it("caps sends at ten per local day and resets on the next day", async () => {
    await setup({ position: 0 });
    for (let position = 1; position < 11; position += 1) await makeTemplate({ position });
    await makeTemplate({ day: 2, position: 0, timingType: "day_time", timingValue: 540 });
    for (let minute = 60; minute <= 70; minute += 1) await tick(at(minute));
    expect(sends()).toHaveLength(10);
    await tick(at(71));
    expect(sends()).toHaveLength(10);
    await tick(at(23 * 60));
    expect(sends()).toHaveLength(11);
  });

  it("collapses a night message into 07:30", async () => {
    await setup({ timingValue: 780 });
    await tick(at(810));
    expect(sends()).toHaveLength(0);
    await tick(at(1260));
    expect(sends()).toHaveLength(0);
    await tick(at(1290));
    expect(sends()).toHaveLength(1);
    const [row] = await rows();
    expect(row.dueAt).toEqual(at(1290));
  });

  it("does not carry a message due just before 23:00 into the morning", async () => {
    await setup({ timingType: "day_time", timingValue: 22 * 60 + 59 });
    await tick(at(13 * 60));
    expect(sends()).toHaveLength(0);
    await tick(at(13 * 60 + 1));
    await tick(at(21 * 60));
    await tick(at(21 * 60 + 30));
    expect(sends()).toHaveLength(0);
  });

  it("replays the TZ 10:00 row minute by minute", async () => {
    const expiresAt = at(24 * 60);
    const user = await makeUser({ linkGivenAt: entry, linkExpiresAt: expiresAt });
    await openRun(user.id, "A");
    for (const [position, hours] of [23, 21, 19, 17, 15, 10, 5, 4, 3, 2, 1].entries()) {
      await makeTemplate({ position, text: `${hours}: {qolgan_vaqt} qoldi`, timingType: "before_expiry", timingValue: hours * 60 });
    }
    await makeTemplate({ position: 11, text: "Ertaga soat {link_tugash_soati} gacha", timingType: "night_notice", timingValue: 0 });

    for (let minute = 0; minute <= 24 * 60 + 5; minute += 1) await tick(at(minute));

    expect(sends().map((call) => call.payload.text)).toEqual([
      "23: 23 soat qoldi",
      "21: 21 soat qoldi",
      "19: 19 soat qoldi",
      "17: 17 soat qoldi",
      "15: 15 soat qoldi",
      "Ertaga soat 10:00 gacha",
      "3: 3 soat qoldi",
      "2: 2 soat qoldi",
      "1: 1 soat qoldi",
    ]);
    const all = await rows();
    expect(all.map((row) => row.sentAt!.getTime() - entry.getTime())).toEqual(
      [1, 3, 5, 7, 9, 12, 21, 22, 23].map((hours) => hours * HOUR),
    );
    expect(all.map((row) => row.slot)).toEqual(["", "", "", "", "", localDate(expiresAt), "", "", ""]);
    expect(deletes()).toHaveLength(8);
    expect(all.filter((row) => row.deletedAt === null)).toHaveLength(1);
  }, 120_000);

  it("sends the first message of the new segment and deletes the old one", async () => {
    const user = await makeUser();
    const runA = await openRun(user.id, "A");
    await makeTemplate({ segment: "A", text: "A1", position: 0 });
    await makeTemplate({ segment: "A", text: "A2", position: 1, timingValue: 120 });
    await makeTemplate({ segment: "B", text: "B1" });
    await tick(at(61));
    expect(sends().map((call) => call.payload.text)).toEqual(["A1"]);

    await closeRun(runA.id, at(100));
    await openRun(user.id, "B", at(100));
    await tick(at(121));
    expect(sends()).toHaveLength(1);

    await tick(at(161));
    expect(calls.map((call) => call.method)).toEqual(["sendMessage", "deleteMessage", "sendMessage"]);
    expect(sends().map((call) => call.payload.text)).toEqual(["A1", "B1"]);
    await tick(at(300));
    expect(sends()).toHaveLength(2);
  });

  it("ignores users who wrote to the admin", async () => {
    const user = await makeUser({ wroteAdminAt: at(30) });
    const run = await openRun(user.id);
    await closeRun(run.id, at(30), "wrote_admin");
    await makeTemplate();
    await tick(at(61));
    expect(sends()).toHaveLength(0);
  });

  it("marks the user blocked on 403 and stops", async () => {
    const { user, run } = await setup();
    blockedChats.add(user.telegramId);
    await tick(at(61));
    const [blocked] = await db().select().from(users).where(eq(users.id, user.id));
    expect(blocked.botBlocked).toBe(true);
    const [closed] = await db().select().from(segmentRuns).where(eq(segmentRuns.id, run.id));
    expect(closed.endReason).toBe("bot_blocked");
    const [row] = await rows();
    expect(row.sendError).toContain("blocked");
    expect(row.sentAt).toBeNull();
    await tick(at(62));
    expect(sends()).toHaveLength(1);
  });

  it("drops the reservation and pauses on 429", async () => {
    const first = await makeUser();
    const second = await makeUser();
    await openRun(first.id);
    await openRun(second.id);
    await makeTemplate();
    injections.push({
      method: "sendMessage",
      error_code: 429,
      description: "Too Many Requests: retry after 5",
      parameters: { retry_after: 5 },
    });
    await tick(at(61));
    expect(sends()).toHaveLength(1);
    expect(await rows()).toHaveLength(0);

    await tick(new Date(at(61).getTime() + 3000));
    expect(sends()).toHaveLength(1);

    await tick(new Date(at(61).getTime() + 10_000));
    expect(sends()).toHaveLength(3);
    expect((await rows()).filter((row) => row.sentAt)).toHaveLength(2);
  });

  it("retries after a server error", async () => {
    await setup();
    injections.push({ method: "sendMessage", error_code: 502, description: "Bad Gateway" });
    await tick(at(61));
    expect(await rows()).toHaveLength(0);
    await tick(at(62));
    expect((await rows())[0].sentAt).toEqual(at(62));
  });

  it("keeps the error and never retries other client errors", async () => {
    await setup();
    injections.push({ method: "sendMessage", error_code: 400, description: "Bad Request: wrong file identifier" });
    await tick(at(61));
    await tick(at(62));
    expect(sends()).toHaveLength(1);
    const [row] = await rows();
    expect(row.sentAt).toBeNull();
    expect(row.sendError).toContain("wrong file identifier");
  });

  it("uses the latest template text for unsent messages", async () => {
    const { template } = await setup({ text: "Birinchi", position: 0 });
    const second = await makeTemplate({ text: "Eski", position: 1 });
    await tick(at(60));
    const [sentBefore] = await rows();
    await db().update(messageTemplates).set({ text: "Yangi" }).where(eq(messageTemplates.id, second.id));
    await tick(at(61));
    expect(sends().map((call) => call.payload.text)).toEqual(["Birinchi", "Yangi"]);
    const [sentAfter] = await rows();
    expect(sentAfter).toMatchObject({
      id: sentBefore.id,
      templateId: template.id,
      telegramMessageId: sentBefore.telegramMessageId,
      dueAt: sentBefore.dueAt,
    });
    expect(sentAfter.sentAt).toEqual(sentBefore.sentAt);
  });

  it("skips inactive and deleted templates", async () => {
    const user = await makeUser();
    await openRun(user.id);
    await makeTemplate({ isActive: false });
    await makeTemplate({ deletedAt: entry });
    await tick(at(61));
    expect(sends()).toHaveLength(0);
  });

  it("stays silent on days without templates", async () => {
    await setup({ text: "Kun 1" });
    await makeTemplate({ day: 3, text: "Kun 3", timingValue: 2 * 1440 + 60 });
    await tick(at(61));
    await tick(at(1440 + 61));
    await tick(at(1440 + 300));
    expect(sends().map((call) => call.payload.text)).toEqual(["Kun 1"]);
    await tick(at(2 * 1440 + 61));
    expect(sends().map((call) => call.payload.text)).toEqual(["Kun 1", "Kun 3"]);
  });

  describe("48 hour sweep", () => {
    const sentAt = () => at(60);
    const afterSend = (hours: number, extraMinutes = 0) => new Date(sentAt().getTime() + hours * HOUR + extraMinutes * MINUTE);

    it("deletes a message at 47 hours when nothing is pending", async () => {
      await setup();
      await tick(sentAt());
      await tick(afterSend(47));
      expect(deletes()).toHaveLength(1);
      expect(deletes()[0].payload).toMatchObject({ message_id: 1001 });
      expect((await rows())[0].deletedAt).toEqual(afterSend(47));
    });

    it("keeps it while a send due soon will delete it", async () => {
      await setup({ position: 0 });
      await makeTemplate({ position: 1, timingValue: 60 + 47 * 60 + 30 });
      await tick(sentAt());
      await tick(afterSend(47));
      expect(deletes()).toHaveLength(0);
      await tick(afterSend(47, 30));
      expect(deletes()).toHaveLength(1);
      expect(sends()).toHaveLength(2);
      expect((await rows())[0].deletedAt).toEqual(afterSend(47, 30));
    });

    it("deletes unconditionally from 47h50m", async () => {
      await setup({ position: 0 });
      await makeTemplate({ position: 1, timingValue: 60 + 47 * 60 + 58 });
      await tick(sentAt());
      await tick(afterSend(47, 55));
      expect(deletes()).toHaveLength(1);
      expect((await rows())[0].deletedAt).toEqual(afterSend(47, 55));
    });

    it("marks messages older than 48 hours without calling the API", async () => {
      await setup();
      await tick(sentAt());
      await tick(afterSend(49));
      expect(deletes()).toHaveLength(0);
      expect((await rows())[0].deleteError).toBe("too_old");
    });
  });

  describe("buttons and clicks", () => {
    const buttons: TemplateButton[] = [
      { kind: "admin", text: "Admin", prefill: "Salom" },
      { kind: "link", text: "Sayt", url: "https://example.com/x" },
      { kind: "resume", text: "Davom" },
    ];

    async function sendWithButtons() {
      const context = await setup({ buttons });
      await tick(at(61));
      const [row] = await rows();
      return { ...context, row };
    }

    it("wraps urls with the click token and tags the mini app link", async () => {
      const { row } = await sendWithButtons();
      const keyboard = (sends()[0].payload.reply_markup as { inline_keyboard: Record<string, unknown>[][] })
        .inline_keyboard;
      expect(keyboard[0][0].url).toBe(`${API_URL}/r/${row.clickToken}/0`);
      expect(keyboard[1][0].url).toBe(`${API_URL}/r/${row.clickToken}/1`);
      expect((keyboard[2][0].web_app as { url: string }).url).toContain(`&m=${row.id}`);
      expect(row.linkTargets).toEqual([
        { kind: "admin", url: adminChatUrl("Salom", { ism: "Ali" }) },
        { kind: "link", url: "https://example.com/x" },
        null,
      ]);
    });

    it("redirects a link button and records the click", async () => {
      const { row, user } = await sendWithButtons();
      const res = await app.request(`/r/${row.clickToken}/1`);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://example.com/x");
      const [clicked] = await rows();
      expect(clicked.clickedAt).not.toBeNull();
      const clicks = await db().select().from(events).where(eq(events.type, "message_click"));
      expect(clicks).toHaveLength(1);
      expect(clicks[0].userId).toBe(user.id);
      expect(clicks[0].meta).toMatchObject({ sentMessageId: row.id, via: "url", button: 1, kind: "link" });
      const [unchanged] = await db().select().from(users).where(eq(users.id, user.id));
      expect(unchanged.channelClickAt).toBeNull();
      expect(unchanged.wroteAdminAt).toBeNull();
    });

    it("treats an admin button click as writing to the admin", async () => {
      const { row, user, run } = await sendWithButtons();
      const res = await app.request(`/r/${row.clickToken}/0`);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")?.startsWith("https://t.me/example")).toBe(true);
      const [after] = await db().select().from(users).where(eq(users.id, user.id));
      expect(after.channelClickAt).not.toBeNull();
      expect(after.wroteAdminAt).not.toBeNull();
      const channelEvents = await db().select().from(events).where(eq(events.type, "channel_click"));
      expect(channelEvents).toHaveLength(1);
      const [closed] = await db().select().from(segmentRuns).where(eq(segmentRuns.id, run.id));
      expect(closed.endReason).toBe("wrote_admin");
    });

    it("rejects unknown tokens and indexes", async () => {
      const { row } = await sendWithButtons();
      expect((await app.request("/r/not-a-token/0")).status).toBe(404);
      expect((await app.request(`/r/${crypto.randomUUID()}/0`)).status).toBe(404);
      expect((await app.request(`/r/${row.clickToken}/3`)).status).toBe(404);
      expect((await app.request(`/r/${row.clickToken}/2`)).status).toBe(404);
      expect((await app.request(`/r/${row.clickToken}/x`)).status).toBe(404);
    });

    function sessionRequest(telegramId: number, sentMessageId: number) {
      const params = new URLSearchParams({
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: telegramId, first_name: "Ali" }),
      });
      params.set("hash", signInitData(params, TEST_BOT_TOKEN));
      return app.request("/app/session", {
        method: "POST",
        headers: { authorization: `tma ${params.toString()}`, "content-type": "application/json" },
        body: JSON.stringify({ reason: "open", sentMessageId }),
      });
    }

    it("marks the click from the mini app only for the owner", async () => {
      const { row, user } = await sendWithButtons();
      const stranger = await makeUser();
      expect((await sessionRequest(stranger.telegramId, row.id)).status).toBe(200);
      expect((await rows())[0].clickedAt).toBeNull();
      expect((await sessionRequest(user.telegramId, row.id)).status).toBe(200);
      expect((await rows())[0].clickedAt).not.toBeNull();
      const clicks = await db().select().from(events).where(eq(events.type, "message_click"));
      expect(clicks).toHaveLength(1);
      expect(clicks[0].meta).toMatchObject({ via: "web_app" });
    });

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

    it("marks the click from callback buttons but not from the answer", async () => {
      const context = await setup({ buttons: [{ kind: "when_menu", text: "Qachon?" }] });
      await tick(at(61));
      const [row] = await rows();
      const stranger = await makeUser();
      await tap(stranger.telegramId, `mt:w:s${row.id}`);
      expect((await rows())[0].clickedAt).toBeNull();
      await tap(context.user.telegramId, `mt:wa:s${row.id}:b`);
      expect((await rows())[0].clickedAt).toBeNull();
      await tap(context.user.telegramId, `mt:w:s${row.id}`);
      expect((await rows())[0].clickedAt).not.toBeNull();
    });

    it("marks the click from the later button", async () => {
      const context = await setup({ buttons: [{ kind: "later", text: "Keyinroq" }] });
      await tick(at(61));
      const [row] = await rows();
      await tap(context.user.telegramId, `mt:l:s${row.id}`);
      expect((await rows())[0].clickedAt).not.toBeNull();
    });
  });

  it("sends each segment's first message once while the user advances A, B, C", async () => {
    const user = await makeUser();
    const runA = await openRun(user.id, "A");
    await makeTemplate({ segment: "A", text: "A1" });
    await makeTemplate({ segment: "B", text: "B1" });
    await makeTemplate({ segment: "C", text: "C1" });

    await tick(at(61));
    await tick(at(62));
    await closeRun(runA.id, at(100));
    const runB = await openRun(user.id, "B", at(100));
    await tick(at(161));
    await tick(at(162));
    await closeRun(runB.id, at(200));
    await openRun(user.id, "C", at(200));
    await tick(at(261));
    await tick(at(262));

    expect(sends().map((call) => call.payload.text)).toEqual(["A1", "B1", "C1"]);
    expect(deletes().map((call) => call.payload.message_id)).toEqual([1001, 1002]);
    const all = await rows();
    expect(all.map((row) => row.deletedAt !== null)).toEqual([true, true, false]);
  });

  describe("segment B", () => {
    let lesson: Video;

    beforeAll(async () => {
      lesson = await createTestVideo({ duration: 1500, introEndSec: 300, courseStartSec: 900, priceSec: 1102 });
    });

    async function watcher(maxPosition: number, lastBeatAt: Date, playing = false) {
      const user = await makeUser({ videoId: lesson.id, linkGivenAt: entry, linkExpiresAt: at(24 * 60) });
      await db().insert(watchProgress).values({ userId: user.id, maxPosition, lastPosition: maxPosition, startedAt: entry, lastBeatAt, playing });
      const run = await openRun(user.id, "B");
      return { user, run };
    }

    async function moveTo(userId: number, maxPosition: number, lastBeatAt: Date, playing = false) {
      await db().update(watchProgress).set({ maxPosition, lastPosition: maxPosition, lastBeatAt, playing }).where(eq(watchProgress.userId, userId));
    }

    async function variants() {
      await makeTemplate({ segment: "B", position: 0, text: "0-5", timingValue: 30, statuses: ["korishni_boshladi"] });
      await makeTemplate({ segment: "B", position: 1, text: "5-15", timingValue: 30, statuses: ["dars_yarmida"] });
      await makeTemplate({ segment: "B", position: 2, text: "15-narx", timingValue: 30, statuses: ["sotuvda_toxtadi"] });
    }

    it("sends the text for the stop point 30 minutes after the stop and re-times after a new stop", async () => {
      const { user } = await watcher(180, at(5));
      await variants();
      await tick(at(34));
      expect(sends()).toHaveLength(0);
      await tick(at(35));
      expect(sends().map((call) => call.payload.text)).toEqual(["0-5"]);

      await moveTo(user.id, 960, at(60));
      for (let minute = 61; minute < 90; minute += 1) await tick(at(minute));
      expect(sends()).toHaveLength(1);
      await tick(at(90));
      for (let minute = 91; minute <= 150; minute += 5) await tick(at(minute));
      expect(sends().map((call) => call.payload.text)).toEqual(["0-5", "15-narx"]);
    });

    it("sends nothing while the person is watching and keeps the item due", async () => {
      const { user } = await watcher(400, at(119), true);
      await makeTemplate({ segment: "B", text: "10 soat", timingType: "before_expiry", timingValue: 22 * 60 });
      await tick(at(120));
      expect(sends()).toHaveLength(0);
      await moveTo(user.id, 420, at(121), false);
      await tick(at(122));
      expect(sends().map((call) => call.payload.text)).toEqual(["10 soat"]);
    });

    it("caps B at four a day and seven in total", async () => {
      await watcher(100, entry);
      for (let position = 0; position < 10; position += 1) {
        await makeTemplate({ segment: "B", position, text: `d1-${position}`, timingValue: 60 + position });
      }
      for (let position = 0; position < 6; position += 1) {
        await makeTemplate({ segment: "B", day: 2, position, text: `d2-${position}`, timingType: "day_time", timingValue: 540 + position });
      }
      for (let minute = 60; minute <= 80; minute += 1) await tick(at(minute));
      expect(sends()).toHaveLength(4);
      for (let minute = 23 * 60; minute <= 23 * 60 + 10; minute += 1) await tick(at(minute));
      expect(sends()).toHaveLength(7);
      expect(sends().slice(4).map((call) => call.payload.text)).toEqual(["d2-0", "d2-1", "d2-2"]);
    });

    it("applies caps edited in the settings", async () => {
      const { invalidateSettings } = await import("@/settings/service");
      const value = JSON.stringify({ A: { daily: 10, total: null }, B: { daily: 2, total: 7 }, C: { daily: 10, total: null } });
      await db().insert(settings).values({ key: "MESSAGE_CAPS", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
      invalidateSettings();
      try {
        await watcher(100, entry);
        for (let position = 0; position < 4; position += 1) {
          await makeTemplate({ segment: "B", position, timingValue: 60 + position });
        }
        for (let minute = 60; minute <= 70; minute += 1) await tick(at(minute));
        expect(sends()).toHaveLength(2);
      } finally {
        await db().delete(settings).where(eq(settings.key, "MESSAGE_CAPS"));
        invalidateSettings();
      }
    });

    it("stops at narxni_kurdi, at a manual wrote-to-admin mark and when blocked", async () => {
      const { syncSegment } = await import("@/funnel/segments");
      await makeTemplate({ segment: "B", text: "B", timingValue: 30 });
      const priced = await watcher(600, at(5));
      const wrote = await watcher(600, at(5));
      const blocked = await watcher(600, at(5));

      await moveTo(priced.user.id, 1102, at(6));
      await syncSegment(priced.user.id, at(6));
      await db().update(users).set({ wroteAdminAt: at(10) }).where(eq(users.id, wrote.user.id));
      await db().update(users).set({ botBlocked: true }).where(eq(users.id, blocked.user.id));

      for (let minute = 35; minute <= 40; minute += 1) await tick(at(minute));
      expect(sends()).toHaveLength(0);
      const [bRun] = await db().select().from(segmentRuns).where(eq(segmentRuns.userId, priced.user.id)).orderBy(segmentRuns.id);
      expect(bRun.endedAt).toEqual(at(6));
    });
  });
});
