import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { closeDb, db } from "@/db";
import { events, leads, users } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { setTestEnv } from "@/test/env";

const testDbUrl = process.env.TEST_DATABASE_URL;

type ApiCall = { method: string; payload: Record<string, unknown> };

describe.skipIf(!testDbUrl)("Bot registration flow", () => {
  let testBot: Bot;
  const calls: ApiCall[] = [];
  let updateId = 1;

  beforeAll(async () => {
    setTestEnv({ DATABASE_URL: testDbUrl! });
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
      return { ok: true, result: true } as never;
    });
  });

  beforeEach(() => {
    calls.length = 0;
  });

  afterAll(async () => {
    await closeDb();
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

  it("asks a new user for their contact at /start", async () => {
    const telegramId = 7_000_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);

    const reply = calls.find((c) => c.method === "sendMessage");
    const markup = reply?.payload.reply_markup as { keyboard?: { request_contact?: boolean }[][] };
    expect(markup.keyboard?.[0]?.[0]?.request_contact).toBe(true);
    expect((await userRow(telegramId)).registeredAt).toBeNull();
  });

  it("registers with a verified phone when the user shares their own contact", async () => {
    const telegramId = 7_100_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);
    calls.length = 0;

    await message(telegramId, {
      contact: { phone_number: "998901234567", first_name: "Ali", user_id: telegramId },
    });

    const user = await userRow(telegramId);
    expect(user.registeredAt).not.toBeNull();
    expect(user.phone).toBe("+998901234567");
    expect(user.phoneVerified).toBe(true);
    expect(user.name).toBe("Ali Valiyev");
    expect(await registeredEvents(user.id)).toHaveLength(1);

    const replies = calls.filter((c) => c.method === "sendMessage");
    expect(replies[0].payload.reply_markup).toEqual({ remove_keyboard: true });
    const watch = replies[1].payload.reply_markup as { inline_keyboard: { web_app?: { url: string } }[][] };
    expect(watch.inline_keyboard[0][0].web_app?.url).toBe("https://example.com/app");
  });

  it("rejects someone else's contact", async () => {
    const telegramId = 7_200_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);

    await message(telegramId, {
      contact: { phone_number: "998901234567", first_name: "Other", user_id: telegramId + 1 },
    });

    const user = await userRow(telegramId);
    expect(user.registeredAt).toBeNull();
    expect(user.phone).toBeNull();
  });

  it("does not register from a typed phone number and re-asks for the contact button", async () => {
    const telegramId = 7_300_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);
    calls.length = 0;

    await message(telegramId, { text: "+998 (93) 111-22-33" });

    const user = await userRow(telegramId);
    expect(user.registeredAt).toBeNull();
    expect(user.phone).toBeNull();
    const markup = calls.find((c) => c.method === "sendMessage")?.payload.reply_markup as {
      keyboard?: { request_contact?: boolean }[][];
    };
    expect(markup.keyboard?.[0]?.[0]?.request_contact).toBe(true);
  });

  it("uses the landing form name and links the web lead to the Telegram user", async () => {
    const telegramId = 7_500_000 + Math.floor(Math.random() * 100_000);
    const visitorId = `W${String(telegramId).padStart(9, "0")}`;
    const [lead] = await db()
      .insert(leads)
      .values({ source: "web", visitorId, name: "Aziz Karimov", phone: "+998901112233" })
      .returning();

    await message(telegramId, {
      text: `/start v_${visitorId}`,
      entities: [{ type: "bot_command", offset: 0, length: 6 }],
    });
    await message(telegramId, {
      contact: { phone_number: "998935554433", first_name: "Ali", user_id: telegramId },
    });

    const user = await userRow(telegramId);
    expect(user.name).toBe("Aziz Karimov");
    expect(user.phone).toBe("+998935554433");
    const [linked] = await db().select().from(leads).where(eq(leads.id, lead.id));
    expect(linked.userId).toBe(user.id);
    expect(linked.notifyVersion).toBe(2);
  });

  it("creates a bot lead when there is no matching web lead", async () => {
    const telegramId = 7_600_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);
    await message(telegramId, {
      contact: { phone_number: "998977776655", first_name: "Ali", user_id: telegramId },
    });

    const user = await userRow(telegramId);
    const rows = await db().select().from(leads).where(eq(leads.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "bot", name: "Ali Valiyev", phone: "+998977776655" });
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

  it("does not register twice when the contact is shared again", async () => {
    const telegramId = 7_400_000 + Math.floor(Math.random() * 100_000);
    await start(telegramId);
    const contact = { phone_number: "+998901234567", first_name: "Ali", user_id: telegramId };

    await message(telegramId, { contact });
    await message(telegramId, { contact });

    const user = await userRow(telegramId);
    expect(await registeredEvents(user.id)).toHaveLength(1);
  });
});
