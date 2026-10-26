import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import postgres from "postgres";
import { hashPassword } from "@/admin/auth";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { events, messageTemplates, users, videos } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { ensureActiveTestVideo } from "@/test/videos";

const serverDbUrl = process.env.TEST_DATABASE_URL;
const isolatedDbName = `vf_messages_${process.pid}`;
const testDbUrl = serverDbUrl && Object.assign(new URL(serverDbUrl), { pathname: `/${isolatedDbName}` }).toString();
const PASSWORD = "messages-admin-password";
const LEADS_CHAT_ID = "-1001234567890";
const ADMIN_ID = 7001;
const OTHER_ID = 7002;
const REMINDER_USER_ID = 7003;

type ApiCall = { method: string; payload: Record<string, unknown> };

const draft = {
  segment: "A",
  day: 1,
  text: "Salom, <b>{ism}</b>!",
  media: null,
  timing: { type: "after_entry", value: 60 },
  buttons: [],
  isActive: true,
};

describe.skipIf(!testDbUrl)("Message constructor", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let testBot: Bot;
  let cookie: string;
  let updateId = 1;
  let blockedChats = new Set<number>();
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName}`);
    await admin.unsafe(`create database ${isolatedDbName}`);
    await admin.end();
    setTestEnv({
      DATABASE_URL: testDbUrl!,
      ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
      SESSION_SECRET: "messages-session-secret-0123456789abcdef",
      LEADS_CHAT_ID,
      ADMIN_TELEGRAM_IDS: String(ADMIN_ID),
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
      if (blockedChats.has(body.chat_id as number)) {
        return { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } as never;
      }
      if (method === "sendVoice") return { ok: true, result: { message_id: 601, voice: { file_id: "voice-id" } } } as never;
      if (method === "sendPhoto") {
        return { ok: true, result: { message_id: 602, photo: [{ file_id: "small" }, { file_id: "big" }] } } as never;
      }
      if (method === "sendMessage") return { ok: true, result: { message_id: 603 } } as never;
      return { ok: true, result: true } as never;
    });
    app = (await import("@/app")).createApp();

    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    cookie = login.headers.get("set-cookie")!.split(";")[0];
  });

  beforeEach(async () => {
    calls.length = 0;
    blockedChats = new Set();
    await db().delete(messageTemplates);
  });

  afterAll(async () => {
    await closeDb();
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName} with (force)`);
    await admin.end();
  });

  const request = (path: string, init: RequestInit = {}) =>
    app.request(`/admin/messages${path}`, { ...init, headers: { cookie, ...init.headers } });

  const send = (path: string, method: string, body: unknown) =>
    request(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const create = async (overrides: Record<string, unknown> = {}) => {
    const res = await send("", "POST", { ...draft, ...overrides });
    expect(res.status).toBe(201);
    return (await res.json()) as { id: number; position: number; attempts: number[] | null };
  };

  const list = async (segment = "A") => {
    const body = await (await request(`?segment=${segment}`)).json();
    return body.items as { id: number; day: number; position: number; isActive: boolean }[];
  };

  it("requires an admin session", async () => {
    expect((await app.request("/admin/messages?segment=A")).status).toBe(401);
  });

  it("creates, edits, toggles and soft deletes a template", async () => {
    const created = await create();
    expect(created.position).toBe(0);

    const edited = await send(`/${created.id}`, "PUT", { ...draft, text: "Yangi matn", buttons: [{ kind: "later", text: "Keyinroq" }] });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ id: created.id, text: "Yangi matn", buttons: [{ kind: "later" }] });

    const toggled = await send(`/${created.id}/active`, "PATCH", { isActive: false });
    expect(await toggled.json()).toMatchObject({ isActive: false });

    expect((await request(`/${created.id}`, { method: "DELETE" })).status).toBe(200);
    expect(await list()).toEqual([]);
    expect((await send(`/${created.id}`, "PUT", draft)).status).toBe(404);
    expect((await request(`/${created.id}`, { method: "DELETE" })).status).toBe(404);
    const [row] = await db().select().from(messageTemplates).where(eq(messageTemplates.id, created.id));
    expect(row.deletedAt).not.toBeNull();
  });

  it("lists the admins and whether media is enabled", async () => {
    const body = await (await request("?segment=A")).json();
    expect(body.admins).toEqual([{ telegramId: ADMIN_ID, label: String(ADMIN_ID) }]);
    expect(body.mediaEnabled).toBe(true);
    expect(body.prefillSupported).toBe(true);
  });

  it("appends to the end of the day, also when moving a template to another day", async () => {
    const first = await create();
    const second = await create();
    expect([first.position, second.position]).toEqual([0, 1]);

    const moved = await send(`/${first.id}`, "PUT", { ...draft, day: 2, timing: { type: "after_entry", value: 1500 } });
    expect(await moved.json()).toMatchObject({ day: 2, position: 0 });
    const other = await create({ day: 2, timing: { type: "after_entry", value: 1600 } });
    expect(other.position).toBe(1);
  });

  it("reorders a day and rejects a stale order", async () => {
    const a = await create();
    const b = await create();
    const c = await create();

    const ok = await send("/order", "PUT", { segment: "A", day: 1, ids: [c.id, a.id, b.id] });
    expect(ok.status).toBe(200);
    expect((await list()).map((item) => item.id)).toEqual([c.id, a.id, b.id]);

    const stale = await send("/order", "PUT", { segment: "A", day: 1, ids: [a.id, b.id] });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: "stale_order" });
    expect((await send("/order", "PUT", { segment: "A", day: 1, ids: [a.id, b.id, b.id] })).status).toBe(409);
    expect((await list()).map((item) => item.id)).toEqual([c.id, a.id, b.id]);
  });

  it("rejects unknown variables and night timings with 422", async () => {
    const unknown = await send("", "POST", { ...draft, text: "Salom {familiya}" });
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toEqual({ error: "unknown_variable", variable: "familiya" });

    const night = await send("", "POST", { ...draft, timing: { type: "day_time", value: 23 * 60 + 30 } });
    expect(night.status).toBe(422);
    expect(await night.json()).toEqual({ error: "night" });

    expect((await send("", "POST", { ...draft, day: 9 })).status).toBe(400);
    expect(await list()).toEqual([]);
  });

  it("saves a stop-point filter in B and refuses it elsewhere", async () => {
    const targeted = await send("", "POST", { ...draft, segment: "B", statuses: ["sotuvda_toxtadi"] });
    expect(targeted.status).toBe(201);
    expect(await targeted.json()).toMatchObject({ segment: "B", statuses: ["sotuvda_toxtadi"] });

    const everyone = await send("", "POST", {
      ...draft,
      segment: "B",
      statuses: ["sotuvda_toxtadi", "dars_yarmida", "korishni_boshladi"],
    });
    expect(await everyone.json()).toMatchObject({ statuses: null });
    expect(await (await send("", "POST", draft)).json()).toMatchObject({ statuses: null });

    const inA = await send("", "POST", { ...draft, statuses: ["korishni_boshladi"] });
    expect(inA.status).toBe(422);
    expect(await inA.json()).toEqual({ error: "statuses_invalid" });
    expect((await send("", "POST", { ...draft, segment: "B", statuses: ["nimadir"] })).status).toBe(400);
  });

  it("returns the active video's marks for the audience chips", async () => {
    const video = await ensureActiveTestVideo();
    await db().update(videos).set({ introEndSec: 300, courseStartSec: 600, priceSec: 800 }).where(eq(videos.id, video.id));
    const body = await (await request("?segment=B")).json();
    expect(body.videoMarks).toEqual({ introEndSec: 300, courseStartSec: 600, priceSec: 800 });
  });

  it("rejects the removed stage D", async () => {
    expect((await request("?segment=D")).status).toBe(400);
  });

  it("stores the link attempts a chain text is meant for", async () => {
    const saved = await create({ ...draft, attempts: [2, 1] });
    expect(saved.attempts).toEqual([1, 2]);
    const everyone = await create({ ...draft, attempts: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(everyone.attempts).toBeNull();
    const inC = await send("", "POST", { ...draft, segment: "C", attempts: [1] });
    expect(await inC.json()).toEqual({ error: "attempts_invalid" });
  });

  describe("night notice", () => {
    const notice = { ...draft, text: "Ertaga soat {link_tugash_soati} gacha", timing: { type: "night_notice", value: 0 } };

    it("allows one per linked segment", async () => {
      const first = await create(notice);
      const second = await send("", "POST", notice);
      expect(second.status).toBe(409);
      expect(await second.json()).toEqual({ error: "night_notice_exists" });
      expect((await send("", "POST", { ...notice, segment: "B" })).status).toBe(201);

      const plain = await create();
      const moved = await send(`/${plain.id}`, "PUT", notice);
      expect(moved.status).toBe(409);

      expect((await request(`/${first.id}`, { method: "DELETE" })).status).toBe(200);
      expect((await send(`/${plain.id}`, "PUT", notice)).status).toBe(200);
    });

    it("refuses segment C and a non-zero value", async () => {
      const segmentC = await send("", "POST", { ...notice, segment: "C" });
      expect(segmentC.status).toBe(422);
      expect(await segmentC.json()).toEqual({ error: "linked_only" });
      const valued = await send("", "POST", { ...notice, timing: { type: "night_notice", value: 5 } });
      expect(valued.status).toBe(422);
      expect(await valued.json()).toEqual({ error: "out_of_range" });
    });
  });

  it("uploads media through the media chat and removes it there", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "note.ogg", { type: "audio/ogg" }));
    const res = await request("/media", { method: "POST", body: form });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: "voice", fileId: "voice-id" });
    expect(calls.map((call) => call.method)).toEqual(["sendVoice", "deleteMessage"]);
    expect(calls[1].payload).toMatchObject({ chat_id: LEADS_CHAT_ID, message_id: 601 });

    const bad = new FormData();
    bad.append("file", new File(["x"], "a.gif", { type: "image/gif" }));
    expect((await request("/media", { method: "POST", body: bad })).status).toBe(415);
  });

  describe("test send", () => {
    it("refuses ids that are not admins", async () => {
      const res = await send("/test", "POST", { draft, adminTelegramId: OTHER_ID });
      expect(res.status).toBe(403);
      expect(calls).toEqual([]);
    });

    it("sends HTML with escaped values", async () => {
      await db()
        .insert(users)
        .values({ telegramId: ADMIN_ID, firstName: "A<b>&", name: null })
        .onConflictDoUpdate({ target: users.telegramId, set: { firstName: "A<b>&", name: null } });
      const res = await send("/test", "POST", {
        draft: { ...draft, buttons: [{ kind: "later", text: "Keyinroq" }] },
        adminTelegramId: ADMIN_ID,
      });
      expect(res.status).toBe(200);
      expect(calls).toEqual([
        {
          method: "sendMessage",
          payload: expect.objectContaining({
            chat_id: ADMIN_ID,
            text: "Salom, <b>A&lt;b&gt;&amp;</b>!",
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
            reply_markup: { inline_keyboard: [[{ text: "Keyinroq", callback_data: "mt:l:t0" }]] },
          }),
        },
      ]);
      await db().delete(users).where(eq(users.telegramId, ADMIN_ID));
    });

    it("answers 409 when the admin has not started the bot", async () => {
      blockedChats.add(ADMIN_ID);
      const res = await send("/test", "POST", { draft, adminTelegramId: ADMIN_ID });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "admin_not_started" });
    });
  });

  describe("reminder buttons", () => {
    function tap(telegramId: number, data: string) {
      return testBot.handleUpdate({
        update_id: updateId++,
        callback_query: {
          id: String(updateId),
          from: { id: telegramId, is_bot: false, first_name: "U" },
          chat_instance: "ci",
          data,
          message: {
            message_id: 800,
            date: Math.floor(Date.now() / 1000),
            chat: { id: telegramId, type: "private", first_name: "U" },
          },
        },
      } as never);
    }

    async function reminderEvents() {
      const [user] = await db().select().from(users).where(eq(users.telegramId, REMINDER_USER_ID));
      return db().select().from(events).where(eq(events.userId, user.id));
    }

    beforeAll(async () => {
      await db().insert(users).values({ telegramId: REMINDER_USER_ID, firstName: "Reminder" }).onConflictDoNothing();
    });

    it("answers old when-menu buttons with the editable closed text for unregistered users", async () => {
      await tap(REMINDER_USER_ID, "mt:w:s1");
      expect(calls.map((call) => call.method)).toEqual(["answerCallbackQuery", "sendMessage"]);
      expect(calls[1].payload).toMatchObject({
        chat_id: REMINDER_USER_ID,
        text: "Bu tugma eskirgan 🙂 Darsga qaytish uchun /start bosing.",
      });
      expect((await reminderEvents()).map((event) => event.type)).toEqual(["reminder_later"]);
    });

    it("answers a stale when-menu choice the same way", async () => {
      await tap(REMINDER_USER_ID, "mt:wa:s1:e");
      expect(calls.map((call) => call.method)).toEqual(["answerCallbackQuery", "sendMessage"]);
    });

    it("acknowledges later and logs it", async () => {
      await tap(REMINDER_USER_ID, "mt:l:s2");
      expect(calls.map((call) => call.method)).toEqual(["answerCallbackQuery", "sendMessage"]);
      expect((await reminderEvents()).some((event) => event.type === "reminder_later")).toBe(true);
    });

    it("answers test buttons with the later acknowledgement without logging anything", async () => {
      const before = (await reminderEvents()).length;
      await tap(REMINDER_USER_ID, "mt:w:t0");
      await tap(REMINDER_USER_ID, "mt:wa:t0:b");
      await tap(REMINDER_USER_ID, "mt:l:t0");
      expect(calls.some((call) => call.method === "sendMessage")).toBe(true);
      expect((await reminderEvents()).length).toBe(before);
    });
  });
});
