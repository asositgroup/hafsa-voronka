import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { FunnelStatus, TemplateButton } from "@funnel/shared";
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
  watchAppointments,
  watchProgress,
} from "@/db/schema";
import { isolatedDatabase } from "@/test/isolatedDb";
import { setTestEnv } from "@/test/env";
import { ensureActiveTestVideo } from "@/test/videos";

const isolatedDb = isolatedDatabase("vf_appointments");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const noPrice: FunnelStatus[] = ["korishni_boshladi", "dars_yarmida", "sotuvda_toxtadi"];
const offerButtons: TemplateButton[] = [
  { kind: "again", text: "Ha, ko'raman" },
  { kind: "later", text: "Keyinroq, ko'raman" },
];

type ApiCall = { method: string; payload: Record<string, unknown> };
type Keyboard = { text: string; callback_data?: string; web_app?: { url: string } }[][];

describe.skipIf(!isolatedDb.url)("«Keyinroq» time picker and appointments", () => {
  let testBot: Bot;
  let dispatchMessages: typeof import("@/messages/dispatch").dispatchMessages;
  let syncSegment: typeof import("@/funnel/segments").syncSegment;
  let acceptSecondChance: typeof import("@/links/service").acceptSecondChance;
  let markWroteAdmin: typeof import("@/funnel/channel").markWroteAdmin;
  let markBlocked: typeof import("@/telegram/blocked").markBlocked;
  let messageSeq = 1000;
  let telegramSeq = 90_000;
  let updateId = 1;
  let testIndex = 0;
  let entry = new Date();
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    await isolatedDb.create();
    setTestEnv({ DATABASE_URL: isolatedDb.url!, SESSION_SECRET: "appointments-session-secret-0123456789" });
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
    ({ acceptSecondChance } = await import("@/links/service"));
    ({ markWroteAdmin } = await import("@/funnel/channel"));
    ({ markBlocked } = await import("@/telegram/blocked"));
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
  const deletes = () => calls.filter((call) => call.method === "deleteMessage");
  const keyboardOf = (call: ApiCall | undefined) =>
    (call?.payload.reply_markup as { inline_keyboard: Keyboard } | undefined)?.inline_keyboard ?? [];
  const lastKeyboard = () => keyboardOf(sends().at(-1));

  async function linkedUser(options: { givenAt?: Date; expiresAt: Date; maxPosition?: number }) {
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

  const runsOf = (userId: number) =>
    db().select().from(segmentRuns).where(eq(segmentRuns.userId, userId)).orderBy(asc(segmentRuns.id));
  const offersOf = (userId: number) =>
    db().select().from(secondChanceOffers).where(eq(secondChanceOffers.userId, userId)).orderBy(asc(secondChanceOffers.occasion));
  const grantsOf = (userId: number) =>
    db().select().from(linkGrants).where(eq(linkGrants.userId, userId)).orderBy(asc(linkGrants.attempt));
  const appointmentsOf = (userId: number) =>
    db().select().from(watchAppointments).where(eq(watchAppointments.userId, userId)).orderBy(asc(watchAppointments.id));

  function tap(telegramId: number, data: string, now: Date) {
    vi.setSystemTime(now);
    return testBot.handleUpdate({
      update_id: updateId++,
      callback_query: {
        id: String(updateId),
        from: { id: telegramId, is_bot: false, first_name: "Ali" },
        chat_instance: "ci",
        data,
        message: {
          message_id: 800,
          date: Math.floor(now.getTime() / 1000),
          chat: { id: telegramId, type: "private", first_name: "Ali" },
        },
      },
    } as never);
  }

  async function firstAfsus(user: { id: number; telegramId: number }) {
    await tick(at(24 * 60));
    const [offer] = await offersOf(user.id);
    return offer;
  }

  it("asks when with the three TZ slots and a different-time button", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, at(24 * 60));

    expect(sentTexts().at(-1)).toContain("Qachon ko'rishingiz qulay?");
    expect(lastKeyboard().map((row) => [row[0].text, row[0].callback_data])).toEqual([
      ["🌙 Bugun kechqurun (20:00)", "lt:q:t"],
      ["🌅 Ertaga ertalab (08:00)", "lt:q:m"],
      ["🌙 Ertaga kechqurun (20:00)", "lt:q:e"],
      ["🕐 Boshqa vaqt", "lt:o"],
    ]);
    const [answered] = await offersOf(user.id);
    expect(answered.answer).toBe("later");
  });

  it("hides slots in the past", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, at(11 * 60, at(24 * 60)));
    expect(lastKeyboard().map((row) => row[0].callback_data)).toEqual(["lt:q:m", "lt:q:e", "lt:o"]);
  });

  it("walks day then hour menus, hiding past hours, and stores the chosen time", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);

    await tap(user.telegramId, "lt:o", expiry);
    expect(sentTexts().at(-1)).toContain("Qaysi kuni");
    expect(lastKeyboard().flat().map((button) => [button.text, button.callback_data])).toEqual([
      ["Bugun", "lt:d:0"],
      ["Ertaga", "lt:d:1"],
      ["Indinga", "lt:d:2"],
    ]);

    await tap(user.telegramId, "lt:d:0", expiry);
    const todayHours = lastKeyboard().flat().map((button) => button.text);
    expect(todayHours).toEqual(Array.from({ length: 12 }, (_, index) => `${String(11 + index).padStart(2, "0")}:00`));

    await tap(user.telegramId, "lt:d:2", expiry);
    const dayAfter = lastKeyboard().flat().map((button) => button.text);
    expect(dayAfter[0]).toBe("07:00");
    expect(dayAfter.at(-1)).toBe("22:00");
    expect(dayAfter).toHaveLength(16);

    await tap(user.telegramId, "lt:h:2:9", expiry);
    expect(sentTexts().at(-1)).toBe("Zo'r! 🙌 Indinga 09:00 — darsingizni ochib, eslatib qo'yaman ✅");
    const [appointment] = await appointmentsOf(user.id);
    expect(appointment).toMatchObject({
      purpose: "reopen",
      offerId: offer.id,
      chosenAt: at(47 * 60, expiry),
      preRemindAt: at(46 * 60, expiry),
      firedAt: null,
      cancelledAt: null,
    });
    expect((await db().select().from(events).where(eq(events.type, "later_scheduled"))).length).toBe(1);
  });

  it("reminds an hour before, reopens at the chosen time and restarts the chain", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await template({ text: "A1" });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await tap(user.telegramId, "lt:q:m", expiry);

    const chosen = at(22 * 60, expiry);
    const [pending] = await appointmentsOf(user.id);
    expect(pending.chosenAt).toEqual(chosen);

    calls.length = 0;
    await tick(at(20 * 60, expiry));
    expect(sends()).toHaveLength(0);

    await tick(at(-60, chosen));
    expect(sentTexts()).toEqual(["1 soatdan keyin bonus darsingiz ochiladi, choy tayyorlab qo'ying 🙂"]);
    expect(deletes()).toHaveLength(1);
    const [afterPre] = await appointmentsOf(user.id);
    expect(afterPre.preSentMessageId).not.toBeNull();
    const [preRow] = await db().select().from(sentMessages).where(eq(sentMessages.id, afterPre.preSentMessageId!));
    expect(preRow).toMatchObject({ botTextKey: "reopenPreReminder", templateId: null });

    await tick(at(-50, chosen));
    expect(sends()).toHaveLength(1);

    calls.length = 0;
    await tick(chosen);
    expect(sentTexts()).toEqual(["Bonus darsingiz yana ochildi! 🎁\n\nLink 24 soat amal qiladi. Tayyor bo'lsangiz, boshlang 👇"]);
    expect(lastKeyboard()[0][0]).toMatchObject({ text: "▶️ Darsni boshlash" });
    expect(lastKeyboard()[0][0].web_app?.url).toMatch(/\/app\?m=\d+$/);
    expect(deletes()).toHaveLength(1);

    const grants = await grantsOf(user.id);
    expect(grants.map((grant) => [grant.attempt, grant.kind])).toEqual([
      [1, "initial"],
      [2, "scheduled"],
    ]);
    expect(grants[1].expiresAt).toEqual(at(24 * 60, chosen));
    const [fresh] = await db().select().from(users).where(eq(users.id, user.id));
    expect(fresh.linkId).toBe(grants[1].id);
    expect((await runsOf(user.id)).map((run) => [run.segment, run.endReason, run.attempt])).toEqual([
      ["A", "expired", 1],
      ["D", "relinked", 1],
      ["A", null, 2],
    ]);
    const [fired] = await appointmentsOf(user.id);
    expect(fired.firedAt).toEqual(chosen);
    expect(fired.firedMessageId).not.toBeNull();
    expect((await offersOf(user.id))[0]).toMatchObject({ answer: "later", grantedLinkId: grants[1].id });

    calls.length = 0;
    await tick(at(61, chosen));
    expect(sentTexts()).toEqual(["A1"]);
    await tick(at(62, chosen));
    expect(sends()).toHaveLength(1);
    expect((await db().select().from(events).where(eq(events.type, "later_reopened"))).length).toBe(1);
  });

  it("does not send the next «afsus» while an appointment is pending", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    await afsus(2, "Afsus 2");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await tap(user.telegramId, "lt:q:e", expiry);

    calls.length = 0;
    await tick(at(24 * 60, expiry));
    await tick(at(30 * 60, expiry));
    expect(sentTexts()).toEqual([]);
    expect(await offersOf(user.id)).toHaveLength(1);
    expect((await runsOf(user.id)).at(-1)).toMatchObject({ segment: "D", endedAt: null });
  });

  it("continues the daily «afsus» cadence when the reopened link is ignored too", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    await afsus(2, "Afsus 2");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await tap(user.telegramId, "lt:q:m", expiry);
    const chosen = at(22 * 60, expiry);
    await tick(chosen);
    const [, reopened] = await grantsOf(user.id);

    calls.length = 0;
    await tick(at(-1, reopened.expiresAt!));
    expect(sentTexts()).toEqual([]);
    await tick(reopened.expiresAt!);
    expect(sentTexts()).toEqual(["Afsus 2"]);
    expect((await offersOf(user.id)).map((row) => [row.occasion, row.expiredLinkId])).toEqual([
      [1, user.linkId],
      [2, reopened.id],
    ]);
  });

  it("overwrites the pending appointment when the user picks again", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await tap(user.telegramId, "lt:q:t", expiry);
    await tap(user.telegramId, "lt:q:m", at(HOUR / MINUTE, expiry));

    const appointments = await appointmentsOf(user.id);
    expect(appointments).toHaveLength(2);
    expect(appointments[0].cancelledAt).not.toBeNull();
    expect(appointments[1]).toMatchObject({ chosenAt: at(22 * 60, expiry), cancelledAt: null, firedAt: null });

    calls.length = 0;
    await tick(at(10 * 60, expiry));
    expect(sends()).toHaveLength(0);
  });

  it("cancels the appointment when «Ha» reopens the lesson now", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await tap(user.telegramId, "lt:q:e", expiry);

    expect(await acceptSecondChance(user.id, at(60, expiry))).toBe("granted");
    const [appointment] = await appointmentsOf(user.id);
    expect(appointment.cancelledAt).not.toBeNull();

    calls.length = 0;
    await tick(at(34 * 60, expiry));
    await tick(at(35 * 60, expiry));
    expect(sentTexts().filter((text) => String(text).includes("yana ochildi"))).toEqual([]);
    expect(await grantsOf(user.id)).toHaveLength(2);
  });

  it("cancels the appointment when the user writes to admin or blocks the bot", async () => {
    const writer = await linkedUser({ expiresAt: at(24 * 60) });
    const blocker = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    await tick(at(24 * 60));
    const expiry = at(24 * 60);
    for (const user of [writer, blocker]) {
      const [offer] = await offersOf(user.id);
      await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
      await tap(user.telegramId, "lt:q:e", expiry);
      expect((await appointmentsOf(user.id))[0].cancelledAt).toBeNull();
    }

    await markWroteAdmin(writer.id, null, at(60, expiry));
    await markBlocked(blocker.id);
    expect((await appointmentsOf(writer.id))[0].cancelledAt).not.toBeNull();
    expect((await appointmentsOf(blocker.id))[0].cancelledAt).not.toBeNull();

    calls.length = 0;
    await tick(at(10 * 60, expiry));
    await tick(at(12 * 60, expiry));
    expect(sends()).toHaveLength(0);
    expect(await grantsOf(writer.id)).toHaveLength(1);
    expect(await grantsOf(blocker.id)).toHaveLength(1);
  });

  it("answers an old button with the editable «closed» text", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await markWroteAdmin(user.id, null, at(60, expiry));

    await tap(user.telegramId, "lt:q:m", at(61, expiry));
    expect(sentTexts().at(-1)).toBe("Bu tugma eskirgan 🙂 Darsga qaytish uchun /start bosing.");
    expect(await appointmentsOf(user.id)).toHaveLength(0);
  });

  it("skips the pre-reminder when the chosen time is within the hour", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await tap(user.telegramId, "lt:h:0:11", expiry);

    const [appointment] = await appointmentsOf(user.id);
    expect(appointment).toMatchObject({ chosenAt: at(60, expiry), preRemindAt: null });
    calls.length = 0;
    await tick(at(30, expiry));
    expect(sends()).toHaveLength(0);
    await tick(at(60, expiry));
    expect(sentTexts()).toEqual([expect.stringContaining("Bonus darsingiz yana ochildi")]);
  });

  it("skips the pre-reminder when it would fall at night", async () => {
    const user = await linkedUser({ expiresAt: at(24 * 60) });
    await afsus(1, "Afsus 1");
    const offer = await firstAfsus(user);
    const expiry = at(24 * 60);
    await tap(user.telegramId, `mt:l:s${offer.sentMessageId}`, expiry);
    await tap(user.telegramId, "lt:h:1:6", expiry);
    expect(await appointmentsOf(user.id)).toHaveLength(0);
    await tap(user.telegramId, "lt:h:1:7", expiry);
    const [appointment] = await appointmentsOf(user.id);
    expect(appointment).toMatchObject({ chosenAt: at(21 * 60, expiry), preRemindAt: null });
    await tap(user.telegramId, "lt:h:1:7", expiry);
    expect((await appointmentsOf(user.id)).filter((row) => row.cancelledAt === null)).toHaveLength(1);
  });

  describe("while the link is still live", () => {
    async function liveUserWithReminder(expiresAt: Date) {
      const user = await linkedUser({ expiresAt });
      await template({ text: "A1", buttons: [{ kind: "later", text: "Keyinroq" }] });
      await tick(at(61));
      const [row] = await db().select().from(sentMessages).where(eq(sentMessages.userId, user.id));
      return { user, sentId: row.id };
    }

    it("reminds at the chosen time without granting a new link", async () => {
      const { user, sentId } = await liveUserWithReminder(at(24 * 60));
      await tap(user.telegramId, `mt:l:s${sentId}`, at(2 * 60));
      expect(lastKeyboard().map((row) => row[0].callback_data)).toEqual(["lt:q:t", "lt:q:m", "lt:o"]);
      await tap(user.telegramId, "lt:q:t", at(2 * 60));

      const [appointment] = await appointmentsOf(user.id);
      expect(appointment).toMatchObject({ purpose: "remind", offerId: null, preRemindAt: null, chosenAt: at(10 * 60) });

      calls.length = 0;
      await tick(at(10 * 60));
      expect(sentTexts()).toEqual(["Eslatib qo'ydim, dars sizni kutmoqda! ⏰\n\nTayyor bo'lsangiz, davom eting 👇"]);
      expect(lastKeyboard()[0][0]).toMatchObject({ text: "▶️ Darsni davom ettirish" });
      expect(await grantsOf(user.id)).toHaveLength(1);
      expect((await runsOf(user.id)).map((run) => [run.segment, run.attempt])).toEqual([["A", 1]]);
      expect((await appointmentsOf(user.id))[0].firedAt).toEqual(at(10 * 60));
    });

    it("drops the reminder when the user watched in the meantime", async () => {
      const { user, sentId } = await liveUserWithReminder(at(24 * 60));
      await tap(user.telegramId, `mt:l:s${sentId}`, at(2 * 60));
      await tap(user.telegramId, "lt:q:t", at(2 * 60));
      await db()
        .insert(watchProgress)
        .values({ userId: user.id, maxPosition: 30, lastPosition: 30, startedAt: at(3 * 60), lastBeatAt: at(3 * 60) });

      calls.length = 0;
      await tick(at(10 * 60));
      expect(sends()).toHaveLength(0);
      expect((await appointmentsOf(user.id))[0]).toMatchObject({ firedAt: null });
      expect((await appointmentsOf(user.id))[0].cancelledAt).not.toBeNull();
    });

    it("tells people there is no time left when the link ends too soon", async () => {
      const { user, sentId } = await liveUserWithReminder(at(12 * 60));
      await tap(user.telegramId, `mt:l:s${sentId}`, at(11 * 60 + 30));
      expect(sentTexts().at(-1)).toContain("bundan keyin qulay vaqt qolmadi");
      expect(lastKeyboard()[0][0].web_app?.url).toMatch(/\/app$/);
      expect(await appointmentsOf(user.id)).toHaveLength(0);
    });
  });
});
