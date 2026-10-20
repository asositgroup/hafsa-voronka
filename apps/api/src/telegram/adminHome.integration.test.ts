import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  botAdminTestModes,
  leads,
  messageTemplates,
  segmentRuns,
  sentMessages,
  users,
  type Video,
  watchAppointments,
} from "@/db/schema";
import { isolatedDatabase } from "@/test/isolatedDb";
import { setTestEnv } from "@/test/env";
import { ensureActiveTestVideo } from "@/test/videos";

vi.mock("@/leads/notifier", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/leads/notifier")>()),
  kickLeadNotifier: () => {},
}));

const database = isolatedDatabase("vf_admin_home");
const MINUTE = 60_000;
const ADMIN = 4_200_001;
const TEST_ADMIN = 4_200_002;
const DISPATCH_ADMIN = 4_200_003;
const REPORT_ADMIN = 4_200_004;
const LEAD = 4_300_001;
const DISPATCH_LEAD = 4_300_002;
const REPORT_LEAD = 4_300_003;
const ADMIN_IDS = [ADMIN, TEST_ADMIN, DISPATCH_ADMIN, REPORT_ADMIN];

type ApiCall = { method: string; payload: Record<string, unknown> };
type Button = { text: string; callback_data?: string; url?: string; web_app?: { url: string } };

describe.skipIf(!database.url)("Admin home in the bot", () => {
  let testBot: Bot;
  let video: Video;
  let messageSeq = 1000;
  let updateId = 1;
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    await database.create();
    setTestEnv({ DATABASE_URL: database.url!, ADMIN_TELEGRAM_IDS: ADMIN_IDS.join(",") });
    await runMigrations(database.url!);
    video = await ensureActiveTestVideo();
    testBot = (await import("./bot")).bot();
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
  });

  beforeEach(() => {
    calls.length = 0;
  });

  afterAll(async () => {
    await closeDb();
    await database.drop();
  });

  function from(id: number) {
    return { id, is_bot: false, first_name: "Ali", username: "ali" };
  }

  function message(id: number, fields: Record<string, unknown>) {
    return testBot.handleUpdate({
      update_id: updateId++,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id, type: "private", first_name: "Ali" },
        from: from(id),
        ...fields,
      },
    } as never);
  }

  const command = (id: number, name: string) =>
    message(id, { text: `/${name}`, entities: [{ type: "bot_command", offset: 0, length: name.length + 1 }] });

  const shareContact = (id: number, phone: string) =>
    message(id, { contact: { phone_number: phone, first_name: "Ali", user_id: id } });

  function tap(id: number, data: string) {
    return testBot.handleUpdate({
      update_id: updateId++,
      callback_query: {
        id: String(updateId),
        from: from(id),
        chat_instance: "1",
        data,
        message: {
          message_id: 77,
          date: Math.floor(Date.now() / 1000),
          chat: { id, type: "private", first_name: "Ali" },
          text: "x",
        },
      },
    } as never);
  }

  const sends = () => calls.filter((call) => call.method === "sendMessage");
  const lastSend = () => sends().at(-1)!;

  function inlineButtons(call: ApiCall) {
    const markup = call.payload.reply_markup as { inline_keyboard?: Button[][] } | undefined;
    return markup?.inline_keyboard?.flat() ?? [];
  }

  function requestsContact(call: ApiCall) {
    const markup = call.payload.reply_markup as { keyboard?: { request_contact?: boolean }[][] } | undefined;
    return markup?.keyboard?.[0]?.[0]?.request_contact === true;
  }

  async function userRow(telegramId: number) {
    const [row] = await db().select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return row;
  }

  it("shows the admin home instead of the contact request at /start", async () => {
    await command(ADMIN, "start");

    expect(sends()).toHaveLength(1);
    const home = lastSend();
    expect(requestsContact(home)).toBe(false);
    expect(home.payload.text).toContain("Salom, Ali! Siz adminsiz.");
    expect(home.payload.text).toContain(`Faol video: ${video.title} · 15:00 · 0 ta foydalanuvchi`);
    const buttons = inlineButtons(home);
    expect(buttons.map((button) => button.callback_data ?? button.url)).toEqual([
      "ah:videos",
      "ah:upload",
      "ah:stats",
      "https://example.com/admin",
      "ah:test",
    ]);
    expect(await userRow(ADMIN)).toBeUndefined();
  });

  it("shows the admin home for other admin messages and contacts", async () => {
    await message(ADMIN, { text: "salom" });
    await shareContact(ADMIN, "+998901112233");

    expect(sends()).toHaveLength(2);
    for (const call of sends()) expect(call.payload.text).toContain("Siz adminsiz.");
    expect(await userRow(ADMIN)).toBeUndefined();
  });

  it("keeps the lead flow for regular users", async () => {
    await command(LEAD, "start");

    expect(requestsContact(lastSend())).toBe(true);
    expect(lastSend().payload.text).not.toContain("adminsiz");
  });

  it("opens the video list from the home", async () => {
    await tap(ADMIN, "ah:videos");

    expect(lastSend().payload.text).toContain("Videolar: 1 ta");
    expect(inlineButtons(lastSend())[0].callback_data).toBe(`vl:show:${video.id}`);
  });

  it("explains how to upload a new video", async () => {
    await tap(ADMIN, "ah:upload");

    expect(lastSend().payload.text).toBe("Videoni shu yerga yuboring. Asl sifat uchun fayl qilib yuboring.");
  });

  it("shows today and last 7 days numbers without admin activity and refreshes them", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 3 * 24 * 60 * MINUTE);
    await db()
      .insert(users)
      .values([
        { telegramId: REPORT_LEAD, registeredAt: now, linkGivenAt: now, videoId: video.id, channelClickAt: now },
        { telegramId: REPORT_LEAD + 1, registeredAt: old, linkGivenAt: old, videoId: video.id },
        { telegramId: REPORT_ADMIN, registeredAt: now, linkGivenAt: now, videoId: video.id, channelClickAt: now },
      ]);

    await tap(ADMIN, "ah:stats");

    const text = String(lastSend().payload.text);
    expect(text).toContain("Bugun:\nHavola berildi: 1\nVideoni ochdi: 0\nNarxgacha ko'rdi: 0\nAdminga yozdi: 1");
    expect(text).toContain("Oxirgi 7 kun:\nHavola berildi: 2\nVideoni ochdi: 0\nNarxgacha ko'rdi: 0\nAdminga yozdi: 1");
    expect(inlineButtons(lastSend())).toEqual([{ text: "🔄 Yangilash", callback_data: "ah:refresh" }]);

    await db().insert(users).values({ telegramId: REPORT_LEAD + 2, registeredAt: now, linkGivenAt: now, videoId: video.id });
    calls.length = 0;
    await tap(ADMIN, "ah:refresh");

    const edit = calls.find((call) => call.method === "editMessageText");
    expect(edit?.payload.text).toContain("Bugun:\nHavola berildi: 2");
    expect(sends()).toHaveLength(0);
  });

  it("excludes admins from reports and the leads list", async () => {
    const { getReport } = await import("@/reports/queries");
    const { getLeads } = await import("@/admin/queries");
    const { getTashkentToday } = await import("@/admin/dates");
    const today = getTashkentToday();

    const report = await getReport({ from: today, to: today });
    expect(report.videos.reduce((total, row) => total + row.given, 0)).toBe(2);

    const list = await getLeads({ from: today, to: today });
    const ids = new Set(list.leads.map((lead) => lead.id));
    expect(ids.has((await userRow(REPORT_LEAD)).id)).toBe(true);
    expect(ids.has((await userRow(REPORT_ADMIN)).id)).toBe(false);
  });

  it("runs the lead flow in test mode and returns to the admin home with /admin", async () => {
    await tap(TEST_ADMIN, "ah:test");
    expect(lastSend().payload.text).toContain("Sinov rejimi yoqildi");
    expect(inlineButtons(lastSend())).toEqual([{ text: "⬅️ Admin rejimi", callback_data: "ah:home" }]);

    calls.length = 0;
    await command(TEST_ADMIN, "start");
    expect(requestsContact(lastSend())).toBe(true);

    calls.length = 0;
    await shareContact(TEST_ADMIN, "+998901234567");
    const user = await userRow(TEST_ADMIN);
    expect(user.registeredAt).not.toBeNull();
    expect(inlineButtons(lastSend())[0].web_app?.url).toBe("https://example.com/app");

    calls.length = 0;
    await command(TEST_ADMIN, "admin");
    expect(lastSend().payload.text).toContain("Siz adminsiz.");
    expect(await db().select().from(botAdminTestModes)).toHaveLength(0);

    calls.length = 0;
    await command(TEST_ADMIN, "start");
    expect(lastSend().payload.text).toContain("Siz adminsiz.");
  });

  it("leaves test mode from the button", async () => {
    await tap(TEST_ADMIN, "ah:test");
    calls.length = 0;
    await tap(TEST_ADMIN, "ah:home");

    expect(lastSend().payload.text).toContain("Siz adminsiz.");
    expect(await db().select().from(botAdminTestModes)).toHaveLength(0);
  });

  it("does not notify the leads chat about an admin registration", async () => {
    await command(LEAD, "start");
    await shareContact(LEAD, "+998907654321");
    const { flushLeadNotifications } = await import("@/leads/notifier");
    const sent: string[] = [];
    await flushLeadNotifications({
      send: async (text) => {
        sent.push(text);
        return sent.length;
      },
      edit: async () => {},
    });

    const leadOf = async (telegramId: number) => {
      const [row] = await db().select().from(leads).where(eq(leads.userId, (await userRow(telegramId)).id));
      return row;
    };
    expect((await leadOf(LEAD)).notifyMessageId).not.toBeNull();
    expect((await leadOf(TEST_ADMIN)).notifyMessageId).toBeNull();
    expect(sent.some((text) => text.includes("+998901234567") || text.includes("998 90 123 45 67"))).toBe(false);
  });

  it("never sends scheduled messages or appointment reminders to admins", async () => {
    const { dispatchMessages } = await import("@/messages/dispatch");
    const entry = new Date(Date.UTC(2027, 0, 5, 5, 0, 0));
    const tick = (now: Date) => dispatchMessages({ api: testBot.api, now: () => now, gapMs: 0 });
    const [admin, lead] = await db()
      .insert(users)
      .values([
        { telegramId: DISPATCH_ADMIN, firstName: "Ali", name: "Ali", registeredAt: entry, linkExpiresAt: new Date(entry.getTime() + 72 * 60 * MINUTE) },
        { telegramId: DISPATCH_LEAD, firstName: "Ali", name: "Ali", registeredAt: entry, linkExpiresAt: new Date(entry.getTime() + 72 * 60 * MINUTE) },
      ])
      .returning();
    await db().insert(segmentRuns).values([
      { userId: admin.id, segment: "A", enteredAt: entry },
      { userId: lead.id, segment: "A", enteredAt: entry },
    ]);
    await db()
      .insert(messageTemplates)
      .values({ segment: "A", day: 1, position: 0, text: "Salom", timingType: "after_entry", timingValue: 60 });
    const [appointment] = await db()
      .insert(watchAppointments)
      .values({ userId: admin.id, purpose: "remind", chosenAt: new Date(entry.getTime() + 30 * MINUTE) })
      .returning();

    await tick(new Date(entry.getTime() + 61 * MINUTE));

    expect(sends().map((call) => call.payload.chat_id)).toEqual([DISPATCH_LEAD]);
    expect(await db().select().from(sentMessages).where(eq(sentMessages.userId, admin.id))).toHaveLength(0);
    const [cancelled] = await db().select().from(watchAppointments).where(eq(watchAppointments.id, appointment.id));
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.firedAt).toBeNull();
  });
});
