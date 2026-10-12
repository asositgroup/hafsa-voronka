import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { events, leads, users } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { setTestEnv } from "@/test/env";
import type { LeadSender } from "./notifier";

const testDbUrl = process.env.TEST_DATABASE_URL;

function randomPhone() {
  return `+99890${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
}

function visitorId() {
  return Math.random().toString(36).slice(2, 12).padEnd(10, "x");
}

describe.skipIf(!testDbUrl)("Landing leads", () => {
  let createApp: typeof import("@/app").createApp;
  let notifier: typeof import("./notifier");
  let service: typeof import("./service");

  beforeAll(async () => {
    setTestEnv({ DATABASE_URL: testDbUrl! });
    await runMigrations(testDbUrl!);
    ({ createApp } = await import("@/app"));
    notifier = await import("./notifier");
    service = await import("./service");
  });

  afterAll(async () => {
    await closeDb();
  });

  function post(body: unknown, ip = `10.0.${Math.floor(Math.random() * 255)}.1`) {
    return createApp().request("/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip, origin: "https://example.com" },
      body: JSON.stringify(body),
    });
  }

  async function leadsFor(vid: string) {
    return db().select().from(leads).where(eq(leads.visitorId, vid));
  }

  it("stores a web lead with a normalized phone and logs lead_submitted", async () => {
    const vid = visitorId();
    const phone = randomPhone();
    const local = phone.slice(4);
    const res = await post({
      visitor_id: vid,
      name: "  Aziz Karimov ",
      phone: `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`,
      utm_source: "facebook",
      page_url: "https://example.com/?utm_source=facebook",
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.com");
    const [lead] = await leadsFor(vid);
    expect(await res.json()).toEqual({ ok: true, event_id: `lead_${lead.id}` });
    expect(lead).toMatchObject({
      source: "web",
      name: "Aziz Karimov",
      phone,
      utmSource: "facebook",
      pageUrl: "https://example.com/?utm_source=facebook",
      userId: null,
    });
    const logged = await db().select().from(events).where(eq(events.visitorId, vid));
    expect(logged.map((e) => e.type)).toEqual(["lead_submitted"]);
  });

  it("falls back to landing attribution and drops foreign page urls", async () => {
    const vid = visitorId();
    await db().insert(events).values({ type: "landing_view", visitorId: vid, meta: { utm_campaign: "autumn" } });

    await post({ visitor_id: vid, name: "Ali", phone: randomPhone(), page_url: "https://evil.test/" });

    const [lead] = await leadsFor(vid);
    expect(lead.utmCampaign).toBe("autumn");
    expect(lead.pageUrl).toBeNull();
  });

  it("returns field errors for a bad name or phone", async () => {
    const vid = visitorId();
    const badName = await post({ visitor_id: vid, name: "A", phone: "901234567" });
    expect(badName.status).toBe(422);
    expect((await badName.json()).field).toBe("name");

    const badPhone = await post({ visitor_id: vid, name: "Ali", phone: "12 345 67 89" });
    expect(badPhone.status).toBe(422);
    expect((await badPhone.json()).field).toBe("phone");
    expect(await leadsFor(vid)).toHaveLength(0);
  });

  it("silently accepts and discards honeypot submissions", async () => {
    const vid = visitorId();
    const res = await post({ visitor_id: vid, name: "Bot", phone: "901234567", website: "http://spam" });
    expect(res.status).toBe(200);
    expect(await leadsFor(vid)).toHaveLength(0);
  });

  it("updates the same lead when a visitor submits again", async () => {
    const vid = visitorId();
    const ip = "10.9.9.9";
    const secondPhone = randomPhone();
    const first = await (await post({ visitor_id: vid, name: "Ali", phone: randomPhone() }, ip)).json();
    const second = await (await post({ visitor_id: vid, name: "Ali Valiyev", phone: secondPhone }, ip)).json();

    expect(second.event_id).toBe(first.event_id);
    const rows = await leadsFor(vid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Ali Valiyev", phone: secondPhone, notifyVersion: 2 });
  });

  it("rate limits a single visitor", async () => {
    const vid = visitorId();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await post({ visitor_id: vid, name: "Ali", phone: randomPhone() })).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("matches a web lead by phone when the visitor id is lost", async () => {
    const vid = visitorId();
    const phone = randomPhone();
    await post({ visitor_id: vid, name: "Ali", phone });

    const match = await service.findMatchingWebLead("other-device", phone);
    expect(match?.visitorId).toBe(vid);
  });

  it("sends one card, edits it on registration and replies on completion", async () => {
    const vid = visitorId();
    const phone = randomPhone();
    await post({ visitor_id: vid, name: "Aziz", phone });
    const [lead] = await leadsFor(vid);

    const log: string[] = [];
    let nextId = 100;
    const sender: LeadSender = {
      async send(text, replyTo) {
        log.push(`send${replyTo ? `>${replyTo}` : ""}:${text.split("\n")[0]}`);
        return nextId++;
      },
      async edit(messageId, text) {
        log.push(`edit ${messageId}:${text.split("\n")[0]}`);
      },
    };

    await notifier.syncLeadCard(lead, null, sender);
    const [sent] = await leadsFor(vid);
    expect(sent.notifyMessageId).toBe(100);

    const telegramId = 8_000_000 + Math.floor(Math.random() * 100_000);
    const [user] = await db()
      .insert(users)
      .values({
        telegramId,
        username: "aziz",
        name: "Aziz",
        phone,
        phoneVerified: true,
        visitorId: vid,
        registeredAt: new Date(),
      })
      .returning();
    await service.attachLeadToUser(user);
    const [linked] = await leadsFor(vid);
    await notifier.syncLeadCard(linked, user, sender);

    const completedAt = new Date();
    await db().update(users).set({ completedAt }).where(eq(users.id, user.id));
    await service.markLeadCompleted(user.id);
    const [done] = await leadsFor(vid);
    await notifier.syncLeadCard(done, { ...user, completedAt }, sender);
    const [after] = await leadsFor(vid);
    await notifier.syncLeadCard(after, { ...user, completedAt }, sender);

    expect(log).toEqual([
      "send:🆕 Yangi lid (sayt)",
      "edit 100:✅ Lid botda ro'yxatdan o'tdi",
      "edit 100:✅ Lid botda ro'yxatdan o'tdi",
      "send>100:🎬 Aziz videoni oxirigacha ko'rdi",
      "edit 100:✅ Lid botda ro'yxatdan o'tdi",
    ]);
    expect(after.completionNotified).toBe(true);
    expect(after.notifyVersion).toBe(3);
  });

  it("flushes pending cards, marks them sent, and records failures for retry", async () => {
    const good = visitorId();
    const bad = visitorId();
    await post({ visitor_id: good, name: "Good", phone: randomPhone() });
    await post({ visitor_id: bad, name: "Bad", phone: randomPhone() });

    const sender: LeadSender = {
      async send(text) {
        if (text.includes("Bad")) throw new Error("chat not found");
        return 1;
      },
      async edit() {},
    };
    await notifier.flushLeadNotifications(sender);

    const [goodLead] = await leadsFor(good);
    const [badLead] = await leadsFor(bad);
    expect(goodLead.notifiedVersion).toBe(goodLead.notifyVersion);
    expect(badLead.notifiedVersion).toBe(0);
    expect(badLead.notifyAttempts).toBe(1);
    expect(badLead.notifyError).toBe("chat not found");
  });
});
