import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { closeDb, db } from "@/db";
import { chatMessages, events, leads, settings, users } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { setTestEnv } from "@/test/env";
import { isolatedDatabase } from "@/test/isolatedDb";

const isolatedDb = isolatedDatabase("vf_bot");
const testDbUrl = isolatedDb.url;
const LEADS_CHAT_ID = -1_009_999_999_999;

vi.mock("@/leads/notifier", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/leads/notifier")>()),
  kickLeadNotifier: () => {},
}));

type ApiCall = { method: string; payload: Record<string, unknown> };

describe.skipIf(!testDbUrl)("Bot registration flow", () => {
  let testBot: Bot;
  const calls: ApiCall[] = [];
  let updateId = 1;
  let messageSeq = 1_000_000;

  beforeAll(async () => {
    await isolatedDb.create();
    setTestEnv({ DATABASE_URL: testDbUrl!, LEADS_CHAT_ID: String(LEADS_CHAT_ID) });
    await runMigrations(testDbUrl!);
    const { bot } = await import("./bot");
    testBot = bot();
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
    await isolatedDb.drop();
  });

  function from(id: number) {
    return { id, is_bot: false, first_name: "Ali", last_name: "Valiyev", username: "ali" };
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

  const start = (id: number) =>
    message(id, { text: "/start", entities: [{ type: "bot_command", offset: 0, length: 6 }] });

  async function userRow(telegramId: number) {
    const [row] = await db().select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return row;
  }

  async function registeredEvents(userId: number) {
    return (await db().select().from(events).where(eq(events.userId, userId))).filter(
      (e) => e.type === "registered",
    );
  }

  it("registers a new user at /start without asking for a phone", async () => {
    const telegramId = 7_000_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);

    const user = await userRow(telegramId);
    expect(user.registeredAt).not.toBeNull();
    expect(user.phone).toBeNull();
    expect(user.phoneVerified).toBe(false);
    expect(user.name).toBe("Ali Valiyev");
    expect(await registeredEvents(user.id)).toHaveLength(1);

    const replies = calls.filter((c) => c.method === "sendMessage");
    expect(replies).toHaveLength(1);
    expect(replies[0].payload.parse_mode).toBe("HTML");
    expect(replies[0].payload.text).toContain("Ali");
    const watch = replies[0].payload.reply_markup as { inline_keyboard: { web_app?: { url: string } }[][] };
    expect(watch.inline_keyboard[0][0].web_app?.url).toBe("https://example.com/app");
  });

  it("escapes HTML in the user's first name", async () => {
    const telegramId = 7_050_000 + Math.floor(Math.random() * 10_000);
    await testBot.handleUpdate({
      update_id: updateId++,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: telegramId, type: "private", first_name: "x" },
        from: { id: telegramId, is_bot: false, first_name: "<b>Ali&" },
        text: "/start",
        entities: [{ type: "bot_command", offset: 0, length: 6 }],
      },
    } as never);

    const reply = calls.find((c) => c.method === "sendMessage");
    expect(reply?.payload.text).toContain("&lt;b&gt;Ali&amp;");
    expect(reply?.payload.text).not.toContain("<b>Ali");
  });

  it("registers a user who writes to the bot without pressing /start", async () => {
    const telegramId = 7_300_000 + Math.floor(Math.random() * 100_000);
    await message(telegramId, { text: "salom" });

    const user = await userRow(telegramId);
    expect(user.registeredAt).not.toBeNull();
    const watch = calls.find((c) => c.method === "sendMessage")?.payload.reply_markup as {
      inline_keyboard: { web_app?: { url: string } }[][];
    };
    expect(watch.inline_keyboard[0][0].web_app?.url).toBe("https://example.com/app");
  });

  it("does not create a lead when a user registers", async () => {
    const telegramId = 7_600_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);

    const user = await userRow(telegramId);
    expect(await db().select().from(leads).where(eq(leads.userId, user.id))).toHaveLength(0);
  });

  it("replaces the previous bot reply when /start is pressed again", async () => {
    const telegramId = 7_700_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);
    const firstReply = messageSeq;
    calls.length = 0;

    await start(telegramId);

    const deletes = calls.filter((c) => c.method === "deleteMessage").map((c) => c.payload);
    expect(deletes).toEqual([{ chat_id: telegramId, message_id: firstReply }]);
    const logged = await db().select().from(chatMessages).where(eq(chatMessages.chatId, telegramId));
    expect(logged.filter((row) => !row.fromBot)).toHaveLength(2);
    expect(logged.filter((row) => row.fromBot && row.deletedAt === null)).toHaveLength(1);
  });

  it("deletes logged chat messages once they are 24 hours old and drops rows after 3 days", async () => {
    const { cleanupChatMessages } = await import("@/telegram/chatLog");
    const chatId = 7_800_000 + Math.floor(Math.random() * 100_000);
    const now = new Date();
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
    await db()
      .insert(chatMessages)
      .values([
        { chatId, messageId: 1, fromBot: false, sentAt: hoursAgo(25) },
        { chatId, messageId: 2, fromBot: true, sentAt: hoursAgo(23) },
        { chatId, messageId: 3, fromBot: true, sentAt: hoursAgo(49) },
        { chatId, messageId: 4, fromBot: true, sentAt: hoursAgo(73), deletedAt: hoursAgo(49) },
      ]);

    await cleanupChatMessages(testBot.api, now, async () => {});

    const deletes = calls.filter((c) => c.method === "deleteMessage").map((c) => c.payload);
    expect(deletes).toEqual([{ chat_id: chatId, message_id: 1 }]);
    const rows = await db().select().from(chatMessages).where(eq(chatMessages.chatId, chatId));
    const byId = new Map(rows.map((row) => [row.messageId, row]));
    expect(byId.get(1)?.deletedAt).toEqual(now);
    expect(byId.get(2)?.deletedAt).toBeNull();
    expect(byId.get(3)?.deleteError).toBe("too_old");
    expect(byId.has(4)).toBe(false);
  });

  it("deletes logged chat messages after the cleanup delay chosen in settings", async () => {
    const { cleanupChatMessages } = await import("@/telegram/chatLog");
    const { invalidateSettings } = await import("@/settings/service");
    await db()
      .insert(settings)
      .values({ key: "CHAT_CLEANUP_HOURS", value: "1" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "1" } });
    invalidateSettings();
    const chatId = 7_900_000 + Math.floor(Math.random() * 100_000);
    const now = new Date();
    const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
    await db()
      .insert(chatMessages)
      .values([
        { chatId, messageId: 1, fromBot: true, sentAt: minutesAgo(61) },
        { chatId, messageId: 2, fromBot: true, sentAt: minutesAgo(59) },
      ]);

    try {
      await cleanupChatMessages(testBot.api, now, async () => {});
    } finally {
      await db().delete(settings).where(eq(settings.key, "CHAT_CLEANUP_HOURS"));
      invalidateSettings();
    }

    const deletes = calls
      .filter((c) => c.method === "deleteMessage" && c.payload.chat_id === chatId)
      .map((c) => c.payload);
    expect(deletes).toEqual([{ chat_id: chatId, message_id: 1 }]);
  });

  it("ignores group chatter and answers /chatid in groups", async () => {
    const groupId = -1_000_000_000_000 - Math.floor(Math.random() * 100_000);
    const groupUpdate = (text: string, entities?: unknown[]) =>
      testBot.handleUpdate({
        update_id: updateId++,
        message: {
          message_id: updateId,
          date: Math.floor(Date.now() / 1000),
          chat: { id: groupId, type: "supergroup", title: "Leads" },
          from: from(42),
          text,
          entities,
        },
      } as never);

    await groupUpdate("salom");
    expect(calls).toHaveLength(0);

    await groupUpdate("/chatid", [{ type: "bot_command", offset: 0, length: 7 }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toMatchObject({ chat_id: groupId, text: `LEADS_CHAT_ID=${groupId}` });
  });

  it("does not register twice when /start is pressed again", async () => {
    const telegramId = 7_400_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);
    await start(telegramId);

    const user = await userRow(telegramId);
    expect(await registeredEvents(user.id)).toHaveLength(1);
  });

  function pressButton(chatId: number, presser: number, data: string) {
    return testBot.handleUpdate({
      update_id: updateId++,
      callback_query: {
        id: String(updateId),
        from: { id: presser, is_bot: false, first_name: "Sardor", username: "sardor" },
        chat_instance: "1",
        data,
        message: {
          message_id: 10,
          date: Math.floor(Date.now() / 1000),
          chat: { id: chatId, type: "supergroup", title: "Leads" },
          text: "card",
        },
      },
    } as never);
  }

  it("binds a lead to the first salesman who presses the button in the leads group", async () => {
    const [lead] = await db()
      .insert(leads)
      .values({ source: "web", name: "Button", phone: "+998900000001" })
      .returning();
    const salesman = 9_000_000 + Math.floor(Math.random() * 100_000);

    await pressButton(LEADS_CHAT_ID, salesman, `lead:claim:${lead.id}`);
    await pressButton(LEADS_CHAT_ID, salesman + 1, `lead:claim:${lead.id}`);

    const answers = calls.filter((c) => c.method === "answerCallbackQuery").map((c) => c.payload);
    expect(answers[0]).toMatchObject({ text: "Lid sizga biriktirildi", show_alert: false });
    expect(answers[1]).toMatchObject({ text: "Bu lid Sardor (@sardor)ga biriktirilgan", show_alert: true });

    const [after] = await db().select().from(leads).where(eq(leads.id, lead.id));
    expect(after.assigneeTelegramId).toBe(salesman);
  });

  it("ignores lead buttons pressed outside the configured leads group", async () => {
    const [lead] = await db()
      .insert(leads)
      .values({ source: "web", name: "Elsewhere", phone: "+998900000002" })
      .returning();

    await pressButton(-1_000_000_000_001, 9_100_000, `lead:claim:${lead.id}`);

    const [after] = await db().select().from(leads).where(eq(leads.id, lead.id));
    expect(after.assigneeTelegramId).toBeNull();
    expect(calls.map((c) => c.method)).toEqual(["answerCallbackQuery"]);
  });
});
